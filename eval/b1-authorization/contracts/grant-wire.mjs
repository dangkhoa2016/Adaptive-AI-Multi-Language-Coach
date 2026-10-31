import { parseNonGrantEnvelope } from '../../authorization/wire/strict-json.mjs'
import { frameNonGrant } from '../../authorization/wire/framing.mjs'

// Strictly paper-only. No grant schema, authority, key discovery or operational allow.
export function parsePaperBoundary(raw) {
  const payload = parseNonGrantEnvelope(raw)
  return Object.freeze({ kind: 'TEST_ONLY_NON_GRANT', operationalDecision: 'DENY', payload })
}

export function framePaperBoundary(raw) {
  const bytes = frameNonGrant(raw)
  return Object.freeze({ kind: 'TEST_ONLY_NON_GRANT', operationalDecision: 'DENY', bytes })
}
