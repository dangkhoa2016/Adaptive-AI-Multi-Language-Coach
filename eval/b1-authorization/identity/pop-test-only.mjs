// Non-cryptographic marker matching. Not mTLS, PoP, an authenticated user or replay storage.
const synthetic = (s) => typeof s === 'string' && /^TEST_ONLY_[A-Za-z0-9_]{1,100}$/.test(s)
export function checkSyntheticPop(input) {
  const fields = ['nonce', 'boundSubject', 'presentedSubject', 'proofMarker', 'usedNonces']
  const validShape =
    input &&
    typeof input === 'object' &&
    !Array.isArray(input) &&
    Object.keys(input).length === fields.length &&
    fields.every((field) => Object.hasOwn(input, field))
  const matches =
    validShape &&
    synthetic(input.nonce) &&
    synthetic(input.boundSubject) &&
    input.boundSubject === input.presentedSubject &&
    input.proofMarker === 'TEST_ONLY_NON_CRYPTO_POP' &&
    Array.isArray(input.usedNonces) &&
    input.usedNonces.length <= 100 &&
    input.usedNonces.every(synthetic) &&
    !input.usedNonces.includes(input.nonce)
  return Object.freeze({
    kind: 'TEST_ONLY_POP_OBSERVATION',
    testOnlyClaimMatches: Boolean(matches),
    operationalDecision: 'DENY',
  })
}
