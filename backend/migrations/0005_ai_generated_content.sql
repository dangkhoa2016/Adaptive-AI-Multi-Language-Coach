-- Migration 0003: ai_generated_content table
-- Stores AI-generated vocabulary pairs to enable admin history review
-- and avoid redundant API calls that could trigger rate limits.

CREATE TABLE IF NOT EXISTS ai_generated_content (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_lang TEXT NOT NULL,
  target_lang TEXT NOT NULL,
  topic TEXT NOT NULL,
  level TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'mix',
  count INTEGER NOT NULL,
  pairs_json TEXT NOT NULL,
  cache_key TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_generated_lookup
  ON ai_generated_content(source_lang, target_lang, topic, level, mode, created_at);

CREATE INDEX IF NOT EXISTS idx_ai_generated_cache_key
  ON ai_generated_content(cache_key);
