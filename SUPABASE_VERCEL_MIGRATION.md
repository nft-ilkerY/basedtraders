# 🚀 Supabase + Vercel Migration Guide

## Overview

This guide helps you migrate from:
- **SQLite → Supabase (PostgreSQL)**
- **Local Server → Vercel Serverless**
- **WebSocket → Supabase Realtime**

## Prerequisites

1. Supabase account ([supabase.com](https://supabase.com))
2. Vercel account ([vercel.com](https://vercel.com))
3. Node.js 18+ installed

---

## Part 1: Supabase Setup

### Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **"New Project"**
3. Fill in details:
   - **Name**: based-traders
   - **Database Password**: (save this!)
   - **Region**: Choose closest to your users
4. Wait for project to initialize (~2 minutes)

### Step 2: Run Schema Migration

1. Open Supabase Dashboard → **SQL Editor**
2. Copy contents of `supabase-schema.sql`
3. Paste and click **"Run"**
4. Verify tables created in **Table Editor**

### Step 3: Get Supabase Credentials

In Supabase Dashboard → **Settings** → **API**:

Copy these values:
- **Project URL**: `https://xxxxx.supabase.co`
- **anon/public key**: `eyJhbGciOi...`
- **service_role key**: `eyJhbGciOi...` (⚠️ Keep secret!)

### Step 4: Migrate Data from SQLite

```bash
# Install Supabase client
npm install @supabase/supabase-js

# Add to .env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOi...

# Run migration script
npx tsx scripts/migrate-to-supabase.ts
```

### Step 5: Enable Realtime

In Supabase Dashboard → **Database** → **Replication**:

1. Find `tokens` table
2. Enable **Realtime** for it
3. Click **Save**

---

## Part 2: Code Migration

### Step 1: Install Dependencies

```bash
npm install @supabase/supabase-js
npm install --save-dev @types/node
```

### Step 2: Update Environment Variables

Create `.env.local` for local development:

```bash
# Supabase
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_KEY=eyJhbGciOi...

# Existing vars
ADMIN_FIDS=326821
ACHIEVEMENT_CONTRACT_ADDRESS=0x...
MINT_WALLET_PRIVATE_KEY=0x...
BASE_RPC_URL=https://mainnet.base.org
```

### Step 3: Replace Database Layer

**Option A: Direct Replacement (Easier)**

```bash
# Backup old db.ts
mv server/db.ts server/db.ts.backup

# Rename supabase-db.ts to db.ts
mv server/supabase-db.ts server/db.ts
```

**Option B: Gradual Migration**

Update imports gradually:
```typescript
// Old
import db from './db.js'

// New
import db from './supabase-db.js'
```

### Step 4: Update Price Engine

Replace `src/lib/priceEngine.ts`:

```typescript
// Old WebSocket-based
import { priceEngine } from './priceEngine'

// New Supabase Realtime-based
import { priceEngine } from './supabaseRealtime'
```

---

## Part 3: Vercel Deployment

### Step 1: Connect Repository

1. Go to [vercel.com](https://vercel.com)
2. Click **"Add New Project"**
3. Import your GitHub repository
4. Select **based-traders**

### Step 2: Configure Build Settings

Vercel should auto-detect Vite. Verify:

- **Framework Preset**: Vite
- **Root Directory**: `./`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`

### Step 3: Add Environment Variables

In Vercel Dashboard → **Settings** → **Environment Variables**:

Add ALL variables from `.env.local`:

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_KEY=eyJhbGciOi...
ADMIN_FIDS=326821
ACHIEVEMENT_CONTRACT_ADDRESS=0x...
MINT_WALLET_PRIVATE_KEY=0x...
BASE_RPC_URL=https://mainnet.base.org
```

⚠️ **Important**: Add to **Production**, **Preview**, and **Development**

### Step 4: Deploy

1. Click **"Deploy"**
2. Wait for build to complete
3. Visit your deployment URL

---

## Part 4: Price Engine Worker

Since Vercel functions timeout after 10 seconds, we need a separate worker for price updates.

### Option A: Vercel Cron Job (Recommended)

Create `api/cron/update-prices.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'
import { cryptoPriceFetcher } from '../../server/cryptoPrice'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export const config = {
  maxDuration: 60, // 60 seconds
}

export default async function handler(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    // Get all active tokens
    const { data: tokens } = await supabase
      .from('tokens')
      .select('*')
      .eq('is_active', true)

    if (!tokens) {
      return new Response('No tokens found', { status: 404 })
    }

    const prices: Record<string, number> = {}

    for (const token of tokens) {
      let price = token.current_price

      if (token.is_real_crypto) {
        // Fetch real price from Binance/CoinGecko
        const realPrice = await fetchRealPrice(token.symbol)
        if (realPrice > 0) {
          price = realPrice
        }
      } else {
        // Simulate price movement for game tokens
        const volatility = 0.004
        const change = (Math.random() - 0.5) * 2 * volatility
        price = price * (1 + change)
      }

      // Update price in database
      await supabase
        .from('tokens')
        .update({ current_price: price })
        .eq('id', token.id)

      // Save to price history
      await supabase
        .from('price_history')
        .insert({
          token_id: token.id,
          price: price,
          timestamp: Date.now()
        })

      prices[token.symbol] = price
    }

    // Broadcast via Supabase Realtime
    const channel = supabase.channel('price_updates')
    await channel.send({
      type: 'broadcast',
      event: 'price_update',
      payload: { prices, timestamp: Date.now() }
    })

    return new Response(JSON.stringify({ success: true, prices }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

async function fetchRealPrice(symbol: string): Promise<number> {
  // Implement Binance/CoinGecko API call
  // ... existing cryptoPrice.ts logic
  return 0
}
```

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/update-prices",
      "schedule": "*/1 * * * *"
    }
  ]
}
```

### Option B: External Worker (Alternative)

Deploy price updater to:
- Railway.app
- Render.com
- Fly.io

---

## Part 5: Testing

### Local Testing

```bash
# Install Vercel CLI
npm i -g vercel

# Link project
vercel link

# Pull environment variables
vercel env pull .env.local

# Run locally
vercel dev
```

### Production Testing Checklist

- [ ] All pages load correctly
- [ ] User can login with Farcaster
- [ ] Trading works (open/close positions)
- [ ] Prices update in real-time
- [ ] Leaderboard displays
- [ ] Admin panel accessible
- [ ] Achievement minting works

---

## Part 6: Monitoring

### Vercel Dashboard

Monitor:
- Function logs
- Error rates
- Response times

### Supabase Dashboard

Monitor:
- Database size
- Query performance
- Realtime connections

---

## Troubleshooting

### Issue: Prices not updating

**Solution**: Check Vercel Cron logs, ensure `CRON_SECRET` is set

### Issue: Database connection errors

**Solution**: Verify `SUPABASE_SERVICE_KEY` is set correctly

### Issue: "Module not found" errors

**Solution**: Run `npm install` and redeploy

### Issue: Realtime not working

**Solution**: Check Supabase → Database → Replication is enabled for `tokens` table

---

## Rollback Plan

If something goes wrong:

1. Keep Cloudflare deployment running
2. Test Vercel deployment on preview URL first
3. Only switch DNS when fully tested

---

## Cost Estimate

### Supabase (Free Tier)
- 500 MB database
- 2 GB bandwidth
- Unlimited API requests

**Estimated**: $0/month (under limits)

### Vercel (Hobby Plan)
- 100 GB bandwidth
- Serverless function executions: 100 GB-hours
- Cron jobs included

**Estimated**: $0/month (under limits)

---

## Next Steps

1. ✅ Create Supabase project
2. ✅ Run schema migration
3. ✅ Migrate data
4. ✅ Update code
5. ✅ Deploy to Vercel
6. ✅ Setup price cron job
7. ✅ Test thoroughly
8. ✅ Switch DNS/domain

---

## Support

If you encounter issues:

1. Check Vercel function logs
2. Check Supabase logs
3. Review this guide
4. Check environment variables

**Ready to migrate!** 🚀
