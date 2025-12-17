-- Migration number: 0002 	 2025-10-12T20:59:38.798Z
-- Migration: Add UNIQUE constraint on stripe_payment_id
-- Purpose: Prevent duplicate credits from duplicate Stripe webhooks
-- Date: 2025-10-12

-- In SQLite, you cannot add UNIQUE constraint to existing column directly
-- You must recreate the table with the constraint

-- Step 1: Create new table with UNIQUE constraint
CREATE TABLE transactions_new (
  transaction_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(user_id),
  type TEXT NOT NULL CHECK (type IN ('purchase', 'usage')),
  token_amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  stripe_payment_id TEXT UNIQUE,  -- ADDED UNIQUE constraint
  mcp_server_name TEXT,
  description TEXT,
  created_at TIMESTAMP DEFAULT (datetime('now'))
);

-- Step 2: Copy existing data
INSERT INTO transactions_new 
SELECT * FROM transactions;

-- Step 3: Drop old table
DROP TABLE transactions;

-- Step 4: Rename new table
ALTER TABLE transactions_new RENAME TO transactions;

-- Step 5: Recreate indexes
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_stripe_payment ON transactions(stripe_payment_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX idx_transactions_type ON transactions(type);

-- Verify the constraint was added
SELECT sql FROM sqlite_master WHERE type='table' AND name='transactions';
