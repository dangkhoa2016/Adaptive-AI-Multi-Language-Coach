// Equality is a synthetic observation, never a trusted runtime release attestation.
const digest = (x) => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x)
export function inspectSyntheticRelease(input) {
  const plain = input && typeof input === 'object' && !Array.isArray(input)
  const keys = plain ? Object.keys(input) : []
  const shape =
    keys.length === 2 && keys.includes('pinnedDigest') && keys.includes('measuredDigest')
  const matches =
    shape &&
    digest(input.pinnedDigest) &&
    digest(input.measuredDigest) &&
    input.pinnedDigest === input.measuredDigest
  return Object.freeze({
    kind: 'TEST_ONLY_RELEASE_COMPARISON',
    testOnlyMatches: Boolean(matches),
    operationalDecision: 'DENY',
  })
}
