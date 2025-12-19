import express from 'express'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import db from './db.js'
import { calculateRank } from './rankSystem.js'
import { cryptoPriceFetcher } from './cryptoPrice.js'
// import { mintAchievementNFT } from './nftMinter.js' // DISABLED - Achievements coming soon
import dotenv from 'dotenv'
import { createCanvas, loadImage } from 'canvas'

// Load environment variables
dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load admin FIDs from environment variable
const ADMIN_FIDS = process.env.ADMIN_FIDS?.split(',').map(fid => parseInt(fid.trim())).filter(fid => !isNaN(fid)) || []
console.log('🔐 Admin FIDs loaded:', ADMIN_FIDS)

const app = express()
const server = createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

// CORS - only for development
const isDev = process.env.NODE_ENV !== 'production'
if (isDev) {
  app.use(cors())
}

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
    // Initialize prices for all active tokens
    const tokens = db.prepare('SELECT id, current_price FROM tokens WHERE is_active = 1').all() as { id: number, current_price: number }[]
    tokens.forEach(token => {
      this.tokenPrices.set(token.id, token.current_price)
    })
    this.trend = -0.0002
  }

  start() {
    if (this.intervalId) return

    this.intervalId = setInterval(() => {
      this.updateAllPrices()
    }, 1000)
  }

  private updateAllPrices() {
    const elapsedMinutes = (Date.now() - this.startTime) / 1000 / 60

    // Get all active tokens
    const tokens = db.prepare('SELECT id, current_price, symbol, is_real_crypto FROM tokens WHERE is_active = 1').all() as { id: number, current_price: number, symbol: string, is_real_crypto: number }[]

    tokens.forEach(token => {
      let price = this.tokenPrices.get(token.id) || token.current_price

      // For real crypto tokens, use real prices from Binance
      if (token.is_real_crypto === 1) {
        const realPrice = cryptoPriceFetcher.getPrice(token.symbol)
        if (realPrice > 0) {
          price = realPrice
        }
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

      // Update token price in memory and database
      this.tokenPrices.set(token.id, price)
      db.prepare('UPDATE tokens SET current_price = ? WHERE id = ?').run(price, token.id)

      // Save to price history
      this.savePriceForToken(token.id, price)
    })

    this.broadcastPrice()
  }

  private savePriceForToken(tokenId: number, price: number) {
    db.prepare('INSERT INTO price_history (token_id, price, timestamp) VALUES (?, ?, ?)').run(
      tokenId,
      price,
      Date.now()
    )

    // Keep only last 300 records per token
    const count = db.prepare('SELECT COUNT(*) as count FROM price_history WHERE token_id = ?').get(tokenId) as { count: number }
    if (count.count > 300) {
      db.prepare(`
        DELETE FROM price_history
        WHERE token_id = ? AND id NOT IN (
          SELECT id FROM price_history
          WHERE token_id = ?
          ORDER BY timestamp DESC
          LIMIT 300
        )
      `).run(tokenId, tokenId)
    }
  }

  private broadcastPrice() {
    // Broadcast all token prices as { prices: { BATR: 100, BTC: 50000, ... } }
    const tokens = db.prepare('SELECT id, symbol, current_price FROM tokens WHERE is_active = 1').all() as { id: number, symbol: string, current_price: number }[]

    const prices: Record<string, number> = {}
    tokens.forEach(t => {
      prices[t.symbol] = t.current_price
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

  getCurrentPrice(tokenSymbol: string = 'BATR') {
    const token = db.prepare('SELECT current_price FROM tokens WHERE symbol = ?').get(tokenSymbol) as { current_price: number } | undefined
    return token?.current_price || 100
  }

  getPriceHistory(tokenSymbol: string = 'BATR', limit: number = 120) {
    const token = db.prepare('SELECT id FROM tokens WHERE symbol = ?').get(tokenSymbol) as { id: number } | undefined
    if (!token) return []

    const rows = db.prepare('SELECT price FROM price_history WHERE token_id = ? ORDER BY timestamp DESC LIMIT ?').all(token.id, limit) as { price: number }[]
    return rows.reverse().map(r => r.price)
  }

  reloadTokens() {
    // Reload all active tokens into memory
    const tokens = db.prepare('SELECT id, current_price FROM tokens WHERE is_active = 1').all() as { id: number, current_price: number }[]
    tokens.forEach(token => {
      if (!this.tokenPrices.has(token.id)) {
        this.tokenPrices.set(token.id, token.current_price)
      }
    })
  }
}

const priceEngine = new GlobalPriceEngine()
priceEngine.start()

// Start crypto price fetcher for real prices
cryptoPriceFetcher.setDatabase(db)
cryptoPriceFetcher.start()

// API Routes
app.get('/api/price', (req, res) => {
  const tokenSymbol = (req.query.symbol as string) || 'BATR'

  // Get token from database
  const token = db.prepare('SELECT * FROM tokens WHERE symbol = ?').get(tokenSymbol) as any

  if (!token) {
    return res.status(404).json({ error: 'Token not found' })
  }

  res.json({
    price: token.current_price,
    history: priceEngine.getPriceHistory(tokenSymbol, 120),
    timestamp: Date.now()
  })
})

app.get('/api/player/:fid', (req, res) => {
  const player = db.prepare('SELECT * FROM players WHERE farcaster_fid = ?').get(req.params.fid)
  if (!player) {
    return res.json(null)
  }
  res.json(player)
})

app.post('/api/player/create', (req, res) => {
  const { username, fid, displayName, pfpUrl } = req.body

  const existing = db.prepare('SELECT * FROM players WHERE farcaster_fid = ?').get(fid)

  if (existing) {
    db.prepare('UPDATE players SET farcaster_username = ?, display_name = ?, pfp_url = ?, updated_at = ? WHERE farcaster_fid = ?').run(
      username,
      displayName,
      pfpUrl,
      Date.now(),
      fid
    )
    return res.json(existing)
  }

  db.prepare('INSERT INTO players (farcaster_fid, farcaster_username, display_name, pfp_url, cash, high_score, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
    fid,
    username,
    displayName,
    pfpUrl,
    250,
    250,
    Date.now(),
    Date.now()
  )

  const newPlayer = db.prepare('SELECT * FROM players WHERE farcaster_fid = ?').get(fid)
  res.json(newPlayer)
})

app.post('/api/player/:fid/update', (req, res) => {
  const { cash, high_score } = req.body
  db.prepare('UPDATE players SET cash = ?, high_score = ?, updated_at = ? WHERE farcaster_fid = ?').run(
    cash,
    high_score,
    Date.now(),
    req.params.fid
  )
  res.json({ success: true })
})

app.post('/api/position/open', (req, res) => {
  const { id, player_fid, token_symbol, type, entry_price, leverage, size, collateral } = req.body

  // Get token_id from symbol
  const token = db.prepare('SELECT id FROM tokens WHERE symbol = ?').get(token_symbol || 'BATR') as { id: number } | undefined

  if (!token) {
    return res.status(400).json({ error: 'Invalid token' })
  }

  db.prepare('INSERT INTO positions (id, player_fid, token_id, type, entry_price, leverage, size, collateral, opened_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    id,
    player_fid,
    token.id,
    type,
    entry_price,
    leverage,
    size,
    collateral,
    Date.now()
  )
  res.json({ success: true })
})

app.post('/api/position/close', (req, res) => {
  const { id, close_price, pnl, is_liquidated } = req.body
  db.prepare('UPDATE positions SET closed_at = ?, close_price = ?, pnl = ?, is_liquidated = ? WHERE id = ?').run(
    Date.now(),
    close_price,
    pnl,
    is_liquidated ? 1 : 0,
    id
  )
  res.json({ success: true })
})

app.get('/api/positions/:fid', (req, res) => {
  const positions = db.prepare('SELECT * FROM positions WHERE player_fid = ? ORDER BY opened_at DESC').all(req.params.fid)
  res.json(positions)
})

app.get('/api/positions/:fid/open', (req, res) => {
  const positions = db.prepare(`
    SELECT p.*, t.symbol as token_symbol
    FROM positions p
    LEFT JOIN tokens t ON p.token_id = t.id
    WHERE p.player_fid = ? AND p.closed_at IS NULL
    ORDER BY p.opened_at DESC
  `).all(req.params.fid)
  res.json(positions)
})

app.get('/api/positions/:fid/closed', (req, res) => {
  const positions = db.prepare(`
    SELECT p.*, t.symbol as token_symbol
    FROM positions p
    LEFT JOIN tokens t ON p.token_id = t.id
    WHERE p.player_fid = ? AND p.closed_at IS NOT NULL
    ORDER BY p.closed_at DESC
  `).all(req.params.fid)
  res.json(positions)
})

app.get('/api/player/:fid/stats', (req, res) => {
  const fid = req.params.fid
  const player = db.prepare('SELECT * FROM players WHERE farcaster_fid = ?').get(fid) as any

  if (!player) {
    return res.json({
      farcaster_fid: parseInt(fid),
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

  const closedPositions = db.prepare('SELECT * FROM positions WHERE player_fid = ? AND closed_at IS NOT NULL').all(fid) as any[]
  const total_trades = closedPositions.length
  const winning_trades = closedPositions.filter(p => p.pnl > 0).length
  const losing_trades = closedPositions.filter(p => p.pnl <= 0).length
  const total_volume = closedPositions.reduce((sum, p) => sum + p.size, 0)
  const biggest_win = Math.max(...closedPositions.map(p => p.pnl), 0)
  const biggest_loss = Math.min(...closedPositions.map(p => p.pnl), 0)
  const total_pnl = closedPositions.reduce((sum, p) => sum + p.pnl, 0)
  const avg_hold_time = total_trades > 0
    ? closedPositions.reduce((sum, p) => sum + (p.closed_at - p.opened_at), 0) / total_trades
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
})

app.post('/api/player/:fid/submit', (req, res) => {
  const fid = req.params.fid
  const { cash } = req.body

  const allPlayers = db.prepare('SELECT farcaster_fid, submitted_cash FROM players').all() as { farcaster_fid: number, submitted_cash: number }[]
  const { rank, position } = calculateRank(cash, allPlayers)

  db.prepare('UPDATE players SET submitted_cash = ?, rank = ?, updated_at = ? WHERE farcaster_fid = ?').run(
    cash,
    rank,
    Date.now(),
    fid
  )

  const updatedPlayers = db.prepare('SELECT farcaster_fid, submitted_cash FROM players WHERE submitted_cash > 0').all() as { farcaster_fid: number, submitted_cash: number }[]
  updatedPlayers.forEach((player) => {
    const { rank: newRank } = calculateRank(player.submitted_cash, updatedPlayers)
    db.prepare('UPDATE players SET rank = ? WHERE farcaster_fid = ?').run(newRank, player.farcaster_fid)
  })

  res.json({ success: true, rank, position })
})

app.get('/api/leaderboard', (req, res) => {
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

  // Get all players who have at least one trade
  const players = db.prepare('SELECT farcaster_fid, farcaster_username, display_name, pfp_url, cash, high_score FROM players').all() as any[]

  // Calculate stats for each player based on positions in the time range
  const leaderboard = players.map(player => {
    const positions = db.prepare(`
      SELECT pnl, size, opened_at, closed_at
      FROM positions
      WHERE player_fid = ? AND closed_at IS NOT NULL AND closed_at >= ?
    `).all(player.farcaster_fid, timeThreshold) as any[]

    if (positions.length === 0) return null

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
  }).filter(p => p !== null && p.total_trades > 0) // Only include players with trades

  res.json(leaderboard)
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
app.get('/api/admin/tokens', isAdmin, (req, res) => {
  const tokens = db.prepare('SELECT * FROM tokens ORDER BY created_at DESC').all()
  res.json(tokens)
})

// Admin: Add token
app.post('/api/admin/tokens', isAdmin, async (req, res) => {
  const { symbol, name, initial_price, is_real_crypto } = req.body

  try {
    let logoUrl = null

    // If it's a real crypto, fetch logo from Binance
    if (is_real_crypto) {
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

    // Insert token with logo URL
    const result = db.prepare('INSERT INTO tokens (symbol, name, initial_price, current_price, is_active, is_real_crypto, logo_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
      symbol,
      name,
      initial_price || 0,
      initial_price || 0,
      1,
      is_real_crypto ? 1 : 0,
      logoUrl,
      Date.now()
    )

    const tokenId = result.lastInsertRowid

    // Initialize price history with initial price (create 120 historical points)
    const now = Date.now()
    for (let i = 119; i >= 0; i--) {
      const timestamp = now - (i * 1000) // 1 second intervals
      db.prepare('INSERT INTO price_history (token_id, price, timestamp) VALUES (?, ?, ?)').run(
        tokenId,
        initial_price,
        timestamp
      )
    }

    // Reload price engine to include new token
    priceEngine.reloadTokens()

    // If it's a real crypto token, reload Binance WebSocket
    if (is_real_crypto) {
      cryptoPriceFetcher.reloadTokens()
    }

    res.json({ success: true, logoUrl })
  } catch (error: any) {
    res.status(400).json({ error: error.message })
  }
})

// Admin: Update token
app.put('/api/admin/tokens/:id', isAdmin, (req, res) => {
  const { name, is_active, max_leverage } = req.body

  try {
    db.prepare('UPDATE tokens SET name = ?, is_active = ?, max_leverage = ? WHERE id = ?').run(
      name,
      is_active ? 1 : 0,
      max_leverage || 10,
      req.params.id
    )
    res.json({ success: true })
  } catch (error: any) {
    res.status(400).json({ error: error.message })
  }
})

// Admin: Delete token
app.delete('/api/admin/tokens/:id', isAdmin, (req, res) => {
  try {
    // Check if there are any positions using this token
    const positionsCount = db.prepare('SELECT COUNT(*) as count FROM positions WHERE token_id = ?').get(req.params.id) as { count: number }

    if (positionsCount.count > 0) {
      return res.status(400).json({ error: `Cannot delete token: ${positionsCount.count} position(s) exist for this token. Please close all positions first or deactivate the token instead.` })
    }

    // Delete price history for this token
    db.prepare('DELETE FROM price_history WHERE token_id = ?').run(req.params.id)

    // Delete the token
    db.prepare('DELETE FROM tokens WHERE id = ?').run(req.params.id)

    res.json({ success: true })
  } catch (error: any) {
    res.status(400).json({ error: error.message })
  }
})

// Admin: Count players below threshold
app.get('/api/admin/players/count', isAdmin, (req, res) => {
  try {
    const threshold = parseFloat(req.query.threshold as string)

    if (isNaN(threshold)) {
      return res.status(400).json({ error: 'Invalid threshold' })
    }

    const result = db.prepare('SELECT COUNT(*) as count FROM players WHERE cash < ?').get(threshold) as { count: number }
    res.json({ count: result.count })
  } catch (error: any) {
    res.status(400).json({ error: error.message })
  }
})

// Admin: Bulk balance update
app.post('/api/admin/players/bulk-balance', isAdmin, (req, res) => {
  try {
    const { threshold, amount } = req.body

    if (isNaN(threshold) || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Invalid parameters' })
    }

    // Get affected players
    const affectedPlayers = db.prepare('SELECT farcaster_fid, cash FROM players WHERE cash < ?').all(threshold) as any[]

    // Update each player's balance
    const updateStmt = db.prepare('UPDATE players SET cash = cash + ?, updated_at = ? WHERE farcaster_fid = ?')
    const now = Date.now()

    affectedPlayers.forEach(player => {
      updateStmt.run(amount, now, player.farcaster_fid)
    })

    res.json({ success: true, updated: affectedPlayers.length })
  } catch (error: any) {
    res.status(400).json({ error: error.message })
  }
})

// Admin: Get all config
app.get('/api/admin/config', isAdmin, (req, res) => {
  const configs = db.prepare('SELECT * FROM config ORDER BY key').all()
  res.json(configs)
})

// Admin: Update config
app.put('/api/admin/config/:key', isAdmin, (req, res) => {
  const { value } = req.body

  try {
    db.prepare('UPDATE config SET value = ?, updated_at = ? WHERE key = ?').run(
      value,
      Date.now(),
      req.params.key
    )
    res.json({ success: true })
  } catch (error: any) {
    res.status(400).json({ error: error.message })
  }
})

// Public: Get active tokens
app.get('/api/tokens', (req, res) => {
  const tokens = db.prepare('SELECT * FROM tokens WHERE is_active = 1 ORDER BY created_at ASC').all()
  res.json(tokens)
})

// Public: Get config
app.get('/api/config', (req, res) => {
  const configs = db.prepare('SELECT * FROM config').all()
  const configObj: any = {}
  configs.forEach((c: any) => {
    configObj[c.key] = c.value
  })
  res.json(configObj)
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

  const imageUrl = `https://basetraders.vercel.app/api/share-image-png?token=${encodeURIComponent(token)}&leverage=${leverage}&profit=${profit}&profitPercent=${profitPercent}`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta property="fc:frame" content="vNext" />
  <meta property="fc:frame:image" content="${imageUrl}" />
  <meta property="fc:frame:button:1" content="Open" />
  <meta property="fc:frame:button:1:action" content="link" />
  <meta property="fc:frame:button:1:target" content="https://farcaster.xyz/miniapps/GlmJsUyW-yPo/based-traders" />

  <meta property="og:url" content="https://farcaster.xyz/miniapps/GlmJsUyW-yPo/based-traders" />
  <meta property="og:title" content="Profitable Trade on Based Traders!" />
  <meta property="og:description" content="${leverage}x ${token} position closed with +$${profit} profit!" />
</head>
<body>
  <h1>Profitable Trade!</h1>
  <p>${leverage}x ${token} position closed with +$${profit} profit (+${profitPercent}%)</p>
</body>
</html>
  `

  res.setHeader('Content-Type', 'text/html')
  res.send(html)
})

// Share image PNG generation endpoint
app.get('/api/share-image-png', async (req, res) => {
  const token = req.query.token as string || 'BATR'
  const leverage = req.query.leverage as string || '1'
  const profit = req.query.profit as string || '0'
  const profitPercent = req.query.profitPercent as string || '0'

  // Create canvas
  const canvas = createCanvas(1200, 630)
  const ctx = canvas.getContext('2d')

  // Background gradient (approximation with solid colors since canvas doesn't support CSS gradients the same way)
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
    // Draw logo centered at top (150x150 size)
    ctx.drawImage(logo, 525, 30, 150, 150)
  } catch (error) {
    console.error('Failed to load menulogo.png:', error)
  }

  // Title
  ctx.fillStyle = '#22c55e'
  ctx.font = 'bold 60px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('Profitable Trade!', 600, 240)

  // Stats background rounded rectangle
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

  // Set response headers
  res.setHeader('Content-Type', 'image/png')
  res.setHeader('Cache-Control', 'public, max-age=3600')

  // Send image
  canvas.createPNGStream().pipe(res)
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
wss.on('connection', (ws) => {
  // Send initial prices for all tokens
  const tokens = db.prepare('SELECT symbol, current_price FROM tokens WHERE is_active = 1').all() as { symbol: string, current_price: number }[]
  const prices: Record<string, number> = {}
  tokens.forEach(t => {
    prices[t.symbol] = t.current_price
  })

  ws.send(JSON.stringify({
    prices,
    timestamp: Date.now()
  }))
})

const PORT = process.env.PORT || 3000

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`)
  console.log(`📡 WebSocket running on ws://localhost:${PORT}`)
  console.log(`🌍 Mode: ${isDev ? 'Development' : 'Production'}`)
})
