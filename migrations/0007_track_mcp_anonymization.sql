-- Migration 0007: Track MCP Actions Anonymization in Account Deletions
-- Date: 2025-10-18
-- Purpose: Add column to track how many MCP actions had their parameters anonymized
--
-- GDPR Compliance: Article 17 - Right to Erasure
-- MCP action parameters may contain PII in the result field (e.g., user email, IP addresses)
-- When user deletes account, we anonymize these parameters to comply with GDPR

-- Add MCP actions anonymization tracking to account_deletions table
ALTER TABLE account_deletions
ADD COLUMN mcp_actions_anonymized INTEGER NOT NULL DEFAULT 0;
-- Stores count of MCP actions that had parameters anonymized

-- NOTES:
-- - This count helps audit GDPR compliance
-- - Shows how many records had PII removed from parameters field
-- - Original parameters are replaced with: {"anonymized": true, "reason": "user_account_deleted", ...}
-- - Use this query to verify anonymization:
--   SELECT user_id, COUNT(*) as actions,
--          SUM(CASE WHEN json_extract(parameters, '$.anonymized') = 1 THEN 1 ELSE 0 END) as anonymized
--   FROM mcp_actions
--   WHERE user_id IN (SELECT user_id FROM account_deletions)
--   GROUP BY user_id;
