-- Migration 0004: seed default app settings in system_settings
-- These are AI model configuration values, stored as plain text (non-sensitive).

INSERT OR IGNORE INTO system_settings (key, value, description)
VALUES
  ('env.AI_ENDPOINT_URL', 'https://api.openai.com/v1/responses', 'AI API endpoint URL for generating vocabulary'),
  ('env.AI_MODEL_NAME', 'gpt-5.4-mini', 'AI model identifier'),
  ('env.AI_MODEL_OPTIONS', '{"max_output_tokens":4096,"temperature":0.7}', 'AI model options as JSON (varies by provider/model)');
