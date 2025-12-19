# Vercel API Routes

Since Vercel doesn't support long-running servers or WebSockets, we need to restructure the API endpoints.

## Architecture Changes

1. **WebSocket → Supabase Realtime**: Price updates via Supabase Realtime Channels
2. **Express Routes → Vercel Serverless Functions**: Each endpoint is a separate function
3. **Price Engine**: Runs as a Vercel Cron Job or external worker

## File Structure

```
api/
├── player/
│   ├── [fid].ts              # GET /api/player/:fid
│   ├── create.ts             # POST /api/player/create
│   └── update.ts             # POST /api/player/:fid/update
├── position/
│   ├── open.ts               # POST /api/position/open
│   ├── close.ts              # POST /api/position/close
│   └── [fid]/
│       ├── open.ts           # GET /api/position/:fid/open
│       └── closed.ts         # GET /api/position/:fid/closed
├── tokens.ts                 # GET /api/tokens
├── price.ts                  # GET /api/price
├── leaderboard.ts            # GET /api/leaderboard
├── achievements/
│   ├── index.ts              # GET /api/achievements
│   └── [id]/
│       └── mint.ts           # POST /api/achievements/:id/mint
└── admin/
    ├── tokens.ts             # GET/POST/PUT/DELETE /api/admin/tokens
    ├── achievements.ts       # GET/POST/PUT/DELETE /api/admin/achievements
    └── players.ts            # GET/POST /api/admin/players/*
```

## Deployment

All files in `api/` directory are automatically deployed as serverless functions by Vercel.
