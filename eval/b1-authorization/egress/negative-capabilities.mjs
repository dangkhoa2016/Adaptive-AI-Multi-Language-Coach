// Pure simulation: does NOT install platform egress filters or intercept network.
const mockSafe = new Set(['readFixture'])
const own = (x, k) => Object.hasOwn(x, k)
export function inspectSyntheticCapabilities(input) {
  const valid =
    input &&
    typeof input === 'object' &&
    !Array.isArray(input) &&
    Object.keys(input).length === 2 &&
    own(input, 'marker') &&
    own(input, 'capabilities') &&
    input.marker === 'TEST_ONLY_CAPABILITY_SCAN' &&
    Array.isArray(input.capabilities) &&
    input.capabilities.length <= 32 &&
    input.capabilities.every((s) => typeof s === 'string' && mockSafe.has(s)) &&
    new Set(input.capabilities).size === input.capabilities.length
  return Object.freeze({
    kind: 'TEST_ONLY_STATIC_CAPABILITY_SCAN',
    testOnlyNoDangerousCapabilities: Boolean(valid),
    operationalDecision: 'DENY',
  })
}

export function assertNoSyntheticEgress() {
  // Callback intentionally ignored: no fetch, connect, provider, D1, KV, mail or AI.
  throw new Error('NO_EGRESS_TEST_ONLY')
}
