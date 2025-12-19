// Client-side Price Engine - Connects to WebSocket for global prices
class PriceEngine {
  private tokenPrices: Map<string, number> = new Map() // symbol -> price
  private listeners: Map<string, Set<(price: number) => void>> = new Map() // symbol -> callbacks
  private ws: WebSocket | null = null
  private reconnectTimeout: number | null = null

  constructor() {
    this.connect()
  }

  private connect() {
    try {
      // Use relative WebSocket URL based on current location
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${protocol}//${window.location.host}/ws`
      this.ws = new WebSocket(wsUrl)

      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        // Server now sends { prices: { BATR: 100, BTC: 50000, ... } }
        if (data.prices) {
          Object.entries(data.prices).forEach(([symbol, price]) => {
            this.tokenPrices.set(symbol, price as number)
            this.notifyListenersForToken(symbol)
          })
        }
      }

      this.ws.onclose = () => {
        this.reconnectTimeout = setTimeout(() => this.connect(), 3000)
      }
    } catch (error) {
      this.reconnectTimeout = setTimeout(() => this.connect(), 3000)
    }
  }

  start() {
    // WebSocket handles updates automatically
  }

  stop() {
    if (this.ws) {
      this.ws.close()
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
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
