# 📋 Supabase + Vercel Migration Checklist

## Phase 1: Supabase Setup ✅

### 1.1 Create Supabase Project
- [ ] Go to [supabase.com](https://supabase.com) and create account
- [ ] Create new project: **based-traders**
- [ ] Save database password securely
- [ ] Wait for project initialization (~2 min)

### 1.2 Run Database Schema
- [ ] Open Supabase Dashboard → SQL Editor
- [ ] Copy `supabase-schema.sql` content
- [ ] Paste and click "Run"
- [ ] Verify tables in Table Editor:
  - [ ] players
  - [ ] tokens
  - [ ] positions
  - [ ] price_history
  - [ ] config
  - [ ] achievements

### 1.3 Enable Realtime
- [ ] Go to Database → Replication
- [ ] Enable Realtime for `tokens` table
- [ ] Enable Realtime for `price_history` table
- [ ] Click Save

### 1.4 Get API Credentials
- [ ] Go to Settings → API
- [ ] Copy **Project URL**
- [ ] Copy **anon public key**
- [ ] Copy **service_role key** (⚠️ secret!)

---

## Phase 2: Data Migration ✅

### 2.1 Install Dependencies
```bash
npm install @supabase/supabase-js
```

### 2.2 Configure Environment
- [ ] Create `.env.local` file
- [ ] Add Supabase credentials:
```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOi...
```

### 2.3 Run Migration Script
```bash
npm run migrate:supabase
```

- [ ] Verify migration output
- [ ] Check Supabase dashboard for data
- [ ] Verify player count matches
- [ ] Verify positions migrated
- [ ] Verify tokens created

### 2.4 Backup SQLite Database
```bash
cp traders.db traders.db.backup
```

---

## Phase 3: Code Updates ✅

### 3.1 Update package.json
- [ ] Replace `package.json` with `package.json.new`
- [ ] Run `npm install`
- [ ] Verify `@supabase/supabase-js` installed

### 3.2 Update Environment Variables
- [ ] Copy `.env.example` to `.env.local`
- [ ] Fill in all Supabase credentials
- [ ] Add frontend vars (VITE_* prefix)
- [ ] Add backend vars (no prefix)

### 3.3 Replace Database Layer
**Option A: Direct replacement**
```bash
mv server/db.ts server/db.ts.sqlite-backup
mv server/supabase-db.ts server/db.ts
```

**Option B: Gradual migration**
- [ ] Keep both files
- [ ] Update imports in `unified.ts`
- [ ] Test endpoints one by one

### 3.4 Update Price Engine
- [ ] Replace `priceEngine.ts` import with `supabaseRealtime.ts` in:
  - [ ] `src/components/TradingInterface.tsx`
  - [ ] Any other files using priceEngine

---

## Phase 4: Vercel Setup ✅

### 4.1 Connect Repository
- [ ] Go to [vercel.com](https://vercel.com)
- [ ] Click "Add New Project"
- [ ] Import your GitHub repo
- [ ] Select `based-traders` repository

### 4.2 Configure Build Settings
Verify auto-detected settings:
- [ ] Framework: **Vite**
- [ ] Root Directory: `./`
- [ ] Build Command: `npm run build`
- [ ] Output Directory: `dist`

### 4.3 Add Environment Variables
In Vercel Dashboard → Settings → Environment Variables:

**Frontend (VITE_* prefix):**
- [ ] `VITE_SUPABASE_URL`
- [ ] `VITE_SUPABASE_ANON_KEY`
- [ ] `VITE_WALLETCONNECT_PROJECT_ID`

**Backend:**
- [ ] `SUPABASE_URL`
- [ ] `SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_KEY`
- [ ] `ADMIN_FIDS`
- [ ] `ACHIEVEMENT_CONTRACT_ADDRESS`
- [ ] `MINT_WALLET_PRIVATE_KEY`
- [ ] `BASE_RPC_URL`
- [ ] `BASESCAN_API_KEY`
- [ ] `CRON_SECRET`

⚠️ Add to: Production, Preview, Development

### 4.4 Deploy to Vercel
- [ ] Click "Deploy"
- [ ] Wait for build (~2-5 min)
- [ ] Check build logs for errors
- [ ] Get deployment URL

---

## Phase 5: Price Updater Worker ✅

### 5.1 Create Cron Job Endpoint
- [ ] Create `api/cron/update-prices.ts`
- [ ] Implement price update logic
- [ ] Test locally first

### 5.2 Configure Vercel Cron
Update `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/update-prices",
    "schedule": "*/1 * * * *"
  }]
}
```

### 5.3 Deploy Cron
- [ ] Commit `vercel.json` changes
- [ ] Push to GitHub
- [ ] Verify deployment
- [ ] Check Vercel → Cron Jobs tab

---

## Phase 6: Testing ✅

### 6.1 Local Testing
```bash
# Install Vercel CLI
npm i -g vercel

# Link project
vercel link

# Pull env vars
vercel env pull .env.local

# Run locally
vercel dev
```

Test:
- [ ] Homepage loads
- [ ] Login with Farcaster works
- [ ] Trading interface displays
- [ ] Can open position
- [ ] Can close position
- [ ] Prices update (check console)

### 6.2 Production Testing
Visit your Vercel URL and test:

**Authentication:**
- [ ] Farcaster login works
- [ ] Profile loads correctly
- [ ] Admin panel (if admin)

**Trading:**
- [ ] Can view tokens
- [ ] Can open LONG position
- [ ] Can open SHORT position
- [ ] Can close position
- [ ] PnL calculates correctly
- [ ] Liquidation works

**Real-time:**
- [ ] Prices update automatically
- [ ] Position PnL updates live
- [ ] No WebSocket errors in console

**Data:**
- [ ] Leaderboard displays
- [ ] Profile stats correct
- [ ] Achievements show
- [ ] Position history loads

**Admin (if applicable):**
- [ ] Can add tokens
- [ ] Can edit config
- [ ] Can manage achievements

---

## Phase 7: Monitoring & Optimization ✅

### 7.1 Vercel Dashboard
Monitor:
- [ ] Function executions
- [ ] Error rates
- [ ] Response times
- [ ] Cron job runs

### 7.2 Supabase Dashboard
Monitor:
- [ ] Database size
- [ ] API requests
- [ ] Realtime connections
- [ ] Query performance

### 7.3 Performance Check
- [ ] Lighthouse score
- [ ] Page load time
- [ ] API response time
- [ ] Realtime latency

---

## Phase 8: Go Live ✅

### 8.1 Final Checks
- [ ] All features tested
- [ ] No errors in production
- [ ] Cron job running
- [ ] Realtime working
- [ ] Database healthy

### 8.2 Domain Setup (Optional)
- [ ] Add custom domain in Vercel
- [ ] Update DNS records
- [ ] Verify SSL certificate

### 8.3 Switch from Cloudflare
**Gradual approach:**
- [ ] Keep Cloudflare running
- [ ] Test Vercel thoroughly
- [ ] Update DNS gradually (A/B test)
- [ ] Monitor for 24-48 hours
- [ ] Full switchover

---

## Rollback Plan 🔄

If something goes wrong:

1. **Keep Cloudflare deployment running**
2. **Don't switch DNS until fully tested**
3. **Can revert database changes:**
   ```bash
   # Restore SQLite backup
   cp traders.db.backup traders.db

   # Revert code changes
   git revert <commit>
   ```

---

## Common Issues & Solutions 🔧

### Issue: "SUPABASE_URL is not defined"
**Solution:** Ensure env vars are set in Vercel Dashboard

### Issue: Prices not updating
**Solution:** Check Vercel Cron logs, verify `CRON_SECRET` matches

### Issue: "Cannot connect to database"
**Solution:** Verify `SUPABASE_SERVICE_KEY` is correct

### Issue: Realtime not working
**Solution:** Enable Realtime in Supabase → Database → Replication

### Issue: Build fails on Vercel
**Solution:** Check build logs, ensure all dependencies in `package.json`

---

## Success Criteria ✅

Migration is complete when:
- [ ] ✅ All data migrated to Supabase
- [ ] ✅ Application deployed on Vercel
- [ ] ✅ All features working in production
- [ ] ✅ Prices updating via cron
- [ ] ✅ Realtime working via Supabase
- [ ] ✅ No critical errors
- [ ] ✅ Performance acceptable
- [ ] ✅ Users can trade normally

---

## Cost Estimate 💰

**Supabase (Free Tier):**
- 500 MB database ✅
- 2 GB bandwidth ✅
- Unlimited API requests ✅
- **Cost:** $0/month

**Vercel (Hobby Plan):**
- 100 GB bandwidth ✅
- Serverless functions ✅
- Cron jobs ✅
- **Cost:** $0/month

**Total:** $0/month (within free limits)

---

## Timeline ⏱️

**Estimated time:**
- Phase 1: 30 min
- Phase 2: 30 min
- Phase 3: 1 hour
- Phase 4: 30 min
- Phase 5: 1 hour
- Phase 6: 1 hour
- Phase 7-8: 1 hour

**Total: ~5-6 hours**

---

## Support Resources 📚

- [Supabase Docs](https://supabase.com/docs)
- [Vercel Docs](https://vercel.com/docs)
- [Migration Guide](./SUPABASE_VERCEL_MIGRATION.md)
- Supabase Discord
- Vercel Support

---

**Ready to migrate!** 🚀

Start with Phase 1 and work through each section carefully.
