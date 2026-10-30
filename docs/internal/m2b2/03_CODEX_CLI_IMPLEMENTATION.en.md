# Codex CLI — Integrate M2-B2 Evaluation Design (OFFLINE ONLY)

**Task:** Read `README.md`, `docs/01_OWNER_DECISION_AND_ACCEPTANCE.en.md`, `docs/02_EVALUATION_DESIGN.en.md` and `data/planning`. Integrate only offline design and pure validation tools into the recovery branch; export evidence for ChatGPT review. **Never call a model.**

## 0. Preconditions and stop rules

- Expected branch: `recovery/adaptive-coach-production-hardening-2026-10-29`; baseline HEAD: `c5f61515b6ff363ef35ee5abb6474ddec5f549b1`; clean working tree. Check branch/HEAD/status **before editing**. If there is any mismatch, **stop**, report; never reset/stash/rebase/force checkout.
- Do not redo accepted M0/M1/M2-A/M2-B1 work. Do not modify application runtime, dependencies, quotas, database migrations, CI, provider config or E2E fixtures to force PASS.
- Disallowed: paid/free inference, TTS/STT, email, fabricated review labels, public dataset publication, Git push/merge/deployment, remote D1 and access/logging of secrets. Use Node built-ins; no package installation unless genuinely required and separately scoped.
- Keep every `owner_*` approval PENDING and semantic scores NOT_EVALUATED. Structural compatibility is not semantic evaluation.

## 1. Baseline inventory and provenance

Capture UTC, OS, Node/pnpm, branch/HEAD/clean state. Verify `SHA256SUMS.txt`, then from the **extracted package root**:

```bash
node tools/validate_design.mjs
node --test tools/selftest.mjs
node tools/report_readiness.mjs
```

Compare all seven immutable files with the B1 ZIP and `data/planning/source_anchors.json`. Inspect actual schemas, generate routes/services, frontend API and `eval/m2b1/` for drift, rather than relying on documentation alone. If the expected SHA or real schema differs, stop and report.

## 2. Isolated integration

- Integrate new materials under `eval/m2b2/` and separately maintained EN/VI internal documents under `docs/internal/m2b2/`, or explain another internal-only path. Never overwrite `eval/m2a`, `eval/m2b1` or historic data; do not add owner-private materials to public READMEs.
- Preserve the seven `data/source/` inputs byte-for-byte. Retain all 12 decisions, 5/4/3 mapping and a five-request, 46-pair **requested** main-pilot plan (16 EN→VI / 30 VI→EN). These are proposed ceilings, not actual results.
- Keep all owner mapping/mode approvals PENDING; all inference NOT_AUTHORIZED; zero attempts/reviews/model outputs; semantic quality NOT_EVALUATED.
- `tools/attempt_contract.mjs` is a pure future-capture record contract; validate **synthetic in-memory test cases only**. Never call any API or turn synthetic fixtures into purported model samples. Cross-check proposed request enums against real backend schema through pure locally bundled schema tests if needed.

## 3. Contract tests and integrity

Test original intent/hashes, blocked/exploratory topic classification, locale vs pair-text distinction, pending approvals, partial/error denominators (including 429/503 and network timeouts), cache/fallback separation, and no fabricated identity/price/prompt/rating data. Preserve red/green logs if any tool logic changes. Fail closed on unexpected source or status. Inspect source for network, inference, secret access or hidden enablement flags.

## 4. Verification and commits

Run focused Node tools and any applicable scoped formatter/linter checks for newly added files. Record what was actually run; don't claim historic suites were re-executed. If runtime/CI/dependency modifications turn out necessary, **stop for scope approval**. If integrated, create one or two meaningful local conventional commits only, preserve a clean final tree, and never push/merge/rewrite Git history. Export full sanitized patch, hashes and per-command UTC/exit/SHA ledger; retain failed attempts.

## 5. Evidence return package

Create `adaptive-coach-m2b2-design-evidence-<UTC>.zip` containing `00_environment/` run ledger and toolchain; `01_git/` parent/head/change list and redacted patch; `02_source/` seven original hashes and B1 comparison; `03_plan/` decisions, sampling counts and pending gates; `04_tests/` targeted logs and negative tests; `05_safety/` bounded secret scan, network/inference-not-run statement; `06_summary/` execution summary, machine-readable status, open findings and next actions; root `SHA256SUMS.txt` and a SHA256 of the final ZIP. Never package `.git`, `.env`, credentials, live databases, private user data or audio.

**Done condition:** `M2_B2_DESIGN_TECHNICAL_PASS` only if source integrity, 15+ offline selftests, safe 5/4/3 grouping, full pending-owner statuses, zero real samples, unchanged runtime, clean local Git and verifiable evidence. **Not** `M2_QUALITY_PASS`, live inference authorization or production readiness. Stop and send the ZIP for review.
