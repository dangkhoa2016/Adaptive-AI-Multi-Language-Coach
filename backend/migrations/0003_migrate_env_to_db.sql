-- Migration 0003: migrate env vars from wrangler.toml/.dev.vars into system_settings
-- This allows changing env vars without re-deploying.
-- Sensitive values (secrets) should be encrypted at rest using ENCRYPTION_KEY.
-- Non-secret values are stored as plain text.

-- Email configuration (non-secret)
INSERT OR IGNORE INTO system_settings (key, value, description)
VALUES
  ('env.EMAIL_FROM', 'no-reply@yourdomain.com', 'Email sender address'),
  ('env.EMAIL_FROM_NAME', 'AI Vocab App', 'Email sender display name'),
  ('env.EMAIL_PROVIDER', 'database_dynamic', 'Default email provider strategy'),
  ('env.AWS_REGION', 'us-east-1', 'AWS region for SES email sending');
