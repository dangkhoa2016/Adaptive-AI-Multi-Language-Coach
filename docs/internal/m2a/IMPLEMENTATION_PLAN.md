# M2-A offline foundation implementation plan

Goal: execute the owner-supplied 2026-10-30 kickoff instruction on the specified recovery baseline, with local deterministic evidence only.
Spec: `/workspaces/adaptive-coach-m2-kickoff-20261030/02_CODEX_M2_OFFLINE_IMPLEMENTATION_INSTRUCTIONS.md` and companion acceptance/protocol documents. Their explicit execution authorization is the design and scope authority; no new feature approval is inferred.
Architecture: retain existing route/service seams, add structural guards and additive count metadata, fail closed for unavailable quiz options, preserve Unicode transcript distinctions. Do not call live services or change dependencies/configuration. Work in place on the explicitly required recovery branch (the kickoff overrides generic worktree/feature branch preferences).

## Constraints and review focus

- Keep M0/M1 security, quota, migration, cache isolation and deployment restrictions.
- Preserve draft 16 ENVI/16 VIEN cases verbatim and publication-pending rights; structural validation is not human review.
- Check decomposed/case duplicate input without stripping tones, including one-to-many translations.
- Check short and excessive AI/cache/fallback counts, old/new frontend response compatibility.
- Check quiz inadequate pool and canonical answer leakage; no language identification claim.
- Check VI tone distinctions and distinct non-Latin strings in transcript similarity.
- Retain all failed runs, exact commit state, all final gates after commit and package integrity.

## Tasks (execute inline with TDD)

1. [x] Read kickoff, master handoff and closure; verify exact clean baseline; inventory source hashes/contracts/consumer mapping before edits.
2. [x] Import seed resources; run validator/selftest and pending annotation report; log attribution and enum mapping, block unresolved scenario modes.
3. [x] Write `backend/test/services/m2-offline.test.ts`, `backend/test/routes/m2-offline.test.ts` and frontend API migration tests. Capture red for whitespace/placeholders, duplicates, count metadata/capping, quiz options and Unicode. Existing correct locale/cache/fallback behavior should remain green.
4. [x] Fix only verified defects in schemas, generate/fallback boundary, quiz service/route and STT normalization. Keep exactly four quiz choices; 422 if insufficient. Preserve generate 200 shape with additive metadata. Update two contradictory legacy expectations (placeholder padding, accent removal) explicitly. Run focused green and impacted regression.
5. [x] Document eight-locale capability matrix, count policy, draft provenance, contract matrix, pending review and M2-B owner decisions. Review changes and commit locally using Conventional Commits.
6. [ ] Run frozen offline install, typecheck, lint, format, unit/coverage, build, E2E, local fresh/legacy D1, native synthetic provider and audit on final committed HEAD. Preserve failures and limits; no blanket semantic PASS.
7. [ ] Export private evidence with command ledger, complete sanitized patch, source hashes, failed/successful logs, negative secret scan, summary/status, SHA256 manifest and ZIP member verification.

No push/merge/deploy. New API metadata and deliberate 422 availability behavior are covered by frontend migration tests. TTS mapping defect and missing speaking reference remain visible for separately scoped work; no provider quality claims.

Final gates and packaging run after the implementation commit; their authoritative completion ledger is in the private evidence package, not a post-test source edit.
