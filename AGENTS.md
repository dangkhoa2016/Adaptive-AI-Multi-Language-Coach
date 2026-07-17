# AGENTS.md

This file provides guidance to the AI agent when working with code in this repository.

## Repo Overview

pnpm monorepo with 3 workspaces: `backend` (Cloudflare Workers / Hono), `frontend` (Vue 3 SPA), `packages/shared`. The frontend builds into `../assets/` which the Worker serves via the `ASSETS` binding.

## Key Commands

```bash
pnpm install                    # Install all workspaces
pnpm dev:backend                # Wrangler dev on :8787
pnpm dev:frontend               # Vite dev on :5173 (proxies /api to :8787)
pnpm typecheck                  # pnpm -r typecheck
pnpm lint / pnpm lint:fix       # ESLint flat config
pnpm format / pnpm format:check # Prettier
pnpm test                       # pnpm -r test
pnpm -r build                   # Build all workspaces
```

Backend-specific:

```bash
pnpm --filter @vocab/backend db:migrate:local   # Apply D1 migrations locally (run before dev)
pnpm --filter @vocab/backend db:migrate:remote  # Apply to production D1
pnpm --filter @vocab/backend test:watch         # Vitest watch mode
pnpm --filter @vocab/backend exec wrangler secret put <NAME>  # Set production secret
```

Frontend build uses `vue-tsc --noEmit && vite build`, output dir is `../assets`.

## Before Running Locally

1. Copy `backend/.dev.vars.example` to `backend/.dev.vars`
2. Apply D1 migrations: `pnpm --filter @vocab/backend db:migrate:local`
3. Replace placeholder KV/D1 IDs in `backend/wrangler.toml` before deploying

## Code Style

- **Prettier**: no semicolons, single quotes, trailing commas all, print width 100
- **ESLint**: flat config (`eslint.config.mjs`), TypeScript strict, Vue flat/recommended
- **Unused vars**: `warn` with `argsIgnorePattern: '^_'` — prefix unused params with `_`
- **no-explicit-any**: `warn` — avoid `any` but not a hard block
- **lint-staged** runs on pre-commit: `*.{ts,tsx,vue,js,mjs,cjs}` → eslint + prettier, `*.{json,md,yml,css,html}` → prettier
- Commit style: Conventional Commits (e.g., `feat(plan): add detailed project plan`)

## Testing

- Backend uses Vitest with `@cloudflare/vitest-pool-workers` (uses `wrangler.test.toml`)
- Frontend has no tests yet (placeholder script)
- Run all tests: `pnpm test`

## Architecture Gotchas

- **Frontend output**: Vite `build.outDir` is `../assets` — this is NOT `frontend/dist`. The Worker serves these files via `ASSETS` binding.
- **i18n**: Backend resolves locale via `Accept-Language` header or `?lang=` query param. 8 locales supported: `en, vi, ja, ko, th, zh, fr, de`. Locale constants live in `packages/shared/src/locales.ts`.
- **Frontend proxy**: Vite dev server proxies `/api` to `http://127.0.0.1:8787` — both services must run for API calls to work.
- **Path alias**: Frontend uses `@/` alias mapped to `frontend/src/`.
- **D1 migrations**: Live in `backend/migrations/`. Must be applied separately for local (`--local`) and remote (`--remote`).
- **wrangler.toml IDs**: KV and D1 IDs are placeholders (`xxxx_...`). Must be replaced with real IDs before first deploy.

## CI/CD

- **ci.yml**: Runs on PRs and push to `main` — install (frozen lockfile) → typecheck → lint → format:check → test → build
- **deploy.yml**: Push to `main` → production deploy; PR → preview deploy with `--env preview`

## Branch / PR Conventions

- Branch naming: `tembo/` prefix for feature branches (e.g., `tembo/start-plan-step1-idea-docs`)
- PR titles follow Conventional Commits: `type(scope): description`
