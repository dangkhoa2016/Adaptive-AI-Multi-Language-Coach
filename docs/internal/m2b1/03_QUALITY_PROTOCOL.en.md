# M2-B1 — EN↔VI Human Quality Review Protocol (PROPOSED)

## Evidence lanes

**A — Offline contract:** validate the 32 original draft lexical cases, 12 proposal objects shaped like the API schema and 64 pending reviewer slots. Contract PASS does not prove translation accuracy. Only this lane may execute automatically now.

**B1 — Reference curation:** two independent human reviewers evaluate each of the 32 authored context-specific lexical cases for semantic accuracy, contextual fit, naturalness and suitability of the suggested translation references. That is 64 independent reviews plus third-party adjudication of material disagreements. Current count: zero completed. The draft has no validated IPA; do not invent transcriptions.

**B2 — Model output evaluation:** requires separately authorized inference and captured topic-generation samples. Each generated pair gets a stable sample ID and is linked to scenario, pair index, model revision, prompt hash, language codes, config, cache/fallback/partial flags and captured time. Two independent human reviews then score translation accuracy, context, naturalness, example fidelity and IPA applicability/quality. No output sample exists now. The topic-generation route cannot accept a single lexical item as an independent instruction.

**C — Speech:** actual audio/provider and pronunciation evaluation are not authorized. STT transcript similarity is not pronunciation scoring. Four TTS language mappings to English remain unvalidated/incorrect for a supported-language claim.

## Scoring scale

| Score | Meaning                                                                |
| ----- | ---------------------------------------------------------------------- |
| 0     | Critical wrong meaning, wrong language direction or harmful distortion |
| 1     | Material defect; unfit for learning                                    |
| 2     | Partly correct but substantial correction needed                       |
| 3     | Acceptable with minor shortcomings                                     |
| 4     | Accurate, natural and pedagogically strong for the context             |

Annotate dimensions separately. In B1, use `semantic_accuracy`, `context_alignment`, `naturalness`, `reference_suitability`, plus critical/language direction flags. In B2, use `semantic_accuracy`, `context_alignment`, `naturalness`, `example_fidelity`, `ipa_quality` only when applicable, plus documented accent/dialect. Do not use strict string equality to label a context-specific translation correct. Reference variants are illustrative, not exhaustive. Review examples and negation, register and CEFR separately. A missing IPA is not automatically wrong unless the source language and assessment rules warrant it.

## Independent review and adjudication

Two distinct, real reviewer IDs per case, blind first-pass review, UTC timestamp, and documented disagreements. A third reviewer adjudicates critical flags, language-direction conflicts, and disagreements of at least two points. Do not average away substantive disagreements. Record reasons and retain low-scoring samples. Publish only after owner reviews dataset rights/license and approves the final gold-set status.

## Reporting and thresholds

Report attempted cases, completed reviews, independent coverage, disagreements, adjudications, critical errors and non-evaluated dimensions. Zero human reviews means `NOT_EVALUATED`, **never zero accuracy or perfect accuracy**. A discussion-only candidate gate for later pilot: no critical language-direction errors and ≥95% of evaluated samples with semantic and context scores ≥3 on an appropriately sampled, human-reviewed collection. **This is not an adopted threshold**; 32 draft references are not representative production evidence. Fix sample design and uncertainty reporting before treating any percentage as a launch gate.
