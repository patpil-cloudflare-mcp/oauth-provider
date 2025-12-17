-- Migration 0012: Add API Keys Table
-- Purpose: Enable permanent API keys for non-OAuth MCP clients (AnythingLLM, Cursor, etc.)
-- Date: 2025-10-24
-- Author: System

-- ============================================================
-- API KEYS TABLE
-- ============================================================
-- Stores permanent API keys for programmatic access to MCP servers
-- Keys are hashed using bcrypt before storage (never store plaintext)
-- ============================================================

CREATE TABLE IF NOT EXISTS api_keys (
  -- Primary identifier
  api_key_id TEXT PRIMARY KEY,

  -- Foreign key to users table
  user_id TEXT NOT NULL,

  -- Hashed API key (SHA-256, never store plaintext)
  api_key_hash TEXT NOT NULL UNIQUE,

  -- Prefix for display purposes (first 16 chars: "wtyk_a7f3k9m2...")
  key_prefix TEXT NOT NULL,

  -- User-provided name for the key (e.g., "AnythingLLM", "Cursor IDE", "Production Server")
  name TEXT NOT NULL,

  -- Last time this key was used for authentication
  last_used_at INTEGER,

  -- Timestamps
  created_at INTEGER NOT NULL,

  -- Optional expiration (NULL = never expires)
  expires_at INTEGER,

  -- Active status (0 = revoked, 1 = active)
  is_active INTEGER DEFAULT 1 CHECK (is_active IN (0, 1)),

  -- Foreign key constraint
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================

-- Index for looking up keys by user_id (for listing user's keys)
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);

-- Index for authentication lookups by hash
CREATE INDEX idx_api_keys_hash ON api_keys(api_key_hash);

-- Index for finding active keys
CREATE INDEX idx_api_keys_active ON api_keys(is_active);

-- Composite index for user's active keys
CREATE INDEX idx_api_keys_user_active ON api_keys(user_id, is_active);

-- ============================================================
-- NOTES
-- ============================================================
-- 1. API Key Format: wtyk_<32_random_chars>
--    Example: wtyk_a7f3k9m2p5q8r1s4t6v9w2x5y8z1b4c7
--
-- 2. Security:
--    - Keys are hashed with SHA-256 before storage (Cloudflare Workers compatible)
--    - Plaintext key is shown ONCE at generation time
--    - key_prefix stored for display in UI (e.g., "wtyk_a7f3k9m2...")
--    - Note: SHA-256 chosen over bcrypt due to Cloudflare Workers limitations
--    - Future: Consider bcrypt via WebAssembly for enhanced security
--
-- 3. Usage:
--    - Users generate keys in dashboard settings
--    - Keys used in Authorization header: "Bearer wtyk_..."
--    - Rate limiting applied per API key
--
-- 4. Revocation:
--    - Set is_active = 0 (soft delete)
--    - ON DELETE CASCADE removes keys when user is deleted
--
-- 5. Expiration:
--    - expires_at = NULL means never expires (default)
--    - Optional expiration for temporary keys
--
-- ============================================================
