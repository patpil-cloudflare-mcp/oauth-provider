-- Migration 0020: Add UNIQUE constraint on workos_user_id
-- Purpose: Prevent duplicate user records when email changes in WorkOS
-- SQLite requires table rebuild to add constraints to existing columns

-- Step 1: Create new table with UNIQUE constraint on workos_user_id
CREATE TABLE users_new (
  user_id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TEXT DEFAULT (datetime('now')),
  last_login_at TEXT,
  is_deleted INTEGER DEFAULT 0,
  deleted_at TEXT,
  workos_user_id TEXT UNIQUE
);

-- Step 2: Copy existing data
INSERT INTO users_new (user_id, email, created_at, last_login_at, is_deleted, deleted_at, workos_user_id)
SELECT user_id, email, created_at, last_login_at, is_deleted, deleted_at, workos_user_id
FROM users;

-- Step 3: Drop old table
DROP TABLE users;

-- Step 4: Rename new table
ALTER TABLE users_new RENAME TO users;

-- Step 5: Recreate index for workos_user_id lookups
CREATE INDEX idx_users_workos_user_id ON users(workos_user_id);
