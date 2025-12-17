-- Migration number: 0005
-- Date: 2025-10-17
-- Migration: Add Idempotency Protection and Failed Deduction Reconciliation
-- Purpose:
--   1. Prevent duplicate token charges via unique action_id constraint
--   2. Enable automatic reconciliation of failed token deductions
--   3. Add audit trail for deduction failures

-- ============================================================
-- 1. ADD UNIQUE INDEX ON action_id FOR IDEMPOTENCY
-- ============================================================
-- Prevents duplicate token charges when retry occurs
-- If same action_id is used twice, second attempt will fail with UNIQUE constraint error
CREATE UNIQUE INDEX IF NOT EXISTS idx_mcp_actions_action_id
ON mcp_actions(action_id);

-- ============================================================
-- 2. CREATE failed_deductions TABLE FOR RECONCILIATION
-- ============================================================
-- Logs all failed token deduction attempts for automatic retry
-- Used by cron job to recover lost revenue from transient failures
CREATE TABLE IF NOT EXISTS failed_deductions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action_id TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    mcp_server_name TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    token_amount INTEGER NOT NULL,
    parameters TEXT NOT NULL,
    error_message TEXT NOT NULL,
    created_at TEXT NOT NULL,
    resolved_at TEXT,
    retry_count INTEGER DEFAULT 0,
    last_retry_at TEXT,
    FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- ============================================================
-- 3. CREATE INDEX FOR RECONCILIATION QUERIES
-- ============================================================
-- Optimizes query: SELECT * FROM failed_deductions WHERE resolved_at IS NULL
-- Used by cron job every 6 hours to find pending reconciliations
CREATE INDEX IF NOT EXISTS idx_failed_deductions_unresolved
ON failed_deductions(resolved_at, created_at)
WHERE resolved_at IS NULL;

-- ============================================================
-- 4. RUN PRAGMA OPTIMIZE FOR QUERY PLANNER
-- ============================================================
-- Update statistics for query planner to optimize performance
PRAGMA optimize;

-- ============================================================
-- 5. VERIFY DATABASE INTEGRITY
-- ============================================================
-- Ensure no corruption after schema changes
PRAGMA quick_check;
