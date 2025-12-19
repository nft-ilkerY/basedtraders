import Database from 'better-sqlite3'
import path from 'path'

const db = new Database(path.join(process.cwd(), 'traders.db'))

// Initialize database tables with FID as primary key
db.exec(`
  CREATE TABLE IF NOT EXISTS players (
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

  CREATE TABLE IF NOT EXISTS positions (
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
    FOREIGN KEY (player_fid) REFERENCES players(farcaster_fid),
    FOREIGN KEY (token_id) REFERENCES tokens(id)
  );

  CREATE TABLE IF NOT EXISTS price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_id INTEGER NOT NULL,
    price REAL NOT NULL,
    timestamp INTEGER NOT NULL,
    FOREIGN KEY (token_id) REFERENCES tokens(id)
  );

  CREATE TABLE IF NOT EXISTS tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    initial_price REAL NOT NULL,
    current_price REAL NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    is_real_crypto BOOLEAN DEFAULT 0,
    logo_url TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    rarity TEXT NOT NULL,
    requirement_type TEXT NOT NULL,
    requirement_value REAL NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_positions_player ON positions(player_fid);
  CREATE INDEX IF NOT EXISTS idx_positions_open ON positions(closed_at) WHERE closed_at IS NULL;
  CREATE INDEX IF NOT EXISTS idx_positions_token ON positions(token_id);
  CREATE INDEX IF NOT EXISTS idx_price_timestamp ON price_history(timestamp);
  CREATE INDEX IF NOT EXISTS idx_price_token ON price_history(token_id);
  CREATE INDEX IF NOT EXISTS idx_achievements_active ON achievements(is_active);
`)

// Add logo_url column to tokens table if it doesn't exist
try {
  db.exec(`
    ALTER TABLE tokens ADD COLUMN logo_url TEXT;
  `)
  console.log('✅ Added logo_url column to tokens table')
} catch (e: any) {
  if (!e.message.includes('duplicate column')) {
    console.log('ℹ️  Logo_url column already exists')
  }
}

// Add is_real_crypto column to tokens table if it doesn't exist
try {
  db.exec(`
    ALTER TABLE tokens ADD COLUMN is_real_crypto BOOLEAN DEFAULT 0;
  `)
  console.log('✅ Added is_real_crypto column to tokens table')
} catch (e: any) {
  if (!e.message.includes('duplicate column')) {
    console.log('ℹ️  is_real_crypto column already exists')
  }
}

// Add max_leverage column to tokens table if it doesn't exist
try {
  db.exec(`
    ALTER TABLE tokens ADD COLUMN max_leverage INTEGER DEFAULT 10;
  `)
  console.log('✅ Added max_leverage column to tokens table')
} catch (e: any) {
  if (!e.message.includes('duplicate column')) {
    console.log('ℹ️  max_leverage column already exists')
  }
}

// Add mintedAchievements column to players table if it doesn't exist
try {
  db.exec(`
    ALTER TABLE players ADD COLUMN mintedAchievements TEXT DEFAULT '';
  `)
  console.log('✅ Added mintedAchievements column to players table')
} catch (e: any) {
  if (!e.message.includes('duplicate column')) {
    console.log('ℹ️  mintedAchievements column already exists')
  }
}

// Initialize default BATR token if not exists
const batrToken = db.prepare('SELECT * FROM tokens WHERE symbol = ?').get('BATR') as any
if (!batrToken) {
  const result = db.prepare('INSERT INTO tokens (symbol, name, initial_price, current_price, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    'BATR',
    'Based Traders Token',
    100,
    100,
    1,
    Date.now()
  )
  console.log('✅ Created default BATR token')

  // Initialize price history for BATR token
  const tokenId = result.lastInsertRowid
  const now = Date.now()
  for (let i = 119; i >= 0; i--) {
    const timestamp = now - (i * 1000)
    db.prepare('INSERT INTO price_history (token_id, price, timestamp) VALUES (?, ?, ?)').run(
      tokenId,
      100,
      timestamp
    )
  }
  console.log('✅ Created initial price history for BATR token')
} else {
  // Check if BATR has price history
  const historyCount = db.prepare('SELECT COUNT(*) as count FROM price_history WHERE token_id = ?').get(batrToken.id) as { count: number }
  if (historyCount.count === 0) {
    console.log('⚠️  BATR token has no price history, creating initial history...')
    const now = Date.now()
    for (let i = 119; i >= 0; i--) {
      const timestamp = now - (i * 1000)
      db.prepare('INSERT INTO price_history (token_id, price, timestamp) VALUES (?, ?, ?)').run(
        batrToken.id,
        batrToken.current_price || 100,
        timestamp
      )
    }
    console.log('✅ Created initial price history for BATR token')
  }
}

// Initialize real crypto tokens (BTC, ETH, SOL) with approximate prices
const realCryptoTokens = [
  { symbol: 'BTC', name: 'Bitcoin', price: 95000 },
  { symbol: 'ETH', name: 'Ethereum', price: 3500 },
  { symbol: 'SOL', name: 'Solana', price: 230 }
]

realCryptoTokens.forEach(crypto => {
  const existingToken = db.prepare('SELECT * FROM tokens WHERE symbol = ?').get(crypto.symbol) as any
  if (!existingToken) {
    const result = db.prepare('INSERT INTO tokens (symbol, name, initial_price, current_price, is_active, is_real_crypto, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      crypto.symbol,
      crypto.name,
      crypto.price,
      crypto.price,
      1,
      1,
      Date.now()
    )
    console.log(`✅ Created ${crypto.symbol} token`)

    // Initialize price history for the token
    const tokenId = result.lastInsertRowid
    const now = Date.now()
    for (let i = 119; i >= 0; i--) {
      const timestamp = now - (i * 1000)
      db.prepare('INSERT INTO price_history (token_id, price, timestamp) VALUES (?, ?, ?)').run(
        tokenId,
        crypto.price,
        timestamp
      )
    }
    console.log(`✅ Created initial price history for ${crypto.symbol} token`)
  } else {
    // Check if token has price history
    const historyCount = db.prepare('SELECT COUNT(*) as count FROM price_history WHERE token_id = ?').get(existingToken.id) as { count: number }
    if (historyCount.count === 0) {
      console.log(`⚠️  ${crypto.symbol} token has no price history, creating initial history...`)
      const now = Date.now()
      for (let i = 119; i >= 0; i--) {
        const timestamp = now - (i * 1000)
        db.prepare('INSERT INTO price_history (token_id, price, timestamp) VALUES (?, ?, ?)').run(
          existingToken.id,
          existingToken.current_price || crypto.price,
          timestamp
        )
      }
      console.log(`✅ Created initial price history for ${crypto.symbol} token`)
    }
  }
})

// Initialize default fee configs if not exists
const defaultConfigs = [
  { key: 'BASE_TRADING_FEE', value: '0.002' },
  { key: 'PROFIT_FEE', value: '0.05' },
  { key: 'FUNDING_RATE_PER_HOUR', value: '0.0005' },
  { key: 'MAX_POSITION_SIZE_PERCENT', value: '0.80' },
  { key: 'INITIAL_CASH', value: '250' }
]

defaultConfigs.forEach(config => {
  const existing = db.prepare('SELECT * FROM config WHERE key = ?').get(config.key)
  if (!existing) {
    db.prepare('INSERT INTO config (key, value, updated_at) VALUES (?, ?, ?)').run(
      config.key,
      config.value,
      Date.now()
    )
    console.log(`✅ Created config: ${config.key} = ${config.value}`)
  }
})

// Initialize predefined achievements
const predefinedAchievements = [
  {
    name: 'First Trade',
    description: 'Complete your first trade',
    rarity: 'common',
    requirement_type: 'trades_count',
    requirement_value: 1
  },
  {
    name: 'Profit Master',
    description: 'Reach $1000 in total profit',
    rarity: 'rare',
    requirement_type: 'total_profit',
    requirement_value: 1000
  },
  {
    name: 'Diamond Hands',
    description: 'Hold a position for 24 hours',
    rarity: 'epic',
    requirement_type: 'hold_duration',
    requirement_value: 86400
  }
]

predefinedAchievements.forEach(achievement => {
  const existing = db.prepare('SELECT * FROM achievements WHERE name = ?').get(achievement.name)
  if (!existing) {
    db.prepare(`
      INSERT INTO achievements (name, description, rarity, requirement_type, requirement_value, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      achievement.name,
      achievement.description,
      achievement.rarity,
      achievement.requirement_type,
      achievement.requirement_value,
      1,
      Date.now()
    )
    console.log(`✅ Created achievement: ${achievement.name}`)
  }
})

export default db
