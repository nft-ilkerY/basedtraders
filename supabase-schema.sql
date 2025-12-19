-- Based Traders PostgreSQL Schema for Supabase
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Players table
CREATE TABLE IF NOT EXISTS players (
  farcaster_fid BIGINT PRIMARY KEY,
  farcaster_username TEXT,
  display_name TEXT,
  pfp_url TEXT,
  cash DECIMAL(15, 2) NOT NULL DEFAULT 250,
  high_score DECIMAL(15, 2) NOT NULL DEFAULT 250,
  rank TEXT DEFAULT 'Unranked',
  submitted_cash DECIMAL(15, 2) DEFAULT 0,
  minted_achievements TEXT DEFAULT '',
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

-- Tokens table
CREATE TABLE IF NOT EXISTS tokens (
  id SERIAL PRIMARY KEY,
  symbol TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  initial_price DECIMAL(15, 2) NOT NULL,
  current_price DECIMAL(15, 2) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  is_real_crypto BOOLEAN DEFAULT FALSE,
  logo_url TEXT,
  max_leverage INTEGER DEFAULT 10,
  created_at BIGINT NOT NULL
);

-- Positions table
CREATE TABLE IF NOT EXISTS positions (
  id TEXT PRIMARY KEY,
  player_fid BIGINT NOT NULL,
  token_id INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('LONG', 'SHORT')),
  entry_price DECIMAL(15, 2) NOT NULL,
  leverage INTEGER NOT NULL,
  size DECIMAL(15, 2) NOT NULL,
  collateral DECIMAL(15, 2) NOT NULL,
  opened_at BIGINT NOT NULL,
  closed_at BIGINT,
  close_price DECIMAL(15, 2),
  pnl DECIMAL(15, 2),
  is_liquidated BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (player_fid) REFERENCES players(farcaster_fid) ON DELETE CASCADE,
  FOREIGN KEY (token_id) REFERENCES tokens(id) ON DELETE RESTRICT
);

-- Price history table
CREATE TABLE IF NOT EXISTS price_history (
  id SERIAL PRIMARY KEY,
  token_id INTEGER NOT NULL,
  price DECIMAL(15, 2) NOT NULL,
  timestamp BIGINT NOT NULL,
  FOREIGN KEY (token_id) REFERENCES tokens(id) ON DELETE CASCADE
);

-- Config table
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at BIGINT NOT NULL
);

-- Achievements table
CREATE TABLE IF NOT EXISTS achievements (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  rarity TEXT NOT NULL CHECK (rarity IN ('Common', 'Rare', 'Epic', 'Legendary')),
  requirement_type TEXT NOT NULL,
  requirement_value DECIMAL(15, 2) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at BIGINT NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_positions_player ON positions(player_fid);
CREATE INDEX IF NOT EXISTS idx_positions_open ON positions(closed_at) WHERE closed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_positions_token ON positions(token_id);
CREATE INDEX IF NOT EXISTS idx_price_timestamp ON price_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_price_token ON price_history(token_id);
CREATE INDEX IF NOT EXISTS idx_achievements_active ON achievements(is_active);

-- Insert default BATR token
INSERT INTO tokens (symbol, name, initial_price, current_price, is_active, is_real_crypto, created_at)
VALUES ('BATR', 'Based Traders Token', 100, 100, TRUE, FALSE, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
ON CONFLICT (symbol) DO NOTHING;

-- Insert real crypto tokens
INSERT INTO tokens (symbol, name, initial_price, current_price, is_active, is_real_crypto, created_at)
VALUES
  ('BTC', 'Bitcoin', 95000, 95000, TRUE, TRUE, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
  ('ETH', 'Ethereum', 3500, 3500, TRUE, TRUE, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
  ('SOL', 'Solana', 230, 230, TRUE, TRUE, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
ON CONFLICT (symbol) DO NOTHING;

-- Insert default config
INSERT INTO config (key, value, updated_at)
VALUES
  ('BASE_TRADING_FEE', '0.002', EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
  ('PROFIT_FEE', '0.05', EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
  ('FUNDING_RATE_PER_HOUR', '0.0005', EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
  ('MAX_POSITION_SIZE_PERCENT', '0.80', EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
  ('INITIAL_CASH', '250', EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
ON CONFLICT (key) DO NOTHING;

-- Insert default achievements
INSERT INTO achievements (name, description, icon, rarity, requirement_type, requirement_value, is_active, created_at)
VALUES
  ('First Trade', 'Complete your first trade', '🎯', 'Common', 'total_trades', 1, TRUE, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
  ('Profit Master', 'Reach $1000 in total profit', '🏆', 'Rare', 'total_pnl', 1000, TRUE, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
  ('Diamond Hands', 'Hold a position for 24 hours', '💎', 'Epic', 'hold_duration', 86400, TRUE, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
ON CONFLICT DO NOTHING;

-- Enable Row Level Security (RLS)
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE config ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all for now - adjust based on your needs)
CREATE POLICY "Allow all on players" ON players FOR ALL USING (true);
CREATE POLICY "Allow all on positions" ON positions FOR ALL USING (true);
CREATE POLICY "Allow all on price_history" ON price_history FOR ALL USING (true);
CREATE POLICY "Allow all on tokens" ON tokens FOR ALL USING (true);
CREATE POLICY "Allow all on achievements" ON achievements FOR ALL USING (true);
CREATE POLICY "Allow all on config" ON config FOR ALL USING (true);

-- Create a function to clean old price history (keep last 300 per token)
CREATE OR REPLACE FUNCTION clean_old_price_history()
RETURNS trigger AS $$
BEGIN
  DELETE FROM price_history
  WHERE token_id = NEW.token_id
  AND id NOT IN (
    SELECT id FROM price_history
    WHERE token_id = NEW.token_id
    ORDER BY timestamp DESC
    LIMIT 300
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic cleanup
CREATE TRIGGER trigger_clean_price_history
AFTER INSERT ON price_history
FOR EACH ROW
EXECUTE FUNCTION clean_old_price_history();
