import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { DEFAULT_ROOT, jsonl, validate } from '../tools/validate_plan.mjs'

const mutate = (root, file, change) => {
  const p = path.join(root, file)
  const rows = jsonl(p)
  change(rows)
  fs.writeFileSync(p, rows.map((row) => JSON.stringify(row)).join('\n') + '\n')
}
function isolated(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'coach-m2b1-contract-'))
  fs.cpSync(path.join(DEFAULT_ROOT, 'data'), path.join(root, 'data'), { recursive: true })
  fs.cpSync(path.join(DEFAULT_ROOT, 'annotations'), path.join(root, 'annotations'), {
    recursive: true,
  })
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  return root
}
const scenarios = 'data/generation_scenarios.proposed.jsonl'
const reviews = 'annotations/lexical_reference_review.pending.jsonl'
const lexical = 'data/lexical_cases.draft.jsonl'
function rejection(name, pattern, file, change) {
  test(name, (t) => {
    const root = isolated(t)
    mutate(root, file, change)
    assert.throws(() => validate(root), pattern)
  })
}

test('keeps all cases and independent slots pending with zero evaluated samples', () => {
  const result = validate()
  assert.equal(result.lexical_cases, 32)
  assert.deepEqual(result.directions, { ENVI: 16, VIEN: 16 })
  assert.equal(result.topic_exact, 5)
  assert.equal(result.topic_approximate, 7)
  assert.equal(result.review_slots, 64)
  assert.equal(result.completed_human_reviews, 0)
  assert.equal(result.executed_scenarios, 0)
  assert.equal(result.model_samples, 0)
  assert.equal(result.model_quality, 'NOT_EVALUATED')
})

for (const [field, value, pattern] of [
  ['source', 'hello', /locale enum/],
  ['target', 'xin chào', /locale enum/],
  ['uiLocale', 'xx', /locale enum/],
  ['topic', 'transport', /topic enum/],
  ['level', 'C1', /level enum/],
  ['mode', 'dialogue', /mode enum/],
  ['count', 0, /count bounds/],
  ['count', 51, /count bounds/],
  ['count', 1.5, /count bounds/],
])
  rejection(`rejects invalid request ${field}=${value}`, pattern, scenarios, (rows) => {
    rows[0].proposed_request[field] = value
  })

rejection('rejects a missing scenario ID', /identity mismatch|scenario ID/, scenarios, (r) => {
  delete r[0].id
})
rejection('rejects duplicate scenario IDs', /duplicate proposed scenario IDs/, scenarios, (r) => {
  r[1].id = r[0].id
})
rejection('rejects a missing scenario', /expected 12 scenarios/, scenarios, (r) => {
  r.pop()
})
rejection('rejects original lexical ID removal', /original input modified/, lexical, (r) => {
  delete r[0].id
})
rejection('rejects original lexical ID duplication', /original input modified/, lexical, (r) => {
  r[1].id = r[0].id
})
rejection(
  'preserves Vietnamese tones by rejecting decomposed original text',
  /original input modified/,
  lexical,
  (r) => {
    r[0].context = 'cha\u0300o'
  },
)
rejection(
  'rejects NFD in proposal rationale independently of pinned inputs',
  /NFC|NFD/,
  scenarios,
  (r) => {
    r[0].rationale += ' cha\u0300o'
  },
)
rejection('rejects missing reviewer assignment', /expected 64 reviewer slots/, reviews, (r) => {
  r.pop()
})
rejection('rejects duplicate A/B assignment', /duplicate case\/slot/, reviews, (r) => {
  r[1].reviewer_slot = 'A'
})
rejection('rejects an invalid reviewer slot', /invalid reviewer slot/, reviews, (r) => {
  r[0].reviewer_slot = 'C'
})
rejection('rejects review for an unknown case', /unknown review case/, reviews, (r) => {
  r[0].case_id = 'ENVI-999'
})
rejection(
  'rejects fake COMPLETE with no reviewer identity, time or ratings',
  /falsely completed review/,
  reviews,
  (r) => {
    r[0].review_status = 'COMPLETE'
  },
)
rejection('rejects filled pending scores', /unreviewed rating/, reviews, (r) => {
  r[0].semantic_accuracy = 4
})
rejection(
  'keeps all pending review fields blank including notes and accent',
  /unreviewed|pending.*blank/,
  reviews,
  (r) => {
    r[0].notes = 'Invented assessment'
    r[0].accent_dialect = 'invented'
  },
)
rejection('rejects silent owner approval', /unauthorized approval/, scenarios, (r) => {
  r[0].owner_review = 'APPROVED'
})
rejection(
  'rejects false execution or semantic quality',
  /unverified quality or execution/,
  scenarios,
  (r) => {
    r[0].execution_status = 'PASS'
    r[0].semantic_quality = 'PASS'
  },
)
rejection('rejects falsely exact topic mapping', /falsely exact/, scenarios, (r) => {
  r[0].topic_match = 'EXACT'
})
rejection(
  'preserves the proposed fixed UI locale independently of reverse learning direction',
  /UI locale|uiLocale/,
  scenarios,
  (r) => {
    r[1].proposed_request.uiLocale = 'vi'
  },
)

test('cannot authorize source tampering by deleting provenance entries', (t) => {
  const root = isolated(t)
  mutate(root, lexical, (r) => {
    r[0].context = 'tampered context'
  })
  fs.writeFileSync(path.join(root, 'data/input_provenance.json'), '{}\n')
  assert.throws(() => validate(root), /provenance|original input modified/)
})
test('cannot authorize source tampering by rehashing its provenance', (t) => {
  const root = isolated(t)
  mutate(root, lexical, (r) => {
    r[0].context = 'tampered context'
  })
  const p = path.join(root, 'data/input_provenance.json')
  const provenance = JSON.parse(fs.readFileSync(p, 'utf8'))
  provenance[lexical].sha256 = createHash('sha256')
    .update(fs.readFileSync(path.join(root, lexical)))
    .digest('hex')
  fs.writeFileSync(p, JSON.stringify(provenance))
  assert.throws(() => validate(root), /provenance|original input modified/)
})
test('rejects unexpected provenance paths before reading them', (t) => {
  const root = isolated(t)
  const p = path.join(root, 'data/input_provenance.json')
  const provenance = JSON.parse(fs.readFileSync(p, 'utf8'))
  provenance['../unapproved.json'] = { sha256: '0'.repeat(64) }
  fs.writeFileSync(p, JSON.stringify(provenance))
  assert.throws(() => validate(root), /provenance/)
})
for (const [name, suffix, pattern] of [
  ['corruption', '{broken\n', /invalid JSON/],
  ['blank lines', '\n', /blank line/],
]) {
  test(`rejects JSONL ${name}`, (t) => {
    const root = isolated(t)
    fs.appendFileSync(path.join(root, scenarios), suffix)
    assert.throws(() => validate(root), pattern)
  })
}
test('rejects missing JSONL final newline', (t) => {
  const root = isolated(t)
  const p = path.join(root, scenarios)
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').trimEnd())
  assert.throws(() => validate(root), /newline/)
})
test('rejects fabricated model samples in the empty template', (t) => {
  const root = isolated(t)
  const p = path.join(root, 'annotations/model_output_review.empty_template.json')
  const template = JSON.parse(fs.readFileSync(p, 'utf8'))
  template.sample_id = 'fabricated-sample'
  template.ipa_quality = 4
  fs.writeFileSync(p, JSON.stringify(template))
  assert.throws(() => validate(root), /model.*template|template.*blank/)
})

test('all 12 fully specified proposals conform to the actual pure backend request schema', async () => {
  const requireBackend = createRequire(new URL('../../../backend/package.json', import.meta.url))
  const { build } = requireBackend('esbuild')
  const result = await build({
    entryPoints: [
      fileURLToPath(new URL('../../../backend/src/services/schemas.ts', import.meta.url)),
    ],
    bundle: true,
    platform: 'node',
    format: 'esm',
    write: false,
  })
  const { generateRequestSchema } = await import(
    'data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64')
  )
  const rows = jsonl(path.join(DEFAULT_ROOT, scenarios))
  assert.equal(rows.length, 12)
  for (const row of rows) {
    const parsed = generateRequestSchema.parse(row.proposed_request)
    assert.deepEqual(parsed, row.proposed_request, row.id)
    assert.equal(parsed.source, row.original_intent.source_locale)
    assert.equal(parsed.target, row.original_intent.target_locale)
    assert.equal(parsed.uiLocale, 'en')
  }
  for (const [field, value] of [
    ['source', 'hello'],
    ['target', 'xin chào'],
    ['uiLocale', 'xx'],
    ['topic', 'transport'],
    ['level', 'C1'],
    ['mode', 'dialogue'],
    ['count', 0],
    ['count', 51],
    ['count', 1.5],
  ]) {
    const invalid = { ...rows[0].proposed_request, [field]: value }
    assert.equal(generateRequestSchema.safeParse(invalid).success, false, field)
  }
})
test('pending CLI exposes no invented accuracy, IPA score, run or review', () => {
  const report = JSON.parse(
    execFileSync(process.execPath, [path.join(DEFAULT_ROOT, 'tools/report_pending.mjs')], {
      encoding: 'utf8',
    }),
  )
  assert.equal(report.reference_review_completion, '0/64')
  assert.equal(report.executed_scenarios, 0)
  assert.equal(report.model_samples, 0)
  assert.equal(report.accuracy, null)
  assert.equal(report.ipa_quality, null)
  assert.equal(report.mapping_approval, 'OWNER_REVIEW_PENDING')
  assert.deepEqual(report.reference_curation, {
    planned_cases: 32,
    required_reviews: 64,
    completed_reviews: 0,
    completed_case_pairs: 0,
    independent_reviewers: 0,
    disagreements: null,
    adjudicated_cases: 0,
    critical_errors: null,
    semantic_quality: 'NOT_EVALUATED',
  })
  assert.deepEqual(report.model_output_sampling, {
    planned_scenarios: 12,
    attempted_scenarios: 0,
    full_results: 0,
    partial_results: 0,
    unavailable_503: 0,
    other_failures: 0,
    model_samples: 0,
    requested_items: 0,
    returned_items: 0,
    completed_reviews: 0,
    execution_status: 'NOT_RUN',
    semantic_quality: 'NOT_EVALUATED',
  })
})
