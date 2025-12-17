-- Migration 0009: Track Failed Deductions Cleanup
-- Date: 2025-10-18
-- Purpose: Add resolution tracking to failed_deductions table and account_deletions table
--
-- GDPR Compliance: Article 17 - Right to Erasure
-- Failed deductions may contain PII in parameters (user email, IP, etc.)
-- When user deletes account, we anonymize these and mark as resolved

-- Add resolution tracking columns to failed_deductions table
-- Note: resolved_at already exists from migration 0005, so we only add the new ones

ALTER TABLE failed_deductions
ADD COLUMN resolved INTEGER NOT NULL DEFAULT 0;
-- Values: 0 = pending (still trying reconciliation), 1 = resolved (no longer actionable)

ALTER TABLE failed_deductions
ADD COLUMN resolution_note TEXT;
-- Explanation of how it was resolved (e.g., "User account deleted - reconciliation cancelled")

-- Add tracking column to account_deletions table
ALTER TABLE account_deletions
ADD COLUMN failed_deductions_cleaned INTEGER NOT NULL DEFAULT 0;
-- Count of failed deductions that were cleaned/anonymized during account deletion

-- Note: Index idx_failed_deductions_unresolved already exists from migration 0005

-- NOTES:
-- - Failed deductions are created when token consumption fails (e.g., database timeout)
-- - Normally, they're reconciled by background job
-- - When user deletes account:
--   1. All unresolved failed deductions get user_id = 'DELETED'
--   2. Parameters field anonymized to: {"anonymized": true, "reason": "user_account_deleted"}
--   3. Marked as resolved with note "User account deleted - reconciliation cancelled"
--
-- - Use this query to find failed deductions needing cleanup:
--   SELECT * FROM failed_deductions WHERE user_id != 'DELETED' AND resolved = 0;
