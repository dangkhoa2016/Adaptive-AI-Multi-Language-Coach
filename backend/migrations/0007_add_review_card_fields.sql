-- Migration 0007: add rich card fields to learned_pairs

ALTER TABLE learned_pairs ADD COLUMN ipa TEXT;
ALTER TABLE learned_pairs ADD COLUMN pos TEXT;
ALTER TABLE learned_pairs ADD COLUMN example_source TEXT;
ALTER TABLE learned_pairs ADD COLUMN example_target TEXT;
