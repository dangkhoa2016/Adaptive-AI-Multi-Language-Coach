import test from 'node:test'
import assert from 'node:assert/strict'
import { createSyntheticLedger, stepSyntheticLedger } from '../ledger/serialized-simulator.mjs'
import { createSyntheticAnchor, appendSyntheticAnchor } from '../audit/anchor-simulator.mjs'

const make = () =>
  createSyntheticLedger({
    projectId: 'TEST_ONLY_PROJECT',
    projectCap: '10',
    grantCaps: { TEST_ONLY_GRANT_A: '8', TEST_ONLY_GRANT_B: '8' },
  })
const reserve = (state, overrides = {}) =>
  stepSyntheticLedger(state, {
    type: 'RESERVE',
    expectedVersion: state.version,
    attemptId: 'TEST_ONLY_ATTEMPT_1',
    grantId: 'TEST_ONLY_GRANT_A',
    scenarioId: 'GEN-04',
    attemptKind: 'INITIAL',
    W: '6',
    ...overrides,
  })

test('B1-RECOVERY-01 reserve is synthetic, serialized and always operational DENY', () => {
  const s = make(),
    r = reserve(s)
  assert.equal(r.outcome, 'TEST_ONLY_RESERVED')
  assert.equal(r.operationalDecision, 'DENY')
  assert.equal(s.version, 0)
  assert.equal(r.state.holds.TEST_ONLY_ATTEMPT_1.W, '6')
  assert.equal(Object.isFrozen(r.state), true)
})
test('B1-RECOVERY-02 stale concurrent CAS and cross-grant budget race denied', () => {
  const s = make(),
    a = reserve(s)
  const stale = stepSyntheticLedger(a.state, {
    type: 'RESERVE',
    expectedVersion: 0,
    attemptId: 'TEST_ONLY_ATTEMPT_2',
    grantId: 'TEST_ONLY_GRANT_B',
    scenarioId: 'GEN-06',
    attemptKind: 'INITIAL',
    W: '6',
  })
  assert.equal(stale.outcome, 'TEST_ONLY_DENIED')
  const current = stepSyntheticLedger(a.state, {
    type: 'RESERVE',
    expectedVersion: a.state.version,
    attemptId: 'TEST_ONLY_ATTEMPT_2',
    grantId: 'TEST_ONLY_GRANT_B',
    scenarioId: 'GEN-06',
    attemptKind: 'INITIAL',
    W: '6',
  })
  assert.equal(current.outcome, 'TEST_ONLY_DENIED')
})
test('B1-RECOVERY-03 UNKNOWN holds W and globally halts, no blind retry', () => {
  const first = reserve(make()).state
  const lost = stepSyntheticLedger(first, {
    type: 'UNKNOWN',
    expectedVersion: first.version,
    attemptId: 'TEST_ONLY_ATTEMPT_1',
  })
  assert.equal(lost.state.halted, true)
  assert.equal(lost.state.holds.TEST_ONLY_ATTEMPT_1.W, '6')
  assert.equal(
    reserve(lost.state, { attemptId: 'TEST_ONLY_ATTEMPT_2', scenarioId: 'GEN-06' }).outcome,
    'TEST_ONLY_DENIED',
  )
})
test('B1-RECOVERY-04 kill fences modeled dispatch while retaining outstanding hold', () => {
  const first = reserve(make()).state
  const killed = stepSyntheticLedger(first, { type: 'KILL', expectedVersion: first.version })
  assert.equal(killed.state.killed, true)
  assert.equal(killed.state.holds.TEST_ONLY_ATTEMPT_1.W, '6')
  assert.equal(
    stepSyntheticLedger(killed.state, {
      type: 'DISPATCH',
      expectedVersion: killed.state.version,
      attemptId: 'TEST_ONLY_ATTEMPT_1',
    }).outcome,
    'TEST_ONLY_DENIED',
  )
})
test('B1-RECOVERY-05 fake audit chain and ACK do not confer durable trust', () => {
  const seed = createSyntheticAnchor('TEST_ONLY_ANCHOR_SEED')
  const event = appendSyntheticAnchor(seed, { marker: 'TEST_ONLY_AUDIT_EVENT', sequence: 1 })
  assert.equal(event.operationalDecision, 'DENY')
  assert.equal(event.testOnlyAck, 'TEST_ONLY_ANCHOR_ACK')
  assert.equal(event.sequence, 1)
  assert.notEqual(event.hash, seed.hash)
})
test('B1-RECOVERY-06 dispatch state needs prepare and synthetic anchor ACK, no physical send', () => {
  const a = reserve(make()).state
  const raw = stepSyntheticLedger(a, {
    type: 'DISPATCH',
    expectedVersion: a.version,
    attemptId: 'TEST_ONLY_ATTEMPT_1',
  })
  assert.equal(raw.outcome, 'TEST_ONLY_DENIED')
  const pre = stepSyntheticLedger(a, {
    type: 'PREPARE',
    expectedVersion: a.version,
    attemptId: 'TEST_ONLY_ATTEMPT_1',
  }).state
  const ack = stepSyntheticLedger(pre, {
    type: 'ACK_ANCHOR',
    expectedVersion: pre.version,
    attemptId: 'TEST_ONLY_ATTEMPT_1',
    marker: 'TEST_ONLY_ANCHOR_ACK',
  }).state
  const dispatched = stepSyntheticLedger(ack, {
    type: 'DISPATCH',
    expectedVersion: ack.version,
    attemptId: 'TEST_ONLY_ATTEMPT_1',
  })
  assert.equal(dispatched.outcome, 'TEST_ONLY_MODELED_DISPATCH')
  assert.equal(dispatched.operationalDecision, 'DENY')
})
test('B1-RECOVERY-07 unknown restored continuity remains halted', () => {
  const s = reserve(make()).state
  const r = stepSyntheticLedger(s, { type: 'RESTORE_UNKNOWN', expectedVersion: s.version })
  assert.equal(r.state.halted, true)
  assert.equal(r.state.holds.TEST_ONLY_ATTEMPT_1.W, '6')
})

test('B1-RECOVERY-08 synthetic overspend halts and preserves hold', () => {
  const a = reserve(make()).state
  const b = stepSyntheticLedger(a, {
    type: 'PREPARE',
    expectedVersion: a.version,
    attemptId: 'TEST_ONLY_ATTEMPT_1',
  }).state
  const c = stepSyntheticLedger(b, {
    type: 'ACK_ANCHOR',
    expectedVersion: b.version,
    attemptId: 'TEST_ONLY_ATTEMPT_1',
    marker: 'TEST_ONLY_ANCHOR_ACK',
  }).state
  const e = stepSyntheticLedger(c, {
    type: 'DISPATCH',
    expectedVersion: c.version,
    attemptId: 'TEST_ONLY_ATTEMPT_1',
  }).state
  const result = stepSyntheticLedger(e, {
    type: 'SETTLE',
    expectedVersion: e.version,
    attemptId: 'TEST_ONLY_ATTEMPT_1',
    amount: '7',
    receiptMarker: 'TEST_ONLY_FAKE_FINAL_RECEIPT',
  })
  assert.equal(result.outcome, 'TEST_ONLY_OVER_W_HALTED')
  assert.equal(result.state.halted, true)
  assert.equal(result.state.holds.TEST_ONLY_ATTEMPT_1.W, '6')
  assert.equal(result.state.projectSpent, '0')
})
test('B1-RECOVERY-09 synthetic final settlement transitions without real billing', () => {
  const a = reserve(make()).state
  const b = stepSyntheticLedger(a, {
    type: 'PREPARE',
    expectedVersion: a.version,
    attemptId: 'TEST_ONLY_ATTEMPT_1',
  }).state
  const c = stepSyntheticLedger(b, {
    type: 'ACK_ANCHOR',
    expectedVersion: b.version,
    attemptId: 'TEST_ONLY_ATTEMPT_1',
    marker: 'TEST_ONLY_ANCHOR_ACK',
  }).state
  const e = stepSyntheticLedger(c, {
    type: 'DISPATCH',
    expectedVersion: c.version,
    attemptId: 'TEST_ONLY_ATTEMPT_1',
  }).state
  const settled = stepSyntheticLedger(e, {
    type: 'SETTLE',
    expectedVersion: e.version,
    attemptId: 'TEST_ONLY_ATTEMPT_1',
    amount: '4',
    receiptMarker: 'TEST_ONLY_FAKE_FINAL_RECEIPT',
  })
  assert.equal(settled.outcome, 'TEST_ONLY_SETTLED')
  assert.equal(settled.state.projectSpent, '4')
  assert.equal(settled.state.grants.TEST_ONLY_GRANT_A.spent, '4')
  assert.equal(settled.state.holds.TEST_ONLY_ATTEMPT_1.status, 'SETTLED')
  assert.equal(settled.operationalDecision, 'DENY')
})
test('B1-RECOVERY-10 revoked grant prevents further modeled dispatch', () => {
  const s = reserve(make()).state
  const revoked = stepSyntheticLedger(s, {
    type: 'REVOKE',
    expectedVersion: s.version,
    grantId: 'TEST_ONLY_GRANT_A',
  })
  assert.equal(revoked.state.revoked.includes('TEST_ONLY_GRANT_A'), true)
  assert.equal(
    stepSyntheticLedger(revoked.state, {
      type: 'PREPARE',
      expectedVersion: revoked.state.version,
      attemptId: 'TEST_ONLY_ATTEMPT_1',
    }).outcome,
    'TEST_ONLY_DENIED',
  )
  assert.equal(revoked.state.holds.TEST_ONLY_ATTEMPT_1.W, '6')
})
test('B1-RECOVERY-11 unsigned anchor marker and late after-kill ACK denied', () => {
  const s = reserve(make()).state
  const prepared = stepSyntheticLedger(s, {
    type: 'PREPARE',
    expectedVersion: s.version,
    attemptId: 'TEST_ONLY_ATTEMPT_1',
  }).state
  assert.equal(
    stepSyntheticLedger(prepared, {
      type: 'ACK_ANCHOR',
      expectedVersion: prepared.version,
      attemptId: 'TEST_ONLY_ATTEMPT_1',
      marker: 'REAL_ANCHOR',
    }).outcome,
    'TEST_ONLY_DENIED',
  )
  const killed = stepSyntheticLedger(prepared, {
    type: 'KILL',
    expectedVersion: prepared.version,
  }).state
  assert.equal(
    stepSyntheticLedger(killed, {
      type: 'ACK_ANCHOR',
      expectedVersion: killed.version,
      attemptId: 'TEST_ONLY_ATTEMPT_1',
      marker: 'TEST_ONLY_ANCHOR_ACK',
    }).outcome,
    'TEST_ONLY_DENIED',
  )
})
test('B1-RECOVERY-12 unknown identities and unsigned values cannot reserve', () => {
  const s = make()
  for (const overrides of [
    { attemptId: 'ATTEMPT_1' },
    { grantId: 'REAL_GRANT' },
    { scenarioId: 'GEN-10' },
    { W: '0' },
    { W: '9223372036854775808' },
    { attemptKind: 'REPEAT' },
    { expectedVersion: 1 },
  ])
    assert.equal(reserve(s, overrides).outcome, 'TEST_ONLY_DENIED')
})
