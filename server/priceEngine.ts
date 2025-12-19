import db from './db'

class GlobalPriceEngine {
  private price: number
  private volatility: number = 0.008
  private upwardBias: number = 0.0002
  private crashProbability: number = 0.001
  private intervalId: NodeJS.Timeout | null = null

  constructor() {
    // Load last price from database or start at 100
    const lastPrice = db.prepare('SELECT price FROM price_history ORDER BY timestamp DESC LIMIT 1').get() as { price: number } | undefined
    this.price = lastPrice?.price || 100
    console.log(`🚀 Price Engine initialized at $${this.price.toFixed(2)}`)
  }

  start() {
    if (this.intervalId) return

    this.intervalId = setInterval(() => {
      this.updatePrice()
    }, 1000)

    console.log('✅ Price Engine started')
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    console.log('🛑 Price Engine stopped')
  }

  private updatePrice() {
    // Check for crash
    if (Math.random() < this.crashProbability) {
      this.triggerCrash()
      return
    }

    // Normal upward trend
    const randomComponent = (Math.random() - 0.5) * 2 * this.volatility
    const change = this.upwardBias + randomComponent
    this.price = Math.max(10, this.price * (1 + change))

    this.savePrice()
  }

  private triggerCrash() {
    const crashPercent = 0.15 + Math.random() * 0.20
    const oldPrice = this.price
    this.price = this.price * (1 - crashPercent)

    console.log(`💥 MARKET CRASH! $${oldPrice.toFixed(2)} -> $${this.price.toFixed(2)} (-${(crashPercent * 100).toFixed(1)}%)`)

    this.savePrice()
  }

  private savePrice() {
    db.prepare('INSERT INTO price_history (price, timestamp) VALUES (?, ?)').run(
      this.price,
      Date.now()
    )
  }

  getCurrentPrice(): number {
    return this.price
  }

  getPriceHistory(limit: number = 120): number[] {
    const rows = db.prepare('SELECT price FROM price_history ORDER BY timestamp DESC LIMIT ?').all(limit) as { price: number }[]
    return rows.reverse().map(r => r.price)
  }
}

export const globalPriceEngine = new GlobalPriceEngine()

// Auto-start when server loads
globalPriceEngine.start()
