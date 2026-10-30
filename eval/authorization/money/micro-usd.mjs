const MAX = 9223372036854775807n

function checked(value) {
  if (typeof value !== 'bigint' || value < 0n || value > MAX) {
    throw new RangeError('MICRO_USD_RANGE_OR_TYPE')
  }
  return value
}

export function parseMicroUsd(value) {
  if (typeof value !== 'string' || !/^(?:0|[1-9][0-9]{0,18})$/.test(value)) {
    throw new TypeError('MICRO_USD_DECIMAL')
  }
  return checked(BigInt(value))
}

export function checkedAdd(left, right) {
  return checked(checked(left) + checked(right))
}

export function checkedMultiply(left, right) {
  return checked(checked(left) * checked(right))
}

export function ceilRatio(numerator, denominator) {
  checked(numerator)
  checked(denominator)
  if (denominator === 0n) throw new RangeError('ZERO_DENOMINATOR')
  const quotient = numerator / denominator
  return numerator % denominator === 0n ? quotient : checkedAdd(quotient, 1n)
}

// Pure invented-unit formula: ceil(ceil(q/u) * a * 1000000 / b).
// Checked intermediates intentionally reject overflow even if division would reduce it.
export function blockCharge(units, blockUnits, numeratorUsd, denominator) {
  const blocks = ceilRatio(units, blockUnits)
  return ceilRatio(checkedMultiply(checkedMultiply(blocks, numeratorUsd), 1000000n), denominator)
}

export function canReserve(project, grant, W) {
  try {
    checked(W)
    const fits = (account) => {
      if (!account || !Array.isArray(account.holds)) return false
      checked(account.cap)
      let total = checked(account.spent)
      for (const hold of account.holds) total = checkedAdd(total, hold)
      return checkedAdd(total, W) <= account.cap
    }
    return fits(project) && fits(grant)
  } catch {
    return false
  }
}
