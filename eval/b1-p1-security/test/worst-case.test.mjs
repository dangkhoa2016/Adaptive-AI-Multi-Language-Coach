import test from 'node:test'
import assert from 'node:assert/strict'
import { estimateSyntheticW, inspectSyntheticCaps } from '../money/synthetic-worst-case.mjs'
import { makeSyntheticContext } from '../fixtures/paper.synthetic.mjs'

const setup = () => makeSyntheticContext().money
test('P1-IAR03-01 fake worst case includes 4 dimensions + per-send fee x 3', () => {
  const s = setup(),
    r = estimateSyntheticW(s)
  assert.equal(r.testOnlyPerSend, '6')
  assert.equal(r.testOnlyW, '18')
  assert.equal(r.operationalDecision, 'DENY')
})
test('P1-IAR03-02 charge every send including potentially billable retry', () => {
  const s = setup()
  for (const [maxSends, expected] of [
    [1, '6'],
    [2, '12'],
    [3, '18'],
  ]) {
    assert.equal(estimateSyntheticW({ ...s, bound: { ...s.bound, maxSends } }).testOnlyW, expected)
  }
})
test('P1-IAR03-03 missing, unknown or renamed billing dimension cannot be priced', () => {
  const s = setup()
  const missing = { ...s.bound.units }
  delete missing.hidden
  assert.equal(estimateSyntheticW({ ...s, bound: { ...s.bound, units: missing } }).testOnlyW, null)
  assert.equal(
    estimateSyntheticW({ ...s, bound: { ...s.bound, units: { ...s.bound.units, extra: '1' } } })
      .testOnlyW,
    null,
  )
  assert.equal(
    estimateSyntheticW({
      ...s,
      price: { ...s.price, tariffs: { ...s.price.tariffs, unknown: s.price.tariffs.tool } },
    }).testOnlyW,
    null,
  )
})
test('P1-IAR03-04 price schedule, model, revision or coverage ambiguity fail closed', () => {
  const s = setup()
  for (const v of [
    { ...s, price: { ...s.price, marker: 'REAL_PRICE' } },
    { ...s, bound: { ...s.bound, revision: 'TEST_ONLY_WRONG' } },
    { ...s, bound: { ...s.bound, allDimensionsAccounted: false } },
    { ...s, price: { ...s.price, model: 'REAL_MODEL' } },
    { ...s, bound: { ...s.bound, extraTokens: '1' } },
  ])
    assert.equal(estimateSyntheticW(v).testOnlyW, null)
})
test('P1-IAR03-05 zero units, zero block, zero rate or unknown fee fail closed', () => {
  const s = setup()
  for (const v of [
    { ...s, bound: { ...s.bound, units: { input: '0', output: '0', hidden: '0', tool: '0' } } },
    {
      ...s,
      price: {
        ...s.price,
        tariffs: { ...s.price.tariffs, input: { ...s.price.tariffs.input, blockUnits: '0' } },
      },
    },
    {
      ...s,
      price: {
        ...s.price,
        tariffs: { ...s.price.tariffs, output: { ...s.price.tariffs.output, numeratorUsd: '0' } },
      },
    },
    { ...s, price: { ...s.price, perSendFeeMicroUsd: null } },
  ])
    assert.equal(estimateSyntheticW(v).testOnlyW, null)
})
test('P1-IAR03-06 attempts outside 1..3 denied; 429 unverified not free', () => {
  const s = setup()
  for (const maxSends of [0, 4, -1, NaN, 1.3]) {
    assert.equal(estimateSyntheticW({ ...s, bound: { ...s.bound, maxSends } }).testOnlyW, null)
  }
})
test('P1-IAR03-07 unsafe units and overflow fail closed', () => {
  const s = setup()
  for (const input of ['9007199254740993', '-1', '1.0', '9223372036854775808']) {
    assert.equal(
      estimateSyntheticW({ ...s, bound: { ...s.bound, units: { ...s.bound.units, input } } })
        .testOnlyW,
      null,
    )
  }
})
test('P1-IAR03-08 independently rounded 4 categories (not joined) change output', () => {
  const s = setup()
  const tariffs = {
    ...s.price.tariffs,
    tool: { blockUnits: '100', numeratorUsd: '1', denominator: '1000000' },
  }
  assert.equal(estimateSyntheticW({ ...s, price: { ...s.price, tariffs } }).testOnlyW, '45')
})
test('P1-IAR03-09 project AND grant caps must both hold 18 fake microUSD', () => {
  const r = estimateSyntheticW(setup())
  const project = { cap: 100n, spent: 10n, holds: [60n] }
  const grant = { cap: 25n, spent: 5n, holds: [2n] }
  assert.equal(inspectSyntheticCaps({ project, grant, testOnlyW: r.testOnlyW }).testOnlyFits, true)
  assert.equal(
    inspectSyntheticCaps({ project, grant: { ...grant, holds: [3n] }, testOnlyW: r.testOnlyW })
      .testOnlyFits,
    false,
  )
  assert.equal(
    inspectSyntheticCaps({ project: { ...project, holds: [73n] }, grant, testOnlyW: r.testOnlyW })
      .testOnlyFits,
    false,
  )
})
test('P1-IAR03-10 null W, missing accounts or malformed caps deny', () => {
  const s = setup(),
    W = estimateSyntheticW(s).testOnlyW
  for (const input of [
    {},
    { testOnlyW: W },
    { testOnlyW: '0', project: {}, grant: {} },
    { testOnlyW: '18.0', project: {}, grant: {} },
  ]) {
    assert.equal(inspectSyntheticCaps(input).testOnlyFits, false)
    assert.equal(inspectSyntheticCaps(input).operationalDecision, 'DENY')
  }
})

test('P1-IAR03-11 extra cap attributes cannot produce a positive observation', () => {
  const s = makeSyntheticContext()
  const project = { ...s.caps.project, operationalPermit: true }
  const r = inspectSyntheticCaps({ project, grant: s.caps.grant, testOnlyW: '18' })
  assert.equal(r.testOnlyFits, false)
  assert.equal(r.operationalDecision, 'DENY')
})

test('P1-IAR03-12 hostile top-level getter cannot throw from W observation', () => {
  const evil = Object.defineProperty({}, 'price', {
    get() {
      throw new Error('TEST_ONLY_GETTER')
    },
  })
  assert.doesNotThrow(() => estimateSyntheticW(evil))
  assert.equal(estimateSyntheticW(evil).testOnlyW, null)
})
