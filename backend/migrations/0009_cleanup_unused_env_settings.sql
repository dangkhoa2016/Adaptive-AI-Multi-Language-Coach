-- Migration 0009: Remove unused env.* settings from system_settings
-- env.EMAIL_FROM, env.EMAIL_FROM_NAME, env.EMAIL_PROVIDER, env.AWS_REGION
-- were seeded in migration 0003 but are never read by any source code.
-- The email service reads its config from email_providers_config table instead.

DELETE FROM system_settings WHERE key IN (
  'env.EMAIL_FROM',
  'env.EMAIL_FROM_NAME',
  'env.EMAIL_PROVIDER',
  'env.AWS_REGION'
);
