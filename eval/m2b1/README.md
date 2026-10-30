# Internal M2-B1 offline resources

DRAFT_UNREVIEWED; publication/license owner decision pending. Immutable source inputs are copied separately from M2-A; proposals never replace original intents. No model calls, ratings, audio, provider tests or human quality results are represented by these drafts.

From repository root, with the existing Node 22.22.3/pnpm 11.1.3 toolchain installed:

```sh
node eval/m2b1/tools/validate_plan.mjs
node eval/m2b1/tools/selftest.mjs
node eval/m2b1/tools/report_pending.mjs
node --experimental-test-coverage '--test-coverage-include=eval/m2b1/tools/*.mjs' --test eval/m2b1/test/plan.test.mjs
```

No new dependencies. The Node tests bundle the actual pure backend request schema using already-installed esbuild to check 12 proposed requests locally; they never invoke a route/service or execute a proposal. Their coverage applies to offline tooling only. Root `pnpm test` remains the existing application regression suite; run the explicit command above for this separate harness.

The preparation validator requires all 64 A/B reviewer slots and model-review template to stay blank/PENDING. COMPLETE is rejected even with filled fields because this is not an ingestion workflow for real completed reviews. Source hashes are pinned independently of the editable provenance manifest. Original JSONL and metadata bytes remain unchanged. The narrow Prettier exclusion for original metadata preserves its pinned checksum; tools/test sources are formatted normally.

See separate EN/VI protocol, mapping, evaluation-pipeline and decision documents under `docs/internal/m2b1/`. Five mappings are exact, seven approximate; all mappings/modes pending. No semantic accuracy metric is computed. `templates/model_capture.empty.json` is an empty design template, not a model sample.
