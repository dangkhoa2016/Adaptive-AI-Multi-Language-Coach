import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { validate, ROOT } from './validate_design.mjs'
import { validateCapturedAttempt, summarizeAttempts, hashRequest } from './attempt_contract.mjs'
function isolated(t) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'm2b2-design-test-'))
  fs.cpSync(path.join(ROOT, 'data'), path.join(d, 'data'), { recursive: true })
  t.after(() => fs.rmSync(d, { recursive: true, force: true }))
  return d
}
function change(t, rel, mut) {
  const d = isolated(t)
  const p = path.join(d, rel),
    raw = fs.readFileSync(p, 'utf8')
  let s
  if (rel.endsWith('.jsonl')) {
    const rows = raw.trimEnd().split('\n').map(JSON.parse)
    mut(rows)
    s = rows.map((x) => JSON.stringify(x)).join('\n') + '\n'
  } else {
    const x = JSON.parse(raw)
    mut(x)
    s = JSON.stringify(x) + '\n'
  }
  fs.writeFileSync(p, s)
  return d
}
const dec = 'data/planning/scenario_decisions.proposed.jsonl',
  plan = 'data/planning/pilot_plan.proposed.json',
  template = 'data/planning/attempt_capture.empty.json'
test('baseline design validates with no inferred quality or approval', () => {
  const r = validate()
  assert.equal(r.pilot_requested_max_if_once_each, 46)
  assert.deepEqual(r.group_counts, {
    MAIN_EXACT: 5,
    EXPLORATORY_APPROXIMATE: 4,
    BLOCKED_ORIGINAL_INTENT: 3,
  })
  assert.equal(r.live_inference, 'NOT_AUTHORIZED')
})
test('reject proposed unauthorized inference', (t) =>
  assert.throws(
    () =>
      validate(
        change(t, dec, (r) => {
          r[0].inference_authorization = 'AUTHORIZED'
        }),
      ),
    /unauthorized/,
  ))
test('reject silent owner mapping approval', (t) =>
  assert.throws(
    () =>
      validate(
        change(t, dec, (r) => {
          r[0].owner_topic_approval = 'APPROVED'
        }),
      ),
    /unauthorized/,
  ))
test('reject moving blocked family into main', (t) =>
  assert.throws(
    () =>
      validate(
        change(t, dec, (r) => {
          r[9].recommended_lane = 'MAIN_EXACT'
        }),
      ),
    /grouping drift/,
  ))
test('reject changed request without changing originals', (t) =>
  assert.throws(
    () =>
      validate(
        change(t, dec, (r) => {
          r[0].proposed_request.topic = 'food'
        }),
      ),
    /proposed request changed/,
  ))
test('reject tampered source even if source anchor edited', (t) => {
  const d = isolated(t)
  const p = path.join(d, 'data/source/lexical_cases.draft.jsonl')
  fs.appendFileSync(p, '\n')
  const anchors = path.join(d, 'data/planning/source_anchors.json')
  const x = JSON.parse(fs.readFileSync(anchors))
  x.immutable_source_sha256['data/source/lexical_cases.draft.jsonl'] = 'x'
  fs.writeFileSync(anchors, JSON.stringify(x))
  assert.throws(() => validate(d), /original input altered|external B1/)
})
test('reject fake performed pilot', (t) =>
  assert.throws(
    () =>
      validate(
        change(t, plan, (x) => {
          x.pilot_candidate.executed_attempts = 1
        }),
      ),
    /invented pilot/,
  ))
test('reject fake budget approval', (t) =>
  assert.throws(
    () =>
      validate(
        change(t, plan, (x) => {
          x.execution_prerequisites.budget_cap_usd = 10
        }),
      ),
    /unexpected owner/,
  ))
test('reject fabricated model record', (t) =>
  assert.throws(
    () =>
      validate(
        change(t, template, (x) => {
          x.scenario_id = 'GEN-04'
        }),
      ),
    /fabricated/,
  ))
const req = {
  source: 'vi',
  target: 'en',
  uiLocale: 'en',
  topic: 'food',
  level: 'A2',
  mode: 'mix',
  count: 3,
}
const synthetic = (id, over = {}) => ({
  record_kind: 'CAPTURED_ATTEMPT',
  evidence_origin: 'SYNTHETIC_TEST',
  scenario_id: 'GEN-04',
  attempt_id: id,
  application_commit: 'c5f61515b6ff363ef35ee5abb6474ddec5f549b1',
  request: req,
  request_sha256: hashRequest(req),
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
  },
  human_review_status: 'NOT_EVALUATED',
  semantic_scores: null,
  ...over,
})
test('synthetic partial counts toward attempt denominator, no fake accuracy', () => {
  const a = synthetic('test-1')
  assert.equal(validateCapturedAttempt(a), true)
  const r = summarizeAttempts([a])
  assert.equal(r.attempts, 1)
  assert.equal(r.full_deliveries, 0)
  assert.equal(r.pair_yield, 2 / 3)
  assert.equal(r.semantic_accuracy, null)
})
test('reject incorrect returned count and partial flags', () => {
  assert.throws(
    () =>
      validateCapturedAttempt(
        synthetic('test-1', { response: { ...synthetic('x').response, returnedCount: 3 } }),
      ),
    /counts/,
  )
  assert.throws(
    () =>
      validateCapturedAttempt(
        synthetic('test-2', { response: { ...synthetic('x').response, partial: false } }),
      ),
    /partial/,
  )
})
test('synthetic 503 and 429 stay in attempted denominator', () => {
  const e = synthetic('e', { http_status: 503, error_code: 'fallback_unavailable', response: null })
  const r = summarizeAttempts([
    synthetic('a'),
    e,
    synthetic('b', { http_status: 429, error_code: 'rate_limited', response: null }),
  ])
  assert.equal(r.attempts, 3)
  assert.equal(r.failed, 2)
  assert.equal(r.full_delivery_rate, 0)
  assert.equal(r.requested_pairs, 9)
})
test('reject fabricated HTTP status after network timeout', () =>
  assert.throws(
    () =>
      validateCapturedAttempt(
        synthetic('t', { transport_outcome: 'TIMEOUT', http_status: 200, response: null }),
      ),
    /network\/timeout/,
  ))
test('reject duplicated attempt ids', () =>
  assert.throws(() => summarizeAttempts([synthetic('dup'), synthetic('dup')]), /duplicate attempt/))
test('cache/fallback deliveries distinct from independent model samples', () => {
  const r = summarizeAttempts([
    synthetic('a', { response: { ...synthetic('a').response, cacheHit: true } }),
    synthetic('b', { response: { ...synthetic('b').response, isFallback: true } }),
  ])
  assert.equal(r.cache_deliveries, 1)
  assert.equal(r.fallback_deliveries, 1)
  assert.equal(r.independent_model_samples, 'NOT_DETERMINABLE_FROM_DELIVERY_COUNTS')
})

test('reject wrong request SHA256 or invented verified identity', () => {
  assert.throws(
    () => validateCapturedAttempt(synthetic('hash', { request_sha256: '0'.repeat(64) })),
    /request hash/,
  )
  assert.throws(
    () =>
      validateCapturedAttempt(
        synthetic('id', {
          provider: { ...synthetic('x').provider, model_identity_status: 'VERIFIED' },
        }),
      ),
    /model identity/,
  )
})
