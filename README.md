# Adaptive AI Multi-Language Coach

> 🌐 Language / Ngôn ngữ: **English** | [Tiếng Việt](README.vi.md)

A full-stack monorepo delivering an AI-powered language learning experience — spaced-repetition flashcards, AI-generated vocabulary, TTS/STT drills, magic-link authentication, and gamification — all running serverlessly on Cloudflare's edge network.

The detailed product plan lives in [`idea-and-plan/`](./idea-and-plan/) (`plan.md` in English-mixed Vietnamese / `plan.vi.md` in full Vietnamese).

## Features

### Currently Implemented

- **pnpm monorepo** with 3 workspaces (`backend`, `frontend`, `packages/shared`)
- **Hono API** on Cloudflare Workers with i18n middleware (`Accept-Language` / `?lang=`)
- **Vue 3 SPA** with locale switcher, Pinia persisted state, vue-i18n
- **8 supported locales**: `en`, `vi`, `ja`, `ko`, `th`, `zh`, `fr`, `de`
- **D1 database schema** ready for auth, SM-2 spaced repetition, and email provider rotation
- **CI/CD** — quality gate on PRs, auto-deploy on push to `main`

### Planned (see [roadmap](#roadmap))

- AI word/phrase generation with KV caching & fallback
- Flashcard, quiz, and result views with auto-scaling text
- Magic-link authentication with multi-provider email rotation (SES, Postmark, SendPulse, Resend)
- SM-2 spaced repetition algorithm with daily review cron
- TTS (MeloTTS) listening drills & Whisper STT speaking drills
- Gamification (streaks, XP, leagues, leaderboards, badges)
- PWA + Capacitor mobile wrapper

## Technologies Used

| Layer          | Technology                                                             |
| -------------- | ---------------------------------------------------------------------- |
| **Runtime**    | Cloudflare Workers (Hono + TypeScript)                                 |
| **Storage**    | D1 (SQLite), KV (cache), Workers AI bindings                           |
| **Frontend**   | Vue 3 + Vite + Tailwind 4 + Pinia + vue-i18n@11 + Vue Router 5         |
| **Validation** | Zod                                                                    |
| **Testing**    | Vitest + `@cloudflare/vitest-pool-workers`                             |
| **Tooling**    | pnpm workspaces, ESLint 9 (flat config), Prettier, Husky + lint-staged |
| **CI/CD**      | GitHub Actions (typecheck, lint, format, test, build, deploy)          |

## Layout

```
.
├── backend/                    # Cloudflare Worker (Hono API + D1 migrations)
│   ├── src/
│   │   ├── index.ts            # Hono app entry, middleware, routes
│   │   └── env.ts              # Bindings & env var types
│   ├── migrations/
│   │   └── 0001_init.sql       # Initial D1 schema (5 tables)
│   ├── test/
│   │   └── health.test.ts      # Vitest tests
│   ├── wrangler.toml           # Production config & bindings
│   └── package.json            # @vocab/backend
│
├── frontend/                   # Vue 3 SPA (builds into ../assets, served by Worker)
│   ├── src/
│   │   ├── main.ts             # Bootstrap (Pinia + Router + i18n)
│   │   ├── App.vue             # Root component
│   │   ├── router/             # Vue Router config
│   │   ├── stores/             # Pinia stores (prefs)
│   │   ├── i18n/               # vue-i18n setup + messages
│   │   ├── views/              # Page components (HomeView)
│   │   └── styles/             # Tailwind CSS entry
│   ├── vite.config.ts          # Output to ../assets, API proxy to :8787
│   ├── tailwind.config.ts      # Tailwind v4, dark mode, CJK fonts
│   └── package.json            # @vocab/frontend
│
├── packages/shared/            # @vocab/shared — locale constants, shared types
│   └── src/
│       ├── index.ts            # Re-exports
│       └── locales.ts          # SUPPORTED_LOCALES, Locale type, resolveLocale()
│
├── assets/                     # Built frontend output (served by Worker ASSETS binding)
├── .github/workflows/
│   ├── ci.yml                  # Quality gate on PRs
│   └── deploy.yml              # Deploy to Cloudflare Workers
└── idea-and-plan/              # Product plan
    ├── plan.md                 # English-mixed Vietnamese
    └── plan.vi.md              # Full Vietnamese
```

## Quick Start

### Prerequisites

- **Node.js >= 20.11** (see `.nvmrc`)
- **pnpm** (packageManager pinned in `package.json`)
- **Wrangler CLI** (`pnpm add -g wrangler`)

### Development

```bash
# 1. Install all workspaces
pnpm install

# 2. Apply D1 migrations locally
pnpm --filter @vocab/backend db:migrate:local

# 3. Start backend (Wrangler dev on :8787)
pnpm dev:backend

# 4. In another terminal, start frontend (Vite on :5173, proxies /api to :8787)
pnpm dev:frontend
```

### Quality Gate

```bash
# Mirrors CI: typecheck + lint + format check + test + build
pnpm typecheck && pnpm lint && pnpm test && pnpm -r build
```

### Available Scripts

| Command             | Description                       |
| ------------------- | --------------------------------- |
| `pnpm dev:backend`  | Start backend with `wrangler dev` |
| `pnpm dev:frontend` | Start frontend with `vite`        |
| `pnpm build`        | Build all workspaces              |
| `pnpm test`         | Run all tests                     |
| `pnpm typecheck`    | Type-check all workspaces         |
| `pnpm lint`         | Run ESLint                        |
| `pnpm lint:fix`     | Run ESLint with `--fix`           |
| `pnpm format`       | Run Prettier (write)              |
| `pnpm format:check` | Run Prettier (check)              |

Backend-specific:

| Command                                           | Description                      |
| ------------------------------------------------- | -------------------------------- |
| `pnpm --filter @vocab/backend dev`                | Wrangler dev                     |
| `pnpm --filter @vocab/backend test`               | Vitest run                       |
| `pnpm --filter @vocab/backend test:watch`         | Vitest watch                     |
| `pnpm --filter @vocab/backend db:migrate:local`   | Apply D1 migrations locally      |
| `pnpm --filter @vocab/backend db:migrate:remote`  | Apply D1 migrations to remote DB |
| `pnpm --filter @vocab/backend db:migrations:list` | List pending migrations          |
| `pnpm --filter @vocab/backend deploy`             | `wrangler deploy`                |

Frontend-specific:

| Command                                 | Description                      |
| --------------------------------------- | -------------------------------- |
| `pnpm --filter @vocab/frontend dev`     | Vite dev server                  |
| `pnpm --filter @vocab/frontend build`   | `vue-tsc --noEmit && vite build` |
| `pnpm --filter @vocab/frontend preview` | Vite preview                     |

## Database Schema

The D1 schema (`backend/migrations/0001_init.sql`) defines 5 tables:

| Table                    | Purpose                                                                                |
| ------------------------ | -------------------------------------------------------------------------------------- |
| `users`                  | User accounts (email, verification, timezone)                                          |
| `magic_tokens`           | SHA-256 hashed magic-link tokens with expiry                                           |
| `learned_pairs`          | Vocabulary/phrases with SM-2 fields (ease, interval, repetitions, next_review, status) |
| `email_providers_config` | Email provider rotation config with weighted random selection                          |
| `system_settings`        | Key-value store for runtime settings (e.g., `force_email_provider`)                    |

## API Endpoints

| Method | Path           | Description                              |
| ------ | -------------- | ---------------------------------------- |
| `GET`  | `/`            | Welcome JSON                             |
| `GET`  | `/health`      | Health check `{ ok, ts }`                |
| `GET`  | `/api/locales` | List all 8 supported locales with labels |

All `/api/*` routes include:

- **CORS** headers
- **i18n middleware** — resolves locale from `Accept-Language` header or `?lang=` query param, sets `Content-Language` response header

## Cloudflare Bindings

`backend/wrangler.toml` declares:

| Binding             | Purpose                                                    |
| ------------------- | ---------------------------------------------------------- |
| `ASSETS`            | Static assets (Vue SPA built into `../assets`)             |
| `AI`                | Workers AI (LLM, Whisper, MeloTTS)                         |
| `CACHE`             | KV namespace for caching AI generation responses (24h TTL) |
| `DB`                | D1 SQLite database (users, magic tokens, learned pairs)    |
| `RATE_LIMITER_API`  | 10 req / 60s — AI endpoints                                |
| `RATE_LIMITER_AUTH` | 3 req / 15 min — magic-link request / verify               |

> **Before deploying**, replace the placeholder `id`s in `wrangler.toml` with real IDs from `wrangler kv namespace create` / `wrangler d1 create`.

## Secrets

Local dev secrets live in `backend/.dev.vars` (gitignored). Copy from [`backend/.dev.vars.example`](./backend/.dev.vars.example):

```bash
cp backend/.dev.vars.example backend/.dev.vars
```

Production secrets are set via Wrangler:

```bash
pnpm --filter @vocab/backend exec wrangler secret put <NAME>
```

Expected secret names: `JWT_SECRET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `POSTMARK_SERVER_TOKEN`, `SENDPULSE_CLIENT_ID`, `SENDPULSE_CLIENT_SECRET`, `RESEND_API_KEY`.

## CI/CD

### `ci.yml` — Quality Gate

Triggers on push to `main` and PRs:

1. `pnpm install` (frozen lockfile)
2. `pnpm typecheck`
3. `pnpm lint`
4. `pnpm format:check`
5. `pnpm test`
6. `pnpm -r build`

### `deploy.yml` — Deploy

- **Push to `main`**: `wrangler deploy` (production)
- **PR**: `wrangler deploy --env preview --name ai-vocab-app-pr-<number>` (preview deployment)

Requires GitHub secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.

## Roadmap

| Phase | Objective                                                                       | Status                      |
| ----- | ------------------------------------------------------------------------------- | --------------------------- |
| **0** | Bootstrap monorepo, CI, DB migrations, Wrangler config, linting                 | **Done**                    |
| **1** | Backend i18n, AI word/phrase generation API with cache, fallback, rate limiting | Planned                     |
| **2** | Vue 3 SPA — flashcard/quiz/result views, auto-scale text, 8 locale i18n         | **Partial** (HomeView only) |
| **3** | A11y, Lighthouse 95+, offline cache, WAF, error boundaries, analytics           | Planned                     |
| **4** | Magic-link auth (SHA-256 tokens, JWT cookies), multi-provider email adapter     | Planned                     |
| **5** | SM-2 spaced repetition algorithm, daily review cron, vocab reset/re-learn       | Planned                     |
| **6** | Server TTS (MeloTTS), listening & speaking drills (Whisper STT)                 | Planned                     |
| **7** | Gamification — streaks, XP, leagues, leaderboards, badges, social challenges    | Planned                     |
| **8** | PWA manifest (8 locales), Capacitor wrapper, Sentry, custom domain              | Planned                     |
| **9** | Full QA — Vitest unit, Miniflare integration, Playwright E2E, k6 load testing   | Planned                     |
