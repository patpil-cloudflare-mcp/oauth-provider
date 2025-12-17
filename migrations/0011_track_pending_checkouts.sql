-- Migration 0011: Track Pending Checkouts
-- Date: 2025-10-18
-- Purpose: Track active checkout sessions to detect payment race conditions
--
-- UX Protection: Detect when user deletes account but has pending payment
-- If payment completes within 1 hour of deletion, auto-refund with explanation

-- Add checkout tracking columns to account_deletions table
ALTER TABLE account_deletions
ADD COLUMN had_pending_checkout INTEGER NOT NULL DEFAULT 0;
-- Values: 0 = no pending checkout, 1 = had active checkout session at deletion time

ALTER TABLE account_deletions
ADD COLUMN checkout_session_id TEXT;
-- Stores the Stripe checkout session ID if there was a pending checkout

ALTER TABLE account_deletions
ADD COLUMN checkout_auto_refunded INTEGER NOT NULL DEFAULT 0;
-- Values: 0 = no refund needed/issued, 1 = payment auto-refunded

ALTER TABLE account_deletions
ADD COLUMN checkout_refund_id TEXT;
-- Stores the Stripe refund ID if auto-refund was issued

-- Index for quick lookup of recent deletions with pending checkouts
CREATE INDEX idx_account_deletions_recent_checkout
ON account_deletions(deleted_at, had_pending_checkout)
WHERE had_pending_checkout = 1;

-- NOTES:
-- - When user deletes account, we check for active checkout sessions
-- - If session exists and is in 'open' or 'complete' state, we record it
-- - In webhook handler, if payment completes within 1 hour of deletion:
--   1. Check if user is deleted (is_deleted = 1)
--   2. Check if deletion happened within last 60 minutes
--   3. If yes, auto-refund the payment
--   4. Send explanatory email to user
--   5. Update checkout_auto_refunded and checkout_refund_id
--
-- - This protects users who:
--   a) Start checkout process
--   b) Delete account while payment page is open
--   c) Complete payment after deletion
--
-- - Edge case example:
--   - 10:00 AM - User clicks "Delete Account" and confirms
--   - 10:05 AM - Account deleted from database
--   - 10:10 AM - User completes Stripe payment (browser tab still open)
--   - 10:11 AM - Webhook receives checkout.session.completed
--   - 10:11 AM - System detects deletion within last hour
--   - 10:12 AM - Auto-refund issued with explanation
