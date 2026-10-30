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
pnpm --filter @vocab/backend test:provider-runtime
pnpm -r build
pnpm --filter @vocab/backend test:coverage
pnpm --filter @vocab/frontend test:coverage
pnpm --filter @vocab/frontend exec playwright install --with-deps chromium
pnpm --filter @vocab/frontend test:e2e
```

The native provider regression uses the installed workerd and a synthetic outbound service to check successful fetches and rejected redirects; it never reaches the network. CI runs it separately from Vitest.

Playwright starts Vite and a Miniflare driver with fresh in-memory D1/KV, local migrations/seed and native rate limits. Stop other services on 5173/8787/8788 first; existing backends are never reused. Only synthetic mail is captured locally, every other outbound request is blocked, and no live AI key is configured. `pnpm test` runs Vitest, not Playwright. Coverage includes `coverage-summary.json` in each workspace's ignored coverage directory. Auth/mail/AI unit tests use mocks; Workers tests also exercise local D1/KV. Passing those tests does not establish live mail or AI quality; Playwright separately exercises the synthetic complete browser flow.

## Authentication and security status

M1 follows the owner's continuation request after the M0 dependency remediation. Authentication uses a configured canonical `PUBLIC_APP_ORIGIN`, atomic hash-only token consumption and revocable JWT sessions. Admin settings expose metadata only; secret replacements are encrypted by server policy. Review grades require `expectedVersion` and `idempotencyKey`; pair update and history insertion share a transactional D1 batch. Evidence and acceptance remain separate: credential verification was skipped at the owner's request, and production acceptance is not claimed.

For newly created local secrets, `.dev.vars.example` includes `PUBLIC_APP_ORIGIN=http://localhost:5173` and `ENVIRONMENT=local`. Setup preserves existing files: add these two non-secret values privately to an existing local `.dev.vars` if absent. Use the same browser hostname and port as the origin. Built assets served directly on another port require that exact local origin instead. Production requires a canonical HTTPS origin and `ENVIRONMENT=production`; HTTP cookies are permitted only for explicit loopback local development. Changing `JWT_SECRET` invalidates all existing sessions; coordinate rotation privately. Logout revokes the presented session until its expiry.

`AI_PROVIDER_ORIGINS` is optional trusted deployment configuration (comma-separated HTTPS origins; default `https://api.openai.com`). A D1 endpoint change cannot add an origin. Settings PATCH allows only `AI_KEYS` (JSON array), `AI_ENDPOINT_URL`, `AI_MODEL_NAME`, and `AI_MODEL_OPTIONS` (`max_output_tokens`, `temperature`, `top_p`). Plaintext/corrupt legacy AI_KEYS fail closed: replace through the authenticated admin API; GET never retrieves them. Historical audit values are hidden in responses but preserved at rest for a separately approved cleanup/rotation procedure.

Guest access remains available. Durable D1 limits share a daily budget across generate/quiz/TTS/STT: guest20, account100, global500; native minute limits also apply. Auth requests allow3 per normalized email/hour and200 globally/hour. Quota exhaustion returns429 with Retry-After; unavailable quota storage fails closed. Limits count requests, including cache hits, and need owner review before a release. JSON is limited to64KiB, STT audio5MiB, learning text2000characters. Provider HTTP has a15s total budget,5s per attempt, max3 explicit rejected-key attempts,256KiB response cap and no retry after ambiguous acceptance. Speech binding calls have a10s deadline with no retry; an underlying invocation may finish because the binding cannot cancel it. Existing audio-language mappings remain pending M2 quality work.

The Playwright driver now exercises actual Vue login, EN→VI generation, save with correct locale fields, review grading and history using one synthetic account. Its private loopback capture consumes a magic link once from memory; it does not log or export the token. Never use token console output or manual token SQL inserts as a login workflow. The old SQL recipe referenced nonexistent `magic_tokens.id` and did not implement hashing. Do not use real email accounts or provider credentials for this review.

## Database and release limits

Fresh migrations and a synthetic local legacy upgrade were exercised. Local main's historical migration names `0003_ai_generated_content.sql` / `0004_sm2_review.sql` differ from recovery's `0003_migrate_env_to_db.sql` / `0004_seed_app_settings.sql`. Preserve historical identities. Legacy also retains `mastered_at`, absent from fresh schema. Migration 0009 deletes four old settings keys. Additive migrations0013–0015 add review version/replay metadata, session revocations and expiring quotas without changing historical files. Unknown remote history requires private inventory, backup, and a matching rehearsal before any approved upgrade.

Deployment workflow is manual-only and its deploy job is disabled. It depends on reusable quality CI; enabling deployment requires owner review, real environment configuration, and explicit release authorization. No remote migrations, deployment, or paid AI checks were performed.
