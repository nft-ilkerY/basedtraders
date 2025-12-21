import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers for all requests
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { token, leverage, profit, profitPercent } = req.body

    // Proxy POST request to Render server
    const renderUrl = 'https://basedtraders.onrender.com/api/create-share-image'

    console.log('🔄 Proxying create-share-image POST to Render')

    const renderResponse = await fetch(renderUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token, leverage, profit, profitPercent })
    })

    if (!renderResponse.ok) {
      console.error('❌ Failed to create image on Render:', renderResponse.status)
      return res.status(500).json({ error: 'Failed to create share image' })
    }

    const data = await renderResponse.json()

    // Replace Render URL with Vercel proxy URL
    if (data.success && data.imageUrl) {
      const filename = data.imageUrl.split('/').pop()
      data.imageUrl = `https://basetraders.vercel.app/api/shares/${filename}`
    }

    res.json(data)
  } catch (error: any) {
    console.error('Error proxying create-share-image:', error)
    res.status(500).json({ error: error.message })
  }
}
