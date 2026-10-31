import test from 'node:test'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { generateKeyPairSync, sign } from 'node:crypto'
import { frameNonGrant } from '../../authorization/wire/framing.mjs'
import { inspectSyntheticRoot } from '../contracts/synthetic-root.mjs'
import { inspectSyntheticChallenge } from '../identity/synthetic-challenge.mjs'
import { makeSyntheticContext } from '../fixtures/paper.synthetic.mjs'

test('P1-IAR02-01 temporary signed non-grant is a positive synthetic observation, operational DENY', () => {
  const r = inspectSyntheticRoot(makeSyntheticContext().root)
  assert.equal(r.testOnlyMatched, true)
  assert.equal(r.operationalDecision, 'DENY')
})
test('P1-IAR02-02 invalid signer fingerprint fails', () => {
  const s = makeSyntheticContext(),
    stranger = generateKeyPairSync('ed25519')
  assert.equal(
    inspectSyntheticRoot({ ...s.root, publicKey: stranger.publicKey }).testOnlyMatched,
    false,
  )
})
test('P1-IAR02-03 wrong signature, wrong payload and real-grant shape fail', () => {
  const s = makeSyntheticContext()
  assert.equal(
    inspectSyntheticRoot({ ...s.root, signature: Buffer.alloc(64) }).testOnlyMatched,
    false,
  )
  assert.equal(
    inspectSyntheticRoot({ ...s.root, paperBytes: Buffer.from('{"issuer":1}') }).testOnlyMatched,
    false,
  )
  assert.equal(
    inspectSyntheticRoot({ ...s.root, paperBytes: Buffer.from(' {"a":1,"b":2}') }).testOnlyMatched,
    false,
  )
})
test('P1-IAR02-04 valid test root revoked or release changed fails', () => {
  const s = makeSyntheticContext()
  const revoked = {
    ...s.root.snapshot,
    roots: s.root.snapshot.roots.map((r) => ({ ...r, revoked: true })),
  }
  assert.equal(inspectSyntheticRoot({ ...s.root, snapshot: revoked }).testOnlyMatched, false)
  assert.equal(
    inspectSyntheticRoot({ ...s.root, releaseDigest: 'b'.repeat(64) }).testOnlyMatched,
    false,
  )
})
test('P1-IAR02-05 stale epoch, duplicate root and extra registry fields fail', () => {
  const s = makeSyntheticContext()
  assert.equal(inspectSyntheticRoot({ ...s.root, epoch: 2 }).testOnlyMatched, false)
  assert.equal(
    inspectSyntheticRoot({
      ...s.root,
      snapshot: { ...s.root.snapshot, roots: [s.root.snapshot.roots[0], s.root.snapshot.roots[0]] },
    }).testOnlyMatched,
    false,
  )
  assert.equal(
    inspectSyntheticRoot({ ...s.root, snapshot: { ...s.root.snapshot, operationalAllow: true } })
      .testOnlyMatched,
    false,
  )
})
test('P1-IAR02-06 supplied public key but non-Ed25519 key fails', () => {
  const s = makeSyntheticContext(),
    other = generateKeyPairSync('rsa', { modulusLength: 2048 })
  assert.equal(
    inspectSyntheticRoot({ ...s.root, publicKey: other.publicKey }).testOnlyMatched,
    false,
  )
})
test('P1-IAR02-07 fake challenge matches within test-only window, operational DENY', () => {
  const r = inspectSyntheticChallenge(makeSyntheticContext().identity)
  assert.equal(r.testOnlyMatched, true)
  assert.equal(r.operationalDecision, 'DENY')
})
test('P1-IAR02-08 replay, duplicate used nonce and incorrect audience fail', () => {
  const s = makeSyntheticContext()
  assert.equal(
    inspectSyntheticChallenge({ ...s.identity, usedNonces: ['TEST_ONLY_NONCE_A'] }).testOnlyMatched,
    false,
  )
  assert.equal(
    inspectSyntheticChallenge({ ...s.identity, usedNonces: ['TEST_ONLY_X', 'TEST_ONLY_X'] })
      .testOnlyMatched,
    false,
  )
  assert.equal(
    inspectSyntheticChallenge({
      ...s.identity,
      claim: { ...s.identity.claim, audience: 'TEST_ONLY_OTHER' },
    }).testOnlyMatched,
    false,
  )
})
test('P1-IAR02-09 expiration, early tick, overlong TTL and missing clock fail', () => {
  const s = makeSyntheticContext()
  for (const nowTick of [99, 120, undefined, NaN]) {
    assert.equal(inspectSyntheticChallenge({ ...s.identity, nowTick }).testOnlyMatched, false)
  }
  assert.equal(
    inspectSyntheticChallenge({
      ...s.identity,
      challenge: { ...s.identity.challenge, expiresTick: 999 },
    }).testOnlyMatched,
    false,
  )
})
test('P1-IAR02-10 mismatched epoch, claimant, marker and extra fields fail', () => {
  const s = makeSyntheticContext()
  for (const claim of [
    { ...s.identity.claim, policyEpoch: 4 },
    { ...s.identity.claim, subject: 'TEST_ONLY_OTHER' },
    { ...s.identity.claim, proof: 'REAL_POP' },
    { ...s.identity.claim, grant: true },
  ]) {
    assert.equal(inspectSyntheticChallenge({ ...s.identity, claim }).testOnlyMatched, false)
  }
})
test('P1-IAR02-11 invalid Ed25519 signed bytes cannot become real execution grant', () => {
  const s = makeSyntheticContext()
  const signature = sign(
    null,
    frameNonGrant(Buffer.from('{}')),
    generateKeyPairSync('ed25519').privateKey,
  )
  const r = inspectSyntheticRoot({ ...s.root, signature })
  assert.equal(r.operationalDecision, 'DENY')
  assert.equal(r.testOnlyMatched, false)
})

test('P1-IAR02-12 direct observation rejects hostile getters without throwing', () => {
  const evilRoot = Object.defineProperty({}, 'snapshot', {
    get() {
      throw new Error('TEST_ONLY_GETTER')
    },
  })
  const evilChallenge = Object.defineProperty({}, 'challenge', {
    get() {
      throw new Error('TEST_ONLY_GETTER')
    },
  })
  assert.doesNotThrow(() => inspectSyntheticRoot(evilRoot))
  assert.equal(inspectSyntheticRoot(evilRoot).testOnlyMatched, false)
  assert.doesNotThrow(() => inspectSyntheticChallenge(evilChallenge))
  assert.equal(inspectSyntheticChallenge(evilChallenge).testOnlyMatched, false)
})
