import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  parseMicroUsd,
  checkedAdd,
  checkedMultiply,
  ceilRatio,
  blockCharge,
  canReserve,
} from '../money/micro-usd.mjs'
const MAX = 9223372036854775807n

test('MONEY-01 canonical decimal range roundtrips exactly as BigInt', () => {
  for (const s of ['0', '1', '9007199254740993', '9223372036854775807'])
    assert.equal(parseMicroUsd(s).toString(), s)
  for (const s of [
    '',
    '00',
    '01',
    '-0',
    '-1',
    '+1',
    '1.0',
    '1e3',
    ' 1',
    '1\n',
    '9223372036854775808',
    '99999999999999999999',
    1,
    1n,
    null,
    undefined,
  ])
    assert.throws(() => parseMicroUsd(s))
})

test('MONEY-02 checked arithmetic rejects types, negative and overflowing intermediates', () => {
  assert.equal(checkedAdd(MAX - 1n, 1n), MAX)
  assert.equal(checkedMultiply(MAX, 0n), 0n)
  assert.equal(checkedMultiply(3n, 7n), 21n)
  for (const f of [
    () => checkedAdd(MAX, 1n),
    () => checkedMultiply(MAX, 2n),
    () => checkedAdd(-1n, 1n),
    () => checkedMultiply(1, 2n),
    () => checkedAdd(MAX + 1n, 0n),
  ])
    assert.throws(f)
})

test('MONEY-03 rational ceilings and invented block units are exact and conservative', () => {
  for (const [a, b, want] of [
    [0n, 3n, 0n],
    [1n, 3n, 1n],
    [6n, 3n, 2n],
    [7n, 3n, 3n],
    [MAX, 1n, MAX],
  ])
    assert.equal(ceilRatio(a, b), want)
  assert.equal(blockCharge(11n, 10n, 1n, 3n), 666667n)
  assert.equal(blockCharge(0n, 10n, 1n, 3n), 0n)
  assert.throws(() => ceilRatio(1n, 0n))
  assert.throws(() => blockCharge(1n, 0n, 1n, 1n))
  assert.throws(() => blockCharge(MAX, 1n, 2n, MAX))
})

test('MONEY-04 both project and grant include all outstanding holds and exact equality', () => {
  const fixtures = JSON.parse(
    readFileSync(new URL('../fixtures/accounting-cases.synthetic.json', import.meta.url)),
  )
  assert.equal(fixtures.kind, 'TEST_ONLY_INVENTED_UNITS_NOT_PRICING')
  const account = (x) => ({
    cap: BigInt(x.cap),
    spent: BigInt(x.spent),
    holds: x.holds.map(BigInt),
  })
  for (const row of fixtures.reservations)
    assert.equal(
      canReserve(account(row.project), account(row.grant), BigInt(row.W)),
      row.want,
      row.id,
    )
  assert.equal(
    canReserve({ cap: MAX, spent: MAX, holds: [1n] }, { cap: MAX, spent: 0n, holds: [] }, 0n),
    false,
  )
  assert.equal(canReserve({}, {}, undefined), false)
  assert.equal(
    canReserve({ cap: 10n, spent: 0n, holds: [] }, { cap: 10n, spent: 0n, holds: [] }, '1'),
    false,
  )
})
