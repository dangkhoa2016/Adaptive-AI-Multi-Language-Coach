# Private M2-B2 evaluation design

Offline design only; no provider, inference, app API, speech, mail or human assessment is executed. Sources under `data/source` are the seven byte-identical B1 inputs. Planning remains proposed: 5 MAIN_EXACT, 4 EXPLORATORY_APPROXIMATE, 3 BLOCKED_ORIGINAL_INTENT. A single future main pass requests at most 46 pairs (16 EN→VI, 30 VI→EN), not 46 observed outputs. All topic/mode approvals remain PENDING, inference NOT_AUTHORIZED, actual reviews/attempts/model samples zero and semantic quality NOT_EVALUATED.

From repository root with the existing Node22.22.3/pnpm11.1.3 installation:

```sh
node eval/m2b2/tools/validate_design.mjs
node --test eval/m2b2/tools/selftest.mjs eval/m2b2/test/design.test.mjs
node --experimental-test-coverage '--test-coverage-include=eval/m2b2/tools/*.mjs' --test eval/m2b2/tools/selftest.mjs eval/m2b2/test/design.test.mjs
node eval/m2b2/tools/report_readiness.mjs
```

The 16 supplied tests remain; 33 additional tests exercise actual pure backend request schema, immutable provenance, pending-state guards and in-memory synthetic capture validation. Existing local esbuild is used only to bundle the pure schema in a test. No dependency installation or service import is needed. Synthetic fixtures live in test code/disposable copies, never source/planning datasets. They are not model results or benchmarks.

`validateCapturedAttempt` validates supplied structure; it does not perform capture, authorize inference, verify a user's approval or attest provider measurements. AUTHORIZED_CAPTURE is a caller-supplied classification, never permission; summaries explicitly say CLASSIFIED_ONLY. Synthetic-only summaries are labelled SYNTHETIC_ONLY and mixed-origin summaries are rejected. Unknown cost/revision/prompt hashes remain null; no field is estimated/defaulted. Delivery counts cannot establish independent model samples or semantic quality. UTC timestamps accept calendar-valid Z timestamps with no fractional seconds or exactly three fractional digits; monotonic elapsed time is not inferred from wall-clock differences.

The pending-design validator requires exact blank capture/metric/lane/prerequisite state. It is not a future completed-review intake or live executor. Source pins are change-control checks, not protection against editing checker and pins together; independent ZIP comparison is exported in evidence. Source metadata has one narrow existing-convention Prettier exemption to retain pinned bytes; no tooling/test source is excluded. EN/VI design documents are separate under `docs/internal/m2b2` and must stay private. Stop after evidence review; no M2_QUALITY_PASS or release claim.
