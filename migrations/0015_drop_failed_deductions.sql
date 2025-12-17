-- Migration number: 0015 	 2025-12-17
-- Migration 0015: Drop failed deductions table
-- Purpose: Remove reconciliation infrastructure

-- Drop indexes
DROP INDEX IF EXISTS idx_failed_deductions_user_id;
DROP INDEX IF EXISTS idx_failed_deductions_resolved;
DROP INDEX IF EXISTS idx_failed_deductions_created_at;

-- Drop table
DROP TABLE IF EXISTS failed_deductions;

-- Verify table removed
SELECT name FROM sqlite_master WHERE type='table' AND name = 'failed_deductions';
