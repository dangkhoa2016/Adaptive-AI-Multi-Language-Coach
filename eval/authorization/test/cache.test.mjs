import test from 'node:test'
import assert from 'node:assert/strict'
import { createModel, transition } from '../state/model.mjs'
import { denyOperational } from '../policy/deny.mjs'
const config = {
  projectId: 'TEST_ONLY_PROJECT',
  evaluationScopeId: 'TEST_ONLY_SCOPE',
  projectCap: '100',
  grantCaps: { TEST_ONLY_G1: '100', TEST_ONLY_G2: '100' },
  maxInitials: 5,
  maxOutbound: 5,
  maxConcurrency: 1,
}
const step = (s, e) => {
  const result = transition(s, e)
  const value = result.state
  console.log(
    'B0_MODEL_TRACE ' +
      JSON.stringify({
        kind: 'TEST_ONLY_NON_OPERATIVE',
        event: e,
        outcome: result.outcome,
        operationalDecision: result.operationalDecision,
        version: value.version,
        policyEpoch: value.policyEpoch,
        halted: value.halted,
        killed: value.killed,
        claims: value.claims,
        outboundAllocated: value.outboundAllocated,
        occupiedSlots: value.occupiedSlots,
        project: value.project,
        grants: value.grants,
        incidents: value.incidents,
      }),
  )
  return value
}
const initial = () => createModel(config)
const claim = (s, grantId = 'TEST_ONLY_G1') =>
  step(s, { type: 'CLAIM', scenarioId: 'GEN-04', grantId })
const hit = { type: 'CACHE_HIT', scenarioId: 'GEN-04', fixture: 'TEST_ONLY_TRUSTED_HIT' }
const miss = (s) => ({
  type: 'CACHE_MISS',
  scenarioId: 'GEN-04',
  W: '60',
  proof: 'TEST_ONLY_HYPOTHETICAL_BOUND',
  expectedVersion: s.version,
  expectedPolicyEpoch: s.policyEpoch,
})

test('B0-CACHE-01 unique claim consumes initial exactly once', () => {
  const s = claim(initial())
  assert.equal(s.claims.length, 1)
  assert.deepEqual(claim(s), s)
})
test('B0-CACHE-02 CT02 synthetic hit consumes claim with no outbound/hold/slot', () => {
  const s = step(claim(initial()), hit)
  assert.equal(s.claims[0].status, 'CACHE_ONLY_COMPLETE')
  assert.equal(s.claims[0].attempt, null)
  assert.equal(s.outboundAllocated, 0)
  assert.equal(s.occupiedSlots, 0)
  assert.equal(denyOperational(s).decision, 'DENY')
  const c = claim(initial())
  assert.deepEqual(step(c, { type: 'CACHE_HIT', scenarioId: 'GEN-04', cacheHit: true }), c)
})
test('B0-CACHE-03 CT04 missing W or hypothetical proof terminally denies without attempt', () => {
  for (const extras of [
    {},
    { W: '60' },
    { W: '-1', proof: 'TEST_ONLY_HYPOTHETICAL_BOUND' },
    { W: '60', proof: 'UNTRUSTED' },
  ]) {
    const s = claim(initial())
    const denied = step(s, {
      type: 'CACHE_MISS',
      scenarioId: 'GEN-04',
      expectedVersion: s.version,
      expectedPolicyEpoch: s.policyEpoch,
      ...extras,
    })
    assert.equal(denied.claims[0].status, 'NO_OUTBOUND_DENIED')
    assert.equal(denied.claims[0].attempt, null)
    assert.equal(denied.outboundAllocated, 0)
    assert.deepEqual(step(denied, hit), denied)
  }
})
test('B0-CACHE-04 CT03 hypothetical outbound never double-consumes initial', () => {
  const c = claim(initial())
  const s = step(c, miss(c))
  assert.equal(s.claims.length, 1)
  assert.equal(s.outboundAllocated, 1)
  assert.equal(s.claims[0].attempt.W, '60')
})
test('B0-CACHE-05 cross-grant competitors share same INITIAL key', () => {
  const s = claim(initial())
  assert.deepEqual(claim(s, 'TEST_ONLY_G2'), s)
  assert.deepEqual(s.claims[0].key, ['TEST_ONLY_PROJECT', 'TEST_ONLY_SCOPE', 'GEN-04', 'INITIAL'])
})
test('B0-CACHE-06 hit versus miss permits at most one selected branch', () => {
  const c = claim(initial())
  const h = step(c, hit)
  assert.deepEqual(step(h, miss(h)), h)
  const m = step(c, miss(c))
  assert.deepEqual(step(m, hit), m)
})
test('B0-CACHE-07 provider ambiguity plus cached fallback retains W/slot/HALT and both flags', () => {
  let s = claim(initial())
  s = step(s, miss(s))
  s = step(s, { type: 'UNKNOWN', scenarioId: 'GEN-04' })
  s = step(s, { type: 'FALLBACK', scenarioId: 'GEN-04', cacheHit: true })
  assert.equal(s.halted, true)
  assert.equal(s.claims[0].attempt.W, '60')
  assert.equal(s.occupiedSlots, 1)
  assert.deepEqual(s.claims[0].delivery, { cacheHit: true, isFallback: true })
  assert.equal(s.claims[0].status, 'CLAIM_OR_DELIVERY_UNKNOWN')
  assert.equal(denyOperational(s).decision, 'DENY')
})
test('B0-CACHE-08 CT05 ambiguous ACK keeps key and consumes no invented W or retry', () => {
  for (const cached of [false, true]) {
    let s = claim(initial())
    if (cached) s = step(s, hit)
    const key = s.claims[0].key
    s = step(s, { type: 'UNKNOWN', scenarioId: 'GEN-04' })
    assert.deepEqual(s.claims[0].key, key)
    assert.equal(s.claims[0].attempt, null)
    assert.equal(s.outboundAllocated, 0)
    assert.equal(s.occupiedSlots, 0)
    assert.equal(s.halted, true)
    assert.deepEqual(claim(s), s)
    assert.deepEqual(step(s, hit), s)
    assert.deepEqual(step(s, miss(s)), s)
  }
})

test('B0-CACHE-09 CT04 denial cannot turn into UNKNOWN or fallback delivery', () => {
  const c = claim(initial())
  const denied = step(c, {
    type: 'CACHE_MISS',
    scenarioId: 'GEN-04',
    expectedVersion: c.version,
    expectedPolicyEpoch: c.policyEpoch,
  })
  const unknown = step(denied, { type: 'UNKNOWN', scenarioId: 'GEN-04' })
  assert.deepEqual(unknown, denied)
  assert.deepEqual(
    step(unknown, { type: 'FALLBACK', scenarioId: 'GEN-04', cacheHit: true }),
    denied,
  )
  assert.equal(denied.claims[0].status, 'NO_OUTBOUND_DENIED')
  assert.deepEqual(denied.claims[0].delivery, { cacheHit: false, isFallback: false })
})
