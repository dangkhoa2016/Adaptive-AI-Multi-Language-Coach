#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { parseJsonl } from './validate_seed.mjs'
const path =
  process.argv[2] ??
  new URL('../annotations/lexical_review.pending.jsonl', import.meta.url).pathname
const rows = parseJsonl(readFileSync(path, 'utf8'))
const rated = rows.filter((x) => x.review_status === 'COMPLETE')
let invalid = 0
const aggregate = {
  semantic_accuracy: [],
  context_alignment: [],
  naturalness: [],
  example_fidelity: [],
  ipa_quality: [],
}
for (const r of rated) {
  if (!r.sample_id || !r.reviewer_id || typeof r.critical_error !== 'boolean') {
    invalid++
    continue
  }
  for (const k of ['semantic_accuracy', 'context_alignment', 'naturalness', 'example_fidelity']) {
    if (!Number.isInteger(r[k]) || r[k] < 0 || r[k] > 4) {
      invalid++
      break
    }
  }
  if (
    r.ipa_quality !== null &&
    (!Number.isInteger(r.ipa_quality) || r.ipa_quality < 0 || r.ipa_quality > 4)
  )
    invalid++
  for (const k of Object.keys(aggregate)) if (typeof r[k] === 'number') aggregate[k].push(r[k])
}
const status = invalid
  ? 'INVALID_ANNOTATIONS'
  : rated.length
    ? 'PARTIAL_REVIEW_DO_NOT_CLAIM_MODEL_PASS'
    : 'NOT_EVALUATED'
const result = {
  status,
  total_records: rows.length,
  completed_annotations: rated.length,
  invalid_records: invalid,
  critical_errors: rated.filter((x) => x.critical_error === true).length,
  average_ratings: Object.fromEntries(
    Object.entries(aggregate).map(([k, v]) => [
      k,
      v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 1000) / 1000 : null,
    ]),
  ),
  note: 'This is NOT an objective translation accuracy metric; gold examples are unreviewed. Human rubric labels require adjudication.',
}
console.log(JSON.stringify(result, null, 2))
if (invalid) process.exitCode = 1
