# Local development

Use Node **22.22.3** (`.nvmrc`, supported range `>=22.18.0 <23`) and **pnpm 11.1.3**. Locked tooling requires Node 22.18 or later. Do not reuse production credentials or database snapshots.

```bash
nvm use
corepack enable
pnpm install --frozen-lockfile
pnpm --filter @vocab/backend setup:local
pnpm --filter @vocab/frontend build
pnpm --filter @vocab/backend db:migrate:local
pnpm --filter @vocab/backend db:seed:local
```

`setup:local` creates ignored `backend/wrangler.toml` and `backend/.dev.vars` only if absent. Existing files are preserved; inspect them privately before use. The generated configuration uses local placeholder IDs, D1, KV, assets, and rate limiters. Never deploy it. It deliberately omits Workers AI because that binding can invoke remote, billable inference. The deployment template declares AI; account bindings and approval are required for live checks. Local AI/audio functionality is not verified by health checks.

Run two terminals:

```bash
pnpm dev:backend
```

```bash
pnpm dev:frontend
```

Visit `http://localhost:5173`. Vite proxies `/api` to `127.0.0.1:8787`. Check `http://127.0.0.1:8787/health` and `/api/locales` (eight locales). Built assets go to root `assets/`.

For disposable validation, always pass a new `--persist-to` directory to Wrangler migration, seed, and dev commands, using the same absolute path for all three. This avoids reusing an existing local database. Never use `--remote` in the M0/M1 review run.

## Verification

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm -r build
pnpm --filter @vocab/backend test:coverage
pnpm --filter @vocab/frontend test:coverage
pnpm --filter @vocab/frontend exec playwright install --with-deps chromium
pnpm --filter @vocab/frontend test:e2e
```

Playwright starts Vite and a Miniflare driver with fresh in-memory D1/KV, local migrations/seed and native rate limits. Stop other services on 5173/8787/8788 first; existing backends are never reused. Only synthetic mail is captured locally, every other outbound request is blocked, and no live AI key is configured. `pnpm test` runs Vitest, not Playwright. Coverage includes `coverage-summary.json` in each workspace's ignored coverage directory. Auth/mail/AI unit tests use mocks; Workers tests also exercise local D1/KV. Passing those tests does not establish live mail, AI quality, or complete browser flows.

## Authentication and security status

The narrow M0 closure exception fixes double serialization, route quota scope and unlabelled fallback; The dependency follow-up migrates to the supported Cloudflare test plugin to remediate audit; M0 acceptance remains pending the owner, and credential verification is skipped at the owner’s request. Overall M1 remains gated on M0 acceptance; magic-link generation trusts request Origin and has an unsafe token log failure path. Admin secret APIs and review atomicity also need M1 work. Do not test with real email accounts, provider credentials, or production secrets. Do not use token console output or manual token SQL inserts as a login workflow. The old insert recipe used a nonexistent `magic_tokens.id` column and could not satisfy token hashing. The E2E driver captures synthetic mail for the link-request assertion only. Complete safe login/save/review fixtures remain M1 work and are not accepted here.

## Database and release limits

Fresh migrations and a synthetic local legacy upgrade were exercised. Local main's historical migration names `0003_ai_generated_content.sql` / `0004_sm2_review.sql` differ from recovery's `0003_migrate_env_to_db.sql` / `0004_seed_app_settings.sql`. Preserve historical identities. Legacy also retains `mastered_at`, absent from fresh schema. Migration 0009 deletes four old settings keys. Unknown remote history requires private inventory, backup, and a matching rehearsal before any approved upgrade.

Deployment workflow is manual-only and its deploy job is disabled. It depends on reusable quality CI; enabling deployment requires owner review, real environment configuration, and explicit release authorization. No remote migrations, deployment, or paid AI checks were performed.
