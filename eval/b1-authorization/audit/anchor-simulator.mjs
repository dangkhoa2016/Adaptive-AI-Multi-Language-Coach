import { createHash } from 'node:crypto'

// Local in-memory fake hash chain only. No independent anchor, signature or durable ACK.
const sha = (s) => createHash('sha256').update(s).digest('hex')
export function createSyntheticAnchor(seed) {
  if (seed !== 'TEST_ONLY_ANCHOR_SEED') throw new TypeError('TEST_ONLY_ANCHOR_SEED_REQUIRED')
  return Object.freeze({
    kind: 'TEST_ONLY_LOCAL_AUDIT_CHAIN',
    sequence: 0,
    hash: sha(seed),
    operationalDecision: 'DENY',
  })
}
export function appendSyntheticAnchor(previous, event) {
  if (
    !previous ||
    previous.kind !== 'TEST_ONLY_LOCAL_AUDIT_CHAIN' ||
    !Number.isSafeInteger(previous.sequence) ||
    previous.sequence < 0 ||
    !/^[a-f0-9]{64}$/.test(previous.hash) ||
    !event ||
    Object.keys(event).length !== 2 ||
    event.marker !== 'TEST_ONLY_AUDIT_EVENT' ||
    event.sequence !== previous.sequence + 1
  )
    throw new TypeError('TEST_ONLY_ANCHOR_REJECTED')
  return Object.freeze({
    kind: 'TEST_ONLY_LOCAL_AUDIT_CHAIN',
    sequence: event.sequence,
    hash: sha(previous.hash + ':' + event.sequence + ':TEST_ONLY_AUDIT_EVENT'),
    testOnlyAck: 'TEST_ONLY_ANCHOR_ACK',
    operationalDecision: 'DENY',
  })
}
