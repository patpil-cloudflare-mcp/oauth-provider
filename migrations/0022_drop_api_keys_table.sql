-- Migration 0022: Drop api_keys table
-- API-key authorization (wtyk_* keys) has been removed. All authentication now
-- goes through AuthKit JWT (verifyAuthKitJwtToUserId in src/auth/authenticateBearer.ts).
-- Dropping the table also removes its indexes (idx_api_keys_*).

DROP TABLE IF EXISTS api_keys;
