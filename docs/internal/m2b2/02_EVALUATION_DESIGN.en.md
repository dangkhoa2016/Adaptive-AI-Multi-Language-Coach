# M2-B2 — English ↔ Vietnamese quality evaluation design (EN)

**Status:** `PROPOSED_OWNER_REVIEW_PENDING`. This design phase must not run a model. Current inputs: 32 draft lexical cases, 12 generation proposals, 64 empty reviewer slots, zero real model outputs. API contract from M2-B1: `POST /api/generate` produces a topic-based set; request `source`/`target` are locale codes while pair `source`/`target` are text. There is no targeted per-word, per-context generation API.

## A. Distinct claims

Keep four evidence classes separate: **(1) structurally valid API payload**, **(2) delivery/count/origin reliability**, **(3) human-reviewed semantic/context/naturalness/IPA quality**, and **(4) real speech performance**. Structural PASS cannot imply linguistic or audio quality. Never grade semantics by string equality, equate STT transcript similarity with pronunciation assessment, or advertise TTS support for `vi/fr/th/de` while those locales map to `en`.

## B. Evaluation lanes

**Reference lane R:** 32 authored draft lexical cases, split 16 EN→VI and 16 VI→EN. Two real independent blind reviewers per case, i.e., 64 reviews, score `semantic_accuracy`, `context_alignment`, `naturalness`, `reference_suitability` on 0–4, plus critical/direction flags, rationale, accent/dialect and UTC timestamp. Adjudicator handles critical/direction disagreements or score differences ≥2. Keep original scores; do not silently average material conflicts. Gold-set approval also requires owner review of rights/license. Current completion: **0/64**, quality `NOT_EVALUATED`.

**Model sampling lane M:** Requires a distinct future inference authorization. Capture `scenario_id`, `attempt_id`, exact request and request SHA256, application commit, provider/model/revision when verified, prompt/config hashes when known, UTC, monotonic elapsed time, HTTP status/errors, requested/returned counts, partial/cache/fallback flags. Link each actual returned pair as `sample_id=(attempt_id,pair_index)`; do not map arbitrary topic samples to authored lexical items. Two independent humans score each returned sample. Report by source population, including separate model-generated, fallback and cached deliveries.

**Speech lane S:** NOT_RUN; requires an independent provider/audio/consent plan and actual language support evidence.

## C. Pilot gates and sampling

**Stage 0 — owner approvals:** each mapping and mode, reviewer criteria/rubric, rights and license, sample plan, verified model revision, sandbox, hard USD cap, attempt cap, emergency kill switch. Without all approvals, **BLOCKED**; the tooling has no default budget.

**Stage 1 candidate:** exact-topic GEN-04/06/07/09/11, **one attempt each**, i.e., at most **five attempted requests and 46 requested pairs** if each is fully delivered. EN→VI accounts for 16 requested and VI→EN for 30. This is uneven by direction and not a representative production sample. Record all attempted requests, including 429, 503, network errors, timeouts, partial responses and fallback. GEN-11 repeat/cache is a cache characterization, not independent inference replication. GEN-07 count=1 is a boundary test. GEN-09 fallback checks are delivery provenance tests, never automatically model-quality samples. Do not intentionally interfere with a live provider to fabricate fallback.

**Stage 2 exploratory, subject to separate approval:** GEN-01/02/05/08, labeled broad-topic exploratory; never pool with primary-pilot quality claims. GEN-03/10/12 remain blocked for their original intent until product taxonomy or objective is explicitly redesigned.

**Subsequent expansion:** choose a stratified cohort by direction × level × topic × mode with explicit request and cost ceilings, capture uncertainty, and account for pairs clustered within attempts. Five initial scenarios do not support a production accuracy claim.

## D. Metric contracts

- `attempts_all`: all executed authorized attempts (HTTP failures, 429/503, timeout and network errors included); retries are new attempts with parent IDs.
- `full_delivery_rate = HTTP200 full-count attempts / all attempts`; `null` if denominator zero.
- `pair_yield = sum(HTTP200 returnedCount) / sum(attempt.request.count)` over **all** attempted requests, including failures; `null` if zero denominator.
- Report fallback and cache deliveries separately; neither proves independent model inference.
- Human semantic scores: `semantic_accuracy`, `context_alignment`, `naturalness`, `example_fidelity`, IPA applicability/quality where justified, critical/direction flags and supporting rationale. Before review, report `NOT_EVALUATED`, never 0% or 100% accuracy.
- Always show numerator, denominator, strata, reviewer count, disagreement and adjudication. Wilson 95% interval is an _optional candidate_ for a binary proportion after approval; clustered attempts violate naive per-pair independence assumptions.
- `>=95%` passing semantic/context rating and zero critical errors are discussion-only proposals, not adopted acceptance thresholds; approve sample size and uncertainty first.
- Elapsed time must be monotonic; timestamps are UTC provenance. If actual spend, token usage, exact model revision or prompt hash cannot be established, leave null/UNKNOWN instead of estimating as verified facts.

## E. Safety and reproducibility

Export private evidence without access tokens, cookies, magic links, personal emails, private DB rows, user text, audio or sensitive prompts. Keep app commit, source hashes, seed if randomness is used, Node/pnpm/OS, verified model identity and request instrumentation. Do not publish the draft dataset pending license review. No runtime AI/quotas/CI/D1/M2-A/M2-B1 changes in this design scope.

## F. Design acceptance criteria

All 12 decisions retain original intent and B1 request shape; recommended 5/4/3 grouping; all seven B1 source anchors match; planned main pilot five attempts, 46 requested pair slots, 16/30 by language direction; empty capture template contains only null/NOT_RUN; offline validator and negative tests PASS; no real model samples or network access. **`M2_B2_DESIGN_PASS` is neither `M2_QUALITY_PASS` nor permission to run inference.**
