-- Migration 0018: Add simplified account_deletions table for GDPR audit trail

CREATE TABLE account_deletions (
  deletion_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  original_email TEXT NOT NULL,
  deletion_reason TEXT,
  deleted_at TEXT DEFAULT (datetime('now')),
  deleted_by_ip TEXT,

  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE INDEX idx_deletions_user ON account_deletions(user_id);
CREATE INDEX idx_deletions_date ON account_deletions(deleted_at);
