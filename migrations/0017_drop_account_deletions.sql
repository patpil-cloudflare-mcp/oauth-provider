-- Migration 0017: Drop account_deletions table
-- Token system removed, this table is no longer needed

DROP TABLE IF EXISTS account_deletions;
