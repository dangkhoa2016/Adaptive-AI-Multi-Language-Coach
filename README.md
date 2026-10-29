# Adaptive AI Multi-Language Coach

[Tiếng Việt](README.vi.md)

A pnpm monorepo with a Vue 3 SPA, Hono API on Cloudflare Workers, D1 storage, KV caching, and shared TypeScript locale definitions. Source includes vocabulary generation, flashcards, quizzes, spaced review, magic-link auth, admin settings, and TTS/STT routes. Their presence does not establish production or live AI acceptance.

## Current verification status

The 2026-10-29 recovery starts from `42f0d7d9cc261f83e627f112f976c34d2c3b7ddf` on `recovery/adaptive-coach-production-hardening-2026-10-29`.

- **M0: FAIL**. Browser tests ran after installing Chromium and system dependencies: both auth and learning flow tests failed their success assertions. M1 has not started, as required by the hardening plan's stop gate.
- Fresh Vitest runs: **165 backend + 160 frontend tests passed**. Coverage lines: backend **89.82%**, frontend **52.79%**. Auth/mail/AI tests use mocks; local Workers tests also exercise D1/KV.
- Frozen install, typecheck, lint, and build passed. Lint retains 65 existing warnings; build reports existing locale chunking warnings.
- Twelve fresh D1 migrations, synthetic local legacy upgrade, integrity checks, and independent snapshot restoration passed. Unknown remote history and fresh/legacy schema divergence still require review.
- Dependency audit reports unresolved vulnerabilities, including runtime and development dependencies. Auth, admin secret handling, review atomicity, and API limits need M1 regression work. No production readiness claim is made.
- Deployment is disabled. No push, remote database change, live mail, or paid AI call was performed. M2–M4 are not run.

The external evidence bundle contains command timestamps/exit codes, current coverage summaries, migration inventory, static security findings, and E2E failure logs. Never share original source archives or private backups: they contain Git/local secret material. Rotate the exposed GitHub credential identified in the redacted report.

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

| Path                             | Purpose                                                       |
| -------------------------------- | ------------------------------------------------------------- |
| `backend/src/`                   | Hono routes, auth, settings, review, AI/audio services        |
| `backend/migrations/`            | Forward migrations; preserve historical identities            |
| `backend/wrangler.template.toml` | Deployment configuration template requiring owner review      |
| `frontend/src/`                  | Vue views, stores, composables, API client                    |
| `frontend/e2e/`                  | Playwright browser tests, separate from Vitest                |
| `packages/shared/src/`           | Shared types and eight locale definitions                     |
| `assets/`                        | Ignored frontend build output served by Worker assets binding |
| `idea-and-plan/`                 | Historical product roadmap; not verification evidence         |

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm -r build
pnpm --filter @vocab/frontend test:e2e
```

CI runs typecheck, lint, formatting, Vitest, and build. E2E is a separate local command and remains a failed review gate. The manual deployment workflow depends on reusable quality CI and has its deployment job disabled pending owner approval and environment configuration.
