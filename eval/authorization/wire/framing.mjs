import { Buffer } from 'node:buffer'
import { parseNonGrantEnvelope } from './strict-json.mjs'

// Paper framing only: no key, signature, verifier, registry or execution grant.
export function frameNonGrant(raw) {
  // Copy before parsing so the exact validated bytes are also the framed bytes.
  if (!(raw instanceof Uint8Array)) throw new TypeError('BYTE_INPUT')
  if (raw.byteLength > 65536) throw new RangeError('BODY_LIMIT')
  const payload = Buffer.from(raw)
  parseNonGrantEnvelope(payload)
  const domain = Buffer.from('ADAPTIVE_COACH_PHASE_C_S0_EXECUTION_V1\0', 'ascii')
  const length = Buffer.alloc(8)
  length.writeBigUInt64BE(BigInt(payload.byteLength))
  return Buffer.concat([domain, length, payload])
}
