import {
  parseMicroUsd,
  checkedAdd,
  checkedMultiply,
  blockCharge,
  canReserve,
} from '../../authorization/money/micro-usd.mjs'

const result = (W = null) =>
  Object.freeze({ kind: 'TEST_ONLY_FAKE_W', testOnlyFiniteW: W, operationalDecision: 'DENY' })
const keys = (obj, expected) =>
  obj &&
  typeof obj === 'object' &&
  !Array.isArray(obj) &&
  Object.keys(obj).length === expected.length &&
  expected.every((key) => Object.hasOwn(obj, key))
const scheduleKeys = [
  'marker',
  'model',
  'revision',
  'blockUnits',
  'priceNumeratorUsd',
  'priceDenominator',
]
const boundKeys = [
  'marker',
  'model',
  'revision',
  'inputUnits',
  'outputUnits',
  'hiddenUnits',
  'maxSends',
  'covered',
]
const synthetic = (x) => typeof x === 'string' && /^TEST_ONLY_[A-Za-z0-9_]+$/.test(x)
const safeUnits = (x) => {
  const number = parseMicroUsd(x)
  if (number > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError('TEST_ONLY_UNIT_TOO_LARGE')
  return number
}

// These are fake units/prices, not any real provider's billable tokens or dollar schedule.
export function computeSyntheticW({ schedule, bound } = {}) {
  try {
    if (
      !keys(schedule, scheduleKeys) ||
      !keys(bound, boundKeys) ||
      schedule.marker !== 'TEST_ONLY_FAKE_PRICE_SCHEDULE' ||
      bound.marker !== 'TEST_ONLY_BILLABLE_BOUND' ||
      !synthetic(schedule.model) ||
      !synthetic(schedule.revision) ||
      bound.model !== schedule.model ||
      bound.revision !== schedule.revision ||
      !Array.isArray(bound.covered) ||
      bound.covered.length !== 3 ||
      bound.covered[0] !== 'input' ||
      bound.covered[1] !== 'output' ||
      bound.covered[2] !== 'hidden' ||
      !Number.isInteger(bound.maxSends) ||
      bound.maxSends < 1 ||
      bound.maxSends > 3
    )
      return result()
    const input = safeUnits(bound.inputUnits)
    const output = safeUnits(bound.outputUnits)
    const hidden = safeUnits(bound.hiddenUnits)
    const all = checkedAdd(checkedAdd(input, output), hidden)
    if (all === 0n) return result()
    const blocks = safeUnits(schedule.blockUnits)
    const numerator = safeUnits(schedule.priceNumeratorUsd)
    const denominator = safeUnits(schedule.priceDenominator)
    if (blocks === 0n || numerator === 0n || denominator === 0n) return result()
    const perSend = blockCharge(all, blocks, numerator, denominator)
    return result(checkedMultiply(perSend, BigInt(bound.maxSends)).toString())
  } catch {
    return result()
  }
}

export function assessSyntheticReservation({ project, grant, W } = {}) {
  return Object.freeze({
    kind: 'TEST_ONLY_RESERVATION_PREDICATE',
    testOnlyFits: canReserve(project, grant, W),
    operationalDecision: 'DENY',
  })
}
