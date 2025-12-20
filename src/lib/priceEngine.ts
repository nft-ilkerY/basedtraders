// Client-side Price Engine - Gets all prices from server WebSocket
class PriceEngine {
  private tokenPrices: Map<string, number> = new Map() // symbol -> price
  private listeners: Map<string, Set<(price: number) => void>> = new Map() // symbol -> callbacks
  private serverWs: WebSocket | null = null

  constructor() {
    // Initialize with default prices
    this.tokenPrices.set('BATR', 100)
    this.tokenPrices.set('BTC', 50000)
    this.tokenPrices.set('ETH', 3000)
    this.tokenPrices.set('SOL', 100)

    // Fetch initial prices from API
    this.fetchInitialPrices()
  }

  start() {
    if (this.serverWs) return

    // Connect to server WebSocket for ALL token prices (both real and game)
    this.connectServerWebSocket()
  }

  private async fetchInitialPrices() {
    try {
      // Fetch all active tokens and their current prices
      const response = await fetch('https://basedtraders.onrender.com/api/tokens')
      const tokens = await response.json()

      tokens.forEach((token: any) => {
        this.tokenPrices.set(token.symbol, token.current_price)
      })

      // Notify all listeners with initial prices
      tokens.forEach((token: any) => {
        this.notifyListenersForToken(token.symbol)
      })

      console.log('✅ Loaded initial prices for', tokens.length, 'tokens')
    } catch (error) {
      console.error('Failed to fetch initial prices:', error)
    }
  }

  private connectServerWebSocket() {
    try {
      // Connect to server WebSocket
      const wsUrl = 'wss://basedtraders.onrender.com/ws'

      this.serverWs = new WebSocket(wsUrl)

      this.serverWs.onopen = () => {
        console.log('🔌 Connected to server WebSocket for price updates')
      }

      this.serverWs.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          if (data.prices) {
            // Update all token prices from server broadcast
            Object.entries(data.prices).forEach(([symbol, price]) => {
              this.tokenPrices.set(symbol, price as number)
              this.notifyListenersForToken(symbol)
            })
          }
        } catch (error) {
          console.error('WebSocket message parse error:', error)
        }
      }

      this.serverWs.onerror = (error) => {
        console.error('Server WebSocket error:', error)
      }

      this.serverWs.onclose = () => {
        console.log('⚠️ Server WebSocket closed, reconnecting in 3s...')
        this.serverWs = null
        // Reconnect after 3 seconds
        setTimeout(() => {
          this.connectServerWebSocket()
        }, 3000)
      }
    } catch (error) {
      console.error('Failed to connect to server WebSocket:', error)
      // Retry after 3 seconds
      setTimeout(() => {
        this.connectServerWebSocket()
      }, 3000)
    }
  }

  stop() {
    if (this.serverWs) {
      this.serverWs.close()
      this.serverWs = null
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
