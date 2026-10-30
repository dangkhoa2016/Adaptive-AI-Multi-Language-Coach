# M2-B1 offline preparation implementation plan

Goal: implement the supplied offline-only protocol at baseline `92952f9e48297ab2a6aa049cc3ee6c4cf9395570`, retaining M2-A/runtime behavior.
Spec: the 2026-10-30 M2-B1 kickoff instructions, owner decision record and EN/VI protocol/mapping. The user's explicit execution request supplies the scope/design authority. Work in place on the required recovery branch, without new branches, reset, stash, rebase, network-backed inference or secrets access.

Architecture: isolated `eval/m2b1` draft inputs and Node-native offline tools/tests. Keep `eval/m2a` immutable. Tests bundle only the actual pure request schema using the already-installed backend esbuild, with no application services/provider imports. Existing dependencies, CI, quota, migrations and runtime remain unchanged.

## Tasks

1. [x] Check clean branch/HEAD, M2-A/source hashes, original ZIP provenance and baseline contracts before changes. Original metadata differs only in M2-A formatting; preserve the original B1 bytes in the new directory.
2. [x] Import original data, proposals and empty assignments separately. Preserve original lexical/scenario/metadata bytes and pending status. Imported MJS formatting may adapt to repository style; record attribution.
3. [x] Run imported CLI smoke tools, add Node contract tests for 12 proposals against the real schema, enums, missing/duplicate IDs, tamper/rehashed provenance, NFC, JSONL corruption, A/B independence slots, fake COMPLETE/null ratings and model template. Observe failing tests before minimum offline-tool fixes.
4. [x] Add two-lane pipeline design, EN/VI rubric, proposal decision table/register and truthful report skeleton (0/64 reviews, 0/12 runs, 0 samples, null quality). No inference executor or future approval mechanism implemented.
5. [ ] Review, locally commit 1–3 meaningful commits; run focused contract coverage and regression gates on final clean HEAD. Record all failures/unrun checks. Export sanitized complete patch, logs, hashes, data, protocol and review-ready ZIP. Stop before M2-B2.

## Review focus

- A self-edited provenance manifest must not authorize changed source bytes; pin original hashes independently, with exact required keys.
- NFC validation must reject decomposed proposal/reviewer text, preserve Vietnamese tones, and never infer semantic accuracy.
- Verify actual request enum conformance and complete required fields, preserve original intents and keep uiLocale distinct from learning direction.
- Count all 64 distinct A/B slots; pending identity/time/notes/flags/ratings remain null. The preparation validator rejects COMPLETE even if fields are filled; it is not a future completed-review validator.
- Reports may expose no fabricated model samples/ratings or percentages, and must preserve partial/error attempts in future denominators.

Verification: `node --test eval/m2b1/test/*.test.mjs` and the three CLI tools; final offline coverage, frozen install, typecheck, lint, format, full existing unit suite, build, browser regressions, disposable D1, synthetic provider and audit because new offline harness source is being hardened. This is regression verification, not reimplementation or renewed milestone acceptance.

The immutable original metadata file needs a narrow Prettier exclusion to preserve its pinned bytes. ESLint Node globals will cover only new offline tools/tests; no CI or runtime setting changes. Final gate/evidence completion is stored outside the source tree to preserve the tested commit.

Implementation review completed without blocking findings. Task 5 final gates/packaging are tracked in the private evidence command ledger after commit; no post-gate source edits are needed.
