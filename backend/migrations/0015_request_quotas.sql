-- Durable counters supplement native per-IP/PoP limits, keys are SHA-256 digests.
CREATE TABLE IF NOT EXISTS quota_buckets (
  key TEXT NOT NULL,
  bucket INTEGER NOT NULL,
  used INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (key, bucket)
);
CREATE INDEX IF NOT EXISTS idx_quota_expiry ON quota_buckets(expires_at);
