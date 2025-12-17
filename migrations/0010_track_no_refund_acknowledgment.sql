-- Migration 0010: Track No-Refund Policy Acknowledgment
-- Date: 2025-10-18
-- Purpose: Track that user acknowledged the no-refund policy before deletion
--
-- UX Protection: Ensures users are fully informed before deleting account

-- Add acknowledgment tracking column
ALTER TABLE account_deletions
ADD COLUMN user_acknowledged_no_refund INTEGER NOT NULL DEFAULT 0;
-- Values: 0 = not acknowledged (shouldn't happen), 1 = user acknowledged no-refund policy

-- NOTES:
-- - This column confirms user saw and acknowledged Article 38(13) notice
-- - Frontend modal displays: "BRAK ZWROTU ŚRODKÓW" with legal reference
-- - User must type their email to confirm understanding
-- - Provides legal protection showing informed consent
