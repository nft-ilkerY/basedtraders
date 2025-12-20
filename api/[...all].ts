// Vercel Serverless Function - Catch-all for Express app
import type { VercelRequest, VercelResponse } from '@vercel/node'
import app from '../server/unified.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Pass request to Express app
  return app(req as any, res as any)
}
