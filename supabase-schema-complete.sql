-- ============================================================================
-- Based Traders - Complete PostgreSQL Schema for Supabase
-- ============================================================================
-- This script creates all tables, indexes, functions, triggers, and RLS policies
-- Run this in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- 1. EXTENSIONS
-- ============================================================================

-- Enable UUID extension for generating unique IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgcrypto for additional crypto functions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 2. DROP EXISTING TABLES (if re-running)
-- ============================================================================

-- Drop tables in reverse order of dependencies
DROP TABLE IF EXISTS price_history CASCADE;
DROP TABLE IF EXISTS positions CASCADE;
-- DROP TABLE IF EXISTS achievements CASCADE; -- DISABLED - Coming soon
DROP TABLE IF EXISTS config CASCADE;
DROP TABLE IF EXISTS tokens CASCADE;
DROP TABLE IF EXISTS players CASCADE;

-- Drop functions and triggers
DROP FUNCTION IF EXISTS clean_old_price_history() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- ============================================================================
-- 3. CREATE TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 3.1 PLAYERS Table
-- ----------------------------------------------------------------------------
CREATE TABLE players (
  farcaster_fid BIGINT PRIMARY KEY,
  farcaster_username TEXT,
  display_name TEXT,
  pfp_url TEXT,
  cash DECIMAL(15, 2) NOT NULL DEFAULT 250.00,
  high_score DECIMAL(15, 2) NOT NULL DEFAULT 250.00,
  rank TEXT DEFAULT 'Unranked',
  submitted_cash DECIMAL(15, 2) DEFAULT 0.00,
  minted_achievements TEXT DEFAULT '',
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,

  -- Constraints
  CONSTRAINT players_cash_positive CHECK (cash >= 0),
  CONSTRAINT players_high_score_positive CHECK (high_score >= 0),
  CONSTRAINT players_submitted_cash_positive CHECK (submitted_cash >= 0)
);

-- Add comments
COMMENT ON TABLE players IS 'Stores player/user information from Farcaster';
COMMENT ON COLUMN players.farcaster_fid IS 'Farcaster user ID (primary key)';
COMMENT ON COLUMN players.cash IS 'Current available cash balance';
COMMENT ON COLUMN players.high_score IS 'Highest portfolio value achieved';
COMMENT ON COLUMN players.minted_achievements IS 'Comma-separated list of minted achievement IDs';

-- ----------------------------------------------------------------------------
-- 3.2 TOKENS Table
-- ----------------------------------------------------------------------------
CREATE TABLE tokens (
  id SERIAL PRIMARY KEY,
  symbol TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  initial_price DECIMAL(15, 2) NOT NULL,
  current_price DECIMAL(15, 2) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  is_real_crypto BOOLEAN DEFAULT FALSE,
  logo_url TEXT,
  max_leverage INTEGER DEFAULT 10,
  created_at BIGINT NOT NULL,

  -- Constraints
  CONSTRAINT tokens_initial_price_positive CHECK (initial_price > 0),
  CONSTRAINT tokens_current_price_positive CHECK (current_price > 0),
  CONSTRAINT tokens_max_leverage_valid CHECK (max_leverage > 0 AND max_leverage <= 100),
  CONSTRAINT tokens_symbol_not_empty CHECK (LENGTH(TRIM(symbol)) > 0),
  CONSTRAINT tokens_name_not_empty CHECK (LENGTH(TRIM(name)) > 0)
);

-- Add comments
COMMENT ON TABLE tokens IS 'Available trading tokens (both real crypto and game tokens)';
COMMENT ON COLUMN tokens.is_real_crypto IS 'TRUE if price comes from external API (Binance), FALSE if simulated';
COMMENT ON COLUMN tokens.max_leverage IS 'Maximum leverage allowed for this token (1-100)';

-- ----------------------------------------------------------------------------
-- 3.3 POSITIONS Table
-- ----------------------------------------------------------------------------
CREATE TABLE positions (
  id TEXT PRIMARY KEY,
  player_fid BIGINT NOT NULL,
  token_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  entry_price DECIMAL(15, 2) NOT NULL,
  leverage INTEGER NOT NULL,
  size DECIMAL(15, 2) NOT NULL,
  collateral DECIMAL(15, 2) NOT NULL,
  opened_at BIGINT NOT NULL,
  closed_at BIGINT,
  close_price DECIMAL(15, 2),
  pnl DECIMAL(15, 2),
  is_liquidated BOOLEAN DEFAULT FALSE,

  -- Foreign Keys
  CONSTRAINT fk_positions_player
    FOREIGN KEY (player_fid)
    REFERENCES players(farcaster_fid)
    ON DELETE CASCADE,

  CONSTRAINT fk_positions_token
    FOREIGN KEY (token_id)
    REFERENCES tokens(id)
    ON DELETE RESTRICT,

  -- Constraints
  CONSTRAINT positions_type_valid CHECK (type IN ('LONG', 'SHORT')),
  CONSTRAINT positions_entry_price_positive CHECK (entry_price > 0),
  CONSTRAINT positions_leverage_valid CHECK (leverage > 0 AND leverage <= 100),
  CONSTRAINT positions_size_positive CHECK (size > 0),
  CONSTRAINT positions_collateral_positive CHECK (collateral > 0),
  CONSTRAINT positions_closed_logic CHECK (
    (closed_at IS NULL AND close_price IS NULL AND pnl IS NULL) OR
    (closed_at IS NOT NULL AND close_price IS NOT NULL AND pnl IS NOT NULL)
  )
);

-- Add comments
COMMENT ON TABLE positions IS 'Trading positions (both open and closed)';
COMMENT ON COLUMN positions.type IS 'Position type: LONG or SHORT';
COMMENT ON COLUMN positions.size IS 'Position size in USD (collateral * leverage)';
COMMENT ON COLUMN positions.collateral IS 'Initial margin/collateral deposited';

-- ----------------------------------------------------------------------------
-- 3.4 PRICE_HISTORY Table
-- ----------------------------------------------------------------------------
CREATE TABLE price_history (
  id SERIAL PRIMARY KEY,
  token_id INTEGER NOT NULL,
  price DECIMAL(15, 2) NOT NULL,
  timestamp BIGINT NOT NULL,

  -- Foreign Key
  CONSTRAINT fk_price_history_token
    FOREIGN KEY (token_id)
    REFERENCES tokens(id)
    ON DELETE CASCADE,

  -- Constraints
  CONSTRAINT price_history_price_positive CHECK (price > 0),
  CONSTRAINT price_history_timestamp_valid CHECK (timestamp > 0)
);

-- Add comments
COMMENT ON TABLE price_history IS 'Historical price data for all tokens (last 300 per token)';
COMMENT ON COLUMN price_history.timestamp IS 'Unix timestamp in milliseconds';

-- ----------------------------------------------------------------------------
-- 3.5 CONFIG Table
-- ----------------------------------------------------------------------------
CREATE TABLE config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at BIGINT NOT NULL,

  -- Constraints
  CONSTRAINT config_key_not_empty CHECK (LENGTH(TRIM(key)) > 0),
  CONSTRAINT config_value_not_empty CHECK (LENGTH(TRIM(value)) > 0)
);

-- Add comments
COMMENT ON TABLE config IS 'System configuration key-value pairs';
COMMENT ON COLUMN config.key IS 'Configuration key (e.g., BASE_TRADING_FEE, PROFIT_FEE)';
COMMENT ON COLUMN config.value IS 'Configuration value (stored as text, parse as needed)';

-- ----------------------------------------------------------------------------
-- 3.6 ACHIEVEMENTS Table - DISABLED (Coming Soon)
-- ----------------------------------------------------------------------------
-- CREATE TABLE achievements (
--   id SERIAL PRIMARY KEY,
--   name TEXT NOT NULL,
--   description TEXT NOT NULL,
--   icon TEXT NOT NULL,
--   rarity TEXT NOT NULL,
--   requirement_type TEXT NOT NULL,
--   requirement_value DECIMAL(15, 2) NOT NULL,
--   is_active BOOLEAN DEFAULT TRUE,
--   created_at BIGINT NOT NULL,

--   -- Constraints
--   CONSTRAINT achievements_rarity_valid CHECK (rarity IN ('Common', 'Rare', 'Epic', 'Legendary')),
--   CONSTRAINT achievements_name_not_empty CHECK (LENGTH(TRIM(name)) > 0),
--   CONSTRAINT achievements_description_not_empty CHECK (LENGTH(TRIM(description)) > 0),
--   CONSTRAINT achievements_requirement_value_valid CHECK (requirement_value >= 0)
-- );

-- -- Add comments
-- COMMENT ON TABLE achievements IS 'Achievement definitions and requirements';
-- COMMENT ON COLUMN achievements.requirement_type IS 'Type of requirement: total_trades, winning_trades, biggest_win, high_score, win_rate';
-- COMMENT ON COLUMN achievements.requirement_value IS 'Threshold value to unlock achievement';

-- ============================================================================
-- 4. CREATE INDEXES
-- ============================================================================

-- Players indexes
CREATE INDEX idx_players_username ON players(farcaster_username);
CREATE INDEX idx_players_rank ON players(rank) WHERE rank != 'Unranked';
CREATE INDEX idx_players_high_score ON players(high_score DESC);
CREATE INDEX idx_players_submitted_cash ON players(submitted_cash DESC) WHERE submitted_cash > 0;

-- Tokens indexes
CREATE INDEX idx_tokens_symbol ON tokens(symbol);
CREATE INDEX idx_tokens_active ON tokens(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_tokens_real_crypto ON tokens(is_real_crypto) WHERE is_real_crypto = TRUE;

-- Positions indexes
CREATE INDEX idx_positions_player ON positions(player_fid);
CREATE INDEX idx_positions_token ON positions(token_id);
CREATE INDEX idx_positions_open ON positions(closed_at) WHERE closed_at IS NULL;
CREATE INDEX idx_positions_closed ON positions(closed_at DESC) WHERE closed_at IS NOT NULL;
CREATE INDEX idx_positions_player_open ON positions(player_fid, token_id) WHERE closed_at IS NULL;
CREATE INDEX idx_positions_opened_at ON positions(opened_at DESC);

-- Price history indexes
CREATE INDEX idx_price_history_token ON price_history(token_id);
CREATE INDEX idx_price_history_timestamp ON price_history(timestamp DESC);
CREATE INDEX idx_price_history_token_timestamp ON price_history(token_id, timestamp DESC);

-- Achievements indexes - DISABLED (Coming Soon)
-- CREATE INDEX idx_achievements_active ON achievements(is_active) WHERE is_active = TRUE;
-- CREATE INDEX idx_achievements_rarity ON achievements(rarity);
-- CREATE INDEX idx_achievements_requirement_type ON achievements(requirement_type);

-- Config indexes (already has primary key on 'key')

-- ============================================================================
-- 5. CREATE FUNCTIONS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 5.1 Function: Clean old price history (keep last 300 per token)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION clean_old_price_history()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete old records, keeping only the latest 300 per token
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

COMMENT ON FUNCTION clean_old_price_history() IS 'Automatically deletes old price history, keeping only last 300 records per token';

-- ----------------------------------------------------------------------------
-- 5.2 Function: Update updated_at timestamp
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT * 1000;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_updated_at_column() IS 'Automatically updates updated_at column on row update';

-- ============================================================================
-- 6. CREATE TRIGGERS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 6.1 Trigger: Clean price history after insert
-- ----------------------------------------------------------------------------
CREATE TRIGGER trigger_clean_price_history
AFTER INSERT ON price_history
FOR EACH ROW
EXECUTE FUNCTION clean_old_price_history();

COMMENT ON TRIGGER trigger_clean_price_history ON price_history IS 'Automatically cleans old price history after each insert';

-- ----------------------------------------------------------------------------
-- 6.2 Trigger: Update players.updated_at on update
-- ----------------------------------------------------------------------------
CREATE TRIGGER trigger_update_players_updated_at
BEFORE UPDATE ON players
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 6.3 Trigger: Update config.updated_at on update
-- ----------------------------------------------------------------------------
CREATE TRIGGER trigger_update_config_updated_at
BEFORE UPDATE ON config
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 7. ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE tokens ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE achievements ENABLE ROW LEVEL SECURITY; -- DISABLED (Coming Soon)
ALTER TABLE config ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 8. CREATE RLS POLICIES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 8.1 Players Policies
-- ----------------------------------------------------------------------------

-- Allow all operations (for now - adjust based on your security needs)
CREATE POLICY "Allow all on players"
ON players
FOR ALL
USING (true)
WITH CHECK (true);

-- Alternative: User can only read/update their own data
-- CREATE POLICY "Users can read own data" ON players FOR SELECT USING (auth.uid()::text = farcaster_fid::text);
-- CREATE POLICY "Users can update own data" ON players FOR UPDATE USING (auth.uid()::text = farcaster_fid::text);

-- ----------------------------------------------------------------------------
-- 8.2 Positions Policies
-- ----------------------------------------------------------------------------

CREATE POLICY "Allow all on positions"
ON positions
FOR ALL
USING (true)
WITH CHECK (true);

-- Alternative: Users can only access their own positions
-- CREATE POLICY "Users can read own positions" ON positions FOR SELECT USING (auth.uid()::text = player_fid::text);
-- CREATE POLICY "Users can create own positions" ON positions FOR INSERT WITH CHECK (auth.uid()::text = player_fid::text);
-- CREATE POLICY "Users can update own positions" ON positions FOR UPDATE USING (auth.uid()::text = player_fid::text);

-- ----------------------------------------------------------------------------
-- 8.3 Price History Policies
-- ----------------------------------------------------------------------------

CREATE POLICY "Allow all on price_history"
ON price_history
FOR ALL
USING (true)
WITH CHECK (true);

-- Alternative: Read-only for users, write for service role
-- CREATE POLICY "Anyone can read price history" ON price_history FOR SELECT USING (true);
-- CREATE POLICY "Service role can write price history" ON price_history FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- ----------------------------------------------------------------------------
-- 8.4 Tokens Policies
-- ----------------------------------------------------------------------------

CREATE POLICY "Allow all on tokens"
ON tokens
FOR ALL
USING (true)
WITH CHECK (true);

-- Alternative: Read-only for users
-- CREATE POLICY "Anyone can read tokens" ON tokens FOR SELECT USING (true);
-- CREATE POLICY "Service role can modify tokens" ON tokens FOR ALL USING (auth.role() = 'service_role');

-- ----------------------------------------------------------------------------
-- 8.5 Achievements Policies - DISABLED (Coming Soon)
-- ----------------------------------------------------------------------------

-- CREATE POLICY "Allow all on achievements"
-- ON achievements
-- FOR ALL
-- USING (true)
-- WITH CHECK (true);

-- Alternative: Read-only for users
-- CREATE POLICY "Anyone can read achievements" ON achievements FOR SELECT USING (true);
-- CREATE POLICY "Service role can modify achievements" ON achievements FOR ALL USING (auth.role() = 'service_role');

-- ----------------------------------------------------------------------------
-- 8.6 Config Policies
-- ----------------------------------------------------------------------------

CREATE POLICY "Allow all on config"
ON config
FOR ALL
USING (true)
WITH CHECK (true);

-- Alternative: Read-only for users
-- CREATE POLICY "Anyone can read config" ON config FOR SELECT USING (true);
-- CREATE POLICY "Service role can modify config" ON config FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- 9. INSERT INITIAL DATA
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 9.1 Default Tokens
-- ----------------------------------------------------------------------------

-- Game token (BATR)
INSERT INTO tokens (symbol, name, initial_price, current_price, is_active, is_real_crypto, created_at)
VALUES ('BATR', 'Based Traders Token', 100.00, 100.00, TRUE, FALSE, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
ON CONFLICT (symbol) DO NOTHING;

-- Real crypto tokens
INSERT INTO tokens (symbol, name, initial_price, current_price, is_active, is_real_crypto, max_leverage, created_at)
VALUES
  ('BTC', 'Bitcoin', 95000.00, 95000.00, TRUE, TRUE, 10, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
  ('ETH', 'Ethereum', 3500.00, 3500.00, TRUE, TRUE, 10, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
  ('SOL', 'Solana', 230.00, 230.00, TRUE, TRUE, 10, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
ON CONFLICT (symbol) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 9.2 Default Config
-- ----------------------------------------------------------------------------

INSERT INTO config (key, value, updated_at)
VALUES
  ('BASE_TRADING_FEE', '0.002', EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
  ('PROFIT_FEE', '0.05', EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
  ('FUNDING_RATE_PER_HOUR', '0.0005', EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
  ('MAX_POSITION_SIZE_PERCENT', '0.80', EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
  ('INITIAL_CASH', '250', EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = EXCLUDED.updated_at;

-- ----------------------------------------------------------------------------
-- 9.3 Default Achievements - DISABLED (Coming Soon)
-- ----------------------------------------------------------------------------

-- INSERT INTO achievements (name, description, icon, rarity, requirement_type, requirement_value, is_active, created_at)
-- VALUES
--   ('First Trade', 'Complete your first trade', '🎯', 'Common', 'total_trades', 1, TRUE, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
--   ('Day Trader', 'Complete 10 trades', '📊', 'Common', 'total_trades', 10, TRUE, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
--   ('Active Trader', 'Complete 50 trades', '💹', 'Rare', 'total_trades', 50, TRUE, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
--   ('Master Trader', 'Complete 100 trades', '🏆', 'Epic', 'total_trades', 100, TRUE, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),

--   ('First Win', 'Win your first trade', '🎉', 'Common', 'winning_trades', 1, TRUE, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
--   ('Lucky Streak', 'Win 10 trades', '🍀', 'Rare', 'winning_trades', 10, TRUE, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
--   ('Winning Machine', 'Win 50 trades', '⚡', 'Epic', 'winning_trades', 50, TRUE, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),

--   ('Small Profit', 'Make $100 profit in one trade', '💵', 'Common', 'biggest_win', 100, TRUE, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
--   ('Big Win', 'Make $500 profit in one trade', '💰', 'Rare', 'biggest_win', 500, TRUE, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
--   ('Jackpot', 'Make $1000 profit in one trade', '💎', 'Epic', 'biggest_win', 1000, TRUE, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
--   ('Mega Win', 'Make $5000 profit in one trade', '👑', 'Legendary', 'biggest_win', 5000, TRUE, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),

--   ('Getting Started', 'Reach $500 balance', '📈', 'Common', 'high_score', 500, TRUE, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
--   ('Rising Star', 'Reach $1000 balance', '⭐', 'Rare', 'high_score', 1000, TRUE, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
--   ('Diamond Hands', 'Reach $5000 balance', '💎', 'Epic', 'high_score', 5000, TRUE, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
--   ('Whale Status', 'Reach $10000 balance', '🐋', 'Legendary', 'high_score', 10000, TRUE, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),

--   ('Sharp Trader', 'Achieve 60% win rate', '🎖️', 'Rare', 'win_rate', 60, TRUE, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
--   ('Expert Trader', 'Achieve 70% win rate', '🥇', 'Epic', 'win_rate', 70, TRUE, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
--   ('Trading God', 'Achieve 80% win rate', '🏅', 'Legendary', 'win_rate', 80, TRUE, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
-- ON CONFLICT DO NOTHING;

-- ============================================================================
-- 10. INITIALIZE PRICE HISTORY FOR DEFAULT TOKENS
-- ============================================================================

-- Create initial price history (last 120 seconds) for each token
DO $$
DECLARE
  token_record RECORD;
  i INTEGER;
  now_ts BIGINT;
BEGIN
  now_ts := EXTRACT(EPOCH FROM NOW())::BIGINT * 1000;

  -- Loop through all active tokens
  FOR token_record IN
    SELECT id, current_price FROM tokens WHERE is_active = TRUE
  LOOP
    -- Create 120 historical price points (2 minutes of data)
    FOR i IN REVERSE 119..0 LOOP
      INSERT INTO price_history (token_id, price, timestamp)
      VALUES (
        token_record.id,
        token_record.current_price,
        now_ts - (i * 1000)
      );
    END LOOP;
  END LOOP;
END $$;

-- ============================================================================
-- 11. GRANT PERMISSIONS
-- ============================================================================

-- Grant usage on sequences to authenticated users
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;

-- Grant access to tables
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- ============================================================================
-- 12. VERIFICATION QUERIES
-- ============================================================================

-- Check created tables
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Check indexes
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- Check constraints
SELECT
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type
FROM information_schema.table_constraints tc
WHERE tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;

-- Check triggers
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- Check initial data
SELECT 'players' as table_name, COUNT(*) as row_count FROM players
UNION ALL
SELECT 'tokens', COUNT(*) FROM tokens
UNION ALL
SELECT 'positions', COUNT(*) FROM positions
UNION ALL
SELECT 'price_history', COUNT(*) FROM price_history
UNION ALL
SELECT 'config', COUNT(*) FROM config
-- UNION ALL
-- SELECT 'achievements', COUNT(*) FROM achievements -- DISABLED (Coming Soon)
ORDER BY table_name;

-- ============================================================================
-- SCHEMA CREATION COMPLETE
-- ============================================================================
--
-- Summary:
-- ✓ 5 tables created (players, tokens, positions, price_history, config)
-- ✓ 17+ indexes created for performance
-- ✓ 2 functions created (cleanup, timestamp update)
-- ✓ 3 triggers created (auto-cleanup, auto-timestamp)
-- ✓ RLS enabled on all tables
-- ✓ RLS policies created (currently permissive - adjust as needed)
-- ✓ Initial data inserted (4 tokens, 5 config entries)
-- ✓ Price history initialized (120 points per token)
-- ℹ️ Achievements table disabled (coming soon)
--
-- Next steps:
-- 1. Review RLS policies and adjust based on your security requirements
-- 2. Run migration script to import existing SQLite data
-- 3. Enable Realtime for 'tokens' and 'price_history' tables in Supabase Dashboard
-- 4. Test the schema with your application
--
-- ============================================================================
