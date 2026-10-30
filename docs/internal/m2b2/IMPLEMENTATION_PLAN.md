# M2-B2 offline evaluation design implementation plan

Goal: implement the supplied offline-only design at clean recovery baseline `c5f61515b6ff363ef35ee5abb6474ddec5f549b1`, then export reviewable evidence and stop before live pilot.
Spec/design authority: user request plus `03_CODEX_CLI_IMPLEMENTATION.vi.md` and supplied owner/design/capture documents. Work in place on the named recovery branch. Do not rewrite history or change application schemas/runtime, CI, quotas, dependencies, migrations, E2E fixtures or prior eval resources.

Architecture: import immutable seven-source snapshot and separate 12 decisions, proposed plan and empty capture into `eval/m2b2`; independent EN/VI docs under `docs/internal/m2b2`. Node-native validation and in-memory synthetic tests only. Use existing backend esbuild in a separate test to bundle the actual pure request schema, never services/routes/providers.

## Tasks and review focus

1. [x] Check exact baseline/clean branch and kickoff manifest; run original package CLI/selftests from package root. Independently compare seven source byte hashes against B1 ZIP and current B1 Git resources. Capture schema/tool source hashes and read current contracts; stop on drift.
2. [x] Import sources/planning/tools separately, retaining 5/4/3 grouping, 46 proposed requested pairs (16/30), zero actual attempts/reviews/samples and all pending approval gates. Preserve seven source bytes; narrow immutable metadata formatting exception follows existing B1 convention, without excluding tooling/tests.
3. [x] Add tests before changing tooling. Pin original source and intent; reject fake results/approvals anywhere in plan or template, malformed scenario/status/timing/provenance captures, and ensure synthetic summaries remain labelled. Keep all original 16 selftests. Add real pure-schema checks and observe RED before minimum tooling fixes.
4. [ ] Review and commit 1–2 meaningful local commits. Run targeted Node tests/coverage, all CLI tools and applicable lint/format on final clean HEAD. Full application install/typecheck/Vitest/build/E2E/D1/provider/audit gates are NOT_RUN for this task: runtime/dependencies/CI unchanged and kickoff expressly requests scoped checks.
5. [ ] Export complete sanitized patch, command UTC/exit/SHA ledger, source comparisons, plans, reports, original failed runs, secret/capability scan, SHA256 manifest and ZIP readback verification. Keep semantic quality NOT_EVALUATED and live authorization NOT_AUTHORIZED; stop for ChatGPT review.

Synthetic fixtures exist only in test code or disposable test copies. They are not added to evaluation source/planning data and never become actual output samples. Capture validation classifies supplied records; it does not execute inference, verify a human authorization, attest provider cost/revision or prove translation quality. No env-flag executor or network implementation will be added.

Final gate/packaging completion is recorded outside the source tree so the commit remains the exact tested tree. Existing TTS wrong-language mappings, transcript-only similarity, missing speaking reference and AI persistence-before-capping finding remain unchanged and open.

Independent implementation review completed without blocking findings. Final commit/gates/package results are recorded in the private external evidence ledger; no source change is required after verification.
