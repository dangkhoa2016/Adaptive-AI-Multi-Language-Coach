import { createHash, generateKeyPairSync, sign } from 'node:crypto'
import { Buffer } from 'node:buffer'
import { frameNonGrant } from '../../authorization/wire/framing.mjs'

// Only called by tests. Ephemeral key material is not stored in any fixture or evidence.
export function makeSyntheticContext() {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  const releaseDigest = 'a'.repeat(64)
  const paperBytes = Buffer.from('{}')
  const signature = sign(null, frameNonGrant(paperBytes), privateKey)
  const keySha256 = createHash('sha256')
    .update(publicKey.export({ type: 'spki', format: 'der' }))
    .digest('hex')
  const root = {
    snapshot: {
      marker: 'TEST_ONLY_ROOT_SNAPSHOT',
      epoch: 3,
      roots: [{ id: 'TEST_ONLY_ROOT_A', keySha256, releaseDigest, revoked: false }],
    },
    rootId: 'TEST_ONLY_ROOT_A',
    publicKey,
    paperBytes,
    signature,
    releaseDigest,
    epoch: 3,
  }
  const identity = {
    challenge: {
      marker: 'TEST_ONLY_CHALLENGE',
      nonce: 'TEST_ONLY_NONCE_A',
      subject: 'TEST_ONLY_RUNNER_A',
      audience: 'TEST_ONLY_BROKER_A',
      issuedTick: 100,
      expiresTick: 120,
      policyEpoch: 3,
    },
    claim: {
      marker: 'TEST_ONLY_CLAIM',
      nonce: 'TEST_ONLY_NONCE_A',
      subject: 'TEST_ONLY_RUNNER_A',
      audience: 'TEST_ONLY_BROKER_A',
      policyEpoch: 3,
      proof: 'TEST_ONLY_UNTRUSTED_POP_MARKER',
    },
    usedNonces: [],
    nowTick: 105,
  }
  const tariff = () => ({ blockUnits: '1000', numeratorUsd: '1', denominator: '1000000' })
  const money = {
    price: {
      marker: 'TEST_ONLY_FAKE_TARIFF',
      model: 'TEST_ONLY_MODEL_A',
      revision: 'TEST_ONLY_REV_1',
      tariffs: {
        input: tariff(),
        output: tariff(),
        hidden: tariff(),
        tool: tariff(),
      },
      perSendFeeMicroUsd: '2',
    },
    bound: {
      marker: 'TEST_ONLY_FAKE_BOUND',
      model: 'TEST_ONLY_MODEL_A',
      revision: 'TEST_ONLY_REV_1',
      maxSends: 3,
      units: { input: '1000', output: '1000', hidden: '1000', tool: '1000' },
      allDimensionsAccounted: true,
    },
  }
  const topology = {
    marker: 'TEST_ONLY_STATIC_GRAPH',
    runner: { globalOutbound: 'none', bindings: ['TEST_ONLY_BROKER'], connectAvailable: false },
    nodes: ['runner', 'broker', 'provider', 'ledger', 'audit'],
    edges: [
      { from: 'runner', to: 'broker' },
      { from: 'broker', to: 'provider' },
      { from: 'broker', to: 'ledger' },
      { from: 'broker', to: 'audit' },
    ],
  }
  const caps = {
    project: { cap: 100n, spent: 0n, holds: [] },
    grant: { cap: 100n, spent: 0n, holds: [] },
  }
  return { root, identity, money, topology, caps }
}
