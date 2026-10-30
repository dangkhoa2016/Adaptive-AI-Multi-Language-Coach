import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { denyOperational } from '../policy/deny.mjs'

test('POLICY-01 absent, malformed and apparently approved metadata always DENY', () => {
  for (const value of [
    undefined,
    null,
    true,
    0,
    'AUTHORIZED_CAPTURE',
    {},
    { phase: 'B0', cacheHit: true },
    { phase: 'PHASE_C', authority: true, valid: true },
    { cacheHit: true, isFallback: true, proof: 'TEST_ONLY_HYPOTHETICAL_BOUND' },
  ]) {
    assert.deepEqual(denyOperational(value), { decision: 'DENY', reason: 'B0_NON_OPERATIVE' })
  }
})

test('POLICY-02 all five historical design pins remain DENY', () => {
  const pins = JSON.parse(
    readFileSync(new URL('../fixtures/design-pins.reference.json', import.meta.url)),
  )
  assert.equal(pins.approved_design_only.length, 5)
  for (const pin of pins.approved_design_only) {
    assert.equal(pin.runtime_permission, false)
    assert.equal(denyOperational(pin).decision, 'DENY')
    assert.equal(
      denyOperational({ ...pin, runtime_permission: true, phase: 'S0_CONTROLLED_SMOKE' }).decision,
      'DENY',
    )
  }
})

test('POLICY-03 input getters, proxies and functions are never invoked as authority', () => {
  const hostile = new Proxy(
    {},
    {
      get() {
        throw new Error('input inspected')
      },
      ownKeys() {
        throw new Error('input inspected')
      },
    },
  )
  assert.equal(denyOperational(hostile).decision, 'DENY')
  assert.equal(
    denyOperational(() => {
      throw new Error('callback invoked')
    }).decision,
    'DENY',
  )
  const verdict = denyOperational({})
  assert.ok(Object.isFrozen(verdict))
  assert.throws(() => {
    verdict.decision = 'CHANGED'
  }, TypeError)
  assert.equal(denyOperational({}).decision, 'DENY')
})
