# Adaptive AI Multi-Language Coach

[Tiếng Việt](README.vi.md)

A pnpm monorepo with a Vue 3 SPA, Hono API on Cloudflare Workers, D1 storage, KV caching, and shared TypeScript locale definitions. Source includes vocabulary generation, flashcards, quizzes, spaced review, magic-link auth, admin settings, and TTS/STT routes. Their presence does not establish production or live AI acceptance.

## Current verification status

The M0 closure continues on `recovery/adaptive-coach-production-hardening-2026-10-29`, from original baseline `42f0d7d9cc261f83e627f112f976c34d2c3b7ddf` and first review HEAD `488121f4384bfa8a0738a871ff112ac9e20b0f6a`.

Auth JSON is serialized once, rate limits apply to intended POST routes, and fallback only serves explicitly labelled language pairs. The cache namespace changed to invalidate historical unsafe fallback. Browser auth-request and learning tests now pass with actual Worker/D1/KV HTTP behavior, native quota exhaustion checks, captured synthetic mail, and en→vi fixtures. This does not prove the complete login/save/review security journey or live mail/AI acceptance.

**M0 is not accepted yet**: residual development dependency advisories need owner decisions, and exposed credential rotation is not verified. M1–M4 remain NOT_RUN. Current results, coverage, failures from earlier attempts, dependency decisions and commands recorded on the actual final commit are delivered in the external M0 closure evidence bundle. Previous coverage percentages belong to the first report; they are not reused as current results.

The remaining audit records are high-severity Zod 3 in the development test pool and low-severity esbuild in development tooling; neither is owner-accepted. Frontend Vitest moved from 3 to 4 for security fixes, so its current coverage mapping must not be compared directly with the earlier report.

Deployment remains disabled. No push, remote database read/write, live mail, paid inference, or production data access is authorized in this run. Keep original ZIPs/private backups private and rotate the exposed GitHub credential.

## Local setup

Use **Node 22.22.3** and **pnpm 11.1.3**. See [local setup and verification](docs/DEV-SETUP.md) for commands, disposable database isolation, browser prerequisites, and known auth restrictions.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm --filter @vocab/backend setup:local
pnpm --filter @vocab/frontend build
pnpm --filter @vocab/backend db:migrate:local
pnpm --filter @vocab/backend db:seed:local
```

Run `pnpm dev:backend` and `pnpm dev:frontend` in separate terminals. The SPA uses port 5173 and proxies `/api` to port 8787. The local generator preserves existing config and secrets. Generated configuration is local-only; it omits remote Workers AI.

## Repository and checks

| Path                             | Purpose                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------ |
| `backend/src/`                   | Hono routes, auth, settings, review, AI/audio services                         |
| `backend/migrations/`            | Forward migrations; preserve historical identities                             |
| `backend/wrangler.template.toml` | Deployment configuration template requiring owner review                       |
| `frontend/src/`                  | Vue views, stores, composables, API client                                     |
| `frontend/e2e/`                  | Playwright browser tests and ephemeral full-stack driver, separate from Vitest |
| `packages/shared/src/`           | Shared types and eight locale definitions                                      |
| `assets/`                        | Ignored frontend build output served by Worker assets binding                  |
| `idea-and-plan/`                 | Historical product roadmap; not verification evidence                          |

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm -r build
pnpm --filter @vocab/frontend test:e2e
```

CI runs typecheck, lint, formatting, Vitest, and build. E2E is a separate command that starts its own disposable backend and frontend; it requires Chromium and system browser libraries. The manual deployment workflow depends on reusable quality CI and has its deployment job disabled pending owner approval and environment configuration.

## Architecture and API

Browser → Vue API client → Vite `/api` proxy (development) or Worker (deployment) → Hono routes → D1/KV. The frontend builds to root `assets/`, served through `ASSETS`. Server locale resolution uses `Accept-Language` or `?lang=` for eight locales: en, vi, ja, ko, th, zh, fr, de. UI locale support is separate from verified AI/audio language quality.

Vocabulary generation reads model/endpoint settings and encrypted API-key configuration from D1, calls the configured HTTP provider only when keys exist, then falls back to language-labelled local pairs. KV keys include languages, topic, level, count, mode and day. Audio routes use Workers AI through `AI`; the local smoke configuration omits this potentially billable remote binding.

| API group         | Main endpoints                                                                       | Current boundary                                                            |
| ----------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Public metadata   | `/health`, `/api/locales`, `/api/topics`, `/api/docs`                                | No AI/auth quota charged                                                    |
| Learning          | POST `/api/generate`, `/api/quiz`, `/api/tts`, `/api/stt`                            | Shared native API limiter; guest behavior retained                          |
| Auth              | POST `/api/auth/request`, `/api/auth/verify`, `/api/auth/logout`; GET `/api/auth/me` | Auth POST limiter; me requires a session; security hardening pending        |
| Vocabulary/review | `/api/vocab/*`, `/api/review/*`                                                      | Session required; atomicity/concurrency/authorization acceptance pending M1 |
| Administration    | `/api/admin/*`                                                                       | Auth/admin checks in source; secret exposure fixes pending M1               |

D1 tables cover users, hashed magic tokens, learned pairs, email provider configuration, system settings, topics, fallback pairs, AI-generated history, AI model selection, review logs, rate-limit events and audit logs. Preserve all twelve historical migration files. Local main and recovery differ in 0003/0004 migration identity; legacy retains `mastered_at` and an index absent from fresh schema. Migration 0009 intentionally deletes four settings keys. See setup docs for backup/rehearsal restrictions.

## Configuration and security

| Binding             | Purpose                                                                  |
| ------------------- | ------------------------------------------------------------------------ |
| `ASSETS`            | Built Vue files                                                          |
| `DB`                | D1 relational storage                                                    |
| `CACHE`             | KV generated-pair cache, daily/versioned keys, 24-hour TTL               |
| `RATE_LIMITER_API`  | 10 learning POST requests per 60 seconds in local template/driver        |
| `RATE_LIMITER_AUTH` | 3 auth POST requests per 60 seconds in local template/driver             |
| `AI`                | Deployment-only Workers AI audio binding; not enabled by local generator |

`JWT_SECRET` and `ENCRYPTION_KEY` are Worker secrets; ignored local `.dev.vars` contains synthetic values from setup, or preserves a pre-existing file. Never use those example values in staging/production. Email providers and generation settings are stored in D1; their admin response/audit handling still has open M1 findings. Source contains token logging/origin/replay risks and non-atomic review updates. Do not treat role checks, encrypted-at-rest helpers, or passing unit tests as proof those findings are resolved.

## Browser fixtures and operations

Install Chromium/system dependencies with `pnpm --filter @vocab/frontend exec playwright install --with-deps chromium`, then run `pnpm --filter @vocab/frontend test:e2e`. Stop existing services on 5173/8787/8788 first: the driver refuses reuse, creates fresh in-memory D1/KV, applies tracked migrations/seed, captures only synthetic Resend requests, and blocks other outbound traffic. It never reads `.dev.vars`, remote DBs or live provider keys. Machine-readable Playwright results include HTTP-status annotations; no message bodies, magic tokens or cookies are exported.

A real release needs owner approval, private environment configuration and migration history, resolved/accepted security risks, M1 acceptance, staging/restore rehearsals and subsequent M2–M4 work. This run provides no deployment or remote rollback acceptance. Features such as complete audio-language quality, accessibility acceptance, offline/mobile delivery and extended gamification remain unverified or future work; the historical roadmap is in `idea-and-plan/`.
