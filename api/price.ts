import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method === 'GET') {
    try {
      const tokenSymbol = (req.query.symbol as string) || 'BATR'

      // Get token info
      const { data: token, error: tokenError } = await supabase
        .from('tokens')
        .select('*')
        .eq('symbol', tokenSymbol)
        .single()

      if (tokenError || !token) {
        return res.status(404).json({ error: 'Token not found' })
      }

      // Get price history (last 120 records)
      const { data: priceHistory, error: historyError } = await supabase
        .from('price_history')
        .select('price')
        .eq('token_id', token.id)
        .order('timestamp', { ascending: false })
        .limit(120)

      if (historyError) {
        throw historyError
      }

      // Reverse to get chronological order
      const history = (priceHistory || [])
        .reverse()
        .map((record) => record.price)

      return res.status(200).json({
        price: token.current_price,
        history,
        timestamp: Date.now()
      })
    } catch (error: any) {
      console.error('Error fetching price:', error)
      return res.status(500).json({ error: error.message })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
