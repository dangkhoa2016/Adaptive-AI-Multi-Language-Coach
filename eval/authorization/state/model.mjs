import { parseMicroUsd, checkedAdd, canReserve } from '../money/micro-usd.mjs'

// Pure TEST_ONLY value model. Markers below authenticate nothing and grant no capability.
const scenarios = ['GEN-04', 'GEN-06', 'GEN-07', 'GEN-09', 'GEN-11']
const outstanding = ['RESERVED_READY', 'DISPATCH_INTENT', 'IN_FLIGHT', 'UNKNOWN_QUARANTINED']
const syntheticId = (value) =>
  typeof value === 'string' && /^TEST_ONLY_[A-Za-z0-9_]{1,100}$/.test(value)
const integer = (value, max = 5, min = 1) => Number.isInteger(value) && value >= min && value <= max
const own = (object, key) => Object.hasOwn(object, key)

function freeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child)
    Object.freeze(value)
  }
  return value
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function closed(object, required, optional = []) {
  if (!object || typeof object !== 'object' || Array.isArray(object)) return false
  const keys = Object.keys(object)
  return (
    required.every((key) => own(object, key)) &&
    keys.every((key) => required.includes(key) || optional.includes(key))
  )
}

export function createModel(config) {
  if (
    !closed(config, [
      'projectId',
      'evaluationScopeId',
      'projectCap',
      'grantCaps',
      'maxInitials',
      'maxOutbound',
      'maxConcurrency',
    ]) ||
    !syntheticId(config.projectId) ||
    !syntheticId(config.evaluationScopeId) ||
    !integer(config.maxInitials) ||
    !integer(config.maxOutbound, 5, 0) ||
    !integer(config.maxConcurrency) ||
    !config.grantCaps ||
    typeof config.grantCaps !== 'object' ||
    Array.isArray(config.grantCaps)
  ) {
    throw new TypeError('TEST_ONLY_CONFIG')
  }
  parseMicroUsd(config.projectCap)
  const grants = Object.create(null)
  const entries = Object.entries(config.grantCaps)
  if (entries.length < 1 || entries.length > 5) throw new RangeError('MODEL_GRANT_COUNT')
  for (const [id, cap] of entries) {
    if (!syntheticId(id)) throw new TypeError('TEST_ONLY_GRANT_ID')
    parseMicroUsd(cap)
    grants[id] = { cap, spent: '0' }
  }
  return freeze({
    model: 'TEST_ONLY_NON_OPERATIVE',
    operationalDecision: 'DENY',
    projectId: config.projectId,
    evaluationScopeId: config.evaluationScopeId,
    project: { cap: config.projectCap, spent: '0' },
    grants,
    limits: {
      maxInitials: config.maxInitials,
      maxOutbound: config.maxOutbound,
      maxConcurrency: config.maxConcurrency,
    },
    version: 0,
    policyEpoch: 0,
    halted: false,
    killed: false,
    revokedGrants: [],
    claims: [],
    outboundAllocated: 0,
    occupiedSlots: 0,
    incidents: [],
  })
}

// Unknown event shapes return the same value with a denial. No callbacks or adapters.
export function transition(state, event) {
  const denied = () => freeze({ state, outcome: 'MODEL_DENIED', operationalDecision: 'DENY' })
  if (
    !state ||
    state.model !== 'TEST_ONLY_NON_OPERATIVE' ||
    !Object.isFrozen(state) ||
    state.operationalDecision !== 'DENY' ||
    !event ||
    typeof event !== 'object'
  )
    return denied()
  const shapes = {
    CLAIM: [['type', 'scenarioId', 'grantId']],
    CACHE_HIT: [['type', 'scenarioId', 'fixture']],
    CACHE_MISS: [
      ['type', 'scenarioId', 'expectedVersion', 'expectedPolicyEpoch'],
      ['W', 'proof'],
    ],
    UNKNOWN: [['type', 'scenarioId']],
    PREPARE: [['type', 'scenarioId', 'expectedVersion', 'expectedPolicyEpoch']],
    DISPATCH: [['type', 'scenarioId', 'expectedVersion', 'expectedPolicyEpoch', 'anchor']],
    KILL: [['type']],
    REVOKE: [['type', 'grantId']],
    CANCEL: [['type', 'scenarioId', 'proof']],
    SETTLE: [['type', 'scenarioId', 'amount', 'receiptId', 'proof']],
    FALLBACK: [['type', 'scenarioId', 'cacheHit']],
    RESTORE_UNKNOWN: [['type']],
  }
  if (!own(shapes, event.type) || !closed(event, ...shapes[event.type])) return denied()
  if (!Number.isSafeInteger(state.version + 1) || !Number.isSafeInteger(state.policyEpoch + 1))
    return denied()
  const next = clone(state)
  const finish = (outcome) => {
    next.version++
    next.outboundAllocated = next.claims.filter((claim) => claim.attempt !== null).length
    next.occupiedSlots = next.claims.filter(
      (claim) => claim.attempt && outstanding.includes(claim.attempt.status),
    ).length
    return freeze({ state: freeze(next), outcome, operationalDecision: 'DENY' })
  }
  const blocked = (grantId) => state.halted || state.killed || state.revokedGrants.includes(grantId)
  const gated = () =>
    event.expectedVersion === state.version && event.expectedPolicyEpoch === state.policyEpoch
  const claim = next.claims.find((item) => item.scenarioId === event.scenarioId)
  const incident = (reason, actual) => {
    next.halted = true
    next.incidents.push({ reason, ...(actual === undefined ? {} : { actual }) })
    return finish('MODEL_HALTED')
  }
  if (event.type === 'KILL') {
    if (state.killed) return denied()
    next.killed = true
    next.policyEpoch++
    return finish('MODEL_KILLED')
  }
  if (event.type === 'REVOKE') {
    if (!own(state.grants, event.grantId) || state.revokedGrants.includes(event.grantId))
      return denied()
    next.revokedGrants.push(event.grantId)
    next.policyEpoch++
    return finish('MODEL_REVOKED')
  }
  if (event.type === 'RESTORE_UNKNOWN') {
    return incident('CONTINUITY_UNKNOWN')
  }
  if (event.type === 'CLAIM') {
    if (
      !scenarios.includes(event.scenarioId) ||
      !own(state.grants, event.grantId) ||
      blocked(event.grantId) ||
      claim ||
      state.claims.length >= state.limits.maxInitials
    )
      return denied()
    next.claims.push({
      key: [state.projectId, state.evaluationScopeId, event.scenarioId, 'INITIAL'],
      scenarioId: event.scenarioId,
      grantId: event.grantId,
      status: 'LOGICAL_INITIAL_CLAIMED',
      attempt: null,
      delivery: { cacheHit: false, isFallback: false },
    })
    return finish('MODEL_LOGICAL_INITIAL_CLAIMED')
  }
  if (!claim) return denied()
  const attempt = claim.attempt
  if (event.type === 'UNKNOWN') {
    if (
      ![
        'LOGICAL_INITIAL_CLAIMED',
        'CACHE_ONLY_COMPLETE',
        'MODEL_OUTBOUND_RESERVED',
        'CLAIM_OR_DELIVERY_UNKNOWN',
      ].includes(claim.status)
    )
      return denied()
    if (attempt && !outstanding.includes(attempt.status)) return denied()
    claim.status = 'CLAIM_OR_DELIVERY_UNKNOWN'
    if (attempt) attempt.status = 'UNKNOWN_QUARANTINED'
    next.halted = true
    return finish('MODEL_CLAIM_OR_DELIVERY_UNKNOWN')
  }
  if (event.type === 'FALLBACK') {
    if (claim.status !== 'CLAIM_OR_DELIVERY_UNKNOWN' || typeof event.cacheHit !== 'boolean')
      return denied()
    claim.delivery = { cacheHit: event.cacheHit, isFallback: true }
    return finish('MODEL_FALLBACK_WITH_UNKNOWN_RETAINED')
  }
  if (event.type === 'SETTLE') {
    if (!attempt || event.proof !== 'TEST_ONLY_FINAL_RECEIPT' || !syntheticId(event.receiptId))
      return denied()
    let amount
    try {
      amount = parseMicroUsd(event.amount)
    } catch {
      return denied()
    }
    // Receipt identity is unique across the modeled project, not just the claim.
    const otherReceipt = next.claims.find(
      (item) => item !== claim && item.attempt?.receipt?.receiptId === event.receiptId,
    )
    if (otherReceipt) return incident('RECEIPT_CONFLICT')
    if (attempt.receipt) {
      if (
        attempt.receipt.receiptId === event.receiptId &&
        attempt.receipt.amount === event.amount
      ) {
        return freeze({ state, outcome: 'MODEL_DUPLICATE_NOOP', operationalDecision: 'DENY' })
      }
      return incident('RECEIPT_CONFLICT')
    }
    if (!['IN_FLIGHT', 'UNKNOWN_QUARANTINED'].includes(attempt.status)) return denied()
    if (amount > parseMicroUsd(attempt.W)) {
      // Retain the observed receipt even though it cannot settle this reservation.
      attempt.receipt = { receiptId: event.receiptId, amount: event.amount }
      attempt.status = 'UNKNOWN_QUARANTINED'
      claim.status = 'CLAIM_OR_DELIVERY_UNKNOWN'
      return incident('ACTUAL_EXCEEDS_W', event.amount)
    }
    try {
      next.project.spent = checkedAdd(parseMicroUsd(state.project.spent), amount).toString()
      next.grants[claim.grantId].spent = checkedAdd(
        parseMicroUsd(state.grants[claim.grantId].spent),
        amount,
      ).toString()
    } catch {
      return incident('SETTLEMENT_OVERFLOW', event.amount)
    }
    attempt.receipt = { receiptId: event.receiptId, amount: event.amount }
    attempt.status = 'SETTLED'
    claim.status = 'MODEL_SETTLED'
    return finish('MODEL_SETTLED')
  }
  if (event.type === 'CANCEL') {
    if (!attempt || attempt.status !== 'RESERVED_READY' || event.proof !== 'TEST_ONLY_NO_SEND')
      return denied()
    attempt.status = 'CANCELLED_PROVEN_NO_SEND'
    claim.status = 'MODEL_CANCELLED'
    return finish('MODEL_CANCELLED_PROVEN_NO_SEND')
  }
  if (blocked(claim.grantId)) return denied()
  if (event.type === 'CACHE_HIT') {
    if (claim.status !== 'LOGICAL_INITIAL_CLAIMED' || event.fixture !== 'TEST_ONLY_TRUSTED_HIT')
      return denied()
    claim.status = 'CACHE_ONLY_COMPLETE'
    claim.delivery.cacheHit = true
    return finish('MODEL_CACHE_ONLY_COMPLETE')
  }
  if (event.type === 'CACHE_MISS') {
    if (!gated() || claim.status !== 'LOGICAL_INITIAL_CLAIMED') return denied()
    const noOutbound = () => {
      claim.status = 'NO_OUTBOUND_DENIED'
      return finish('MODEL_NO_OUTBOUND_DENIED')
    }
    let W
    try {
      W = parseMicroUsd(event.W)
    } catch {
      return noOutbound()
    }
    if (
      event.proof !== 'TEST_ONLY_HYPOTHETICAL_BOUND' ||
      state.outboundAllocated >= state.limits.maxOutbound ||
      state.occupiedSlots >= state.limits.maxConcurrency
    )
      return noOutbound()
    const active = state.claims.filter(
      (item) => item.attempt && outstanding.includes(item.attempt.status),
    )
    const project = {
      cap: parseMicroUsd(state.project.cap),
      spent: parseMicroUsd(state.project.spent),
      holds: active.map((item) => parseMicroUsd(item.attempt.W)),
    }
    const grant = {
      cap: parseMicroUsd(state.grants[claim.grantId].cap),
      spent: parseMicroUsd(state.grants[claim.grantId].spent),
      holds: active
        .filter((item) => item.grantId === claim.grantId)
        .map((item) => parseMicroUsd(item.attempt.W)),
    }
    if (!canReserve(project, grant, W)) return noOutbound()
    claim.attempt = {
      id: [...claim.key, 'OUTBOUND'],
      W: event.W,
      status: 'RESERVED_READY',
      receipt: null,
    }
    claim.status = 'MODEL_OUTBOUND_RESERVED'
    return finish('MODEL_OUTBOUND_RESERVATION')
  }
  if (event.type === 'PREPARE') {
    if (!gated() || !attempt || attempt.status !== 'RESERVED_READY') return denied()
    attempt.status = 'DISPATCH_INTENT'
    return finish('MODEL_DISPATCH_INTENT')
  }
  if (event.type === 'DISPATCH') {
    if (
      !gated() ||
      !attempt ||
      attempt.status !== 'DISPATCH_INTENT' ||
      event.anchor !== 'TEST_ONLY_ANCHORED'
    )
      return denied()
    attempt.status = 'IN_FLIGHT'
    return finish('MODEL_DISPATCH_COMMITTED')
  }
  return denied()
}
