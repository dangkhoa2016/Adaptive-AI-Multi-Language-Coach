# Adaptive AI Multi-Language Coach — M2-B1 acceptance and M2-B2 decision record (EN)

**Date:** 2026-10-30  
**Evidence:** `adaptive-coach-m2b1-offline-evidence-20261030T040632Z.zip` and the associated Codex CLI session transcript.  
**Evidence final HEAD:** `c5f61515b6ff363ef35ee5abb6474ddec5f549b1` on `recovery/adaptive-coach-production-hardening-2026-10-29`.

## Authorized scope

Following the user's instruction to carry out the recommended next steps, record **OWNER_ACCEPTED_LOCAL_ONLY** for **M2-B1 offline preparation**: 37/37 Node contract tests, 492/492 Vitest tests, 4/4 Playwright tests, provenance and package integrity as evidenced. This is a conversation-derived decision record, **not a digital signature** or production certification. Do not redo accepted code.

**M2-B2 EVALUATION DESIGN: AUTHORIZED_OFFLINE_ONLY.** Documentation, schema design, offline validation and explicitly synthetic in-memory test records are allowed. Real model calls, paid inference, live TTS/STT, email, push/merge/deploy, remote D1 writes/reads, public dataset publication, and invented human scores are **not authorized**.

## Twelve scenario recommendations, not scenario-specific approval

| Candidate lane              | IDs                                    | Recommended treatment                                                          | Per-scenario owner approval |
| --------------------------- | -------------------------------------- | ------------------------------------------------------------------------------ | --------------------------- |
| **MAIN_EXACT**              | GEN-04, GEN-06, GEN-07, GEN-09, GEN-11 | Proposed primary pilot, only after explicit approval                           | PENDING                     |
| **EXPLORATORY_APPROXIMATE** | GEN-01, GEN-02, GEN-05, GEN-08         | Separate broad-topic exploration, never mark original focus as satisfied       | PENDING                     |
| **BLOCKED_ORIGINAL_INTENT** | GEN-03, GEN-10, GEN-12                 | Exclude from original-intent benchmark; redesign taxonomy/objective separately | PENDING                     |

Every mode choice remains a proposal, including `mix`, GEN-05's `phrase`, and GEN-07's `word`. All `owner_mode_approval` fields stay `PENDING`.

The five exact-topic requests, if run **once each** and fully delivered, request **46 pairs**: 16 EN→VI and 30 VI→EN. This is a planned upper bound, not observed output or an independent sample count. GEN-09's fallback is a provenance/delivery check, not model semantic quality. GEN-11 repeated/cache responses cannot be counted as independent inference.

## Outstanding owner decisions

1. Explicit per-scenario mapping and mode approval, especially for approximate intents and blocked GEN-03/10/12.
2. The 0–4 rubric, critical-error definition, two **real independent** reviewers per lexical case, a third adjudicator, and secure review collection. Do not fabricate any of the 64 pending slots.
3. Dataset rights, privacy, license and publication scope for all 32 **draft** references; no GOLD_APPROVED claim.
4. Specific provider/model/revision, isolated environment, USD hard spending cap, maximum request count, emergency disable mechanism and data policy. All are currently `PENDING`/`null`.
5. Sampling/stratification and uncertainty reporting; the proposed 95% and zero-critical thresholds are discussion points, not approved gates.
6. Separate authorization for speech/audio/recordings and consent.

Open state stays explicit: 0/64 human reviews, 0/12 scenario executions, zero real model samples, semantic/IPA quality `NOT_EVALUATED`, speech `NOT_RUN`, M1 O-03–O-08 still open, production `NOT_AUTHORIZED`. The existing uncapped pre-route persistence of model pairs remains separate scoped technical debt, not an implicit code change in this design phase.

## Phase transition control

`DESIGN_PASS` means only offline documentation and validation are complete. **Any inference** requires a new, explicit authorization identifying model/revision, environment, USD budget, request count, instrumentation, evidence destination and stop conditions. Design approval is not permission to infer.
