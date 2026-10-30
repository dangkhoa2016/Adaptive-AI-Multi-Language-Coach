# Attribution and contract decisions

2026-10-30: Codex imported the owner-supplied kickoff fixtures and tooling for this task. All lexical cases, generation scenarios and pending annotations remain byte-identical JSONL; metadata/schema/tooling may have repository formatting only; CLI tool paths registered with existing ESLint Node globals. No examples, reference translations, annotations, IPA or model outputs were invented or added. Dataset status DRAFT_UNREVIEWED; original planning-session provenance retained; owner publication rights and license unresolved. No human review is inferred from schema validation.

Source guard: exact clean baseline and recovery branch verified before edits. Work stays in place because the owner instruction explicitly names this branch. No reset, history rewrite, push or deploy.

Generate decision (before edits, inventory): keep 200 for partial nonempty valid results, add requestedCount/returnedCount/partial on miss and hit, cap excess. Keep old fields and frontend optional metadata. Structural rejection includes whitespace/placeholder and canonical duplicate pairs; tones retained. Error remains fallback_unavailable 503 for an invalid/unavailable fallback set. Invalid AI output falls back via the existing parser path. Cache entries are schema-checked at read; locale/settings/count isolation remains unchanged.

Quiz decision: preserve four options and correctIndex; use other pairs as default pool, normalize and deduplicate candidates and exclude canonical answer variants. If fewer than three wrong candidates, return no questions from pure helper, route 422 quiz_unavailable. Existing frontend API catch path handles 422; migration tests preserve old success shape. Pool locale correctness and synonym ambiguity remain UNKNOWN; no language ID or semantic verification claimed.

STT decision: preserve NFC Unicode letters/marks/numbers and tone marks; empty normalized input yields 0. Shapes and recording flow unchanged. This is transcript comparison only. Code-unit distance is not pronunciation quality.

Legacy test changes: quiz placeholder-padding expectation replaced with unavailable; explicit empty-pool expectation replaced with unavailable; STT accent-stripping expectation replaced with tone-preserving comparison. These are deliberate corrected behavior contracts covered by newly observed red tests. No accepted M1 security tests removed. Existing number of legacy tests is preserved.

Known remaining limits: TTS wrong-language mappings unchanged, speaking reference absent, HomeView consumes pairs without a dedicated partial-result notice (M3 UX follow-up), human semantic/distractor/IPA review pending. Imported validator/selftest are data-contract smoke tests, not a full JSON Schema engine or quality benchmark; invalid out-of-contract top-level input handling in those seed tools has not been hardened.

Independent review found internal-whitespace variants could bypass canonical identity and create visually equivalent quiz answers. Two additional tests reproduced the defect before collapsing whitespace only in identity keys, retaining display text and Vietnamese tones. Final suite and evidence status are recorded outside the repository so the final commit can be tested without changing its tree.

Failed attempts retained: initial baseline red; first green run with cross-test KV cache leakage; isolated baseline red; imported-tool ESLint Node-global errors; independent-review whitespace red. Fixture isolation and ESLint scope were corrected without runtime configuration changes. No failure log was discarded.
