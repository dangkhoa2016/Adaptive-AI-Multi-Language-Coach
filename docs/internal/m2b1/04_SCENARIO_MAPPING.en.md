# M2-B1 — EN↔VI scenario mapping proposals

Source of truth: the actual M2-A inventory for `POST /api/generate`, not the older M0 handoff. Topic enum: `travel, food, work, education, health, technology, shopping, entertainment, daily_life, nature`. Level `A1/A2/B1/B2`, mode `word/phrase/mix`, count integer 1–50, locales `en/vi/ja/ko/th/zh/fr/de`. UI locale remains `en` in proposals to keep display locale independent of learning direction.

The 12 entries in `data/generation_scenarios.proposed.jsonl` have structurally valid request fields but **all remain owner-review pending, not executed**. Five exact topic matches: GEN-04, 06, 07, 09, 11. Seven approximations: GEN-01, 02 (`daily conversation`→`daily_life`), GEN-03 (`transport`→`travel`), GEN-05 (`workplace`→`work`), GEN-08 (`everyday topics`→`daily_life`), GEN-10 (`family`→`daily_life`), GEN-12 (`business`→`work`). Each approximation may change what gets sampled. The source intents are preserved unchanged alongside every proposed request.

Mode is not determined in original source scenarios; `mix` is proposed as current default except GEN-05 `phrase` for collocations and GEN-07 `word` for a count=1 boundary check. None of these choices are owner-approved.

Do not treat the 32 context-specific lexical cases as arguments to this topic-generation endpoint; no targeted lexical API exists in the archived contract. A future evaluated sampling design must map actual generated pairs to `scenario_id` and per-pair `sample_id`, store model/prompt provenance, and separate contract validity from human semantic scoring.
