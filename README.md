# Adaptive AI Multi-Language Coach

[Tiếng Việt](README.vi.md)

A pnpm monorepo with a Vue 3 SPA, Hono API on Cloudflare Workers, D1 storage, KV caching, and shared TypeScript locale definitions. Source includes vocabulary generation, flashcards, quizzes, spaced review, magic-link auth, admin settings, and TTS/STT routes. Their presence does not establish production or live AI acceptance.

## Current verification status

M1 hardening follows the owner's continuation request on `recovery/adaptive-coach-production-hardening-2026-10-29`, starting from M0 dependency HEAD `be1417bf8dc94f9bfc9f0eb87c44383e9eee6b8e`. M0 technical gates passed; owner acceptance remains a separate decision. Credential verification remains skipped at the owner's request.

M1 adds trusted-origin/CSRF checks, race-safe single-use tokens, session revocation, metadata-only admin settings with enforced secret encryption, atomic versioned/idempotent review, durable D1 quotas, bounded payload/provider behavior and model-configuration cache isolation. Browser fixtures exercise login→ENVI generation→save→grade using actual Vue/Worker/D1/KV HTTP and memory-only synthetic mail. The external M1 evidence records final committed-HEAD gates and failed exploratory attempts; historical coverage is not reused.

M2–M4 remain NOT_RUN. Deployment stays disabled: no push, remote database read/write, real email or paid inference. Local verification does not establish production acceptance or AI/audio language quality. Dependencies retain Cloudflare plugin1.4.8/esbuild0.28.2 advisory remediation without audit suppression. Keep credential-bearing source ZIPs/backups private; rotation is not verified.

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

CI runs typecheck, lint, formatting, Vitest, the native provider runtime regression, and build. E2E is a separate command that starts its own disposable backend and frontend; it requires Chromium and system browser libraries. The manual deployment workflow depends on reusable quality CI and has its deployment job disabled pending owner approval and environment configuration.

## Architecture and API

Browser → Vue API client → Vite `/api` proxy (development) or Worker (deployment) → Hono routes → D1/KV. The frontend builds to root `assets/`, served through `ASSETS`. Server locale resolution uses `Accept-Language` or `?lang=` for eight locales: en, vi, ja, ko, th, zh, fr, de. UI locale support is separate from verified AI/audio language quality.

Vocabulary generation reads model/endpoint settings and encrypted API-key configuration from D1, calls the configured HTTP provider only when keys exist, then falls back to language-labelled local pairs. KV v3 keys include languages, topic, level, count, mode, day and an endpoint/model/options snapshot hash; cached fallback remains labelled. Audio routes use Workers AI through `AI`; the local smoke configuration omits this potentially billable remote binding.

| API group         | Main endpoints                                                                       | Current boundary                                                 |
| ----------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| Public metadata   | `/health`, `/api/locales`, `/api/topics`, `/api/docs`                                | No AI/auth quota charged                                         |
| Learning          | POST `/api/generate`, `/api/quiz`, `/api/tts`, `/api/stt`                            | Native limiter + durable guest/account/global budgets            |
| Auth              | POST `/api/auth/request`, `/api/auth/verify`, `/api/auth/logout`; GET `/api/auth/me` | Configured origin, single-use tokens, quotas, revocable sessions |
| Vocabulary/review | `/api/vocab/*`, `/api/review/*`                                                      | User scope; atomic grade, CAS/version and replay key             |
| Administration    | `/api/admin/*`                                                                       | Auth/admin; metadata, encrypted secrets, value-free audit        |

D1 tables cover users, hashed magic tokens, learned pairs, email provider configuration, system settings, topics, fallback pairs, AI-generated history, AI model selection, review logs, rate-limit events and audit logs. Preserve all twelve historical migration files;0013–0015 add M1 schema only. Local main and recovery differ in 0003/0004 migration identity; legacy retains `mastered_at` and an index absent from fresh schema. Migration 0009 intentionally deletes four settings keys. See setup docs for backup/rehearsal restrictions.

## Configuration and security

| Binding             | Purpose                                                                  |
| ------------------- | ------------------------------------------------------------------------ |
| `ASSETS`            | Built Vue files                                                          |
| `DB`                | D1 relational storage                                                    |
| `CACHE`             | KV generated-pair cache, daily/versioned keys, 24-hour TTL               |
| `RATE_LIMITER_API`  | 10 learning POST requests per 60 seconds in local template/driver        |
| `RATE_LIMITER_AUTH` | 3 auth POST requests per 60 seconds in local template/driver             |
| `AI`                | Deployment-only Workers AI audio binding; not enabled by local generator |

`JWT_SECRET` and `ENCRYPTION_KEY` are Worker secrets; ignored local `.dev.vars` contains synthetic values from setup, or preserves a pre-existing file. Never use those example values in staging/production. AI settings live in D1; admin responses expose metadata and enforce AI_KEYS encryption. PUBLIC_APP_ORIGIN/ENVIRONMENT configure the trusted browser origin; AI_PROVIDER_ORIGINS grants provider-origin trust outside D1. See setup docs for existing local config updates. Legacy secret/audit rows may require a separate approved rewrite/cleanup; tests do not verify credential rotation.

## Browser fixtures and operations

Install Chromium/system dependencies with `pnpm --filter @vocab/frontend exec playwright install --with-deps chromium`, then run `pnpm --filter @vocab/frontend test:e2e`. Stop existing services on 5173/8787/8788 first: the driver refuses reuse, creates fresh in-memory D1/KV, applies tracked migrations/seed, captures only synthetic Resend requests, and blocks other outbound traffic. It never reads `.dev.vars`, remote DBs or live provider keys. Machine-readable Playwright results include HTTP-status annotations; no message bodies, magic tokens or cookies are exported.

A real release needs owner approval, private environment configuration and migration history, resolved/accepted security risks, M1 acceptance, staging/restore rehearsals and subsequent M2–M4 work. This run provides no deployment or remote rollback acceptance. Features such as complete audio-language quality, accessibility acceptance, offline/mobile delivery and extended gamification remain unverified or future work; the historical roadmap is in `idea-and-plan/`.

## Worker test toolchain

Backend tests import `cloudflareTest` from exact `@cloudflare/vitest-plugin@1.4.8`, with `@cloudflare/vitest-plugin/types`. Vitest remains 4.1.12; M1 extends safe fixtures and durable quotas without dependency changes. Direct esbuild0.28.2 is supported by the installed Vite peer range and is also used by the disposable E2E bundler.

The vendor plugin owns Wrangler4.153.0/Miniflare5 internally. Local CLI remains Wrangler4.105.0 and browser fixtures remain Miniflare4.20260625.0. A version-scoped `packageExtensions` entry supplies genuine Workers Types5 to the plugin’s internal Wrangler, while application TypeScript and local CLI keep Types4. Peer requirements are satisfied in their own scopes; no peer-check bypass or audit suppression is configured. The newer Miniflare JSON-binding types require a closed object type alias for the existing SQL-file fixtures; payloads and validation are unchanged.

The M1 evidence records gates on the committed clean HEAD, review findings and remaining limits. Stop for owner review before M2–M4 or deployment.
