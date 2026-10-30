import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { DEFAULT_ROOT, validate } from './validate_plan.mjs'
const inputs = [
  'data/lexical_cases.draft.jsonl',
  'data/generation_scenarios.original.jsonl',
  'data/generation_scenarios.proposed.jsonl',
  'data/input_provenance.json',
  'data/dataset_metadata.json',
  'annotations/lexical_reference_review.pending.jsonl',
  'annotations/model_output_review.empty_template.json',
]
function isolated() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'm2b1-selftest-'))
  for (const f of inputs) {
    fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true })
    fs.copyFileSync(path.join(DEFAULT_ROOT, f), path.join(root, f))
  }
  return root
}
let count = 0
function negative(name, pattern, fn) {
  const dir = isolated()
  try {
    fn(dir)
    assert.throws(() => validate(dir), pattern, name)
    count++
    console.log(`PASS negative: ${name}`)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}
function mod(dir, file, fn) {
  const p = path.join(dir, file)
  const arr = fs.readFileSync(p, 'utf8').trimEnd().split('\n').map(JSON.parse)
  fn(arr)
  fs.writeFileSync(p, arr.map((x) => JSON.stringify(x)).join('\n') + '\n')
}
assert.equal(validate().status, 'OFFLINE_DATA_CONTRACT_PASS')
count++
console.log('PASS positive: original dataset')
negative('reject invalid topic', /topic enum/, (d) =>
  mod(
    d,
    'data/generation_scenarios.proposed.jsonl',
    (a) => (a[0].proposed_request.topic = 'transport'),
  ),
)
negative('reject invalid mode', /mode enum/, (d) =>
  mod(
    d,
    'data/generation_scenarios.proposed.jsonl',
    (a) => (a[0].proposed_request.mode = 'dialogue'),
  ),
)
negative('reject invalid count', /count bounds/, (d) =>
  mod(d, 'data/generation_scenarios.proposed.jsonl', (a) => (a[0].proposed_request.count = 51)),
)
negative('reject falsely exact topic', /falsely exact/, (d) =>
  mod(d, 'data/generation_scenarios.proposed.jsonl', (a) => (a[0].topic_match = 'EXACT')),
)
negative('reject silent execution claim', /unverified quality or execution/, (d) =>
  mod(d, 'data/generation_scenarios.proposed.jsonl', (a) => (a[0].execution_status = 'PASS')),
)
negative('reject duplicate scenario id', /duplicate proposed scenario IDs/, (d) =>
  mod(d, 'data/generation_scenarios.proposed.jsonl', (a) => (a[1].id = a[0].id)),
)
negative('reject fake completed human review', /falsely completed review/, (d) =>
  mod(
    d,
    'annotations/lexical_reference_review.pending.jsonl',
    (a) => (a[0].review_status = 'COMPLETE'),
  ),
)
negative('reject filled unreviewed scores', /unreviewed rating/, (d) =>
  mod(d, 'annotations/lexical_reference_review.pending.jsonl', (a) => (a[0].semantic_accuracy = 4)),
)
negative('reject duplicate human slot', /duplicate case\/slot reviewer assignments/, (d) =>
  mod(d, 'annotations/lexical_reference_review.pending.jsonl', (a) => (a[1].reviewer_slot = 'A')),
)
negative('reject source tampering', /original input modified/, (d) =>
  mod(d, 'data/lexical_cases.draft.jsonl', (a) => (a[0].context = 'edited content')),
)
negative('reject malformed JSONL', /invalid JSON/, (d) => {
  const p = path.join(d, 'data/generation_scenarios.proposed.jsonl')
  fs.appendFileSync(p, '{broken\n')
})
negative('reject Unicode decomposition of draft source', /original input modified/, (d) =>
  mod(
    d,
    'data/lexical_cases.draft.jsonl',
    (a) => (a[0].accepted_reference_translations = ['ngân hàng']),
  ),
)
console.log(JSON.stringify({ selftest: 'PASS', assertions: count, negative_assertions: count - 1 }))
