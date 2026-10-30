# Draft scenario enumeration mapping

Actual enum: topic = travel, food, work, education, health, technology, shopping, entertainment, daily_life, nature; level = A1/A2/B1/B2; mode = word/phrase/mix; count = integer 1–50; source/target/uiLocale = en/vi/ja/ko/th/zh/fr/de. `backend/src/services/schemas.ts`, `backend/src/i18n/topics.ts`.

The twelve imported intentions are not executable fixtures. No scenario was sent to AI. Every mode is UNRESOLVED_MAP_FROM_REPO_SCHEMA, so all are BLOCKED. Exact topic matches are documented, and synonyms are not silently guessed. Owner selection/review of mode and nonmatching topic intent is required before M2-B. The separate route test fixtures explicitly select valid enum values and do not claim to execute these intentions.

| Scenario | Topic intention    | Exact enum mapping          | Level / count | Mode       | Execution       |
| -------- | ------------------ | --------------------------- | ------------- | ---------- | --------------- |
| GEN-01   | daily conversation | UNRESOLVED (no exact match) | A1 / 5 valid  | UNRESOLVED | BLOCKED_NOT_RUN |
| GEN-02   | daily conversation | UNRESOLVED (no exact match) | A1 / 5 valid  | UNRESOLVED | BLOCKED_NOT_RUN |
| GEN-03   | transport          | UNRESOLVED (no exact match) | A2 / 10 valid | UNRESOLVED | BLOCKED_NOT_RUN |
| GEN-04   | food               | food                        | A2 / 10 valid | UNRESOLVED | BLOCKED_NOT_RUN |
| GEN-05   | workplace          | UNRESOLVED (no exact match) | B1 / 20 valid | UNRESOLVED | BLOCKED_NOT_RUN |
| GEN-06   | technology         | technology                  | B1 / 20 valid | UNRESOLVED | BLOCKED_NOT_RUN |
| GEN-07   | travel             | travel                      | A2 / 1 valid  | UNRESOLVED | BLOCKED_NOT_RUN |
| GEN-08   | everyday topics    | UNRESOLVED (no exact match) | A2 / 50 valid | UNRESOLVED | BLOCKED_NOT_RUN |
| GEN-09   | food               | food                        | A1 / 5 valid  | UNRESOLVED | BLOCKED_NOT_RUN |
| GEN-10   | family             | UNRESOLVED (no exact match) | A2 / 5 valid  | UNRESOLVED | BLOCKED_NOT_RUN |
| GEN-11   | travel             | travel                      | B1 / 10 valid | UNRESOLVED | BLOCKED_NOT_RUN |
| GEN-12   | business           | UNRESOLVED (no exact match) | B1 / 10 valid | UNRESOLVED | BLOCKED_NOT_RUN |
