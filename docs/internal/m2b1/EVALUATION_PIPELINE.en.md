# Offline evaluation pipeline proposal

Status: PROPOSED; owner mapping, rubric, reviewer eligibility and sampling approval PENDING. No inference executor exists in this package. The only automated lane is structural contract validation. Existing topic generation remains unchanged; request `source`/`target` are locale codes while pair `source`/`target` are text. A lexical case is not a per-word request to `/api/generate`.

## Reference curation lane

Keep the 32 authored lexical cases immutable and DRAFT_UNREVIEWED. The 64 pending rows assign slots A and B to each case, not real reviewers. After approval, two distinct eligible human reviewers independently assess semantic accuracy, context alignment, naturalness and reference suitability (0–4), with critical/direction flags and written reasons. Stable pseudonymous reviewer IDs and UTC completion timestamps are required; do not put names/emails in evidence. B must not see A before submitting. The current preparation validator accepts only blank pending rows; a future completed-review workflow needs its own validated contract and approval.

A case is fully reviewed only with both distinct eligible reviewers. Disagreement per dimension means unequal scores among the fully reviewed cases; report numerator and that complete-pair denominator. Also report incomplete cases separately. Critical/direction flag conflict or absolute score difference ≥2 requires third-person adjudication, retaining both original ratings, adjudicator ID/time, reasons and resolution. Do not average away disagreements. At zero completed pairs, disagreement and semantic rates are null/NOT_EVALUATED. Independent reviews, consensus and adjudicated cases must be separate counts. No IPA is present in the lexical draft; do not invent IPA or an IPA rating.

## Future model-output sampling lane (M2-B2 NOT_AUTHORIZED)

The proposed 12 requests need owner approval of every mapping/mode and a separate inference/budget/environment decision. Exact topic matches do not imply semantically appropriate output. Approximate mappings can lose transport/family/business specificity. Establish a sampling plan stratified by direction, level and topic, including repeated-run policy and uncertainty, before collecting any output. Do not align random topic outputs to lexical references without an approved context-matching method.

For each approved attempt, preserve an attempt record even on 503, timeout or partial response. Use the following capture design; the null capture template is not a model sample:

| Field                                           | Source / contract                                                                                                                  |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| scenario_id, attempt_id                         | Approved scenario and unique attempt ID, including failures                                                                        |
| sample_id, generated_pair_index                 | Stable unique pair sample ID and zero-based index; null on failed/no-pair attempts                                                 |
| source_locale, target_locale, uiLocale          | Request codes, distinct from pair text; UI remains en in this proposal                                                             |
| request, requestCount                           | Exact approved request object and request.count                                                                                    |
| requestedCount, returnedCount                   | Raw route metadata; verify requestedCount=requestCount and returnedCount=pairs.length; missing metadata is recorded, never guessed |
| HTTP_status, error_code                         | Retain 503/unavailable and all other errors in attempt denominator                                                                 |
| cacheHit, isFallback, partial                   | Raw response provenance flags; null on responses without them; fallback is not AI quality evidence                                 |
| model_revision, model_identity_status           | Exact revision if provider exposes it, otherwise UNKNOWN; never invent a revision from a mutable model name                        |
| prompt_hash, model_config_hash, application_SHA | SHA256 of exact prompt/public configuration and source commit; no secrets in captured settings                                     |
| captured_at_utc                                 | Actual capture time, not a synthetic historical timestamp                                                                          |
| pair.source, pair.target, examples, ipa         | Raw returned text; preserve Unicode/tone marks and language direction                                                              |
| reviewer slots A/B                              | Two independent reviewers per collected pair; sample review template retains null identity/scores until actual review              |

Report attempt counts by full success, partial, unavailable 503, other error, cache/fallback and direction/topic/level. Denominator for delivery/availability is **all authorized attempts**, including 503/timeouts/partial, never just successful responses. Item coverage uses total requested items across all attempts versus returned items; separately report valid distinct returned items and missing/rejected items without erasing raw returns. Semantic ratings use fully reviewed eligible samples only and must always show coverage against all captured samples and original attempts. Stratify fallback/cache/AI output rather than counting fallback as model inference quality. No denominator, rate or accuracy exists yet because there are zero attempts/samples/reviews.

Use model rubric dimensions semantic_accuracy, context_alignment, naturalness, example_fidelity, ipa_quality with independently decided IPA applicability and recorded accent/dialect. CEFR needs a separate calibrated rubric; it cannot be inferred from length. Null IPA applicability/score is not automatically wrong. Human assessments and adjudication, not equality against draft strings, establish meaning/context judgments.

## Reporting and boundaries

`node eval/m2b1/tools/report_pending.mjs` emits the executable empty report skeleton: 0/64 completed reviews, 0/12 scenario attempts, 0 model samples; accuracy and IPA quality null. Thresholds of 95% and zero critical errors remain discussion candidates, not adopted gates. Owner must approve sample size/uncertainty, thresholds, rights/license, reviewers and protocol before semantic acceptance. No GOLD_APPROVED or M2 QUALITY PASS label.

TTS vi/fr/th/de → en is incorrect for those language-support claims. STT text similarity measures transcript distance, never pronunciation/accent. No TTS/STT/provider/audio/paid call is authorized. Keep uncapped AI persistence before route capping as a scoped open finding, without runtime changes here.
