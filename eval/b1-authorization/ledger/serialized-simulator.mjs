import { parseMicroUsd, canReserve, checkedAdd } from '../../authorization/money/micro-usd.mjs'

// Pure sequential immutable state simulator. No storage, concurrency primitive, network,
// key, provider SDK, grant, time authority or operational dispatch implementation.
const scenarios = new Set(['GEN-04', 'GEN-06', 'GEN-07', 'GEN-09', 'GEN-11'])
const fakeId = (x) => typeof x === 'string' && /^TEST_ONLY_[A-Za-z0-9_]{1,100}$/.test(x)
const own = (o, k) => Object.hasOwn(o, k)
function exact(obj, fields) {
  return (
    obj &&
    typeof obj === 'object' &&
    !Array.isArray(obj) &&
    Object.keys(obj).length === fields.length &&
    fields.every((k) => own(obj, k))
  )
}
function deepFreeze(obj) {
  if (obj && typeof obj === 'object' && !Object.isFrozen(obj)) {
    for (const v of Object.values(obj)) deepFreeze(v)
    Object.freeze(obj)
  }
  return obj
}
const deny = (state) =>
  Object.freeze({ state, outcome: 'TEST_ONLY_DENIED', operationalDecision: 'DENY' })
const accepted = (state, outcome) =>
  Object.freeze({
    state: deepFreeze(state),
    outcome,
    operationalDecision: 'DENY',
  })
function accounts(state, grantId) {
  const active = Object.values(state.holds).filter((h) => h.status !== 'SETTLED')
  return {
    project: {
      cap: parseMicroUsd(state.projectCap),
      spent: parseMicroUsd(state.projectSpent),
      holds: active.map((h) => parseMicroUsd(h.W)),
    },
    grant: {
      cap: parseMicroUsd(state.grants[grantId].cap),
      spent: parseMicroUsd(state.grants[grantId].spent),
      holds: active.filter((h) => h.grantId === grantId).map((h) => parseMicroUsd(h.W)),
    },
  }
}
export function createSyntheticLedger(config) {
  if (
    !exact(config, ['projectId', 'projectCap', 'grantCaps']) ||
    !fakeId(config.projectId) ||
    !config.grantCaps ||
    Array.isArray(config.grantCaps) ||
    typeof config.grantCaps !== 'object' ||
    Object.keys(config.grantCaps).length < 1 ||
    Object.keys(config.grantCaps).length > 5
  ) {
    throw new TypeError('TEST_ONLY_LEDGER_CONFIG')
  }
  parseMicroUsd(config.projectCap)
  const grants = Object.create(null)
  for (const [id, cap] of Object.entries(config.grantCaps)) {
    if (!fakeId(id)) throw new TypeError('TEST_ONLY_GRANT_ID')
    parseMicroUsd(cap)
    grants[id] = { cap, spent: '0' }
  }
  return deepFreeze({
    kind: 'TEST_ONLY_LOCAL_LEDGER',
    operationalDecision: 'DENY',
    projectId: config.projectId,
    projectCap: config.projectCap,
    projectSpent: '0',
    grants,
    holds: Object.create(null),
    claims: [],
    revoked: [],
    version: 0,
    halted: false,
    killed: false,
  })
}
const expectedFields = Object.freeze({
  RESERVE: ['type', 'expectedVersion', 'attemptId', 'grantId', 'scenarioId', 'attemptKind', 'W'],
  PREPARE: ['type', 'expectedVersion', 'attemptId'],
  ACK_ANCHOR: ['type', 'expectedVersion', 'attemptId', 'marker'],
  DISPATCH: ['type', 'expectedVersion', 'attemptId'],
  UNKNOWN: ['type', 'expectedVersion', 'attemptId'],
  SETTLE: ['type', 'expectedVersion', 'attemptId', 'amount', 'receiptMarker'],
  KILL: ['type', 'expectedVersion'],
  REVOKE: ['type', 'expectedVersion', 'grantId'],
  RESTORE_UNKNOWN: ['type', 'expectedVersion'],
})
export function stepSyntheticLedger(state, event) {
  if (
    !state ||
    state.kind !== 'TEST_ONLY_LOCAL_LEDGER' ||
    state.operationalDecision !== 'DENY' ||
    !Object.isFrozen(state) ||
    !event ||
    typeof event !== 'object' ||
    !own(expectedFields, event.type) ||
    !exact(event, expectedFields[event.type]) ||
    !Number.isSafeInteger(event.expectedVersion) ||
    event.expectedVersion !== state.version ||
    !Number.isSafeInteger(state.version + 1)
  )
    return deny(state)
  const next = JSON.parse(JSON.stringify(state))
  const finish = (status) => {
    next.version++
    return accepted(next, status)
  }
  if (event.type === 'KILL') {
    if (state.killed) return deny(state)
    next.killed = true
    return finish('TEST_ONLY_KILLED')
  }
  if (event.type === 'RESTORE_UNKNOWN') {
    next.halted = true
    return finish('TEST_ONLY_RESTORE_HALTED')
  }
  if (event.type === 'REVOKE') {
    if (!own(state.grants, event.grantId) || state.revoked.includes(event.grantId))
      return deny(state)
    next.revoked.push(event.grantId)
    return finish('TEST_ONLY_REVOKED')
  }
  if (state.halted || state.killed) return deny(state)
  if (event.type === 'RESERVE') {
    if (
      !fakeId(event.attemptId) ||
      !own(state.grants, event.grantId) ||
      state.revoked.includes(event.grantId) ||
      !scenarios.has(event.scenarioId) ||
      event.attemptKind !== 'INITIAL' ||
      state.claims.includes(event.scenarioId) ||
      own(state.holds, event.attemptId)
    )
      return deny(state)
    let W
    try {
      W = parseMicroUsd(event.W)
      if (W === 0n) return deny(state)
      const { project, grant } = accounts(state, event.grantId)
      if (!canReserve(project, grant, W)) return deny(state)
    } catch {
      return deny(state)
    }
    next.holds[event.attemptId] = {
      grantId: event.grantId,
      scenarioId: event.scenarioId,
      W: event.W,
      status: 'RESERVED',
    }
    next.claims.push(event.scenarioId)
    return finish('TEST_ONLY_RESERVED')
  }
  if (!fakeId(event.attemptId) || !own(state.holds, event.attemptId)) return deny(state)
  const before = state.holds[event.attemptId]
  const hold = next.holds[event.attemptId]
  if (state.revoked.includes(before.grantId)) return deny(state)
  if (event.type === 'PREPARE') {
    if (before.status !== 'RESERVED') return deny(state)
    hold.status = 'PREPARED'
    return finish('TEST_ONLY_PREPARED')
  }
  if (event.type === 'ACK_ANCHOR') {
    if (before.status !== 'PREPARED' || event.marker !== 'TEST_ONLY_ANCHOR_ACK') return deny(state)
    hold.status = 'ANCHORED'
    return finish('TEST_ONLY_FAKE_ACKED')
  }
  if (event.type === 'DISPATCH') {
    if (before.status !== 'ANCHORED') return deny(state)
    hold.status = 'MODELED_DISPATCH'
    // Absolutely no external I/O or callback.
    return finish('TEST_ONLY_MODELED_DISPATCH')
  }
  if (event.type === 'UNKNOWN') {
    if (before.status === 'SETTLED' || before.status === 'UNKNOWN') return deny(state)
    hold.status = 'UNKNOWN'
    next.halted = true
    return finish('TEST_ONLY_UNKNOWN_HALTED')
  }
  if (event.type === 'SETTLE') {
    if (
      before.status !== 'MODELED_DISPATCH' ||
      event.receiptMarker !== 'TEST_ONLY_FAKE_FINAL_RECEIPT'
    )
      return deny(state)
    try {
      const amount = parseMicroUsd(event.amount)
      if (amount > parseMicroUsd(before.W)) {
        next.halted = true
        hold.status = 'UNKNOWN'
        return finish('TEST_ONLY_OVER_W_HALTED')
      }
      next.projectSpent = checkedAdd(parseMicroUsd(state.projectSpent), amount).toString()
      next.grants[before.grantId].spent = checkedAdd(
        parseMicroUsd(state.grants[before.grantId].spent),
        amount,
      ).toString()
      hold.status = 'SETTLED'
      return finish('TEST_ONLY_SETTLED')
    } catch {
      return deny(state)
    }
  }
  return deny(state)
}
