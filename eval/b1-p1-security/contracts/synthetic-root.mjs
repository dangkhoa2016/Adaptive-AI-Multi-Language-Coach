import { createHash, verify } from 'node:crypto'
import { Buffer } from 'node:buffer'
import { frameNonGrant } from '../../authorization/wire/framing.mjs'

// Caller-owned registry is TEST ONLY: no enrollment, independent root, or operational authority.
const fakeId = (v) => typeof v === 'string' && /^TEST_ONLY_[A-Za-z0-9_]{1,72}$/.test(v)
const hex64 = (v) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v)
const closed = (o, f) =>
  !!o &&
  typeof o === 'object' &&
  !Array.isArray(o) &&
  Object.keys(o).length === f.length &&
  f.every((k) => Object.hasOwn(o, k))
const outcome = (match = false, reason = 'INVALID_OR_MISSING') =>
  Object.freeze({
    kind: 'TEST_ONLY_ROOT_OBSERVATION',
    testOnlyMatched: match,
    reason,
    operationalDecision: 'DENY',
  })
export function inspectSyntheticRoot(input) {
  try {
    if (
      !closed(input, [
        'snapshot',
        'rootId',
        'publicKey',
        'paperBytes',
        'signature',
        'releaseDigest',
        'epoch',
      ])
    )
      return outcome()
    const { snapshot, rootId, publicKey, paperBytes, signature, releaseDigest, epoch } = input
    if (
      !closed(snapshot, ['marker', 'epoch', 'roots']) ||
      snapshot.marker !== 'TEST_ONLY_ROOT_SNAPSHOT' ||
      !Number.isSafeInteger(snapshot.epoch) ||
      snapshot.epoch < 1 ||
      snapshot.epoch !== epoch ||
      !Array.isArray(snapshot.roots) ||
      snapshot.roots.length < 1 ||
      snapshot.roots.length > 5 ||
      !fakeId(rootId) ||
      !hex64(releaseDigest) ||
      !Buffer.isBuffer(paperBytes) ||
      !Buffer.isBuffer(signature) ||
      signature.length !== 64 ||
      publicKey?.type !== 'public' ||
      publicKey?.asymmetricKeyType !== 'ed25519'
    )
      return outcome()
    const seen = new Set()
    for (const entry of snapshot.roots) {
      if (
        !closed(entry, ['id', 'keySha256', 'releaseDigest', 'revoked']) ||
        !fakeId(entry.id) ||
        !hex64(entry.keySha256) ||
        !hex64(entry.releaseDigest) ||
        typeof entry.revoked !== 'boolean' ||
        seen.has(entry.id)
      )
        return outcome()
      seen.add(entry.id)
    }
    const selected = snapshot.roots.find((entry) => entry.id === rootId)
    if (!selected || selected.revoked || selected.releaseDigest !== releaseDigest)
      return outcome(false, 'TEST_ONLY_ROOT_NOT_ACTIVE')
    const actual = createHash('sha256')
      .update(publicKey.export({ type: 'spki', format: 'der' }))
      .digest('hex')
    if (actual !== selected.keySha256) return outcome(false, 'TEST_ONLY_KEY_MISMATCH')
    // The exact closed paper bytes CANNOT contain grants. B0 owns the framing grammar.
    const valid = verify(null, frameNonGrant(paperBytes), publicKey, signature)
    return outcome(valid, valid ? 'TEST_ONLY_SIGNATURE_MATCH' : 'TEST_ONLY_SIGNATURE_MISMATCH')
  } catch {
    return outcome()
  }
}
