import Database from 'better-sqlite3'
import path from 'path'

const db = new Database(path.join(process.cwd(), 'traders.db'))

console.log('🔄 Starting migration to FID-based system...')

// Step 1: Create new tables with FID as primary key
db.exec(`
  -- Create new players table with FID as primary key
  CREATE TABLE IF NOT EXISTS players_new (
    farcaster_fid INTEGER PRIMARY KEY,
    farcaster_username TEXT,
    display_name TEXT,
    pfp_url TEXT,
    cash REAL NOT NULL DEFAULT 250,
    high_score REAL NOT NULL DEFAULT 250,
    rank TEXT DEFAULT 'Unranked',
    submitted_cash REAL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  -- Create new positions table with player_fid
  CREATE TABLE IF NOT EXISTS positions_new (
    id TEXT PRIMARY KEY,
    player_fid INTEGER NOT NULL,
    token_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    entry_price REAL NOT NULL,
    leverage INTEGER NOT NULL,
    size REAL NOT NULL,
    collateral REAL NOT NULL,
    opened_at INTEGER NOT NULL,
    closed_at INTEGER,
    close_price REAL,
    pnl REAL,
    is_liquidated BOOLEAN DEFAULT 0,
    FOREIGN KEY (player_fid) REFERENCES players_new(farcaster_fid),
    FOREIGN KEY (token_id) REFERENCES tokens(id)
  );

  CREATE INDEX IF NOT EXISTS idx_positions_player_new ON positions_new(player_fid);
  CREATE INDEX IF NOT EXISTS idx_positions_open_new ON positions_new(closed_at) WHERE closed_at IS NULL;
  CREATE INDEX IF NOT EXISTS idx_positions_token_new ON positions_new(token_id);
`)

console.log('✅ Created new table structures')

// Step 2: Migrate existing data
try {
  // Migrate players
  const players = db.prepare('SELECT * FROM players').all() as any[]
  console.log(`📊 Migrating ${players.length} players...`)

  for (const player of players) {
    if (player.farcaster_fid) {
      db.prepare(`
        INSERT OR REPLACE INTO players_new
        (farcaster_fid, farcaster_username, display_name, pfp_url, cash, high_score, rank, submitted_cash, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        player.farcaster_fid,
        player.farcaster_username,
        player.display_name,
        player.pfp_url,
        player.cash,
        player.high_score,
        player.rank || 'Unranked',
        player.submitted_cash || 0,
        player.created_at,
        player.updated_at
      )
    }
  }

  console.log('✅ Migrated players')

  // Migrate positions
  const positions = db.prepare('SELECT * FROM positions').all() as any[]
  console.log(`📊 Migrating ${positions.length} positions...`)

  for (const position of positions) {
    // Find player FID by username
    const player = db.prepare('SELECT farcaster_fid FROM players WHERE farcaster_username = ?').get(position.player_username) as any

    if (player && player.farcaster_fid) {
      db.prepare(`
        INSERT OR REPLACE INTO positions_new
        (id, player_fid, token_id, type, entry_price, leverage, size, collateral, opened_at, closed_at, close_price, pnl, is_liquidated)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        position.id,
        player.farcaster_fid,
        position.token_id,
        position.type,
        position.entry_price,
        position.leverage,
        position.size,
        position.collateral,
        position.opened_at,
        position.closed_at,
        position.close_price,
        position.pnl,
        position.is_liquidated || 0
      )
    }
  }

  console.log('✅ Migrated positions')
} catch (error) {
  console.error('❌ Migration error:', error)
  process.exit(1)
}

// Step 3: Backup old tables and rename new ones
db.exec(`
  -- Backup old tables
  DROP TABLE IF EXISTS players_old;
  DROP TABLE IF EXISTS positions_old;

  ALTER TABLE players RENAME TO players_old;
  ALTER TABLE positions RENAME TO positions_old;

  ALTER TABLE players_new RENAME TO players;
  ALTER TABLE positions_new RENAME TO positions;
`)

console.log('✅ Renamed tables - migration complete!')
console.log('ℹ️  Old tables backed up as players_old and positions_old')
console.log('ℹ️  You can drop them later with: DROP TABLE players_old; DROP TABLE positions_old;')

db.close()
