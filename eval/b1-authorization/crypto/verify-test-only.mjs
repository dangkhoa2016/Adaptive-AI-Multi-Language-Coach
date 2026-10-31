import { verify } from 'node:crypto'

// Accepts an out-of-band TEST ONLY key supplied by the test harness.
// No signer enrollment, real grant verifier or operational trust root exists.
export function verifySyntheticSignature(input) {
  let valid = false
  try {
    const { pinnedTestOnlyPublicKey, bytes, signature } = input ?? {}
    if (
      pinnedTestOnlyPublicKey?.type === 'public' &&
      pinnedTestOnlyPublicKey?.asymmetricKeyType === 'ed25519' &&
      bytes instanceof Uint8Array &&
      signature instanceof Uint8Array
    ) {
      valid = verify(null, bytes, pinnedTestOnlyPublicKey, signature)
    }
  } catch {
    valid = false
  }
  return Object.freeze({
    kind: 'TEST_ONLY_SIGNATURE_OBSERVATION',
    testOnlySignatureValid: valid,
    operationalDecision: 'DENY',
  })
}
