-- Migration 0006: ai_models table for Workers AI model configuration
-- Stores available AI models (TTS, STT) so they can be switched without code changes.

CREATE TABLE IF NOT EXISTS ai_models (
  key TEXT PRIMARY KEY,
  model_id TEXT NOT NULL,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO ai_models (key, model_id, description)
VALUES
  ('tts_model', '@cf/myshell-ai/melotts', 'Text-to-Speech model for audio generation'),
  ('stt_model', '@cf/openai/whisper', 'Speech-to-Text model for transcription');
