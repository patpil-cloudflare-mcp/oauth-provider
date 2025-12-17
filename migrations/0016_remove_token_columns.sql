-- Migration number: 0013 	 2025-12-17
-- Migration 0013: Remove token-related columns from users table
-- Purpose: Simplify users table for OAuth-only authentication

-- Create new users table without token columns
CREATE TABLE users_new (
    user_id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    last_login_at TEXT,
    is_deleted INTEGER DEFAULT 0 CHECK (is_deleted IN (0, 1)),
    deleted_at TEXT,
    workos_user_id TEXT
);

-- Copy data (excluding token and Stripe columns)
INSERT INTO users_new (
    user_id, email, created_at, last_login_at,
    is_deleted, deleted_at, workos_user_id
)
SELECT
    user_id, email, created_at, last_login_at,
    COALESCE(is_deleted, 0), deleted_at, workos_user_id
FROM users;

-- Drop old table
DROP TABLE users;

-- Rename new table
ALTER TABLE users_new RENAME TO users;

-- Recreate indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_workos ON users(workos_user_id);
CREATE INDEX idx_users_deleted ON users(is_deleted);

-- Verify migration
SELECT COUNT(*) as total_users FROM users;
