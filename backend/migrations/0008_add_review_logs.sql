-- Migration 0008: add review_logs table for per-grade history tracking

CREATE TABLE IF NOT EXISTS review_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  learned_pair_id TEXT NOT NULL,
  source_text TEXT NOT NULL,
  target_text TEXT NOT NULL,
  quality INTEGER NOT NULL,
  reviewed_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_review_logs_user_date ON review_logs(user_id, reviewed_at);
