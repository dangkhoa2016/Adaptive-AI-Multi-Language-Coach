// Fake tick-based challenge/PoP; no real replay persistence or trusted clock.
const id = (s) => typeof s === 'string' && /^TEST_ONLY_[A-Za-z0-9_]{1,80}$/.test(s)
const closed = (o, f) =>
  !!o &&
  typeof o === 'object' &&
  !Array.isArray(o) &&
  Object.keys(o).length === f.length &&
  f.every((k) => Object.hasOwn(o, k))
const outcome = (matched = false, reason = 'INVALID_OR_MISSING') =>
  Object.freeze({
    kind: 'TEST_ONLY_CHALLENGE_OBSERVATION',
    testOnlyMatched: matched,
    reason,
    operationalDecision: 'DENY',
  })

export function inspectSyntheticChallenge(input) {
  try {
    if (!closed(input, ['challenge', 'claim', 'usedNonces', 'nowTick'])) return outcome()
    const { challenge, claim, usedNonces, nowTick } = input
    let reason = 'INVALID_OR_MISSING'
    let matched = false
    if (
      closed(challenge, [
        'marker',
        'nonce',
        'subject',
        'audience',
        'issuedTick',
        'expiresTick',
        'policyEpoch',
      ]) &&
      closed(claim, ['marker', 'nonce', 'subject', 'audience', 'policyEpoch', 'proof']) &&
      challenge.marker === 'TEST_ONLY_CHALLENGE' &&
      claim.marker === 'TEST_ONLY_CLAIM' &&
      id(challenge.nonce) &&
      id(challenge.subject) &&
      id(challenge.audience) &&
      Array.isArray(usedNonces) &&
      usedNonces.length <= 100 &&
      usedNonces.every(id) &&
      new Set(usedNonces).size === usedNonces.length &&
      Number.isSafeInteger(nowTick) &&
      nowTick >= 0 &&
      Number.isSafeInteger(challenge.issuedTick) &&
      challenge.issuedTick >= 0 &&
      Number.isSafeInteger(challenge.expiresTick) &&
      challenge.expiresTick > challenge.issuedTick &&
      challenge.expiresTick - challenge.issuedTick <= 300 &&
      Number.isSafeInteger(challenge.policyEpoch) &&
      challenge.policyEpoch >= 1
    ) {
      if (usedNonces.includes(challenge.nonce)) reason = 'TEST_ONLY_REPLAY'
      else if (nowTick < challenge.issuedTick || nowTick >= challenge.expiresTick)
        reason = 'TEST_ONLY_CLOCK_REJECT'
      else if (
        claim.nonce !== challenge.nonce ||
        claim.subject !== challenge.subject ||
        claim.audience !== challenge.audience ||
        claim.policyEpoch !== challenge.policyEpoch ||
        claim.proof !== 'TEST_ONLY_UNTRUSTED_POP_MARKER'
      )
        reason = 'TEST_ONLY_CLAIM_MISMATCH'
      else {
        reason = 'TEST_ONLY_MARKERS_MATCH'
        matched = true
      }
    }
    return outcome(matched, reason)
  } catch {
    return outcome()
  }
}
