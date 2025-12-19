// Client-side Price Engine - Hybrid: Real prices for crypto, simulated for game tokens
class PriceEngine {
  private tokenPrices: Map<string, number> = new Map() // symbol -> price
  private listeners: Map<string, Set<(price: number) => void>> = new Map() // symbol -> callbacks
  private intervalId: number | null = null
  private cryptoFetchInterval: number | null = null
  private volatility: number = 0.004
  private trend: number = 0
  private trendChangeCounter: number = 0

  // Game tokens (simulated) - all others are real crypto fetched from Binance
  private gameTokens = new Set(['BATR'])

  constructor() {
    // Initialize with default prices
    this.tokenPrices.set('BATR', 100)
    this.tokenPrices.set('BTC', 50000)
    this.tokenPrices.set('ETH', 3000)
    this.tokenPrices.set('SOL', 100)

    // Fetch real prices immediately
    this.fetchRealCryptoPrices()
  }

  start() {
    if (this.intervalId) return

    // Update game token prices every second
    this.intervalId = window.setInterval(() => {
      this.updateGameTokenPrices()
    }, 1000)

    // Fetch real crypto prices every 5 seconds
    this.cryptoFetchInterval = window.setInterval(() => {
      this.fetchRealCryptoPrices()
    }, 5000)
  }

  private async fetchRealCryptoPrices() {
    try {
      // Fetch from Binance API (public, no rate limit for simple requests)
      const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT']
      const promises = symbols.map(symbol =>
        fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`)
          .then(res => res.json())
      )

      const results = await Promise.all(promises)

      results.forEach((data: any) => {
        if (data && data.symbol && data.price) {
          const symbol = data.symbol.replace('USDT', '')
          const price = parseFloat(data.price)

          this.tokenPrices.set(symbol, price)
          this.notifyListenersForToken(symbol)
        }
      })
    } catch (error) {
      console.error('Failed to fetch crypto prices:', error)
      // Keep using last known prices if fetch fails
    }
  }

  private updateGameTokenPrices() {
    // Update trend periodically
    this.trendChangeCounter++
    if (this.trendChangeCounter > 60 + Math.random() * 120) {
      const randomTrend = (Math.random() - 0.5) * 0.0002
      this.trend = randomTrend
      this.trendChangeCounter = 0
    }

    // Only update game tokens (BATR, etc)
    this.gameTokens.forEach(symbol => {
      const price = this.tokenPrices.get(symbol) || 100
      let newPrice = price

      // Random price movements
      if (Math.random() < 0.03) {
        // Small movement (3% chance)
        const amount = (price * 0.001) + Math.random() * (price * 0.003)
        const direction = Math.random() > 0.5 ? 1 : -1
        newPrice = price + (amount * direction)
      } else if (Math.random() < 0.0008) {
        // Crash (0.08% chance)
        const dropPercent = 0.02 + Math.random() * 0.03
        newPrice = price * (1 - dropPercent)
      } else if (Math.random() < 0.0008) {
        // Pump (0.08% chance)
        const risePercent = 0.02 + Math.random() * 0.03
        newPrice = price * (1 + risePercent)
      } else {
        // Normal volatility
        const randomComponent = (Math.random() - 0.5) * 2 * this.volatility
        const change = this.trend + randomComponent
        newPrice = price * (1 + change)
      }

      // Ensure price doesn't go too low
      newPrice = Math.max(1, newPrice)

      // Update price
      this.tokenPrices.set(symbol, newPrice)
      this.notifyListenersForToken(symbol)
    })
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    if (this.cryptoFetchInterval) {
      clearInterval(this.cryptoFetchInterval)
      this.cryptoFetchInterval = null
    }
  }

  getCurrentPrice(symbol: string = 'BATR'): number {
    return this.tokenPrices.get(symbol) || 100
  }

  subscribe(symbol: string, callback: (price: number) => void) {
    if (!this.listeners.has(symbol)) {
      this.listeners.set(symbol, new Set())
    }
    this.listeners.get(symbol)!.add(callback)

    // Immediately send current price if available
    const currentPrice = this.tokenPrices.get(symbol)
    if (currentPrice !== undefined) {
      callback(currentPrice)
    }

    return () => {
      const symbolListeners = this.listeners.get(symbol)
      if (symbolListeners) {
        symbolListeners.delete(callback)
      }
    }
  }

  private notifyListenersForToken(symbol: string) {
    const symbolListeners = this.listeners.get(symbol)
    if (symbolListeners) {
      const price = this.tokenPrices.get(symbol)!
      symbolListeners.forEach(callback => callback(price))
    }
  }
}

// Singleton instance
export const priceEngine = new PriceEngine()

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    priceEngine.stop()
  })
}
