import { createClient, RealtimeChannel } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL!
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY!

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Supabase credentials not found in environment variables')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

/**
 * Supabase Realtime Price Engine
 * Replaces WebSocket for real-time price updates
 */
class SupabasePriceEngine {
  private channel: RealtimeChannel | null = null
  private listeners: Map<string, Set<(price: number) => void>> = new Map()
  private currentPrices: Map<string, number> = new Map()
  private isStarted: boolean = false

  start() {
    if (this.isStarted) return

    console.log('🚀 Starting Supabase Realtime Price Engine...')

    // Subscribe to price_updates channel
    this.channel = supabase.channel('price_updates')

    // Listen for price broadcasts
    this.channel
      .on('broadcast', { event: 'price_update' }, (payload) => {
        const { prices } = payload.payload as {
          prices: Record<string, number>
          timestamp: number
        }

        // Update current prices and notify listeners
        Object.entries(prices).forEach(([symbol, price]) => {
          this.currentPrices.set(symbol, price)
          this.notifyListeners(symbol, price)
        })
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Subscribed to price updates')
          this.isStarted = true
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Error subscribing to price updates')
        }
      })

    // Fetch initial prices
    this.fetchInitialPrices()
  }

  private async fetchInitialPrices() {
    try {
      const { data: tokens, error } = await supabase
        .from('tokens')
        .select('symbol, current_price')
        .eq('is_active', true)

      if (error) throw error

      tokens?.forEach((token) => {
        this.currentPrices.set(token.symbol, token.current_price)
      })

      console.log('✅ Loaded initial prices for', tokens?.length, 'tokens')
    } catch (error) {
      console.error('Failed to fetch initial prices:', error)
    }
  }

  subscribe(tokenSymbol: string, callback: (price: number) => void) {
    if (!this.listeners.has(tokenSymbol)) {
      this.listeners.set(tokenSymbol, new Set())
    }

    this.listeners.get(tokenSymbol)!.add(callback)

    // Immediately call with current price if available
    const currentPrice = this.currentPrices.get(tokenSymbol)
    if (currentPrice !== undefined) {
      callback(currentPrice)
    }

    // Return unsubscribe function
    return () => {
      const tokenListeners = this.listeners.get(tokenSymbol)
      if (tokenListeners) {
        tokenListeners.delete(callback)
        if (tokenListeners.size === 0) {
          this.listeners.delete(tokenSymbol)
        }
      }
    }
  }

  private notifyListeners(tokenSymbol: string, price: number) {
    const tokenListeners = this.listeners.get(tokenSymbol)
    if (tokenListeners) {
      tokenListeners.forEach((callback) => callback(price))
    }
  }

  getCurrentPrice(tokenSymbol: string): number | undefined {
    return this.currentPrices.get(tokenSymbol)
  }

  stop() {
    if (this.channel) {
      this.channel.unsubscribe()
      this.channel = null
    }
    this.isStarted = false
    console.log('🛑 Stopped Supabase Realtime Price Engine')
  }
}

export const priceEngine = new SupabasePriceEngine()
export default priceEngine
