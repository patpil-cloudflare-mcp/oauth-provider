-- Migration number: 0014 	 2025-12-17
-- Migration 0014: Drop transaction and MCP action tables
-- Purpose: Remove token accounting tables

-- Drop indexes first
DROP INDEX IF EXISTS idx_transactions_user_id;
DROP INDEX IF EXISTS idx_transactions_stripe_payment;
DROP INDEX IF EXISTS idx_transactions_created_at;
DROP INDEX IF EXISTS idx_transactions_type;

DROP INDEX IF EXISTS idx_mcp_actions_user_id;
DROP INDEX IF EXISTS idx_mcp_actions_server_name;
DROP INDEX IF EXISTS idx_mcp_actions_created_at;
DROP INDEX IF EXISTS idx_mcp_actions_action_id;

-- Drop tables
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS mcp_actions;

-- Verify tables removed
SELECT name FROM sqlite_master WHERE type='table' AND name IN ('transactions', 'mcp_actions');
