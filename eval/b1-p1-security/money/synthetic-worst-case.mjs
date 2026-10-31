import {
  parseMicroUsd,
  checkedAdd,
  checkedMultiply,
  blockCharge,
  canReserve,
} from '../../authorization/money/micro-usd.mjs'

const dimensions = ['input', 'output', 'hidden', 'tool']
const closed = (o, f) =>
  !!o &&
  typeof o === 'object' &&
  !Array.isArray(o) &&
  Object.keys(o).length === f.length &&
  f.every((k) => Object.hasOwn(o, k))
const fake = (v) => typeof v === 'string' && /^TEST_ONLY_[A-Za-z0-9_]{1,80}$/.test(v)
const deny = (W = null, perSend = null, reason = 'UNBOUNDED_OR_UNKNOWN') =>
  Object.freeze({
    kind: 'TEST_ONLY_WORST_CASE_ESTIMATE',
    testOnlyW: W,
    testOnlyPerSend: perSend,
    reason,
    operationalDecision: 'DENY',
  })
const quantity = (v) => {
  const n = parseMicroUsd(v)
  if (n > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError('UNSAFE_QUANTITY')
  return n
}
// 4 fake tariff dimensions; fees cover all <=3 sends, including ambiguous billable attempts.
export function estimateSyntheticW(input) {
  try {
    if (!closed(input, ['price', 'bound'])) return deny()
    const { price, bound } = input
    if (
      !closed(price, ['marker', 'model', 'revision', 'tariffs', 'perSendFeeMicroUsd']) ||
      !closed(bound, [
        'marker',
        'model',
        'revision',
        'maxSends',
        'units',
        'allDimensionsAccounted',
      ]) ||
      price.marker !== 'TEST_ONLY_FAKE_TARIFF' ||
      bound.marker !== 'TEST_ONLY_FAKE_BOUND' ||
      !fake(price.model) ||
      !fake(price.revision) ||
      bound.model !== price.model ||
      bound.revision !== price.revision ||
      bound.allDimensionsAccounted !== true ||
      !Number.isSafeInteger(bound.maxSends) ||
      bound.maxSends < 1 ||
      bound.maxSends > 3 ||
      !closed(price.tariffs, dimensions) ||
      !closed(bound.units, dimensions)
    )
      return deny()
    let perSend = parseMicroUsd(price.perSendFeeMicroUsd)
    let nonzero = false
    for (const key of dimensions) {
      const t = price.tariffs[key]
      if (!closed(t, ['blockUnits', 'numeratorUsd', 'denominator'])) return deny()
      const units = quantity(bound.units[key])
      const block = quantity(t.blockUnits)
      const numerator = parseMicroUsd(t.numeratorUsd)
      const denominator = parseMicroUsd(t.denominator)
      if (block === 0n || numerator === 0n || denominator === 0n) return deny()
      nonzero = nonzero || units > 0n
      perSend = checkedAdd(perSend, blockCharge(units, block, numerator, denominator))
    }
    if (!nonzero || perSend === 0n) return deny()
    return deny(
      checkedMultiply(perSend, BigInt(bound.maxSends)).toString(),
      perSend.toString(),
      'TEST_ONLY_FINITE_USING_INVENTED_PRICES',
    )
  } catch {
    return deny()
  }
}
export function inspectSyntheticCaps(input) {
  let fits = false
  try {
    if (
      closed(input, ['project', 'grant', 'testOnlyW']) &&
      closed(input.project, ['cap', 'spent', 'holds']) &&
      closed(input.grant, ['cap', 'spent', 'holds'])
    ) {
      const W = parseMicroUsd(input.testOnlyW)
      fits = W > 0n && canReserve(input.project, input.grant, W)
    }
  } catch {
    fits = false
  }
  return Object.freeze({
    kind: 'TEST_ONLY_DOUBLE_CAP_PREDICATE',
    testOnlyFits: fits,
    operationalDecision: 'DENY',
  })
}
