# AI settings in D1

Application settings live in D1 `system_settings`, with keys prefixed by `env.`. KV stores public generation results, not configuration.

`pnpm --filter @vocab/backend seed:settings:local` writes local non-secret defaults for `AI_ENDPOINT_URL`, `AI_MODEL_NAME` and `AI_MODEL_OPTIONS`. It replaces those three rows; use a disposable local database for review. The seed does not install API keys. `settings.example.json` demonstrates non-secret overrides. Remote seeding requires a separately approved release procedure and is outside the M1 review.

The authenticated admin PATCH endpoint accepts only `AI_KEYS`, `AI_ENDPOINT_URL`, `AI_MODEL_NAME` and `AI_MODEL_OPTIONS`. `AI_KEYS` is a JSON array of credentials, always encrypted by the server regardless of a client `encrypted` flag. GET returns metadata only. Use a private authenticated client to replace credentials; do not put them in checked-in JSON, shell history, logs or evidence. Legacy plaintext/corrupt secret rows fail closed and require a deliberate replacement.

Endpoint URLs require HTTPS and must match an origin in trusted deployment `AI_PROVIDER_ORIGINS` (default `https://api.openai.com`). D1 changes cannot extend that allowlist. Model options permit only `max_output_tokens`, `temperature` and `top_p`. Model configuration changes invalidate public generation cache namespaces; credentials never enter cache keys.

See [development setup](../../docs/DEV-SETUP.md) for origin configuration, quotas and synthetic browser fixtures.
