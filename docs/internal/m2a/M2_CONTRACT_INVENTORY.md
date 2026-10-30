# M2 contract inventory — baseline 7bd824eb47656fb59c8974ba44dad1b82051c2c5

Internal planning evidence; no release or language quality claim. Source hashes below were captured before source mutation.

| State        | Contract and source citation (baseline line numbers)                                                                                                                                                                                                                                                 |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| IMPLEMENTED  | `backend/src/services/schemas.ts:5`: request source/target are locale enums, pair source/target are text at line 15; count integer 1–50 default 10; level A1/A2/B1/B2; mode word/phrase/mix default mix; uiLocale optional default en.                                                               |
| IMPLEMENTED  | `backend/src/i18n/topics.ts:1`: travel, food, work, education, health, technology, shopping, entertainment, daily_life, nature. Locale enum en/vi/ja/ko/th/zh/fr/de at `packages/shared/src/locales.ts:1`.                                                                                           |
| IMPLEMENTED  | Pair required source/target text ≤2000 characters; optional examples/IPA/POS default empty; numeric isPhrase coerced to boolean. `schemas.ts:15`; response pairs 1–50 at line 32.                                                                                                                    |
| KNOWN_DEFECT | Whitespace-only and `(unknown)` texts accepted; no canonical duplicate guard. `schemas.ts:15`, `ai.ts:151` parser validates shape only.                                                                                                                                                              |
| IMPLEMENTED  | `prompts.ts:32` requests exactly count, source/target/example directions, source-en IPA. Prompt instructions are no semantic verification.                                                                                                                                                           |
| IMPLEMENTED  | `ai.ts:63`: settings endpoint/model validation, trust boundary, encrypted key lookup, bounded attempts/deadlines; parse success persists generated pairs. No live call executed by this audit.                                                                                                       |
| KNOWN_DEFECT | `routes/generate.ts:64`: cache returns cached content/provenance, AI success not bounded to count; fallback sliced; 200 `{pairs,isFallback,cacheHit}` even short, no count metadata.                                                                                                                 |
| IMPLEMENTED  | Generate invalid JSON/schema 400; limiter or cost quota 429 (quota unavailable may 503); settings unavailable 503; empty fallback 503 fallback_unavailable. `routes/generate.ts:15`, `middleware/costQuota.ts`. Unexpected DB exceptions may use global 500 handler; not all exceptions caught here. |
| IMPLEMENTED  | `cache.ts:6`: actual prefix cache:v3 (protocol archive mentions v2, superseded); key includes source,target,topic,level,count,mode,UTC day, settings hash; TTL 86400s; validated shape/provenance; cache failure nonblocking. uiLocale excluded by design.                                           |
| IMPLEMENTED  | `fallback.ts:30`: only exact labelled language pair/topic/level. Wildcards never prove requested language. Labelled content is not independently language-identified.                                                                                                                                |
| KNOWN_DEFECT | Fallback database rows bypass pair schema; current DB contents assumed valid (`fallback.ts:6`). Cache validates schema, not semantics.                                                                                                                                                               |
| KNOWN_DEFECT | `quiz.ts:23`: raw pool excludes exact target only; duplicates/blank/canonical answer variants allowed; `(unknown)` padding creates invalid distractors. Quiz route has no locale metadata, so same-language or semantic uniqueness cannot be proven.                                                 |
| IMPLEMENTED  | `routes/quiz.ts:12`: 1–50 valid pairs, invalid payload 400, cost/rate 429, 200 `{questions:[{pair,options,correctIndex}]}`.                                                                                                                                                                          |
| IMPLEMENTED  | `routes/tts.ts:13`: text 1–2000 trimmed, locale from body or UI locale, invalid 400; binding/provider unavailable 503; missing audio stream 500; audio/mpeg private no-store. `tts.ts:3` bounds size and timeout.                                                                                    |
| KNOWN_DEFECT | `tts.ts:49`: vi/fr/th/de map to en. Incorrect for a corresponding language claim. en/ja/ko/zh mapping present but real audio quality UNKNOWN/NOT_RUN.                                                                                                                                                |
| IMPLEMENTED  | `routes/stt.ts:12`: audio/octet-stream, nonempty bytes, reference max 2000; 400 invalid, 503 unavailable; `{transcript,similarity}` with null similarity if no reference. `stt.ts:3` limits response/time.                                                                                           |
| KNOWN_DEFECT | `stt.ts:55`: NFD + combining-mark removal + ASCII word filter erases tones/non-Latin letters; equal empty normalized strings score 1. Similarity is transcript text distance, never pronunciation assessment.                                                                                        |
| KNOWN_DEFECT | `frontend/src/composables/useSpeakingDrill.ts:31`: recording path does not supply reference to sendToStt; similarity normally null. No personal microphone recording performed.                                                                                                                      |
| UNKNOWN      | Semantic translation/context/naturalness/CEFR/example/IPA accuracy, accents, human review, live provider language coverage, cost/latency. All NOT_EVALUATED or NOT_RUN.                                                                                                                              |

## Consumer mapping and implementation decisions (before API edits)

Generate `frontend/src/api/client.ts:23,97` → `views/HomeView.vue:104` → `stores/session.ts`. Existing fields retained; add requestedCount, returnedCount and partial on all 200 responses, recompute on cache hits, cap excess output, validate fallback at boundary. Empty/invalid sets remain 503. Partial results explicitly remain 200; frontend still consumes existing pairs, no claim of complete count. Optional TypeScript fields preserve older mocked/server payloads; migration tests cover both. User-facing shortfall notice is deferred to M3.

Quiz `api/client.ts:105` → `views/QuizView.vue:25` → `components/QuizQuestion.vue` and session answers. Keep 4 choices and original success shape; use valid unique pool including other pairs. With <4 distinct target strings, fail closed with 422 quiz_unavailable instead of fabricated options. Existing API error handler already propagates failures. Add frontend migration tests for success and 422. No locale guessing added; incoming pool language and semantic alternatives remain human-review limitations.

STT normalize to NFC, retain Unicode letters/marks/numbers, ignore punctuation/spacing/case; do not strip tones. This changes textual similarity intentionally, with counterexamples and revised legacy diacritic test. Keep response shape and no speech enablement.

## Source SHA256 inventory

- `backend/src/services/schemas.ts`: `cf3d275fc92a6e73bae79983b2eabcdfe840d13fa569181e8813ce17843d346a` (34 lines)
- `backend/src/services/ai.ts`: `7ee495ef3e6813d9fe970723de2538e9b304141ca21b9adc96bcc2ba1b177216` (149 lines)
- `backend/src/services/prompts.ts`: `386c26cd65c9495d390a0217073d5f0bd0954f3756bd8051938d1f0473d4e9aa` (49 lines)
- `backend/src/services/quiz.ts`: `3bd9af6b9f00b68db35f7a6c2ec6814b146206a544f635fede50ddf056fbde22` (44 lines)
- `backend/src/services/tts.ts`: `fe1a7a7e5a40349dfd8eb8a5ac02abfdd027893145b0ffb2c2095e69e7c90e82` (53 lines)
- `backend/src/services/stt.ts`: `491a5bd78c841dbf39ac75f2bd42586337154cc8bace7e3999523dcded2650b5` (72 lines)
- `backend/src/services/cache.ts`: `ca49a646ca0b3d177906ec79a88574ec98cc77a44f4cb5939839125da635a25f` (77 lines)
- `backend/src/services/fallback.ts`: `bb8b75d83c93d33a5d65637d0a6d611495e945504b5c1a10f61a5bfe53d22733` (39 lines)
- `backend/src/routes/generate.ts`: `4790590e429706f590084878cf4560efb60a34d35736d205155da9784ff9ebb5` (85 lines)
- `backend/src/routes/quiz.ts`: `067d4b83b49e90bbded3e0a9aa3328d909630a30aa24c423ade48c138b8724cf` (39 lines)
- `backend/src/routes/tts.ts`: `165e80fe16bac98ab8762012088b229765b096af7d180f4a64d2d070f3713046` (53 lines)
- `backend/src/routes/stt.ts`: `642106fd0b3e0df1f932a0cff0cf618154b357faf1f1cf140f90d566729e953a` (38 lines)
- `frontend/src/composables/useSpeakingDrill.ts`: `4339e4b2c6c821123161c31c603ec4c8b887b125e1e22266a9b934129f3618ed` (80 lines)
- `frontend/src/api/client.ts`: `28c3da4670ac00ff236f8ccc97e2068b76b8f5a82f16efe9e924c6b4c71bbcfd` (326 lines)
- `frontend/src/views/HomeView.vue`: `da18f31a1781e2710f5ac3e2583ba2f0f9941c7f1850c6d69cf73e23cbf6d705` (282 lines)
- `frontend/src/views/QuizView.vue`: `3b974d8b2c022166c260d5896210b29aa253ef6133c4de78b7c5ceaa4e5d6836` (137 lines)
- `frontend/src/components/QuizQuestion.vue`: `1d441f2c4df880f08ad11f4f44bff90b0628998a3ddaeccb4231c1d6ce559f69` (76 lines)
- `frontend/src/stores/session.ts`: `094521f0b65588c2bef6ece19f37bb522bad45fae22bf672dd60b0d421c3878d` (97 lines)
- `packages/shared/src/locales.ts`: `be62188214b1157d3aa1dd3e11b35da601929915ee6b29e8fa478be03877642b` (26 lines)
- `backend/src/i18n/topics.ts`: `bc574a1fe63cda0d9871182ecb1b2360c8569ee94cec9beb676b26954c7ebf5a` (31 lines)
