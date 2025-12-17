-- Migration number: 0003 	 2025-10-12T21:07:05.160Z
-- Migration: Add CHECK constraint to prevent negative token balance
-- Purpose: Block token consumption when balance insufficient
-- Use PRAGMA defer_foreign_keys (D1-specific) instead of foreign_keys = OFF

PRAGMA defer_foreign_keys = ON;

CREATE TABLE users_new (
  user_id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  current_token_balance INTEGER DEFAULT 0 CHECK (current_token_balance >= 0),
  monthly_token_limit INTEGER,
  total_tokens_purchased INTEGER DEFAULT 0,
  total_tokens_used INTEGER DEFAULT 0,
  stripe_customer_id TEXT,
  created_at TIMESTAMP DEFAULT (datetime('now')),
  last_login_at TIMESTAMP
);

INSERT INTO users_new SELECT * FROM users;

DROP TABLE users;

ALTER TABLE users_new RENAME TO users;

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_stripe_customer ON users(stripe_customer_id);

PRAGMA defer_foreign_keys = OFF;
