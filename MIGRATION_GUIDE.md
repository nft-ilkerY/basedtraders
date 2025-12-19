# Migration to FID-Based System

## What Changed

The entire system has been migrated from username-based to FID-based (Farcaster ID).

### Database Changes
- `players` table: Primary key changed from `farcaster_username` to `farcaster_fid`
- `positions` table: `player_username` changed to `player_fid`
- Old tables backed up as `players_old` and `positions_old`

### API Changes
All API endpoints now use FID instead of username:
- `/api/player/:username` → `/api/player/:fid`
- `/api/positions/:username` → `/api/positions/:fid`
- `/api/player/:username/update` → `/api/player/:fid/update`
- `/api/player/:username/stats` → `/api/player/:fid/stats`
- `/api/player/:username/submit` → `/api/player/:fid/submit`

### Code Changes Needed
1. unified.ts - All player queries use farcaster_fid
2. gameState.ts - State keyed by FID not username
3. Frontend - All API calls use FID

## Why This Change?
- Usernames can change, FIDs cannot
- More secure and reliable
- Aligns with Farcaster's identity system
