import { Buffer } from 'node:buffer'
import test from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync, sign } from 'node:crypto'
import { parsePaperBoundary, framePaperBoundary } from '../contracts/grant-wire.mjs'
import { inspectSyntheticRelease } from '../contracts/release-binding.mjs'
import { verifySyntheticSignature } from '../crypto/verify-test-only.mjs'
import { checkSyntheticPop } from '../identity/pop-test-only.mjs'

test('B1-TRUST-01 non-grant canonical paper envelope never becomes operational allow', () => {
  assert.equal(parsePaperBoundary(Buffer.from('{}')).operationalDecision, 'DENY')
  assert.equal(framePaperBoundary(Buffer.from('{}')).operationalDecision, 'DENY')
  assert.equal(parsePaperBoundary(Buffer.from('{"a":1,"b":2}')).kind, 'TEST_ONLY_NON_GRANT')
})
test('B1-TRUST-02 duplicate decoded unicode keys and noncanonical bytes denied', () => {
  for (const s of ['{"a":1,"\\u0061":2}', '{"b":2,"a":1}', '{"a":1,"a":2}', ' {}']) {
    assert.throws(() => parsePaperBoundary(Buffer.from(s)))
  }
})
test('B1-TRUST-03 grant-like fields rejected by closed projection', () => {
  for (const s of ['{"issuer":1}', '{"a":1,"b":2,"signature":3}', '{"root":1}']) {
    assert.throws(() => framePaperBoundary(Buffer.from(s)))
  }
})
test('B1-TRUST-04 measured synthetic release match not an execution grant', () => {
  const good = inspectSyntheticRelease({
    pinnedDigest: 'a'.repeat(64),
    measuredDigest: 'a'.repeat(64),
  })
  assert.equal(good.testOnlyMatches, true)
  assert.equal(good.operationalDecision, 'DENY')
  assert.equal(
    inspectSyntheticRelease({ pinnedDigest: 'a'.repeat(64), measuredDigest: 'b'.repeat(64) })
      .testOnlyMatches,
    false,
  )
  assert.equal(
    inspectSyntheticRelease({ pinnedDigest: 'bad', measuredDigest: 'bad' }).testOnlyMatches,
    false,
  )
})
test('B1-TRUST-05 ephemeral Ed25519 TEST_ONLY signatures correct/wrong key; never operational allow', () => {
  const a = generateKeyPairSync('ed25519')
  const b = generateKeyPairSync('ed25519')
  const raw = framePaperBoundary(Buffer.from('{}')).bytes
  const signature = sign(null, raw, a.privateKey)
  const ok = verifySyntheticSignature({
    pinnedTestOnlyPublicKey: a.publicKey,
    bytes: raw,
    signature,
  })
  assert.equal(ok.testOnlySignatureValid, true)
  assert.equal(ok.operationalDecision, 'DENY')
  assert.equal(
    verifySyntheticSignature({ pinnedTestOnlyPublicKey: b.publicKey, bytes: raw, signature })
      .testOnlySignatureValid,
    false,
  )
  assert.equal(
    verifySyntheticSignature({
      pinnedTestOnlyPublicKey: a.publicKey,
      bytes: Buffer.from('wrong'),
      signature,
    }).testOnlySignatureValid,
    false,
  )
})
test('B1-TRUST-06 forged or replayed caller PoP marker is DENY', () => {
  const base = {
    nonce: 'TEST_ONLY_NONCE_1',
    boundSubject: 'TEST_ONLY_RUNNER_A',
    presentedSubject: 'TEST_ONLY_RUNNER_A',
    proofMarker: 'TEST_ONLY_NON_CRYPTO_POP',
    usedNonces: [],
  }
  assert.equal(checkSyntheticPop(base).testOnlyClaimMatches, true)
  assert.equal(
    checkSyntheticPop({ ...base, presentedSubject: 'TEST_ONLY_RUNNER_B' }).testOnlyClaimMatches,
    false,
  )
  assert.equal(
    checkSyntheticPop({ ...base, usedNonces: ['TEST_ONLY_NONCE_1'] }).testOnlyClaimMatches,
    false,
  )
  assert.equal(
    checkSyntheticPop({ ...base, proofMarker: 'PRODUCTION_GRANT' }).testOnlyClaimMatches,
    false,
  )
  assert.equal(checkSyntheticPop(base).operationalDecision, 'DENY')
})
