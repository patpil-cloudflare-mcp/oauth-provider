-- Migration 0008: Add Email Hash Column to Account Deletions
-- Date: 2025-10-18
-- Purpose: Store SHA-256 hash of email instead of plaintext for GDPR compliance
--
-- GDPR Compliance: Article 17 - Right to Erasure
-- Storing email hashes instead of plaintext reduces PII exposure while maintaining:
-- - Re-registration detection (check if user previously deleted account)
-- - Audit trail (cannot reverse hash to recover original email)

-- Add email_hash column to store SHA-256 hash
ALTER TABLE account_deletions
ADD COLUMN email_hash TEXT;

-- Add index for re-registration detection
CREATE INDEX idx_account_deletions_email_hash
ON account_deletions(email_hash);

-- MIGRATION NOTES:
-- 1. This migration adds the column but does NOT automatically hash existing emails
-- 2. Run the one-time migration script to hash existing plaintext emails:
--    node scripts/hash-existing-deletion-emails.mjs
--
-- 3. After all existing emails are hashed and verified:
--    - Create a new migration to drop the original_email column
--    - Example: ALTER TABLE account_deletions DROP COLUMN original_email;
--
-- 4. New deletions will ONLY store email_hash (not plaintext)
--
-- USAGE:
-- - To check if user previously deleted account:
--   SELECT deletion_id, deleted_at
--   FROM account_deletions
--   WHERE email_hash = '<computed_sha256_hash>';
--
-- - Email hash is computed using: SHA-256(lowercase(trim(email)))
