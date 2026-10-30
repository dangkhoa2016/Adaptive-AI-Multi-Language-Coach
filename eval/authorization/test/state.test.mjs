import test from 'node:test'
import assert from 'node:assert/strict'
import { createModel, transition } from '../state/model.mjs'
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
const claim = (s, scenarioId = 'GEN-04', grantId = 'TEST_ONLY_G1') =>
  step(s, { type: 'CLAIM', scenarioId, grantId })
const reserve = (s, scenarioId = 'GEN-04', W = '60') =>
  step(s, {
    type: 'CACHE_MISS',
    scenarioId,
    W,
    proof: 'TEST_ONLY_HYPOTHETICAL_BOUND',
    expectedVersion: s.version,
    expectedPolicyEpoch: s.policyEpoch,
  })
const gated = (s, type, scenarioId = 'GEN-04') =>
  step(s, {
    type,
    scenarioId,
    expectedVersion: s.version,
    expectedPolicyEpoch: s.policyEpoch,
    ...(type === 'DISPATCH' ? { anchor: 'TEST_ONLY_ANCHORED' } : {}),
  })
const ready = () => reserve(claim(createModel(config)))

test('STATE-01 CT01 claim is immutable, cross-grant unique and carries no attempt', () => {
  const initial = createModel(config)
  const s = claim(initial)
  assert.equal(initial.claims.length, 0)
  assert.equal(s.claims.length, 1)
  assert.equal(s.claims[0].status, 'LOGICAL_INITIAL_CLAIMED')
  assert.equal(s.claims[0].attempt, null)
  assert.equal(s.operationalDecision, 'DENY')
  const replay = transition(s, { type: 'CLAIM', scenarioId: 'GEN-04', grantId: 'TEST_ONLY_G2' })
  assert.equal(replay.outcome, 'MODEL_DENIED')
  assert.deepEqual(replay.state, s)
  assert.ok(Object.isFrozen(s.claims[0]))
  assert.throws(() => {
    s.claims.push({})
  }, TypeError)
})

test('STATE-02 CT03 reserves one hold and slot without a second initial; stale CAS loses', () => {
  const c = claim(createModel(config))
  const s = reserve(c)
  assert.equal(s.claims.length, 1)
  assert.equal(s.claims[0].attempt.W, '60')
  assert.equal(s.claims[0].attempt.status, 'RESERVED_READY')
  assert.equal(s.outboundAllocated, 1)
  assert.equal(s.occupiedSlots, 1)
  const stale = transition(s, {
    type: 'CACHE_MISS',
    scenarioId: 'GEN-04',
    W: '60',
    proof: 'TEST_ONLY_HYPOTHETICAL_BOUND',
    expectedVersion: c.version,
    expectedPolicyEpoch: c.policyEpoch,
  })
  assert.equal(stale.outcome, 'MODEL_DENIED')
  assert.deepEqual(stale.state, s)
})

test('STATE-03 competing grants cannot exceed project cap or last slot', () => {
  for (const overrides of [{ maxConcurrency: 2 }, { projectCap: '1000' }]) {
    let s = createModel({ ...config, ...overrides })
    s = claim(s)
    s = claim(s, 'GEN-06', 'TEST_ONLY_G2')
    s = reserve(s)
    const second = reserve(s, 'GEN-06')
    assert.equal(second.outboundAllocated, 1)
    assert.equal(second.occupiedSlots, 1)
    assert.equal(second.claims[1].attempt, null)
    assert.equal(second.claims[1].status, 'NO_OUTBOUND_DENIED')
  }
})

test('STATE-04 kill/revoke before LP_D reject dispatch and preserve original W/slot', () => {
  for (const event of [{ type: 'KILL' }, { type: 'REVOKE', grantId: 'TEST_ONLY_G1' }]) {
    const intent = gated(ready(), 'PREPARE')
    const s = step(intent, event)
    const result = transition(s, {
      type: 'DISPATCH',
      scenarioId: 'GEN-04',
      anchor: 'TEST_ONLY_ANCHORED',
      expectedVersion: s.version,
      expectedPolicyEpoch: intent.policyEpoch,
    })
    assert.equal(result.outcome, 'MODEL_DENIED')
    assert.equal(result.state.claims[0].attempt.status, 'DISPATCH_INTENT')
    assert.equal(result.state.claims[0].attempt.W, '60')
    assert.equal(result.state.occupiedSlots, 1)
    assert.equal(gated(s, 'DISPATCH').claims[0].attempt.status, 'DISPATCH_INTENT')
  }
})

test('STATE-05 LP_D before kill stays consumed; UNKNOWN halts across grants without retry', () => {
  const dispatched = gated(gated(ready(), 'PREPARE'), 'DISPATCH')
  assert.equal(dispatched.claims[0].attempt.status, 'IN_FLIGHT')
  assert.deepEqual(gated(dispatched, 'DISPATCH'), dispatched)
  let s = step(dispatched, { type: 'KILL' })
  s = step(s, { type: 'UNKNOWN', scenarioId: 'GEN-04' })
  assert.equal(s.halted, true)
  assert.equal(s.claims[0].attempt.status, 'UNKNOWN_QUARANTINED')
  assert.equal(s.claims[0].attempt.W, '60')
  assert.equal(s.occupiedSlots, 1)
  assert.deepEqual(claim(s, 'GEN-06', 'TEST_ONLY_G2'), s)
  assert.equal(transition(s, { type: 'RETRY', scenarioId: 'GEN-04' }).outcome, 'MODEL_DENIED')
})

test('STATE-06 no-send proof releases only RESERVED_READY and never refunds claims/allocations', () => {
  const r = ready()
  const s = step(r, { type: 'CANCEL', scenarioId: 'GEN-04', proof: 'TEST_ONLY_NO_SEND' })
  assert.equal(s.claims[0].attempt.status, 'CANCELLED_PROVEN_NO_SEND')
  assert.equal(s.occupiedSlots, 0)
  assert.equal(s.outboundAllocated, 1)
  assert.equal(s.claims.length, 1)
  assert.deepEqual(reserve(s), s)
  const intent = gated(r, 'PREPARE')
  assert.deepEqual(
    step(intent, { type: 'CANCEL', scenarioId: 'GEN-04', proof: 'TEST_ONLY_NO_SEND' }),
    intent,
  )
  assert.deepEqual(step(r, { type: 'CANCEL', scenarioId: 'GEN-04', proof: 'UNTRUSTED' }), r)
})

test('STATE-07 synthetic final settlement is once, conflicting replay HALTs, UNKNOWN never auto-unhalts', () => {
  const flight = gated(gated(ready(), 'PREPARE'), 'DISPATCH')
  const unknown = step(flight, { type: 'UNKNOWN', scenarioId: 'GEN-04' })
  const receipt = {
    type: 'SETTLE',
    scenarioId: 'GEN-04',
    amount: '31',
    receiptId: 'TEST_ONLY_RECEIPT_1',
    proof: 'TEST_ONLY_FINAL_RECEIPT',
  }
  const s = step(unknown, receipt)
  assert.equal(s.project.spent, '31')
  assert.equal(s.grants.TEST_ONLY_G1.spent, '31')
  assert.equal(s.occupiedSlots, 0)
  assert.equal(s.halted, true)
  assert.deepEqual(step(s, receipt), s)
  const conflict = step(s, { ...receipt, amount: '32' })
  assert.equal(conflict.halted, true)
  assert.equal(conflict.project.spent, '31')
  assert.equal(conflict.incidents.at(-1).reason, 'RECEIPT_CONFLICT')
})

test('STATE-08 charge above W records unclamped breach and retains conservative hold/HALT', () => {
  const flight = gated(gated(ready(), 'PREPARE'), 'DISPATCH')
  const s = step(flight, {
    type: 'SETTLE',
    scenarioId: 'GEN-04',
    amount: '61',
    receiptId: 'TEST_ONLY_RECEIPT_2',
    proof: 'TEST_ONLY_FINAL_RECEIPT',
  })
  assert.equal(s.halted, true)
  assert.equal(s.incidents.at(-1).actual, '61')
  assert.equal(s.claims[0].attempt.W, '60')
  assert.equal(s.occupiedSlots, 1)
  assert.equal(s.project.cap, '100')
  assert.equal(s.project.spent, '0')
})

test('STATE-09 restore ambiguity halts, missing gate/anchor and unknown event fields fail closed', () => {
  const r = ready()
  const intent = gated(r, 'PREPARE')
  assert.deepEqual(
    step(intent, {
      type: 'DISPATCH',
      scenarioId: 'GEN-04',
      expectedVersion: intent.version,
      expectedPolicyEpoch: intent.policyEpoch,
    }),
    intent,
  )
  assert.deepEqual(
    step(r, {
      type: 'PREPARE',
      scenarioId: 'GEN-04',
      expectedVersion: r.version,
      expectedPolicyEpoch: r.policyEpoch,
      unknown: true,
    }),
    r,
  )
  const s = step(r, { type: 'RESTORE_UNKNOWN' })
  assert.equal(s.halted, true)
  assert.equal(s.claims[0].attempt.W, '60')
  assert.deepEqual(claim(s, 'GEN-06'), s)
  assert.equal(transition(r, null).outcome, 'MODEL_DENIED')
})

test('STATE-10 grant cap, initial/outbound quotas and immutable snapshots bind independently', () => {
  let s = createModel({
    ...config,
    grantCaps: { TEST_ONLY_G1: '59', TEST_ONLY_G2: '100' },
    maxInitials: 1,
  })
  s = claim(s)
  const denied = reserve(s)
  assert.equal(denied.claims[0].attempt, null)
  assert.deepEqual(claim(denied, 'GEN-06', 'TEST_ONLY_G2'), denied)
  assert.throws(() => createModel({ ...config, projectCap: '01' }))
  assert.throws(() => createModel({ ...config, maxInitials: 6 }))
  let q = createModel({ ...config, maxConcurrency: 2, maxOutbound: 1 })
  q = claim(q)
  q = claim(q, 'GEN-06', 'TEST_ONLY_G2')
  q = reserve(q)
  assert.equal(reserve(q, 'GEN-06', '1').outboundAllocated, 1)
  const cap = claim(createModel({ ...config, projectCap: '60', grantCaps: { TEST_ONLY_G1: '60' } }))
  assert.equal(reserve(cap).claims[0].attempt.W, '60')
})

test('STATE-11 zero outbound quota permits logical/cache claims but never reservation', () => {
  let s = createModel({ ...config, maxOutbound: 0 })
  s = claim(s)
  const denied = reserve(s)
  assert.equal(denied.claims[0].status, 'NO_OUTBOUND_DENIED')
  assert.equal(denied.outboundAllocated, 0)
  assert.equal(denied.occupiedSlots, 0)
  const cached = step(claim(createModel({ ...config, maxOutbound: 0 })), {
    type: 'CACHE_HIT',
    scenarioId: 'GEN-04',
    fixture: 'TEST_ONLY_TRUSTED_HIT',
  })
  assert.equal(cached.claims[0].status, 'CACHE_ONLY_COMPLETE')
})

test('STATE-12 breach receipt identity prevents changed or duplicate receipt from releasing W', () => {
  const flight = gated(gated(ready(), 'PREPARE'), 'DISPATCH')
  const receipt = {
    type: 'SETTLE',
    scenarioId: 'GEN-04',
    amount: '61',
    receiptId: 'TEST_ONLY_BREACH_RECEIPT',
    proof: 'TEST_ONLY_FINAL_RECEIPT',
  }
  const breach = step(flight, receipt)
  assert.deepEqual(step(breach, receipt), breach)
  const conflict = step(breach, { ...receipt, amount: '31' })
  assert.equal(conflict.incidents.at(-1).reason, 'RECEIPT_CONFLICT')
  assert.equal(conflict.claims[0].attempt.status, 'UNKNOWN_QUARANTINED')
  assert.equal(conflict.occupiedSlots, 1)
  assert.equal(conflict.claims[0].attempt.W, '60')
  assert.equal(conflict.project.spent, '0')
  assert.equal(conflict.halted, true)
})
