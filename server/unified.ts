import express from 'express'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import db, { supabase } from './db.js'
import { calculateRank } from './rankSystem.js'
import { cryptoPriceFetcher } from './cryptoPrice.js'
// import { mintAchievementNFT } from './nftMinter.js' // DISABLED - Achievements coming soon
import dotenv from 'dotenv'
import { createCanvas, loadImage } from 'canvas'
import crypto from 'crypto'

// Load environment variables
dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load admin FIDs from environment variable
const ADMIN_FIDS = process.env.ADMIN_FIDS?.split(',').map(fid => parseInt(fid.trim())).filter(fid => !isNaN(fid)) || []
console.log('🔐 Admin FIDs loaded:', ADMIN_FIDS)

// Share images directory
const SHARES_DIR = path.join(__dirname, '..', 'public', 'shares')

// Create shares directory if it doesn't exist
if (!fs.existsSync(SHARES_DIR)) {
  fs.mkdirSync(SHARES_DIR, { recursive: true })
  console.log('📁 Created shares directory:', SHARES_DIR)
}

// Generate hash for share image (deterministic based on trade data)
function generateImageHash(token: string, leverage: string, profit: string, profitPercent: string): string {
  const data = `${token}-${leverage}-${profit}-${profitPercent}`
  return crypto.createHash('md5').update(data).digest('hex')
}

// Clean up old share images (delete files older than 1 hour)
function cleanupShareImages() {
  const now = Date.now()
  const maxAge = 60 * 60 * 1000 // 1 hour
  let deletedCount = 0

  try {
    const files = fs.readdirSync(SHARES_DIR)

    for (const file of files) {
      if (!file.endsWith('.png')) continue

      const filePath = path.join(SHARES_DIR, file)
      const stats = fs.statSync(filePath)
      const age = now - stats.mtimeMs

      if (age > maxAge) {
        fs.unlinkSync(filePath)
        deletedCount++
      }
    }

    if (deletedCount > 0) {
      console.log(`🗑️ Cleaned up ${deletedCount} old share images`)
    }
  } catch (error) {
    console.error('Error cleaning up share images:', error)
  }
}

// Run cleanup every minute
setInterval(cleanupShareImages, 60 * 1000)

const app = express()
const server = createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

// CORS - allow requests from Vercel frontend and Farcaster
const isDev = process.env.NODE_ENV !== 'production'
const allowedOrigins = [
  'https://basetraders.vercel.app',
  'https://warpcast.com',
  'http://localhost:5173', // Local development
  'http://localhost:3000'  // Local development
]

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true)

    // Allow all origins in development
    if (isDev) return callback(null, true)

    // In production, check against allowed origins
    if (allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true
}))

// IMPORTANT: Serve local .well-known/farcaster.json BEFORE any other middleware
app.get('/.well-known/farcaster.json', (req, res) => {
  console.log('🎯 Serving local .well-known/farcaster.json')
  console.log('📂 __dirname:', __dirname)
  console.log('📂 process.cwd():', process.cwd())

  // Try multiple possible paths for the file
  const possiblePaths = [
    // Standard path from server directory
    path.resolve(__dirname, '..', 'public', '.well-known', 'farcaster.json'),
    // Path if running from dist directory
    path.resolve(__dirname, '..', '..', 'public', '.well-known', 'farcaster.json'),
    // Path from process.cwd()
    path.resolve(process.cwd(), 'public', '.well-known', 'farcaster.json'),
    // Path if in based-traders/based-traders structure
    path.resolve(process.cwd(), 'based-traders', 'public', '.well-known', 'farcaster.json')
  ]

  console.log('🔍 Checking possible paths:', possiblePaths)

  let filePath: string | null = null
  for (const testPath of possiblePaths) {
    console.log('  Testing:', testPath, '- exists:', fs.existsSync(testPath))
    if (fs.existsSync(testPath)) {
      filePath = testPath
      console.log('  ✅ Found at:', filePath)
      break
    }
  }

  if (!filePath) {
    console.error('❌ File not found in any of the possible paths')
    return res.status(404).json({
      error: 'File not found',
      possiblePaths,
      __dirname,
      cwd: process.cwd()
    })
  }

  console.log('✅ Using file path:', filePath)

  // Read and send file content directly
  try {
    const fileContent = fs.readFileSync(filePath, 'utf-8')
    const jsonContent = JSON.parse(fileContent) // Validate JSON

    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')

    res.json(jsonContent)
    console.log('✅ File served successfully')
  } catch (error: any) {
    console.error('❌ Error reading/parsing file:', error)
    res.status(500).json({
      error: 'Error serving file',
      details: error.message,
      filePath
    })
  }
})

app.use(express.json())

// Serve static share images from public/shares
app.use('/shares', express.static(SHARES_DIR, {
  maxAge: '1h',
  setHeaders: (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Cache-Control', 'public, max-age=3600')
  }
}))

// Serve Farcaster Manifest with no-cache headers
app.get('/farcaster.json', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
  const filePath = path.resolve(__dirname, '..', 'public', 'farcaster.json')
  res.sendFile(filePath)
})

// Global Price Engine (Server-side) - Updated to handle all tokens
class GlobalPriceEngine {
  private tokenPrices: Map<number, number> = new Map()
  private volatility: number = 0.004
  private trend: number = 0
  private trendChangeCounter: number = 0
  private consecutiveBullish: number = 0
  private consecutiveBearish: number = 0
  private smallMoveProbability: number = 0.03
  private mediumMoveProbability: number = 0.008
  private bigMoveProbability: number = 0.0005
  private crashProbability: number = 0.0008
  private pumpProbability: number = 0.0008
  private intervalId: NodeJS.Timeout | null = null
  private startTime: number = Date.now()

  private minPrice: number = 50
  private maxPrice: number = 600
  private absoluteMinPrice: number = 40
  private absoluteMaxPrice: number = 700

  constructor() {
    this.trend = -0.0002
    this.initTokens()
  }

  private async initTokens() {
    // Initialize prices for all active tokens
    const { data: tokens, error } = await supabase
      .from('tokens')
      .select('id, current_price')
      .eq('is_active', 1)

    if (!error && tokens) {
      tokens.forEach(token => {
        this.tokenPrices.set(token.id, token.current_price)
      })
    }
  }

  start() {
    if (this.intervalId) return

    this.intervalId = setInterval(() => {
      this.updateAllPrices()
    }, 1000)
  }

  private async updateAllPrices() {
    const elapsedMinutes = (Date.now() - this.startTime) / 1000 / 60

    // Get all active tokens
    const { data: tokens, error } = await supabase
      .from('tokens')
      .select('id, current_price, symbol, is_real_crypto')
      .eq('is_active', 1)

    if (error || !tokens) {
      console.error('Error fetching tokens for price update:', error)
      return
    }

    // Use for...of instead of forEach to properly handle async/await
    for (const token of tokens) {
      let price = this.tokenPrices.get(token.id) || token.current_price

      // For real crypto tokens, use real prices from Binance (SKIP simulation!)
      if (token.is_real_crypto === 1 || token.is_real_crypto === true) {
        const realPrice = cryptoPriceFetcher.getPrice(token.symbol)
        if (realPrice > 0) {
          // Only update if price changed (avoid unnecessary DB writes)
          const oldPrice = this.tokenPrices.get(token.id)
          if (oldPrice !== realPrice) {
            price = realPrice
          } else {
            // Price hasn't changed, skip this token
            continue
          }
        } else {
          // Binance price not available yet, skip this update cycle
          continue
        }
        // IMPORTANT: DO NOT run game simulation for real crypto!
      } else {
        // For game tokens (like BATR), use simulated price movements
        // Update trend periodically
        this.trendChangeCounter++
        if (this.trendChangeCounter > 60 + Math.random() * 120) {
          const randomTrend = (Math.random() - 0.5) * 0.0002
          this.trend = randomTrend
          this.trendChangeCounter = 0
        }

        const crashChance = elapsedMinutes < 5 ? this.crashProbability * 0.3 : this.crashProbability
        const pumpChance = elapsedMinutes > 10 ? this.pumpProbability * 1.5 : this.pumpProbability

        if (Math.random() < crashChance) {
          const dropPercent = 0.02 + Math.random() * 0.03
          price = price * (1 - dropPercent)
        } else if (Math.random() < pumpChance) {
          const risePercent = 0.02 + Math.random() * 0.03
          price = price * (1 + risePercent)
        } else if (Math.random() < this.smallMoveProbability) {
          const amount = (price * 0.001) + Math.random() * (price * 0.003)
          const direction = Math.random() > 0.5 ? 1 : -1
          price = price + (amount * direction)
        } else {
          const randomComponent = (Math.random() - 0.5) * 2 * this.volatility
          const change = this.trend + randomComponent
          price = price * (1 + change)
        }

        // Ensure price doesn't go below 1
        price = Math.max(1, price)
      }

      // Update token price in memory first
      this.tokenPrices.set(token.id, price)

      // Update database (no await - fire and forget for performance)
      supabase
        .from('tokens')
        .update({ current_price: price })
        .eq('id', token.id)
        .then(() => {})
        .catch((err) => console.error('Error updating token price:', err))

      // Save to price history (no await - fire and forget for performance)
      this.savePriceForToken(token.id, price)
        .catch((err) => console.error('Error saving price history:', err))
    }

    // Broadcast prices from memory (not database) for immediate sync
    this.broadcastPrice()
  }

  private async savePriceForToken(tokenId: number, price: number) {
    // Insert price history
    await supabase
      .from('price_history')
      .insert({
        token_id: tokenId,
        price,
        timestamp: Date.now()
      })

    // Keep only last 300 records per token
    const { count, error: countError } = await supabase
      .from('price_history')
      .select('*', { count: 'exact', head: true })
      .eq('token_id', tokenId)

    if (!countError && count && count > 300) {
      // Get IDs of records to keep
      const { data: recordsToKeep, error: selectError } = await supabase
        .from('price_history')
        .select('id')
        .eq('token_id', tokenId)
        .order('timestamp', { ascending: false })
        .limit(300)

      if (!selectError && recordsToKeep) {
        const idsToKeep = recordsToKeep.map(r => r.id)

        // Delete old records
        await supabase
          .from('price_history')
          .delete()
          .eq('token_id', tokenId)
          .not('id', 'in', `(${idsToKeep.join(',')})`)
      }
    }
  }

  private async broadcastPrice() {
    // Broadcast all token prices from memory (faster and more up-to-date than database)
    const { data: tokens, error } = await supabase
      .from('tokens')
      .select('id, symbol')
      .eq('is_active', 1)

    if (error || !tokens) return

    const prices: Record<string, number> = {}
    tokens.forEach(t => {
      // Get price from memory (tokenPrices Map) - this is already updated with real-time data
      const price = this.tokenPrices.get(t.id)
      if (price !== undefined) {
        prices[t.symbol] = price
      }
    })

    wss.clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(JSON.stringify({
          prices,
          timestamp: Date.now()
        }))
      }
    })
  }

  async getCurrentPrice(tokenSymbol: string = 'BATR') {
    const { data: token, error } = await supabase
      .from('tokens')
      .select('current_price')
      .eq('symbol', tokenSymbol)
      .single()

    return token?.current_price || 100
  }

  async getPriceHistory(tokenSymbol: string = 'BATR', limit: number = 120) {
    const { data: token, error: tokenError } = await supabase
      .from('tokens')
      .select('id')
      .eq('symbol', tokenSymbol)
      .single()

    if (tokenError || !token) return []

    const { data: rows, error: historyError } = await supabase
      .from('price_history')
      .select('price')
      .eq('token_id', token.id)
      .order('timestamp', { ascending: false })
      .limit(limit)

    if (historyError || !rows) return []

    return rows.reverse().map(r => r.price)
  }

  async reloadTokens() {
    // Reload all active tokens into memory
    const { data: tokens, error } = await supabase
      .from('tokens')
      .select('id, current_price')
      .eq('is_active', 1)

    if (!error && tokens) {
      tokens.forEach(token => {
        if (!this.tokenPrices.has(token.id)) {
          this.tokenPrices.set(token.id, token.current_price)
        }
      })
    }
  }
}

const priceEngine = new GlobalPriceEngine()

// Start crypto price fetcher for real prices FIRST (async IIFE to avoid top-level await)
;(async () => {
  cryptoPriceFetcher.setDatabase(db)
  await cryptoPriceFetcher.start()
  console.log('✅ Crypto price fetcher initialized')

  // Force initial sync of real crypto prices from Binance to database
  console.log('🔄 Syncing real crypto prices from Binance...')
  const { data: tokens, error } = await supabase
    .from('tokens')
    .select('id, symbol')
    .eq('is_real_crypto', 1)
    .eq('is_active', 1)

  if (!error && tokens) {
    for (const token of tokens) {
      const realPrice = cryptoPriceFetcher.getPrice(token.symbol)
      if (realPrice > 0) {
        await supabase
          .from('tokens')
          .update({ current_price: realPrice })
          .eq('id', token.id)
        console.log(`  ✅ ${token.symbol}: $${realPrice}`)
      }
    }
  }

  // Then start price engine (will use real prices from Binance)
  priceEngine.start()
  console.log('✅ Price engine started')
})()

// API Routes
app.get('/api/price', async (req, res) => {
  try {
    const tokenSymbol = (req.query.symbol as string) || 'BATR'

    // Get token from database
    const { data: token, error } = await supabase
      .from('tokens')
      .select('*')
      .eq('symbol', tokenSymbol)
      .single()

    if (error || !token) {
      return res.status(404).json({ error: 'Token not found' })
    }

    const history = await priceEngine.getPriceHistory(tokenSymbol, 120)

    res.json({
      price: token.current_price,
      history,
      timestamp: Date.now()
    })
  } catch (error: any) {
    console.error('Error fetching price:', error)
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/player/:fid', async (req, res) => {
  try {
    const fid = parseInt(req.params.fid)
    console.log('📥 Fetching player with FID:', fid)

    const { data: player, error } = await supabase
      .from('players')
      .select('*')
      .eq('farcaster_fid', fid)
      .single()

    if (error) {
      console.log('⚠️ Player not found or error:', error.message)
      return res.json(null)
    }

    if (!player) {
      console.log('⚠️ No player data returned')
      return res.json(null)
    }

    console.log('✅ Player found - Cash:', player.cash)
    res.json(player)
  } catch (error: any) {
    console.error('❌ Error fetching player:', error)
    res.json(null)
  }
})

app.post('/api/player/create', async (req, res) => {
  try {
    const { username, fid, displayName, pfpUrl } = req.body
    const parsedFid = parseInt(fid)
    console.log('👤 [API] Player create/update request - FID:', parsedFid, 'Username:', username)

    // Check if player exists
    const { data: existing, error: findError } = await supabase
      .from('players')
      .select('*')
      .eq('farcaster_fid', parsedFid)
      .single()

    if (existing && !findError) {
      console.log('✅ [API] Player exists - Updating profile data. Current cash:', existing.cash)
      // Update existing player
      const { error: updateError } = await supabase
        .from('players')
        .update({
          farcaster_username: username,
          display_name: displayName,
          pfp_url: pfpUrl,
          updated_at: Date.now()
        })
        .eq('farcaster_fid', parsedFid)

      if (updateError) {
        console.error('❌ [API] Error updating player:', updateError)
        throw updateError
      }
      console.log('✅ [API] Player updated successfully - Cash preserved:', existing.cash)
      return res.json(existing)
    }

    console.log('🆕 [API] Creating new player with initial cash: 250')
    // Create new player
    const { data: newPlayer, error: insertError } = await supabase
      .from('players')
      .insert({
        farcaster_fid: parsedFid,
        farcaster_username: username,
        display_name: displayName,
        pfp_url: pfpUrl,
        cash: 250,
        high_score: 250,
        created_at: Date.now(),
        updated_at: Date.now()
      })
      .select()
      .single()

    if (insertError) {
      console.error('❌ [API] Error creating player:', insertError)
      throw insertError
    }
    console.log('✅ [API] New player created successfully - FID:', parsedFid)
    res.json(newPlayer)
  } catch (error: any) {
    console.error('❌ [API] Error in player create/update:', error)
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/player/:fid/update', async (req, res) => {
  try {
    const fid = parseInt(req.params.fid)
    const { cash, high_score } = req.body
    const parsedCash = parseFloat(cash)
    const parsedHighScore = parseFloat(high_score)

    console.log('💾 Updating player FID:', fid, '- Cash:', parsedCash, '- High Score:', parsedHighScore)

    const { error } = await supabase
      .from('players')
      .update({
        cash: parsedCash,
        high_score: parsedHighScore,
        updated_at: Date.now()
      })
      .eq('farcaster_fid', fid)

    if (error) {
      console.error('❌ Error updating player:', error)
      throw error
    }

    console.log('✅ Player updated successfully')
    res.json({ success: true })
  } catch (error: any) {
    console.error('❌ Error updating player:', error)
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/position/open', async (req, res) => {
  try {
    const { id, player_fid, token_symbol, type, entry_price, leverage, size, collateral } = req.body
    const parsedFid = parseInt(player_fid)
    const parsedLeverage = parseInt(leverage)
    const parsedEntryPrice = parseFloat(entry_price)
    const parsedSize = parseFloat(size)
    const parsedCollateral = parseFloat(collateral)

    console.log('📈 [API] Position open request:', {
      id,
      player_fid: parsedFid,
      token_symbol,
      type,
      entry_price: parsedEntryPrice,
      leverage: parsedLeverage,
      size: parsedSize,
      collateral: parsedCollateral
    })

    // Get token_id from symbol
    const { data: token, error: tokenError } = await supabase
      .from('tokens')
      .select('id')
      .eq('symbol', token_symbol || 'BATR')
      .single()

    if (tokenError || !token) {
      console.error('❌ [API] Token not found:', token_symbol, tokenError)
      return res.status(400).json({ error: 'Invalid token' })
    }

    console.log('✅ [API] Token found - ID:', token.id, 'Symbol:', token_symbol)

    const positionData = {
      id,
      player_fid: parsedFid,
      token_id: token.id,
      type,
      entry_price: parsedEntryPrice,
      leverage: parsedLeverage,
      size: parsedSize,
      collateral: parsedCollateral,
      opened_at: Date.now()
    }

    console.log('💾 [API] Inserting position into Supabase:', positionData)

    const { data: insertedData, error: insertError } = await supabase
      .from('positions')
      .insert(positionData)
      .select()

    if (insertError) {
      console.error('❌ [API] Error inserting position:', insertError)
      console.error('❌ [API] Insert error details:', JSON.stringify(insertError, null, 2))
      console.error('❌ [API] Position data that failed:', JSON.stringify(positionData, null, 2))
      return res.status(500).json({
        success: false,
        error: insertError.message,
        details: insertError,
        data: positionData
      })
    }

    console.log('✅ [API] Position saved successfully to Supabase!', insertedData)
    res.json({ success: true, data: insertedData })
  } catch (error: any) {
    console.error('❌ [API] Fatal error in position/open:', error)
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/position/close', async (req, res) => {
  try {
    const { id, close_price, pnl, is_liquidated } = req.body
    const parsedClosePrice = parseFloat(close_price)
    const parsedPnl = parseFloat(pnl)

    const { error } = await supabase
      .from('positions')
      .update({
        closed_at: Date.now(),
        close_price: parsedClosePrice,
        pnl: parsedPnl,
        is_liquidated: is_liquidated ? true : false
      })
      .eq('id', id)

    if (error) throw error
    res.json({ success: true })
  } catch (error: any) {
    console.error('Error closing position:', error)
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/positions/:fid', async (req, res) => {
  try {
    const fid = parseInt(req.params.fid)

    const { data: positions, error } = await supabase
      .from('positions')
      .select('*')
      .eq('player_fid', fid)
      .order('opened_at', { ascending: false })

    if (error) throw error
    res.json(positions || [])
  } catch (error: any) {
    console.error('Error fetching positions:', error)
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/positions/:fid/open', async (req, res) => {
  try {
    const fid = parseInt(req.params.fid)

    // Get positions from Supabase
    const { data: positions, error: posError } = await supabase
      .from('positions')
      .select('*')
      .eq('player_fid', fid)
      .is('closed_at', null)
      .order('opened_at', { ascending: false })

    if (posError) throw posError

    // Get token symbols
    const { data: tokens, error: tokenError } = await supabase
      .from('tokens')
      .select('id, symbol')

    if (tokenError) throw tokenError

    // Map token_id to symbol
    const tokenMap = new Map(tokens?.map(t => [t.id, t.symbol]) || [])

    // Add token_symbol to each position
    const positionsWithSymbols = positions?.map(p => ({
      ...p,
      token_symbol: tokenMap.get(p.token_id) || 'BATR'
    })) || []

    res.json(positionsWithSymbols)
  } catch (error: any) {
    console.error('Error fetching open positions:', error)
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/positions/:fid/closed', async (req, res) => {
  try {
    const fid = parseInt(req.params.fid)

    // Get closed positions from Supabase
    const { data: positions, error: posError } = await supabase
      .from('positions')
      .select('*')
      .eq('player_fid', fid)
      .not('closed_at', 'is', null)
      .order('closed_at', { ascending: false })

    if (posError) throw posError

    // Get token symbols
    const { data: tokens, error: tokenError } = await supabase
      .from('tokens')
      .select('id, symbol')

    if (tokenError) throw tokenError

    // Map token_id to symbol
    const tokenMap = new Map(tokens?.map(t => [t.id, t.symbol]) || [])

    // Add token_symbol to each position
    const positionsWithSymbols = positions?.map(p => ({
      ...p,
      token_symbol: tokenMap.get(p.token_id) || 'BATR'
    })) || []

    res.json(positionsWithSymbols)
  } catch (error: any) {
    console.error('Error fetching closed positions:', error)
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/player/:fid/stats', async (req, res) => {
  try {
    const fid = parseInt(req.params.fid)

    // Get player from Supabase
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('*')
      .eq('farcaster_fid', fid)
      .single()

    if (playerError || !player) {
      return res.json({
        farcaster_fid: fid,
        cash: 250,
        high_score: 250,
        created_at: Date.now(),
        total_trades: 0,
        winning_trades: 0,
        losing_trades: 0,
        total_volume: 0,
        biggest_win: 0,
        biggest_loss: 0,
        avg_hold_time: 0,
        total_pnl: 0
      })
    }

    // Get closed positions from Supabase
    const { data: closedPositions, error: posError } = await supabase
      .from('positions')
      .select('*')
      .eq('player_fid', fid)
      .not('closed_at', 'is', null)

    if (posError) throw posError

    const positions = closedPositions || []
    const total_trades = positions.length
    const winning_trades = positions.filter(p => p.pnl > 0).length
    const losing_trades = positions.filter(p => p.pnl <= 0).length
    const total_volume = positions.reduce((sum, p) => sum + (p.size || 0), 0)
    const biggest_win = positions.length > 0 ? Math.max(...positions.map(p => p.pnl), 0) : 0
    const biggest_loss = positions.length > 0 ? Math.min(...positions.map(p => p.pnl), 0) : 0
    const total_pnl = positions.reduce((sum, p) => sum + (p.pnl || 0), 0)
    const avg_hold_time = total_trades > 0
      ? positions.reduce((sum, p) => sum + (p.closed_at - p.opened_at), 0) / total_trades
      : 0

    res.json({
      farcaster_username: player.farcaster_username,
      farcaster_fid: player.farcaster_fid,
      display_name: player.display_name,
      pfp_url: player.pfp_url,
      cash: player.cash,
      high_score: player.high_score,
      created_at: player.created_at,
      total_trades,
      winning_trades,
      losing_trades,
      total_volume,
      biggest_win,
      biggest_loss,
      avg_hold_time,
      total_pnl
    })
  } catch (error: any) {
    console.error('Error fetching player stats:', error)
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/player/:fid/submit', async (req, res) => {
  try {
    const fid = parseInt(req.params.fid)
    const { cash } = req.body

    // Get all players
    const { data: allPlayers, error: playersError } = await supabase
      .from('players')
      .select('farcaster_fid, submitted_cash')

    if (playersError) throw playersError

    const { rank, position } = calculateRank(cash, allPlayers || [])

    // Update this player
    const { error: updateError } = await supabase
      .from('players')
      .update({
        submitted_cash: cash,
        rank,
        updated_at: Date.now()
      })
      .eq('farcaster_fid', fid)

    if (updateError) throw updateError

    // Get updated players with submitted cash
    const { data: updatedPlayers, error: updatedError } = await supabase
      .from('players')
      .select('farcaster_fid, submitted_cash')
      .gt('submitted_cash', 0)

    if (updatedError) throw updatedError

    // Update ranks for all players
    if (updatedPlayers) {
      for (const player of updatedPlayers) {
        const { rank: newRank } = calculateRank(player.submitted_cash, updatedPlayers)
        await supabase
          .from('players')
          .update({ rank: newRank })
          .eq('farcaster_fid', player.farcaster_fid)
      }
    }

    res.json({ success: true, rank, position })
  } catch (error: any) {
    console.error('Error submitting player score:', error)
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/leaderboard', async (req, res) => {
  try {
    const timeRange = (req.query.range as string) || 'weekly'

    // Calculate time threshold based on range
    const now = Date.now()
    let timeThreshold: number

    switch (timeRange) {
      case 'daily':
        timeThreshold = now - (24 * 60 * 60 * 1000) // Last 24 hours
        break
      case 'weekly':
        timeThreshold = now - (7 * 24 * 60 * 60 * 1000) // Last 7 days
        break
      case 'monthly':
        timeThreshold = now - (30 * 24 * 60 * 60 * 1000) // Last 30 days
        break
      case 'quarterly':
        timeThreshold = now - (90 * 24 * 60 * 60 * 1000) // Last 90 days
        break
      default:
        timeThreshold = now - (7 * 24 * 60 * 60 * 1000) // Default to weekly
    }

    // Get all players
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('farcaster_fid, farcaster_username, display_name, pfp_url, cash, high_score')

    if (playersError) throw playersError

    // Calculate stats for each player based on positions in the time range
    const leaderboard = await Promise.all((players || []).map(async player => {
      const { data: positions, error: posError } = await supabase
        .from('positions')
        .select('pnl, size, opened_at, closed_at')
        .eq('player_fid', player.farcaster_fid)
        .not('closed_at', 'is', null)
        .gte('closed_at', timeThreshold)

      if (posError) {
        console.error('Error fetching positions for player:', player.farcaster_fid, posError)
        return null
      }

      if (!positions || positions.length === 0) return null

      const total_trades = positions.length
      const winning_trades = positions.filter(p => p.pnl > 0).length
      const losing_trades = positions.filter(p => p.pnl <= 0).length
      const total_volume = positions.reduce((sum, p) => sum + p.size, 0)
      const total_pnl = positions.reduce((sum, p) => sum + p.pnl, 0)
      const biggest_win = Math.max(...positions.map(p => p.pnl), 0)
      const biggest_loss = Math.min(...positions.map(p => p.pnl), 0)

      return {
        ...player,
        total_trades,
        winning_trades,
        losing_trades,
        total_volume,
        total_pnl,
        biggest_win,
        biggest_loss
      }
    }))

    // Filter out nulls and players with no trades
    const filteredLeaderboard = leaderboard.filter(p => p !== null && p.total_trades > 0)

    res.json(filteredLeaderboard)
  } catch (error: any) {
    console.error('Error fetching leaderboard:', error)
    res.status(500).json({ error: error.message })
  }
})

// Admin middleware - check if user FID is in admin list
const isAdmin = (req: any, res: any, next: any) => {
  const fid = parseInt(req.headers['x-fid'])

  if (!fid || !ADMIN_FIDS.includes(fid)) {
    return res.status(403).json({ error: 'Forbidden: Admin only' })
  }

  next()
}

// Admin: Get all tokens
app.get('/api/admin/tokens', isAdmin, async (req, res) => {
  try {
    const { data: tokens, error } = await supabase
      .from('tokens')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    res.json(tokens || [])
  } catch (error: any) {
    console.error('Error fetching admin tokens:', error)
    res.status(500).json({ error: error.message })
  }
})

// Admin: Add token
app.post('/api/admin/tokens', isAdmin, async (req, res) => {
  const { symbol, name, initial_price, is_real_crypto } = req.body

  console.log('🪙 [ADMIN] Add token request:', { symbol, name, initial_price, is_real_crypto })

  try {
    let logoUrl = null
    let finalPrice = initial_price || 100 // Default 100 for game tokens

    // If it's a real crypto, fetch real price and logo
    if (is_real_crypto) {
      // Fetch real price directly from Binance REST API
      try {
        const binancePriceUrl = `https://api.binance.com/api/v3/ticker/price?symbol=${symbol.toUpperCase()}USDT`
        console.log(`🔍 [ADMIN] Fetching price from Binance: ${binancePriceUrl}`)

        const priceResponse = await fetch(binancePriceUrl)

        if (priceResponse.ok) {
          const priceData = await priceResponse.json() as { symbol: string, price: string }
          const binancePrice = parseFloat(priceData.price)

          if (binancePrice > 0) {
            finalPrice = binancePrice
            console.log(`💰 [ADMIN] Got real price for ${symbol}: $${binancePrice}`)
          } else {
            throw new Error(`Invalid price returned from Binance: ${priceData.price}`)
          }
        } else {
          const errorText = await priceResponse.text()
          console.error(`❌ [ADMIN] Binance API error:`, errorText)
          throw new Error(`Could not fetch price for ${symbol}. Make sure the symbol exists on Binance (e.g., BTC, ETH, SOL).`)
        }
      } catch (error: any) {
        console.error(`❌ [ADMIN] Error fetching price for ${symbol}:`, error)
        return res.status(400).json({
          error: error.message || `Failed to fetch price for ${symbol} from Binance. Make sure it's a valid symbol.`
        })
      }

      // Fetch logo
      try {
        const binanceApiUrl = `https://api.binance.com/api/v3/exchangeInfo?symbol=${symbol}USDT`
        const response = await fetch(binanceApiUrl)

        if (response.ok) {
          // Binance doesn't provide logo URLs directly, so we'll use CoinGecko API
          const coinGeckoUrl = `https://api.coingecko.com/api/v3/coins/${symbol.toLowerCase()}`
          const cgResponse = await fetch(coinGeckoUrl)

          if (cgResponse.ok) {
            const cgData = await cgResponse.json()
            logoUrl = cgData.image?.large || cgData.image?.small || cgData.image?.thumb
          }
        }

        // Fallback to CryptoCompare if CoinGecko fails
        if (!logoUrl) {
          const ccUrl = `https://min-api.cryptocompare.com/data/pricemultifull?fsyms=${symbol}&tsyms=USD`
          const ccResponse = await fetch(ccUrl)

          if (ccResponse.ok) {
            const ccData = await ccResponse.json()
            const imageUrl = ccData.RAW?.[symbol]?.USD?.IMAGEURL
            if (imageUrl) {
              logoUrl = `https://www.cryptocompare.com${imageUrl}`
            }
          }
        }
      } catch (error) {
        console.log('Failed to fetch logo for', symbol, error)
      }
    }

    // Ensure price is valid (positive number)
    if (!finalPrice || finalPrice <= 0) {
      console.error(`❌ [ADMIN] Invalid price: ${finalPrice}`)
      return res.status(400).json({
        error: `Invalid price. For game tokens, enter a positive number. For real crypto, make sure ${symbol} is available on Binance.`
      })
    }

    // Insert token with logo URL
    const tokenData = {
      symbol,
      name,
      initial_price: finalPrice,
      current_price: finalPrice,
      is_active: 1,
      is_real_crypto: is_real_crypto ? 1 : 0,
      logo_url: logoUrl,
      created_at: Date.now()
    }

    console.log('💾 [ADMIN] Inserting token into database:', tokenData)

    const { data: newToken, error: insertError } = await supabase
      .from('tokens')
      .insert(tokenData)
      .select()
      .single()

    if (insertError) {
      console.error('❌ [ADMIN] Token insert error:', insertError)
      throw insertError
    }

    console.log('✅ [ADMIN] Token inserted successfully, ID:', newToken.id)

    const tokenId = newToken.id

    // Initialize price history with initial price (create 120 historical points)
    const now = Date.now()
    const priceHistoryRecords = []
    for (let i = 119; i >= 0; i--) {
      const timestamp = now - (i * 1000) // 1 second intervals
      priceHistoryRecords.push({
        token_id: tokenId,
        price: finalPrice,
        timestamp
      })
    }

    console.log(`📊 [ADMIN] Creating ${priceHistoryRecords.length} price history records...`)

    // Bulk insert price history
    const { error: historyError } = await supabase
      .from('price_history')
      .insert(priceHistoryRecords)

    if (historyError) {
      console.error('❌ [ADMIN] Price history insert error:', historyError)
      throw historyError
    }

    console.log('✅ [ADMIN] Price history created successfully')

    // Reload price engine to include new token
    await priceEngine.reloadTokens()
    console.log('✅ [ADMIN] Price engine reloaded')

    // If it's a real crypto token, reload Binance WebSocket
    if (is_real_crypto) {
      cryptoPriceFetcher.reloadTokens()
      console.log('✅ [ADMIN] Crypto price fetcher reloaded')
    }

    console.log('🎉 [ADMIN] Token added successfully!')
    res.json({ success: true, logoUrl })
  } catch (error: any) {
    console.error('❌ [ADMIN] Error adding token:', error)
    res.status(400).json({ error: error.message || 'Failed to add token' })
  }
})

// Admin: Update token
app.put('/api/admin/tokens/:id', isAdmin, async (req, res) => {
  const { name, is_active, max_leverage } = req.body

  try {
    const { error } = await supabase
      .from('tokens')
      .update({
        name,
        is_active: is_active ? 1 : 0,
        max_leverage: max_leverage || 10
      })
      .eq('id', req.params.id)

    if (error) throw error
    res.json({ success: true })
  } catch (error: any) {
    res.status(400).json({ error: error.message })
  }
})

// Admin: Delete token
app.delete('/api/admin/tokens/:id', isAdmin, async (req, res) => {
  try {
    const tokenId = parseInt(req.params.id)

    if (isNaN(tokenId)) {
      return res.status(400).json({ error: 'Invalid token ID' })
    }

    console.log(`🗑️ [ADMIN] Deleting token ${tokenId}...`)

    // Get all positions for this token
    const { data: positions, error: posError } = await supabase
      .from('positions')
      .select('*')
      .eq('token_id', tokenId)

    if (posError) throw posError

    let refundedPlayers = 0
    let closedPositions = 0

    if (positions && positions.length > 0) {
      console.log(`📋 [ADMIN] Found ${positions.length} position(s) for this token`)

      // Refund collateral and close all open positions
      for (const position of positions) {
        // If position is still open, refund collateral to player
        if (!position.closed_at) {
          console.log(`💰 [ADMIN] Refunding ${position.collateral} to player ${position.player_fid} for open position ${position.id}`)

          // Get player's current cash
          const { data: player, error: playerError } = await supabase
            .from('players')
            .select('cash')
            .eq('farcaster_fid', position.player_fid)
            .single()

          if (!playerError && player) {
            // Refund collateral (this is the amount they put in)
            const newCash = player.cash + position.collateral
            await supabase
              .from('players')
              .update({
                cash: newCash,
                updated_at: Date.now()
              })
              .eq('farcaster_fid', position.player_fid)

            refundedPlayers++
            console.log(`  ✅ Refunded $${position.collateral}! Player cash: ${player.cash} → ${newCash}`)
          }

          // Close the position with 0 PnL (refund only, no profit/loss)
          // This makes it disappear from /api/positions/:fid/open endpoint
          await supabase
            .from('positions')
            .update({
              closed_at: Date.now(),
              close_price: position.entry_price,
              pnl: 0,
              is_liquidated: false
            })
            .eq('id', position.id)

          closedPositions++
          console.log(`  ✅ Closed position ${position.id}`)
        }
      }

      console.log(`✅ [ADMIN] Refunded ${refundedPlayers} player(s), closed ${closedPositions} position(s)`)

      // Broadcast position close event to all connected clients
      const affectedPlayerFids = [...new Set(positions.map(p => p.player_fid))]
      console.log(`📡 [ADMIN] Broadcasting position close event to ${affectedPlayerFids.length} player(s)`)

      wss.clients.forEach(client => {
        if (client.readyState === 1) {
          client.send(JSON.stringify({
            type: 'positions_closed',
            player_fids: affectedPlayerFids,
            timestamp: Date.now()
          }))
        }
      })

      // Now delete ALL positions for this token (both newly closed and already closed)
      // This is necessary to avoid foreign key constraint violation when deleting token
      const { error: deletePositionsError } = await supabase
        .from('positions')
        .delete()
        .eq('token_id', tokenId)

      if (deletePositionsError) {
        console.error('❌ [ADMIN] Error deleting positions:', deletePositionsError)
        throw deletePositionsError
      }

      console.log(`✅ [ADMIN] Deleted all ${positions.length} position(s) from database`)
    }

    // Delete price history for this token
    const { error: historyError } = await supabase
      .from('price_history')
      .delete()
      .eq('token_id', tokenId)

    if (historyError) throw historyError

    console.log(`✅ [ADMIN] Deleted price history`)

    // Delete the token
    const { error: deleteError } = await supabase
      .from('tokens')
      .delete()
      .eq('id', tokenId)

    if (deleteError) throw deleteError

    console.log(`🎉 [ADMIN] Token deleted successfully!`)

    res.json({
      success: true,
      refunded_players: refundedPlayers,
      closed_positions: closedPositions,
      total_positions: positions?.length || 0
    })
  } catch (error: any) {
    console.error('❌ [ADMIN] Error deleting token:', error)
    res.status(400).json({ error: error.message })
  }
})

// Admin: Count players below threshold
app.get('/api/admin/players/count', isAdmin, async (req, res) => {
  try {
    const threshold = parseFloat(req.query.threshold as string)

    if (isNaN(threshold)) {
      return res.status(400).json({ error: 'Invalid threshold' })
    }

    const { count, error } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .lt('cash', threshold)

    if (error) throw error

    res.json({ count: count || 0 })
  } catch (error: any) {
    res.status(400).json({ error: error.message })
  }
})

// Admin: Bulk balance update
app.post('/api/admin/players/bulk-balance', isAdmin, async (req, res) => {
  try {
    const { threshold, amount } = req.body

    if (isNaN(threshold) || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Invalid parameters' })
    }

    // Get affected players
    const { data: affectedPlayers, error: fetchError } = await supabase
      .from('players')
      .select('farcaster_fid, cash')
      .lt('cash', threshold)

    if (fetchError) throw fetchError

    // Update each player's balance
    const now = Date.now()

    if (affectedPlayers && affectedPlayers.length > 0) {
      for (const player of affectedPlayers) {
        await supabase
          .from('players')
          .update({
            cash: player.cash + amount,
            updated_at: now
          })
          .eq('farcaster_fid', player.farcaster_fid)
      }
    }

    res.json({ success: true, updated: affectedPlayers?.length || 0 })
  } catch (error: any) {
    res.status(400).json({ error: error.message })
  }
})

// Admin: Get all config
app.get('/api/admin/config', isAdmin, async (req, res) => {
  try {
    const { data: configs, error } = await supabase
      .from('config')
      .select('*')
      .order('key', { ascending: true })

    if (error) throw error
    res.json(configs || [])
  } catch (error: any) {
    console.error('Error fetching admin config:', error)
    res.status(500).json({ error: error.message })
  }
})

// Admin: Update config
app.put('/api/admin/config/:key', isAdmin, async (req, res) => {
  const { value } = req.body

  try {
    const { error } = await supabase
      .from('config')
      .update({
        value,
        updated_at: Date.now()
      })
      .eq('key', req.params.key)

    if (error) throw error
    res.json({ success: true })
  } catch (error: any) {
    res.status(400).json({ error: error.message })
  }
})

// Admin: Sync real crypto prices from Binance immediately
app.post('/api/admin/sync-crypto-prices', isAdmin, async (req, res) => {
  try {
    // Get all real crypto tokens
    const { data: tokens, error } = await supabase
      .from('tokens')
      .select('id, symbol')
      .eq('is_real_crypto', 1)
      .eq('is_active', 1)

    if (error) throw error

    const updated: string[] = []
    const failed: string[] = []

    for (const token of tokens || []) {
      const realPrice = cryptoPriceFetcher.getPrice(token.symbol)

      if (realPrice > 0) {
        // Update database with real price from Binance
        await supabase
          .from('tokens')
          .update({ current_price: realPrice })
          .eq('id', token.id)

        updated.push(`${token.symbol}: $${realPrice}`)
      } else {
        failed.push(token.symbol)
      }
    }

    res.json({
      success: true,
      updated,
      failed,
      message: `Updated ${updated.length} tokens, ${failed.length} failed`
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Public: Get active tokens
app.get('/api/tokens', async (req, res) => {
  try {
    const { data: tokens, error } = await supabase
      .from('tokens')
      .select('*')
      .eq('is_active', 1)
      .order('created_at', { ascending: true })

    if (error) throw error
    res.json(tokens || [])
  } catch (error: any) {
    console.error('Error fetching tokens:', error)
    res.status(500).json({ error: error.message })
  }
})

// Public: Get config
app.get('/api/config', async (req, res) => {
  try {
    const { data: configs, error } = await supabase
      .from('config')
      .select('*')

    if (error) throw error

    const configObj: any = {}
    configs?.forEach((c: any) => {
      configObj[c.key] = c.value
    })
    res.json(configObj)
  } catch (error: any) {
    console.error('Error fetching config:', error)
    res.status(500).json({ error: error.message })
  }
})

// DISABLED - Achievements coming soon
// Public: Get active achievements
// app.get('/api/achievements', (req, res) => {
//   const achievements = db.prepare('SELECT * FROM achievements WHERE is_active = 1 ORDER BY created_at ASC').all()
//   res.json(achievements)
// })

// Public: Get player's earned achievements
app.get('/api/player/:fid/achievements', (req, res) => {
  // DISABLED - Return empty array for now
  res.json([])

  // const fid = req.params.fid
  // const player = db.prepare('SELECT * FROM players WHERE farcaster_fid = ?').get(fid) as any

  // if (!player) {
  //   return res.json([])
  // }

  // const achievements = db.prepare('SELECT * FROM achievements WHERE is_active = 1').all() as any[]
  // const closedPositions = db.prepare('SELECT * FROM positions WHERE player_fid = ? AND closed_at IS NOT NULL').all(fid) as any[]

  // const totalTrades = closedPositions.length
  // const winningTrades = closedPositions.filter(p => p.pnl > 0).length
  // const biggestWin = Math.max(...closedPositions.map(p => p.pnl), 0)
  // const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0

  // const earnedAchievements = achievements.filter(ach => {
  //   switch (ach.requirement_type) {
  //     case 'total_trades':
  //       return totalTrades >= ach.requirement_value
  //     case 'winning_trades':
  //       return winningTrades >= ach.requirement_value
  //     case 'biggest_win':
  //       return biggestWin >= ach.requirement_value
  //     case 'high_score':
  //       return player.high_score >= ach.requirement_value
  //     case 'win_rate':
  //       return winRate >= ach.requirement_value
  //     default:
  //       return false
  //   }
  // })

  // res.json(earnedAchievements)
})

// DISABLED - Achievements coming soon
// Public: Mint achievement NFT
// app.post('/api/achievements/:id/mint', async (req, res) => {
//   const achievementId = req.params.id
//   const { fid, walletAddress } = req.body

//   try {
//     // Get player
//     const player = db.prepare('SELECT * FROM players WHERE farcaster_fid = ?').get(fid) as any
//     if (!player) {
//       return res.status(404).json({ error: 'Player not found' })
//     }

//     // Get achievement
//     const achievement = db.prepare('SELECT * FROM achievements WHERE id = ?').get(achievementId) as any
//     if (!achievement || !achievement.is_active) {
//       return res.status(404).json({ error: 'Achievement not found' })
//     }

//     // Check if already minted
//     const mintedAchievements = player.mintedAchievements ? player.mintedAchievements.split(',').filter((id: string) => id) : []
//     if (mintedAchievements.includes(achievementId)) {
//       return res.status(400).json({ error: 'Achievement already minted' })
//     }

//     // Verify player has earned this achievement
//     const closedPositions = db.prepare('SELECT * FROM positions WHERE player_fid = ? AND closed_at IS NOT NULL').all(fid) as any[]
//     const totalTrades = closedPositions.length
//     const winningTrades = closedPositions.filter(p => p.pnl > 0).length
//     const biggestWin = Math.max(...closedPositions.map(p => p.pnl), 0)
//     const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0

//     let earned = false
//     switch (achievement.requirement_type) {
//       case 'total_trades':
//         earned = totalTrades >= achievement.requirement_value
//         break
//       case 'winning_trades':
//         earned = winningTrades >= achievement.requirement_value
//         break
//       case 'biggest_win':
//         earned = biggestWin >= achievement.requirement_value
//         break
//       case 'high_score':
//         earned = player.high_score >= achievement.requirement_value
//         break
//       case 'win_rate':
//         earned = winRate >= achievement.requirement_value
//         break
//     }

//     if (!earned) {
//       return res.status(400).json({ error: 'Achievement not earned yet' })
//     }

//     // Call smart contract to mint NFT
//     console.log(`🎯 Minting achievement ${achievementId} for ${walletAddress}...`)
//     const mintResult = await mintAchievementNFT(walletAddress, parseInt(achievementId))

//     if (mintResult.success) {
//       // Update database
//       mintedAchievements.push(achievementId)
//       const updatedMintedAchievements = mintedAchievements.join(',')

//       db.prepare('UPDATE players SET mintedAchievements = ? WHERE farcaster_fid = ?').run(
//         updatedMintedAchievements,
//         fid
//       )

//       const network = process.env.BASE_RPC_URL?.includes('sepolia') ? 'sepolia.' : '';
//       const explorerUrl = `https://${network}basescan.org/tx/${mintResult.txHash}`;

//       res.json({
//         success: true,
//         message: 'Achievement minted successfully!',
//         txHash: mintResult.txHash,
//         tokenId: mintResult.tokenId,
//         explorerUrl
//       })
//     } else {
//       res.status(400).json({
//         error: mintResult.error || 'Failed to mint NFT'
//       })
//     }
//   } catch (error: any) {
//     console.error('Mint error:', error)
//     res.status(500).json({ error: 'Failed to mint achievement' })
//   }
// })

// DISABLED - Achievements coming soon
// NFT Metadata endpoint for OpenSea/marketplaces
// app.get('/api/nft-metadata/:achievementId', (req, res) => {
//   const achievementId = parseInt(req.params.achievementId)

//   // Get achievement from database
//   const achievement = db.prepare('SELECT * FROM achievements WHERE id = ?').get(achievementId) as any

//   if (!achievement) {
//     return res.status(404).json({ error: 'Achievement not found' })
//   }

//   const rarityAttributes: Record<string, number> = {
//     'Common': 1,
//     'Rare': 2,
//     'Epic': 3,
//     'Legendary': 4
//   }

//   const metadata = {
//     name: `${achievement.name} Achievement`,
//     description: achievement.description,
//     image: `https://basetraders.vercel.app/achievements/${achievementId}.png`, // You'll need to upload these images
//     external_url: 'https://basetraders.vercel.app',
//     attributes: [
//       {
//         trait_type: 'Rarity',
//         value: achievement.rarity
//       },
//       {
//         trait_type: 'Rarity Level',
//         value: rarityAttributes[achievement.rarity] || 1,
//         display_type: 'number'
//       },
//       {
//         trait_type: 'Category',
//         value: achievement.requirement_type.replace(/_/g, ' ')
//       },
//       {
//         trait_type: 'Requirement',
//         value: achievement.requirement_value,
//         display_type: 'number'
//       }
//     ]
//   }

//   res.json(metadata)
// })

// Share image generation endpoint - returns Frame HTML
app.get('/api/share-image', async (req, res) => {
  const token = req.query.token as string || 'BATR'
  const leverage = req.query.leverage as string || '1'
  const profit = req.query.profit as string || '0'
  const profitPercent = req.query.profitPercent as string || '0'

  const imageUrl = `https://basedtraders.onrender.com/api/share-image-png?token=${encodeURIComponent(token)}&leverage=${leverage}&profit=${profit}&profitPercent=${profitPercent}`
  const miniappUrl = 'https://farcaster.xyz/miniapps/YgDPslIu3Xrt/basedtraders'

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Profitable Trade on Based Traders!</title>

  <!-- Farcaster Miniapp Embed -->
  <meta property="fc:miniapp" content="vNext" />
  <meta property="fc:miniapp:name" content="Based Traders" />
  <meta property="fc:miniapp:image" content="${imageUrl}" />
  <meta property="fc:miniapp:url" content="${miniappUrl}" />

  <!-- Farcaster Frame (fallback) -->
  <meta property="fc:frame" content="vNext" />
  <meta property="fc:frame:image" content="${imageUrl}" />
  <meta property="fc:frame:image:aspect_ratio" content="1.91:1" />
  <meta property="fc:frame:button:1" content="Play Now" />
  <meta property="fc:frame:button:1:action" content="link" />
  <meta property="fc:frame:button:1:target" content="${miniappUrl}" />

  <!-- Open Graph -->
  <meta property="og:title" content="Profitable Trade on Based Traders!" />
  <meta property="og:description" content="${leverage}x ${token} position closed with +$${profit} profit (+${profitPercent}%)" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url" content="${miniappUrl}" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Profitable Trade on Based Traders!" />
  <meta name="twitter:description" content="${leverage}x ${token} position closed with +$${profit} profit!" />
  <meta name="twitter:image" content="${imageUrl}" />
</head>
<body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background: #0f1117; color: white;">
  <h1>🎯 Profitable Trade!</h1>
  <p>${leverage}x ${token} position closed with +$${profit} profit (+${profitPercent}%)</p>
  <a href="${miniappUrl}" style="color: #0000FF;">Play Now on Based Traders</a>
</body>
</html>`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=300')
  res.send(html)
})

// Share image PNG generation endpoint - saves to disk and returns URL
app.get('/api/share-image-png', async (req, res) => {
  const token = req.query.token as string || 'BATR'
  const leverage = req.query.leverage as string || '1'
  const profit = req.query.profit as string || '0'
  const profitPercent = req.query.profitPercent as string || '0'

  console.log('🎨 Generating share image for:', { token, leverage, profit, profitPercent })

  // Generate unique filename
  const imageHash = generateImageHash(token, leverage, profit, profitPercent)
  const filename = `share-${imageHash}.png`
  const filePath = path.join(SHARES_DIR, filename)

  // Check if image already exists
  if (fs.existsSync(filePath)) {
    console.log('✅ Share image already exists, serving from disk')
    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.setHeader('Access-Control-Allow-Origin', '*')
    return res.sendFile(filePath)
  }

  // Create canvas
  const canvas = createCanvas(1200, 630)
  const ctx = canvas.getContext('2d')

  // Background
  ctx.fillStyle = '#0f1117'
  ctx.fillRect(0, 0, 1200, 630)

  // Add decorative circles
  ctx.fillStyle = 'rgba(0, 0, 255, 0.15)'
  ctx.beginPath()
  ctx.arc(1000, 100, 250, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = 'rgba(34, 197, 94, 0.15)'
  ctx.beginPath()
  ctx.arc(200, 530, 250, 0, Math.PI * 2)
  ctx.fill()

  // Load and draw menulogo
  try {
    const logoPath = path.join(__dirname, '..', 'public', 'menulogo.png')
    const logo = await loadImage(logoPath)
    ctx.drawImage(logo, 525, 30, 150, 150)
  } catch (error) {
    console.error('Failed to load menulogo.png:', error)
  }

  // Title
  ctx.fillStyle = '#22c55e'
  ctx.font = 'bold 60px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('Profitable Trade!', 600, 240)

  // Stats background
  ctx.fillStyle = 'rgba(10, 12, 18, 0.7)'
  ctx.beginPath()
  ctx.roundRect(150, 280, 900, 280, 20)
  ctx.fill()

  // Stats labels
  ctx.fillStyle = '#9ca3af'
  ctx.font = '32px Arial'
  ctx.textAlign = 'left'
  ctx.fillText('Token:', 200, 340)
  ctx.fillText('Leverage:', 200, 400)
  ctx.fillText('Profit:', 200, 460)
  ctx.fillText('Return:', 200, 520)

  // Values
  ctx.textAlign = 'right'
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 40px Arial'
  ctx.fillText(token, 1000, 340)

  ctx.fillStyle = '#0000FF'
  ctx.fillText(`${leverage}x`, 1000, 400)

  ctx.fillStyle = '#22c55e'
  ctx.fillText(`+$${profit}`, 1000, 460)
  ctx.fillText(`+${profitPercent}%`, 1000, 520)

  // Convert to buffer
  const buffer = canvas.toBuffer('image/png')

  // Save to disk
  fs.writeFileSync(filePath, buffer)
  console.log('✅ Generated and saved share image to disk:', filename)

  // Send the image
  res.setHeader('Content-Type', 'image/png')
  res.setHeader('Content-Length', buffer.length.toString())
  res.setHeader('Cache-Control', 'public, max-age=3600')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.send(buffer)
})

// Serve static files in production
if (!isDev) {
  // Try multiple possible paths for dist directory
  const possibleDistPaths = [
    path.join(__dirname, '..', 'dist'),
    path.join(__dirname, '..', '..', 'dist'),
    path.join(process.cwd(), 'dist'),
    path.join(process.cwd(), 'based-traders', 'dist')
  ]

  let distPath: string | null = null
  for (const testPath of possibleDistPaths) {
    if (fs.existsSync(testPath) && fs.existsSync(path.join(testPath, 'index.html'))) {
      distPath = testPath
      console.log('✅ Found dist at:', distPath)
      break
    }
  }

  if (!distPath) {
    console.error('❌ Could not find dist directory in any of these paths:', possibleDistPaths)
    console.error('📂 __dirname:', __dirname)
    console.error('📂 cwd:', process.cwd())
  } else {
    console.log('📦 Serving static files from:', distPath)
    app.use(express.static(distPath))

    // SPA fallback - handle all non-API routes
    app.use((req, res, next) => {
      if (!req.path.startsWith('/api') && !req.path.startsWith('/ws') && req.path !== '/farcaster.json' && !req.path.startsWith('/.well-known')) {
        const indexPath = path.join(distPath!, 'index.html')

        if (fs.existsSync(indexPath)) {
          res.sendFile(indexPath)
        } else {
          console.error('❌ index.html not found at:', indexPath)
          res.status(404).send('index.html not found')
        }
      } else {
        next()
      }
    })
  }
}

// WebSocket
wss.on('connection', async (ws) => {
  // Send initial prices for all tokens
  try {
    const { data: tokens, error } = await supabase
      .from('tokens')
      .select('symbol, current_price')
      .eq('is_active', 1)

    if (error) {
      console.error('Error fetching tokens for WebSocket:', error)
      return
    }

    const prices: Record<string, number> = {}
    tokens?.forEach(t => {
      prices[t.symbol] = t.current_price
    })

    ws.send(JSON.stringify({
      prices,
      timestamp: Date.now()
    }))
  } catch (error) {
    console.error('WebSocket connection error:', error)
  }
})

// Only start server if not in Vercel environment
if (process.env.VERCEL !== '1') {
  const PORT = process.env.PORT || 3000
  server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`)
    console.log(`📡 WebSocket running on ws://localhost:${PORT}`)
    console.log(`🌍 Mode: ${isDev ? 'Development' : 'Production'}`)
  })
}

// Export the Express app for Vercel
export default app
