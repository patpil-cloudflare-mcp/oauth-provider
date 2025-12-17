-- Migration 0006: Track Stripe Customer Deletion in Account Deletions
-- Date: 2025-10-18
-- Purpose: Add columns to track whether Stripe customer was successfully deleted during account deletion
--
-- GDPR Compliance: Article 17 - Right to Erasure
-- These columns help audit complete data deletion from Stripe

-- Add Stripe deletion tracking columns to account_deletions table
ALTER TABLE account_deletions
ADD COLUMN stripe_customer_deleted INTEGER NOT NULL DEFAULT 0;
-- Values: 0 = not deleted or no customer, 1 = successfully deleted

ALTER TABLE account_deletions
ADD COLUMN stripe_deletion_error TEXT;
-- Stores error message if Stripe deletion failed (NULL if successful)

-- Add index for querying failed Stripe deletions
-- This helps identify accounts where Stripe customer deletion failed
CREATE INDEX idx_account_deletions_stripe_failed
ON account_deletions(stripe_customer_deleted)
WHERE stripe_customer_deleted = 0 AND stripe_customer_id IS NOT NULL;

-- NOTES:
-- - stripe_customer_deleted = 0 means either:
--   a) No Stripe customer existed (stripe_customer_id was NULL)
--   b) Stripe deletion failed (check stripe_deletion_error for reason)
--
-- - stripe_customer_deleted = 1 means:
--   - Stripe customer was successfully deleted from Stripe
--   - Customer no longer exists in Stripe systems
--   - All payment methods were detached
--   - All subscriptions were cancelled
--   - All open invoices were voided
--
-- - Use this query to find failed Stripe deletions:
--   SELECT deletion_id, user_id, stripe_customer_id, stripe_deletion_error
--   FROM account_deletions
--   WHERE stripe_customer_deleted = 0 AND stripe_customer_id IS NOT NULL;
