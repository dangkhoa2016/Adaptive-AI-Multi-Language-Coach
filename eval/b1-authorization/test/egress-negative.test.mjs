import test from 'node:test'
import assert from 'node:assert/strict'
import {
  inspectSyntheticCapabilities,
  assertNoSyntheticEgress,
} from '../egress/negative-capabilities.mjs'

test('B1-EGRESS-01 empty synthetic sandbox capabilities deny operational activity', () => {
  const r = inspectSyntheticCapabilities({ marker: 'TEST_ONLY_CAPABILITY_SCAN', capabilities: [] })
  assert.equal(r.testOnlyNoDangerousCapabilities, true)
  assert.equal(r.operationalDecision, 'DENY')
})
test('B1-EGRESS-02 outbound and persistence capabilities are forbidden', () => {
  for (const name of [
    'fetch',
    'connect',
    'AI',
    'MAIL',
    'DB',
    'KV',
    'QUEUE',
    'SERVICE',
    'PROVIDER_SECRET',
    'WEBSOCKET',
  ]) {
    const r = inspectSyntheticCapabilities({
      marker: 'TEST_ONLY_CAPABILITY_SCAN',
      capabilities: [name],
    })
    assert.equal(r.testOnlyNoDangerousCapabilities, false, name)
    assert.equal(r.operationalDecision, 'DENY')
  }
})
test('B1-EGRESS-03 unknown capability cannot silently become allowed', () => {
  assert.equal(
    inspectSyntheticCapabilities({
      marker: 'TEST_ONLY_CAPABILITY_SCAN',
      capabilities: ['UNREVIEWED'],
    }).testOnlyNoDangerousCapabilities,
    false,
  )
  assert.equal(
    inspectSyntheticCapabilities({
      marker: 'TEST_ONLY_CAPABILITY_SCAN',
      capabilities: ['readFixture', 'fetch'],
    }).testOnlyNoDangerousCapabilities,
    false,
  )
  assert.equal(
    inspectSyntheticCapabilities({ marker: 'REAL_CAPABILITY_SCAN', capabilities: [] })
      .testOnlyNoDangerousCapabilities,
    false,
  )
})
test('B1-EGRESS-04 no outbound callback can be invoked by the synthetic blocker', () => {
  let invoked = 0
  const trap = () => {
    invoked++
    return 'SHOULD_NOT_RUN'
  }
  assert.throws(() => assertNoSyntheticEgress(trap), /NO_EGRESS_TEST_ONLY/)
  assert.equal(invoked, 0)
})
