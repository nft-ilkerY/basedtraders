import Database from 'better-sqlite3'
import { createClient } from '@supabase/supabase-js'
import * as path from 'path'
import * as dotenv from 'dotenv'

dotenv.config()

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
const sqlite = new Database(path.join(process.cwd(), 'traders.db'))

async function migrateData() {
  console.log('🚀 Starting migration from SQLite to Supabase...\n')

  try {
    // 1. Migrate Players
    console.log('📊 Migrating players...')
    const players = sqlite.prepare('SELECT * FROM players').all() as any[]

    for (const player of players) {
      const { error } = await supabase.from('players').upsert({
        farcaster_fid: player.farcaster_fid,
        farcaster_username: player.farcaster_username,
        display_name: player.display_name,
        pfp_url: player.pfp_url,
        cash: player.cash,
        high_score: player.high_score,
        rank: player.rank,
        submitted_cash: player.submitted_cash,
        minted_achievements: player.mintedAchievements || '',
        created_at: player.created_at,
        updated_at: player.updated_at
      })

      if (error) {
        console.error(`  ❌ Error migrating player ${player.farcaster_fid}:`, error.message)
      }
    }
    console.log(`  ✅ Migrated ${players.length} players\n`)

    // 2. Migrate Tokens
    console.log('📊 Migrating tokens...')
    const tokens = sqlite.prepare('SELECT * FROM tokens').all() as any[]

    for (const token of tokens) {
      const { error } = await supabase.from('tokens').upsert({
        id: token.id,
        symbol: token.symbol,
        name: token.name,
        initial_price: token.initial_price,
        current_price: token.current_price,
        is_active: token.is_active === 1,
        is_real_crypto: token.is_real_crypto === 1,
        logo_url: token.logo_url,
        max_leverage: token.max_leverage || 10,
        created_at: token.created_at
      })

      if (error) {
        console.error(`  ❌ Error migrating token ${token.symbol}:`, error.message)
      }
    }
    console.log(`  ✅ Migrated ${tokens.length} tokens\n`)

    // 3. Migrate Positions
    console.log('📊 Migrating positions...')
    const positions = sqlite.prepare('SELECT * FROM positions').all() as any[]

    for (const position of positions) {
      const { error } = await supabase.from('positions').upsert({
        id: position.id,
        player_fid: position.player_fid,
        token_id: position.token_id,
        type: position.type,
        entry_price: position.entry_price,
        leverage: position.leverage,
        size: position.size,
        collateral: position.collateral,
        opened_at: position.opened_at,
        closed_at: position.closed_at,
        close_price: position.close_price,
        pnl: position.pnl,
        is_liquidated: position.is_liquidated === 1
      })

      if (error) {
        console.error(`  ❌ Error migrating position ${position.id}:`, error.message)
      }
    }
    console.log(`  ✅ Migrated ${positions.length} positions\n`)

    // 4. Migrate Price History (only recent data to avoid bloat)
    console.log('📊 Migrating recent price history (last 300 per token)...')
    const priceHistory = sqlite.prepare(`
      SELECT ph.* FROM price_history ph
      INNER JOIN (
        SELECT token_id, id
        FROM price_history
        ORDER BY timestamp DESC
        LIMIT 300
      ) recent ON ph.id = recent.id
    `).all() as any[]

    // Insert in batches of 100
    const batchSize = 100
    for (let i = 0; i < priceHistory.length; i += batchSize) {
      const batch = priceHistory.slice(i, i + batchSize).map(ph => ({
        token_id: ph.token_id,
        price: ph.price,
        timestamp: ph.timestamp
      }))

      const { error } = await supabase.from('price_history').insert(batch)

      if (error) {
        console.error(`  ❌ Error migrating price history batch:`, error.message)
      }
    }
    console.log(`  ✅ Migrated ${priceHistory.length} price history records\n`)

    // 5. Migrate Config
    console.log('📊 Migrating config...')
    const configs = sqlite.prepare('SELECT * FROM config').all() as any[]

    for (const config of configs) {
      const { error } = await supabase.from('config').upsert({
        key: config.key,
        value: config.value,
        updated_at: config.updated_at
      })

      if (error) {
        console.error(`  ❌ Error migrating config ${config.key}:`, error.message)
      }
    }
    console.log(`  ✅ Migrated ${configs.length} config entries\n`)

    // 6. Migrate Achievements - DISABLED FOR NOW
    // console.log('📊 Migrating achievements...')
    // const achievements = sqlite.prepare('SELECT * FROM achievements').all() as any[]

    // for (const achievement of achievements) {
    //   const { error } = await supabase.from('achievements').upsert({
    //     id: achievement.id,
    //     name: achievement.name,
    //     description: achievement.description,
    //     icon: achievement.icon || '🏆',
    //     rarity: achievement.rarity,
    //     requirement_type: achievement.requirement_type,
    //     requirement_value: achievement.requirement_value,
    //     is_active: achievement.is_active === 1,
    //     created_at: achievement.created_at
    //   })

    //   if (error) {
    //     console.error(`  ❌ Error migrating achievement ${achievement.name}:`, error.message)
    //   }
    // }
    // console.log(`  ✅ Migrated ${achievements.length} achievements\n`)

    console.log('✅ Migration completed successfully!')
    console.log('\n📝 Next steps:')
    console.log('1. Verify data in Supabase dashboard')
    console.log('2. Update .env with Supabase credentials')
    console.log('3. Replace server/db.ts with server/supabase-db.ts')
    console.log('4. Test the application locally')
    console.log('5. Deploy to Vercel')

  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }
}

migrateData()
