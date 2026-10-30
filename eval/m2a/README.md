# Internal M2-A draft resources

DRAFT_UNREVIEWED. These are original planning examples, not production vocabulary or a validated gold dataset. Publication rights are pending owner decision. Lexical cases, annotation template, metadata, schema and tools imported from the 2026-10-30 kickoff; no lexical text changes, 16 ENVI and 16 VIEN. Formatting-only changes to JSON/MJS are attributable to this implementation; JSONL content is preserved byte for byte. No generated model outputs are included.

Run from repository root:

```sh
node eval/m2a/tools/validate_seed.mjs
node eval/m2a/tools/selftest.mjs
node eval/m2a/tools/report_annotations.mjs
```

These commands establish data contracts only. Thirty-two pending rows are zero completed human reviews; two reviewers plus adjudication are still required. Semantic quality is NOT_EVALUATED. Scenario modes remain unresolved and blocked; see `docs/internal/m2a/SCENARIO_MAPPING.md`. Do not feed lexical prompts to the topic generation API or use reference equality as translation accuracy.
