-- Additive concurrency and user-scoped replay protection. Existing history is preserved.
ALTER TABLE learned_pairs ADD COLUMN review_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE learned_pairs ADD COLUMN last_review_id TEXT;
ALTER TABLE review_logs ADD COLUMN idempotency_key TEXT;
ALTER TABLE review_logs ADD COLUMN request_hash TEXT;
ALTER TABLE review_logs ADD COLUMN result_json TEXT;
CREATE UNIQUE INDEX idx_review_logs_user_idempotency ON review_logs(user_id, idempotency_key);
