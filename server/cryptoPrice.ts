// Real-time Crypto Price Fetcher using Binance WebSocket (Free, Real-time)
import WebSocket from 'ws'
import { supabase } from './db.js'

interface BinanceTickerData {
  s: string  // Symbol (e.g., "BTCUSDT")
  c: string  // Current price
}

class CryptoPriceFetcher {
  private prices: Map<string, number> = new Map()
  private lastUpdate: number = 0
  private ws: WebSocket | null = null
  private reconnectTimeout: NodeJS.Timeout | null = null
  private symbols: string[] = [] // Will be loaded from database

  constructor() {
    // Prices will be initialized when loadSymbols is called
  }

  // Deprecated - no longer needed with Supabase
  setDatabase(_database: any) {
    console.log('⚠️  setDatabase() is deprecated - using Supabase directly')
  }

  private async loadSymbolsFromDB() {
    try {
      const { data: tokens, error } = await supabase
        .from('tokens')
        .select('symbol')
        .eq('is_real_crypto', true)
        .eq('is_active', true)

      if (error || !tokens || tokens.length === 0) {
        console.warn('⚠️  No real crypto tokens found in database')
        return []
      }

      this.symbols = tokens.map(t => `${t.symbol.toLowerCase()}usdt`)
      tokens.forEach(t => {
        if (!this.prices.has(t.symbol)) {
          this.prices.set(t.symbol, 0)
        }
      })

      return tokens.map(t => t.symbol)
    } catch (error) {
      console.error('Error loading tokens from database:', error)
      return []
    }
  }

  async start() {
    // Load symbols from database
    const symbols = await this.loadSymbolsFromDB()

    if (symbols.length === 0) {
      console.log('⚠️  No real crypto tokens found in database')
      return
    }

    // Initial fetch from Binance REST API
    await this.fetchInitialPrices()

    // Connect to Binance WebSocket for real-time updates
    this.connectWebSocket()

    console.log('✅ Crypto Price Fetcher started (real-time via Binance WebSocket)')
  }

  private async fetchInitialPrices() {
    try {
      if (this.symbols.length === 0) return

      // Build symbols array for Binance API
      const symbolsJson = JSON.stringify(this.symbols.map(s => s.toUpperCase()))
      const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbols=${symbolsJson}`)
      const data = await response.json() as Array<{ symbol: string, price: string }>

      data.forEach(item => {
        const price = parseFloat(item.price)
        // Extract token symbol from Binance symbol (e.g., BTCUSDT -> BTC)
        const tokenSymbol = item.symbol.replace('USDT', '')
        this.prices.set(tokenSymbol, price)
      })

      this.lastUpdate = Date.now()
      const priceLog = Array.from(this.prices.entries())
        .map(([sym, price]) => `${sym}=$${price.toFixed(2)}`)
        .join(', ')
      console.log(`📊 Initial prices: ${priceLog}`)
    } catch (error) {
      console.error('Error fetching initial crypto prices:', error)
    }
  }

  private connectWebSocket() {
    try {
      if (this.symbols.length === 0) return

      // Binance WebSocket streams for real-time ticker data
      const streams = this.symbols.map(s => `${s}@ticker`).join('/')
      const wsUrl = `wss://stream.binance.com:9443/stream?streams=${streams}`

      this.ws = new WebSocket(wsUrl)

      this.ws.on('open', () => {
        console.log(`🔌 Connected to Binance WebSocket for real-time prices (${this.symbols.length} tokens)`)
      })

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString())

          if (message.data && message.data.c) {
            const ticker: BinanceTickerData = message.data
            const price = parseFloat(ticker.c)

            // Extract token symbol from Binance symbol (e.g., BTCUSDT -> BTC)
            const tokenSymbol = ticker.s.replace('USDT', '')
            this.prices.set(tokenSymbol, price)

            this.lastUpdate = Date.now()
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
        }
      })

      this.ws.on('error', (error) => {
        console.error('Binance WebSocket error:', error)
      })

      this.ws.on('close', () => {
        console.log('⚠️  Binance WebSocket disconnected, reconnecting in 3s...')
        this.reconnectTimeout = setTimeout(() => {
          this.connectWebSocket()
        }, 3000)
      })
    } catch (error) {
      console.error('Error connecting to Binance WebSocket:', error)
      this.reconnectTimeout = setTimeout(() => {
        this.connectWebSocket()
      }, 3000)
    }
  }

  stop() {
    if (this.ws) {
      this.ws.close()
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
    }
  }

  getPrice(symbol: string): number {
    return this.prices.get(symbol) || 0
  }

  getAllPrices(): Record<string, number> {
    return {
      BTC: this.prices.get('BTC') || 0,
      SOL: this.prices.get('SOL') || 0,
      ETH: this.prices.get('ETH') || 0
    }
  }

  getLastUpdate(): number {
    return this.lastUpdate
  }

  reloadTokens() {
    console.log('🔄 Reloading crypto tokens and reconnecting to Binance...')

    // Stop current WebSocket
    this.stop()

    // Restart with new symbols
    setTimeout(async () => {
      await this.start()
    }, 1000)
  }
}

export const cryptoPriceFetcher = new CryptoPriceFetcher()
