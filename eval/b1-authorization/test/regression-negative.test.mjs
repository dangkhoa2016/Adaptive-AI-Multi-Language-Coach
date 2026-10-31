import { Buffer } from 'node:buffer'
import { URL } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'
import { denyOperational } from '../../authorization/policy/deny.mjs'
import { parseNonGrantEnvelope } from '../../authorization/wire/strict-json.mjs'
import { createSyntheticLedger, stepSyntheticLedger } from '../ledger/serialized-simulator.mjs'
import { readFileSync } from 'node:fs'

test('B1-REGRESS-01 B0 original policy denies every input', () => {
  for (const value of [undefined, null, {}, { grant: 'TRUSTED' }, true])
    assert.equal(denyOperational(value).decision, 'DENY')
})
test('B1-REGRESS-02 original B0 closed wire projection unchanged', () => {
  assert.equal(Object.keys(parseNonGrantEnvelope(Buffer.from('{}'))).length, 0)
  assert.throws(() => parseNonGrantEnvelope(Buffer.from('{"signature":1}')))
})
test('B1-REGRESS-03 five design pins remain runtime false', () => {
  const f = JSON.parse(
    readFileSync(
      new URL('../../authorization/fixtures/design-pins.reference.json', import.meta.url),
    ),
  )
  assert.equal(f.approved_design_only.length, 5)
  for (const pin of f.approved_design_only) {
    assert.equal(pin.runtime_permission, false)
    assert.equal(pin.decision, 'OWNER_APPROVED_DESIGN_ONLY')
  }
})
test('B1-REGRESS-04 GEN-09 induced fallback and GEN-11 repeat never reserve', () => {
  const state = createSyntheticLedger({
    projectId: 'TEST_ONLY_PROJECT',
    projectCap: '100',
    grantCaps: { TEST_ONLY_GRANT_A: '100' },
  })
  for (const [scenarioId, attemptKind] of [
    ['GEN-09', 'FALLBACK'],
    ['GEN-11', 'REPEAT'],
  ]) {
    const r = stepSyntheticLedger(state, {
      type: 'RESERVE',
      expectedVersion: 0,
      attemptId: 'TEST_ONLY_ATTEMPT_1',
      grantId: 'TEST_ONLY_GRANT_A',
      scenarioId,
      attemptKind,
      W: '1',
    })
    assert.equal(r.outcome, 'TEST_ONLY_DENIED')
    assert.equal(r.operationalDecision, 'DENY')
  }
})
test('B1-REGRESS-05 duplicate initial across grants denied, no extra attempts', () => {
  const s = createSyntheticLedger({
    projectId: 'TEST_ONLY_PROJECT',
    projectCap: '100',
    grantCaps: { TEST_ONLY_GRANT_A: '100', TEST_ONLY_GRANT_B: '100' },
  })
  const first = stepSyntheticLedger(s, {
    type: 'RESERVE',
    expectedVersion: 0,
    attemptId: 'TEST_ONLY_ATTEMPT_1',
    grantId: 'TEST_ONLY_GRANT_A',
    scenarioId: 'GEN-04',
    attemptKind: 'INITIAL',
    W: '1',
  }).state
  const again = stepSyntheticLedger(first, {
    type: 'RESERVE',
    expectedVersion: first.version,
    attemptId: 'TEST_ONLY_ATTEMPT_2',
    grantId: 'TEST_ONLY_GRANT_B',
    scenarioId: 'GEN-04',
    attemptKind: 'INITIAL',
    W: '1',
  })
  assert.equal(again.outcome, 'TEST_ONLY_DENIED')
})
