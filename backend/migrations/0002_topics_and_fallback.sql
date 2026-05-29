-- Migration 0002: topics and fallback vocabulary tables
-- Replaces hard-coded topic labels and fallback vocab pairs with database-backed storage.

CREATE TABLE IF NOT EXISTS topics (
  key TEXT PRIMARY KEY,
  label_en TEXT NOT NULL,
  label_vi TEXT NOT NULL,
  label_ja TEXT NOT NULL,
  label_ko TEXT NOT NULL,
  label_th TEXT NOT NULL,
  label_zh TEXT NOT NULL,
  label_fr TEXT NOT NULL,
  label_de TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fallback_pairs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_lang TEXT NOT NULL,
  target_lang TEXT NOT NULL,
  topic TEXT NOT NULL,
  level TEXT NOT NULL,
  source TEXT NOT NULL,
  target TEXT NOT NULL,
  example_source TEXT NOT NULL DEFAULT '',
  example_target TEXT NOT NULL DEFAULT '',
  ipa TEXT NOT NULL DEFAULT '',
  pos TEXT NOT NULL DEFAULT '',
  is_phrase INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_fallback_pairs_lookup
  ON fallback_pairs(source_lang, target_lang, topic, level);
