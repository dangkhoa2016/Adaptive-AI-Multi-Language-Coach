import test from 'node:test'
import assert from 'node:assert/strict'
import { computeSyntheticW, assessSyntheticReservation } from '../money/finite-w-gate.mjs'

const schedule = Object.freeze({
  marker: 'TEST_ONLY_FAKE_PRICE_SCHEDULE',
  model: 'TEST_ONLY_MODEL',
  revision: 'TEST_ONLY_REV_1',
  blockUnits: '1000',
  priceNumeratorUsd: '1',
  priceDenominator: '1000000',
})
const bound = Object.freeze({
  marker: 'TEST_ONLY_BILLABLE_BOUND',
  model: 'TEST_ONLY_MODEL',
  revision: 'TEST_ONLY_REV_1',
  inputUnits: '900',
  outputUnits: '100',
  hiddenUnits: '1000',
  maxSends: 3,
  covered: ['input', 'output', 'hidden'],
})

test('B1-COST-01 finite invented W covers hidden units and all sends, still DENY', () => {
  const r = computeSyntheticW({ schedule, bound })
  assert.equal(r.testOnlyFiniteW, '6')
  assert.equal(r.operationalDecision, 'DENY')
  assert.equal(r.kind, 'TEST_ONLY_FAKE_W')
})
test('B1-COST-02 undefined price/model/revision and missing hidden bound denied', () => {
  const variants = [
    { schedule: null, bound },
    { schedule: { ...schedule, marker: 'REAL_PRICE' }, bound },
    { schedule, bound: { ...bound, model: 'TEST_ONLY_UNKNOWN' } },
    { schedule, bound: { ...bound, hiddenUnits: undefined } },
    { schedule, bound: { ...bound, covered: ['input', 'output'] } },
    { schedule, bound: { ...bound, extra: 'new billing dimension' } },
  ]
  for (const item of variants) assert.equal(computeSyntheticW(item).testOnlyFiniteW, null)
})
test('B1-COST-03 multi-send key rotation worst-case reserved', () => {
  assert.equal(
    computeSyntheticW({ schedule, bound: { ...bound, maxSends: 1 } }).testOnlyFiniteW,
    '2',
  )
  assert.equal(
    computeSyntheticW({ schedule, bound: { ...bound, maxSends: 3 } }).testOnlyFiniteW,
    '6',
  )
  assert.equal(
    computeSyntheticW({ schedule, bound: { ...bound, maxSends: 0 } }).testOnlyFiniteW,
    null,
  )
  assert.equal(
    computeSyntheticW({ schedule, bound: { ...bound, maxSends: 4 } }).testOnlyFiniteW,
    null,
  )
})
test('B1-COST-04 overflow and unsafe integers fail closed', () => {
  for (const v of ['9223372036854775807', '-1', '1.1', '9007199254740993']) {
    const r = computeSyntheticW({ schedule, bound: { ...bound, inputUnits: v } })
    assert.equal(r.testOnlyFiniteW, null)
  }
})
test('B1-COST-05 simultaneous project AND grant caps mandatory', () => {
  const project = { cap: 10n, spent: 1n, holds: [3n] }
  const grant = { cap: 6n, spent: 1n, holds: [2n] }
  assert.equal(assessSyntheticReservation({ project, grant, W: 3n }).testOnlyFits, true)
  assert.equal(assessSyntheticReservation({ project, grant, W: 4n }).testOnlyFits, false)
  assert.equal(assessSyntheticReservation({ project, grant: null, W: 3n }).testOnlyFits, false)
  assert.equal(assessSyntheticReservation({ project, grant, W: 3n }).operationalDecision, 'DENY')
})

test('B1-COST-06 invalid block pricing and no monetary proof fail closed', () => {
  const invalid = [
    { ...schedule, blockUnits: '0' },
    { ...schedule, priceNumeratorUsd: '0' },
    { ...schedule, priceDenominator: '0' },
    { ...schedule, model: 'REAL_MODEL' },
    { ...schedule, priceNumeratorUsd: 'not_a_decimal' },
  ]
  for (const entry of invalid)
    assert.equal(computeSyntheticW({ schedule: entry, bound }).testOnlyFiniteW, null)
})

test('B1-COST-07 comma alias cannot spoof coverage fields', () => {
  const invalid = [['input,output', 'hidden'], ['input', 'output,hidden'], ['input,output,hidden']]
  for (const covered of invalid) {
    assert.equal(
      computeSyntheticW({ schedule, bound: { ...bound, covered } }).testOnlyFiniteW,
      null,
    )
  }
})

test('B1-COST-08 zero billed units cannot establish a positive conservative W', () => {
  const empty = { ...bound, inputUnits: '0', outputUnits: '0', hiddenUnits: '0' }
  assert.equal(computeSyntheticW({ schedule, bound: empty }).testOnlyFiniteW, null)
})
