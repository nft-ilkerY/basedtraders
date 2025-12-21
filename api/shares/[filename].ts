import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers for all requests
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    const { filename } = req.query

    if (!filename || typeof filename !== 'string') {
      return res.status(400).json({ error: 'Missing filename' })
    }

    // Fetch image from Render server
    const renderUrl = `https://basedtraders.onrender.com/shares/${filename}`

    console.log('🔄 Proxying image from Render:', renderUrl)

    const imageResponse = await fetch(renderUrl)

    if (!imageResponse.ok) {
      console.error('❌ Failed to fetch image from Render:', imageResponse.status)
      return res.status(404).json({ error: 'Image not found' })
    }

    // Get image buffer
    const imageBuffer = await imageResponse.arrayBuffer()

    // Set headers for image
    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Content-Disposition', 'inline')
    res.setHeader('Cache-Control', 'public, max-age=3600, immutable')

    // Send image
    res.send(Buffer.from(imageBuffer))
  } catch (error: any) {
    console.error('Error proxying share image:', error)
    res.status(500).json({ error: error.message })
  }
}
