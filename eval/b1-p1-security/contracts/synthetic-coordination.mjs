import { inspectSyntheticRoot } from './synthetic-root.mjs'
import { inspectSyntheticChallenge } from '../identity/synthetic-challenge.mjs'
import { estimateSyntheticW, inspectSyntheticCaps } from '../money/synthetic-worst-case.mjs'
import { inspectSyntheticTopology } from '../egress/synthetic-topology.mjs'

const closed = (o, f) =>
  !!o &&
  typeof o === 'object' &&
  !Array.isArray(o) &&
  Object.keys(o).length === f.length &&
  f.every((k) => Object.hasOwn(o, k))

const report = (matched) =>
  Object.freeze({
    kind: 'TEST_ONLY_COMPOSED_OBSERVATIONS',
    testOnlyAllObservationsMatch: matched,
    runtimeAuthority: false,
    operationalDecision: 'DENY',
  })

// This observation can NEVER dispatch. Unexpected/proxy/getter input fails closed.
export function inspectSyntheticPreflight(input) {
  try {
    if (!closed(input, ['root', 'identity', 'money', 'topology', 'caps'])) return report(false)
    const {
      root: rootInput,
      identity: identityInput,
      money: moneyInput,
      topology: topologyInput,
      caps: capsInput,
    } = input
    const root = inspectSyntheticRoot(rootInput)
    const identity = inspectSyntheticChallenge(identityInput)
    const money = estimateSyntheticW(moneyInput)
    const topology = inspectSyntheticTopology(topologyInput)
    const caps = inspectSyntheticCaps({
      project: capsInput?.project,
      grant: capsInput?.grant,
      testOnlyW: money.testOnlyW,
    })
    return report(
      root.testOnlyMatched === true &&
        identity.testOnlyMatched === true &&
        rootInput.epoch === identityInput.challenge.policyEpoch &&
        money.testOnlyW !== null &&
        topology.testOnlyGraphMatches === true &&
        caps.testOnlyFits === true,
    )
  } catch {
    return report(false)
  }
}
