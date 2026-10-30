const verdict = Object.freeze({ decision: 'DENY', reason: 'B0_NON_OPERATIVE' })

// Never inspect metadata or invoke caller getters/callbacks. No authority in B0.
export function denyOperational(_input) {
  return verdict
}
