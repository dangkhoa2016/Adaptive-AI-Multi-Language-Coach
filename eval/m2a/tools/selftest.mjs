#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseJsonl, validateLexicalCases } from './validate_seed.mjs'
const rows = parseJsonl(
  readFileSync(new URL('../data/lexical_cases.draft.jsonl', import.meta.url), 'utf8'),
)
const good = validateLexicalCases(rows)
assert.equal(good.status, 'PASS_DATA_CONTRACT_ONLY')
assert.equal(good.case_count, 32)
assert.equal(good.directions.ENVI, 16)
assert.equal(good.directions.VIEN, 16)
const duplicate = structuredClone(rows)
duplicate[1].id = duplicate[0].id
assert.match(validateLexicalCases(duplicate).errors.join(' '), /duplicate id/u)
const wrongDirection = structuredClone(rows)
wrongDirection[0].source_locale = 'vi'
assert.match(validateLexicalCases(wrongDirection).errors.join(' '), /locale\/direction mismatch/u)
const fakeApproval = structuredClone(rows)
fakeApproval[0].review_status = 'HUMAN_REVIEWED'
assert.match(validateLexicalCases(fakeApproval).errors.join(' '), /cannot claim human approval/u)
const decomposed = structuredClone(rows)
decomposed[0].accepted_reference_translations[0] = 'nga\u0302n ha\u0300ng'
assert.match(validateLexicalCases(decomposed).errors.join(' '), /non-NFC text/u)
console.log('SELFTEST PASS: valid seed + duplicate + locale + false-approval + non-NFC negatives')
