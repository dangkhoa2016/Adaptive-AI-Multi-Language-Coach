# Configuration Guide

This document lists all environment variables, KV keys, D1 system settings, and Cloudflare bindings required to deploy this application.

## Quick Start

1. Copy `backend/.dev.vars` (contains `ENCRYPTION_KEY` for local dev)
2. Replace placeholder IDs in `backend/wrangler.toml` (KV, D1, Rate Limit namespaces)
3. Run local migrations: `pnpm --filter @vocab/backend db:migrate:local`
4. Seed topics: `pnpm --filter @vocab/backend db:seed:local`

---

## 1. Cloudflare Bindings (`wrangler.toml`)

These are defined in `wrangler.toml` and bound to the Worker via `env`.

| Binding             | Type        | Required | Description                                            |
| ------------------- | ----------- | -------- | ------------------------------------------------------ |
| `ASSETS`            | Fetcher     | Yes      | Serves the Vue SPA static build (from `../assets`)     |
| `CACHE`             | KVNamespace | Yes      | KV namespace for caching AI-generated vocabulary pairs |
| `DB`                | D1Database  | Yes      | SQLite database (users, tokens, vocab, settings)       |
| `RATE_LIMITER_API`  | RateLimit   | Yes      | API rate limiting (10 req/60s per IP)                  |
| `RATE_LIMITER_AUTH` | RateLimit   | Yes      | Auth rate limiting (3 req/60s per IP)                  |

TypeScript interface (`backend/src/env.ts`):

```ts
export interface Bindings {
  ASSETS: Fetcher
  CACHE: KVNamespace
  DB: D1Database
  RATE_LIMITER_API: RateLimit
  RATE_LIMITER_AUTH: RateLimit
  ENCRYPTION_KEY: string
}
```

> **Important**: The KV namespace binding must be named `CACHE`. The code references `env.CACHE`.

### Bindings actually used in code

| Binding             | Used in                                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------------------------------- |
| `DB`                | `routes/topics.ts`, `services/appSettings.ts`, `services/cache.ts`, `services/fallback.ts`, `services/quiz.ts` |
| `CACHE`             | `services/cache.ts`                                                                                            |
| `RATE_LIMITER_API`  | `middleware/rateLimit.ts`                                                                                      |
| `ENCRYPTION_KEY`    | Declared in `Bindings` but not used yet                                                                        |
| `ASSETS`            | Served automatically by Cloudflare                                                                             |
| `RATE_LIMITER_AUTH` | Declared in `Bindings` but not used yet                                                                        |

---

## 2. Environment Variables & Secrets

### Local Development (`backend/.dev.vars`)

| Var              | Value                                           | Description                         |
| ---------------- | ----------------------------------------------- | ----------------------------------- |
| `ENCRYPTION_KEY` | `development-encryption-key-not-for-production` | AES-256 root key (development only) |

### Production Secrets

Set via `wrangler secret put <NAME>`:

| Secret           | Required | Description                                      |
| ---------------- | -------- | ------------------------------------------------ |
| `ENCRYPTION_KEY` | Yes      | AES-256 root key for encrypting sensitive values |

### GitHub Actions (CI/CD)

Required in repository settings for `deploy.yml`:

| Secret                  | Required | Description                                         |
| ----------------------- | -------- | --------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | Yes      | Cloudflare API token with Workers/D1/KV permissions |
| `CLOUDFLARE_ACCOUNT_ID` | Yes      | Your Cloudflare account ID                          |

---

## 3. KV Keys

All KV keys are stored under the `CACHE` namespace. KV is used **only for caching** AI-generated vocabulary responses.

| Key Pattern                                                                 | Format     | TTL      | Description                                                                |
| --------------------------------------------------------------------------- | ---------- | -------- | -------------------------------------------------------------------------- |
| `cache:{source}\|{target}\|{topic}\|{level}\|{count}\|{mode}\|{YYYY-MM-DD}` | JSON array | 24 hours | Cached AI-generated vocabulary pairs. Auto-created on successful AI calls. |

The cache key includes the date (`YYYY-MM-DD`), so cache is bucketed per day.

---

## 4. D1 `system_settings` Keys

All settings are stored in the `system_settings` table (key/value store).

### Keys currently read by application code

These are read by `getAppSettings()` in `backend/src/services/appSettings.ts`:

| Key                    | Default Value                                  | Description                  |
| ---------------------- | ---------------------------------------------- | ---------------------------- |
| `env.AI_ENDPOINT_URL`  | `https://api.openai.com/v1/responses`          | AI API endpoint URL          |
| `env.AI_MODEL_NAME`    | `gpt-5.4-mini`                                 | Model identifier             |
| `env.AI_MODEL_OPTIONS` | `{"max_output_tokens":4096,"temperature":0.7}` | Model options as JSON string |

### Keys seeded by migrations (not read by current code)

These exist in the database but are **not actively used** by the current TypeScript codebase:

| Key                    | Default Value             | Seeded in Migration | Description                                |
| ---------------------- | ------------------------- | ------------------- | ------------------------------------------ |
| `env.EMAIL_FROM`       | `no-reply@yourdomain.com` | 0003                | Email sender address                       |
| `env.EMAIL_FROM_NAME`  | `AI Vocab App`            | 0003                | Email sender display name                  |
| `env.EMAIL_PROVIDER`   | `database_dynamic`        | 0003                | Default email provider strategy            |
| `env.AWS_REGION`       | `us-east-1`               | 0003                | AWS region for SES                         |
| `force_email_provider` | `''` (empty)              | 0001                | CSV whitelist of provider_ids for rotation |

---

## 5. Rate Limit Namespaces

Defined in `wrangler.toml`:

| Binding             | Namespace ID | Limit       | Window | Purpose                  |
| ------------------- | ------------ | ----------- | ------ | ------------------------ |
| `RATE_LIMITER_API`  | `1001`       | 10 requests | 60s    | General API protection   |
| `RATE_LIMITER_AUTH` | `1002`       | 3 requests  | 60s    | Auth endpoint protection |

> Create these namespaces before deploying:
>
> ```bash
> npx wrangler ratelimit create 1001 --period 60 --limit 10
> npx wrangler ratelimit create 1002 --period 60 --limit 3
> ```

---

## 6. Deployment Checklist

### Development (Local)

- [ ] `backend/.dev.vars` exists (contains `ENCRYPTION_KEY`)
- [ ] `backend/wrangler.toml` has real KV/D1 IDs (replace `xxxx_...` placeholders)
- [ ] Migrations applied: `pnpm --filter @vocab/backend db:migrate:local`
- [ ] Topics seeded: `pnpm --filter @vocab/backend db:seed:local`

### Staging / Preview

- [ ] GitHub secrets configured (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`)
- [ ] Open a PR → auto-deploys to preview environment
- [ ] Set secrets: `pnpm --filter @vocab/backend exec wrangler secret put ENCRYPTION_KEY --env preview`
- [ ] Apply migrations: `pnpm --filter @vocab/backend exec wrangler d1 migrations apply ai_vocab_db --remote --env preview`

### Production

- [ ] Merge to `main` → auto-deploys to production
- [ ] Set secrets:
  ```bash
  pnpm --filter @vocab/backend exec wrangler secret put ENCRYPTION_KEY
  ```
- [ ] Apply migrations:
  ```bash
  pnpm --filter @vocab/backend exec wrangler d1 migrations apply ai_vocab_db --remote
  ```
- [ ] Seed topics:
  ```bash
  pnpm --filter @vocab/backend exec wrangler d1 execute ai_vocab_db --remote --file=seed/0001_topics_and_fallback.sql
  ```
- [ ] Verify rate limit namespaces exist (IDs 1001, 1002)

---

## 7. File Locations Reference

| File                                  | Purpose                                   |
| ------------------------------------- | ----------------------------------------- |
| `backend/wrangler.test.toml`          | Test Wrangler config                      |
| `backend/.dev.vars`                   | Local development secrets (gitignored)    |
| `backend/src/env.ts`                  | TypeScript `Bindings` interface           |
| `backend/src/index.ts`                | Hono app entry point, router setup        |
| `backend/src/services/appSettings.ts` | Reads AI config from D1 `system_settings` |
| `backend/src/services/cache.ts`       | KV caching for AI responses (24h TTL)     |
| `backend/src/services/crypto.ts`      | AES-256-GCM encryption/decryption         |
| `backend/src/services/schemas.ts`     | Zod schemas for validation                |
| `backend/src/services/prompts.ts`     | AI prompt builders                        |
| `backend/src/services/fallback.ts`    | Fallback vocabulary pairs from D1         |
| `backend/src/services/quiz.ts`        | Quiz generation logic                     |
| `backend/src/i18n/`                   | Internationalization (8 locales)          |
| `backend/src/routes/`                 | API route handlers                        |
| `backend/src/middleware/rateLimit.ts` | Rate limiting middleware                  |
| `backend/migrations/`                 | D1 schema migrations (0001-0004)          |
