-- Migration 0019: Add OAuth clients and user authorizations tracking
-- Purpose: Store MCP server OAuth clients and track which users have authorized which clients

-- OAuth clients (MCP servers)
-- These are pre-registered OAuth clients that can request user authorization
CREATE TABLE oauth_clients (
  client_id TEXT PRIMARY KEY,
  client_secret_hash TEXT,                    -- bcrypt hash, NULL for public clients
  name TEXT NOT NULL,                          -- Display name (e.g., "Claude Desktop")
  description TEXT,                            -- Optional description
  icon_url TEXT,                               -- Optional icon URL for dashboard display
  redirect_uris TEXT NOT NULL,                 -- JSON array of allowed redirect URIs
  scopes TEXT NOT NULL DEFAULT '["mcp_access"]', -- JSON array of allowed scopes
  client_type TEXT NOT NULL DEFAULT 'public', -- 'public' or 'confidential'
  created_at TEXT DEFAULT (datetime('now')),
  is_active INTEGER DEFAULT 1                  -- Soft delete flag
);

-- User authorizations (tracks which users have authorized which clients)
CREATE TABLE oauth_authorizations (
  authorization_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  scopes TEXT NOT NULL,                        -- JSON array of granted scopes
  authorized_at TEXT DEFAULT (datetime('now')),
  last_used_at TEXT,                           -- Updated on token refresh

  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  UNIQUE (user_id, client_id)                  -- One authorization per user-client pair
);

-- Indexes for efficient queries
CREATE INDEX idx_authorizations_user ON oauth_authorizations(user_id);
CREATE INDEX idx_authorizations_client ON oauth_authorizations(client_id);
CREATE INDEX idx_clients_active ON oauth_clients(is_active);
