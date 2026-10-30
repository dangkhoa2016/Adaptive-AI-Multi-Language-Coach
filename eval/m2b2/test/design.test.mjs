import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { fileURLToPath, URL } from 'node:url'
import { Buffer } from 'node:buffer'
import { validate, ROOT } from '../tools/validate_design.mjs'
import {
  hashRequest,
  validateCapturedAttempt,
  summarizeAttempts,
} from '../tools/attempt_contract.mjs'

const planning = 'data/planning/'
const copy = (x) => JSON.parse(JSON.stringify(x))
function mutate(t, file, fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'm2b2-negative-'))
  fs.cpSync(path.join(ROOT, 'data'), path.join(root, 'data'), { recursive: true })
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const p = path.join(root, file)
  const x = file.endsWith('.jsonl')
    ? fs.readFileSync(p, 'utf8').trimEnd().split('\n').map(JSON.parse)
    : JSON.parse(fs.readFileSync(p, 'utf8'))
  fn(x, root)
  fs.writeFileSync(
    p,
    file.endsWith('.jsonl')
      ? x.map((r) => JSON.stringify(r)).join('\n') + '\n'
      : JSON.stringify(x) + '\n',
  )
  return root
}
for (const [label, fn] of [
  [
    'cost',
    (x) => {
      x.provider.verified_cost_usd = 1
    },
  ],
  [
    'prompt hash',
    (x) => {
      x.provider.prompt_hash_sha256 = 'a'.repeat(64)
    },
  ],
  [
    'model revision',
    (x) => {
      x.provider.model_revision = 'invented'
    },
  ],
  [
    'tokens',
    (x) => {
      x.provider.usage_input_tokens = 1
    },
  ],
  [
    'capture time',
    (x) => {
      x.attempt_started_utc = '2026-10-30T00:00:00Z'
    },
  ],
  [
    'response counts',
    (x) => {
      x.response.returnedCount = 46
    },
  ],
  [
    'pronunciation',
    (x) => {
      x.pronunciation_score = 1
    },
  ],
  [
    'origin',
    (x) => {
      x.evidence_origin = 'AUTHORIZED_CAPTURE'
    },
  ],
])
  test(`empty design template rejects invented ${label}`, (t) => {
    assert.throws(
      () => validate(mutate(t, planning + 'attempt_capture.empty.json', fn)),
      /capture|template/,
    )
  })
for (const [label, fn] of [
  [
    'IPA',
    (x) => {
      x.metrics.ipa_quality = 4
    },
  ],
  [
    'delivery rate',
    (x) => {
      x.metrics.full_delivery_rate = 1
    },
  ],
  [
    'reference review',
    (x) => {
      x.evaluation_lanes.reference_curation.completed_reviews = 64
    },
  ],
  [
    'model samples',
    (x) => {
      x.evaluation_lanes.model_sample.actual_samples = 46
    },
  ],
  [
    'speech',
    (x) => {
      x.evaluation_lanes.speech.status = 'PASS'
    },
  ],
  [
    'fallback count',
    (x) => {
      x.pilot_candidate.fallbacks = 1
    },
  ],
  [
    'cache count',
    (x) => {
      x.pilot_candidate.cache_hits = 1
    },
  ],
  [
    'stage',
    (x) => {
      x.pilot_candidate.candidate_stage = 'PASS'
    },
  ],
  [
    'missing owner gates',
    (x) => {
      x.execution_prerequisites = {}
    },
  ],
  [
    'source HEAD',
    (x) => {
      x.source_final_head = '0'.repeat(40)
    },
  ],
])
  test(`plan rejects invented ${label}`, (t) => {
    assert.throws(
      () => validate(mutate(t, planning + 'pilot_plan.proposed.json', fn)),
      /metric|lane|review|pilot|owner|prerequisite|baseline|source/,
    )
  })
test('planning text preserves Unicode NFC and Vietnamese tones', (t) => {
  const root = mutate(t, planning + 'scenario_decisions.proposed.jsonl', (r) => {
    r[0].recommendation_rationale += ' cha\u0300o'
  })
  assert.throws(() => validate(root), /NFC/)
})
test('independent B1 pins reject a legitimately rehashed changed source', (t) => {
  const root = mutate(t, planning + 'source_anchors.json', (anchors, dir) => {
    const p = path.join(dir, 'data/source/lexical_cases.draft.jsonl')
    fs.appendFileSync(p, '\n')
    anchors.immutable_source_sha256['data/source/lexical_cases.draft.jsonl'] = createHash('sha256')
      .update(fs.readFileSync(p))
      .digest('hex')
  })
  assert.throws(() => validate(root), /external B1/)
})
const request = {
  source: 'vi',
  target: 'en',
  uiLocale: 'en',
  topic: 'food',
  level: 'A2',
  mode: 'mix',
  count: 3,
}
function synthetic(id = 'SYNTHETIC-ONLY') {
  return {
    record_kind: 'CAPTURED_ATTEMPT',
    evidence_origin: 'SYNTHETIC_TEST',
    scenario_id: 'GEN-04',
    attempt_id: id,
    application_commit: 'c5f61515b6ff363ef35ee5abb6474ddec5f549b1',
    request: { ...request },
    request_sha256: hashRequest(request),
    attempt_started_utc: '2026-10-30T00:00:00.000Z',
    attempt_finished_utc: '2026-10-30T00:00:01.000Z',
    elapsed_ms_monotonic: 123,
    transport_outcome: 'HTTP_RESPONSE',
    http_status: 200,
    error_code: null,
    response: {
      pairs: [
        { source: 'cơm', target: 'rice' },
        { source: 'phở', target: 'pho' },
      ],
      requestedCount: 3,
      returnedCount: 2,
      partial: true,
      isFallback: false,
      cacheHit: false,
    },
    provider: {
      model_name: null,
      model_revision: null,
      model_identity_status: 'UNKNOWN_NOT_EVALUATED',
      prompt_hash_sha256: null,
      model_config_hash_sha256: null,
      verified_cost_usd: null,
      usage_input_tokens: null,
      usage_output_tokens: null,
    },
    human_review_status: 'NOT_EVALUATED',
    semantic_scores: null,
    pronunciation_score: null,
  }
}
for (const [label, fn, pattern] of [
  [
    'unknown scenario',
    (x) => {
      x.scenario_id = 'GEN-99'
    },
    /identifier|scenario/,
  ],
  [
    'impossible HTTP status',
    (x) => {
      x.http_status = 999
      x.response = null
      x.error_code = 'synthetic'
    },
    /http status/,
  ],
  [
    'non-calendar UTC',
    (x) => {
      x.attempt_started_utc = '2026-02-30T00:00:00.000Z'
    },
    /timestamp/,
  ],
  [
    'success with error',
    (x) => {
      x.error_code = 'invented'
    },
    /error/,
  ],
  [
    'unscored pronunciation claim',
    (x) => {
      x.pronunciation_score = 1
    },
    /scored|pronunciation/,
  ],
  [
    'negative token usage',
    (x) => {
      x.provider.usage_input_tokens = -1
    },
    /token|usage/,
  ],
])
  test(`captured contract rejects ${label}`, () => {
    const x = synthetic()
    fn(x)
    assert.throws(() => validateCapturedAttempt(x), pattern)
  })
test('unknown provider information is retained as null without mutation or auto-estimation', () => {
  const x = synthetic(),
    before = copy(x)
  assert.equal(validateCapturedAttempt(x), true)
  assert.deepEqual(x, before)
  assert.equal(x.provider.model_revision, null)
  assert.equal(x.provider.prompt_hash_sha256, null)
  assert.equal(x.provider.verified_cost_usd, null)
})
test('valid synthetic timeout stays in delivery denominator with no invented HTTP response', () => {
  const x = synthetic('timeout')
  x.transport_outcome = 'TIMEOUT'
  x.http_status = null
  x.response = null
  x.error_code = 'synthetic_timeout'
  const result = summarizeAttempts([x])
  assert.equal(result.attempts, 1)
  assert.equal(result.failed, 1)
  assert.equal(result.requested_pairs, 3)
  assert.equal(result.returned_pairs, 0)
  assert.equal(result.full_delivery_rate, 0)
  assert.equal(result.pair_yield, 0)
  assert.equal(result.semantic_accuracy, null)
})
test('synthetic summaries retain explicit evidence classification', () => {
  const result = summarizeAttempts([synthetic()])
  assert.equal(result.evidence_classification, 'SYNTHETIC_ONLY')
  assert.equal(result.synthetic_attempts, 1)
  assert.equal(result.authorized_capture_attempts, 0)
})
test('mixed origins cannot silently enter one delivery summary', () => {
  const other = synthetic('not-an-actual-capture')
  // Simulated classification only; this fixture is not authorization or an actual sample.
  other.evidence_origin = 'AUTHORIZED_CAPTURE'
  assert.throws(() => summarizeAttempts([synthetic(), other]), /mixed.*origin|mixed.*evidence/)
})
test('empty attempt summary means not run and null denominators', () => {
  const result = summarizeAttempts([])
  assert.equal(result.attempts, 0)
  assert.equal(result.full_delivery_rate, null)
  assert.equal(result.pair_yield, null)
  assert.equal(result.semantic_accuracy, null)
  assert.equal(result.evidence_classification, 'NOT_RUN')
})
test('request hash is invariant to object key order and distinct from a prompt hash', () => {
  assert.equal(
    hashRequest(request),
    hashRequest(Object.fromEntries(Object.entries(request).reverse())),
  )
  assert.notEqual(hashRequest(request), hashRequest({ ...request, mode: 'word' }))
  assert.equal(synthetic().provider.prompt_hash_sha256, null)
})
test('the 12 proposal requests match the actual pure backend schema without executing routes', async () => {
  const requireBackend = createRequire(new URL('../../../backend/package.json', import.meta.url))
  const { build } = requireBackend('esbuild')
  const bundle = await build({
    entryPoints: [
      fileURLToPath(new URL('../../../backend/src/services/schemas.ts', import.meta.url)),
    ],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
  })
  const { generateRequestSchema } = await import(
    'data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64')
  )
  const rows = fs
    .readFileSync(path.join(ROOT, planning, 'scenario_decisions.proposed.jsonl'), 'utf8')
    .trimEnd()
    .split('\n')
    .map(JSON.parse)
  assert.equal(rows.length, 12)
  for (const row of rows)
    assert.deepEqual(generateRequestSchema.parse(row.proposed_request), row.proposed_request)
  for (const [field, value] of [
    ['source', 'hello'],
    ['target', 'cơm'],
    ['uiLocale', 'xx'],
    ['topic', 'transport'],
    ['mode', 'dialogue'],
    ['level', 'C1'],
    ['count', 0],
    ['count', 51],
  ]) {
    assert.equal(
      generateRequestSchema.safeParse({ ...rows[0].proposed_request, [field]: value }).success,
      false,
    )
  }
})
