-- Migration number: 0004 	 2025-10-17T14:30:00.000Z
-- Migration: Add account deletion support fields and audit table
-- Purpose: GDPR-compliant account deletion with transaction history preservation
-- Strategy: Anonymize user data, preserve financial records for tax/accounting compliance

PRAGMA defer_foreign_keys = ON;

-- ============================================
-- STEP 1: Update users table with deletion fields
-- ============================================

CREATE TABLE users_new (
  user_id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  current_token_balance INTEGER DEFAULT 0 CHECK (current_token_balance >= 0),
  monthly_token_limit INTEGER,
  total_tokens_purchased INTEGER DEFAULT 0,
  total_tokens_used INTEGER DEFAULT 0,
  stripe_customer_id TEXT,
  created_at TIMESTAMP DEFAULT (datetime('now')),
  last_login_at TIMESTAMP,
  -- New deletion fields
  is_deleted INTEGER DEFAULT 0 CHECK (is_deleted IN (0, 1)),
  deleted_at TIMESTAMP,
  workos_user_id TEXT  -- Track WorkOS user ID for deletion
);

-- Copy existing data
INSERT INTO users_new (
  user_id, email, current_token_balance, monthly_token_limit,
  total_tokens_purchased, total_tokens_used, stripe_customer_id,
  created_at, last_login_at
)
SELECT
  user_id, email, current_token_balance, monthly_token_limit,
  total_tokens_purchased, total_tokens_used, stripe_customer_id,
  created_at, last_login_at
FROM users;

-- Replace old table
DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

-- Recreate indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_stripe_customer ON users(stripe_customer_id);
CREATE INDEX idx_users_is_deleted ON users(is_deleted);
CREATE INDEX idx_users_deleted_at ON users(deleted_at);

-- ============================================
-- STEP 2: Create audit table for account deletions
-- ============================================

CREATE TABLE account_deletions (
  deletion_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  original_email TEXT NOT NULL,
  tokens_forfeited INTEGER NOT NULL,
  total_tokens_purchased INTEGER DEFAULT 0,
  total_tokens_used INTEGER DEFAULT 0,
  stripe_customer_id TEXT,
  deletion_reason TEXT,  -- Optional: user can provide reason
  deleted_at TIMESTAMP DEFAULT (datetime('now')),
  deleted_by_ip TEXT,    -- Optional: log IP for security audit
  -- Keep foreign key for audit trail (will still work with anonymized users)
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Indexes for audit queries
CREATE INDEX idx_account_deletions_user_id ON account_deletions(user_id);
CREATE INDEX idx_account_deletions_deleted_at ON account_deletions(deleted_at DESC);
CREATE INDEX idx_account_deletions_original_email ON account_deletions(original_email);

PRAGMA defer_foreign_keys = OFF;
PRAGMA optimize;