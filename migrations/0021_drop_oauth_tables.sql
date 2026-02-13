-- Migration 0021: Drop OAuth tables (deferred cleanup)
-- IMPORTANT: Only apply AFTER confirming AuthKit migration works in production (1+ week)
-- These tables were used by the custom OAuth server (src/oauth.ts) which has been replaced by AuthKit MCP Auth

DROP TABLE IF EXISTS oauth_authorizations;
DROP TABLE IF EXISTS oauth_clients;
