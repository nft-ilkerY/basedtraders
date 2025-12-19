import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const INITIAL_CASH = 250

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method === 'POST') {
    try {
      const { username, fid, displayName, pfpUrl } = req.body

      if (!fid) {
        return res.status(400).json({ error: 'FID is required' })
      }

      // Check if player exists
      const { data: existing, error: checkError } = await supabase
        .from('players')
        .select('*')
        .eq('farcaster_fid', fid)
        .single()

      if (existing) {
        // Update existing player
        const { data: updated, error: updateError } = await supabase
          .from('players')
          .update({
            farcaster_username: username,
            display_name: displayName,
            pfp_url: pfpUrl,
            updated_at: Date.now()
          })
          .eq('farcaster_fid', fid)
          .select()
          .single()

        if (updateError) {
          throw updateError
        }

        return res.status(200).json(updated)
      }

      // Create new player
      const { data: newPlayer, error: createError } = await supabase
        .from('players')
        .insert({
          farcaster_fid: fid,
          farcaster_username: username,
          display_name: displayName,
          pfp_url: pfpUrl,
          cash: INITIAL_CASH,
          high_score: INITIAL_CASH,
          created_at: Date.now(),
          updated_at: Date.now()
        })
        .select()
        .single()

      if (createError) {
        throw createError
      }

      return res.status(200).json(newPlayer)
    } catch (error: any) {
      console.error('Error creating/updating player:', error)
      return res.status(500).json({ error: error.message })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
