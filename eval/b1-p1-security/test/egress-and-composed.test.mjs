import test from 'node:test'
import assert from 'node:assert/strict'
import {
  inspectSyntheticTopology,
  probeSyntheticForbiddenAdapter,
} from '../egress/synthetic-topology.mjs'
import { inspectSyntheticPreflight } from '../contracts/synthetic-coordination.mjs'
import { makeSyntheticContext } from '../fixtures/paper.synthetic.mjs'

const graph = () => makeSyntheticContext().topology
test('P1-IAR05-01 exact mock topology matches but never allows runtime', () => {
  const r = inspectSyntheticTopology(graph())
  assert.equal(r.testOnlyGraphMatches, true)
  assert.equal(r.operationalDecision, 'DENY')
})
test('P1-IAR05-02 global fetch or connect escape denied', () => {
  for (const patch of [
    { globalOutbound: 'allow' },
    { globalOutbound: null },
    { connectAvailable: true },
  ]) {
    const s = graph()
    assert.equal(
      inspectSyntheticTopology({ ...s, runner: { ...s.runner, ...patch } }).testOnlyGraphMatches,
      false,
    )
  }
})
test('P1-IAR05-03 privileged explicit bindings escape denied', () => {
  for (const bindings of [
    ['TEST_ONLY_BROKER', 'AI'],
    ['TEST_ONLY_BROKER', 'DB'],
    ['TEST_ONLY_BROKER', 'KV'],
    ['SERVICE'],
    [],
  ]) {
    const s = graph()
    assert.equal(
      inspectSyntheticTopology({ ...s, runner: { ...s.runner, bindings } }).testOnlyGraphMatches,
      false,
    )
  }
})
test('P1-IAR05-04 direct provider and secondary route bypass denied', () => {
  const s = graph()
  const edges = s.edges.map((x) => ({ ...x }))
  edges[0] = { from: 'runner', to: 'provider' }
  assert.equal(inspectSyntheticTopology({ ...s, edges }).testOnlyGraphMatches, false)
  edges[0] = { from: 'runner', to: 'ledger' }
  assert.equal(inspectSyntheticTopology({ ...s, edges }).testOnlyGraphMatches, false)
})
test('P1-IAR05-05 missing audit ledger and broker route denied', () => {
  const s = graph()
  for (const i of [0, 1, 2, 3]) {
    assert.equal(
      inspectSyntheticTopology({ ...s, edges: s.edges.filter((_, j) => j !== i) })
        .testOnlyGraphMatches,
      false,
    )
  }
})
test('P1-IAR05-06 duplicated edge, unknown edge or node denied', () => {
  const s = graph()
  assert.equal(
    inspectSyntheticTopology({ ...s, edges: [s.edges[0], s.edges[0], s.edges[2], s.edges[3]] })
      .testOnlyGraphMatches,
    false,
  )
  assert.equal(
    inspectSyntheticTopology({ ...s, nodes: [...s.nodes, 'AI'] }).testOnlyGraphMatches,
    false,
  )
  assert.equal(
    inspectSyntheticTopology({ ...s, edges: [{ from: 'runner', to: 'evil' }, ...s.edges.slice(1)] })
      .testOnlyGraphMatches,
    false,
  )
})
test('P1-IAR05-07 missing fields and unknown fields denied', () => {
  const s = graph()
  for (const value of [
    null,
    {},
    { ...s, operationalPermit: true },
    { ...s, runner: { ...s.runner, privileged: true } },
  ]) {
    assert.equal(inspectSyntheticTopology(value).testOnlyGraphMatches, false)
  }
})
test('P1-IAR05-08 callback never runs even if a mock attempts outbound', () => {
  let count = 0
  const sideEffect = () => {
    count++
  }
  assert.throws(() => probeSyntheticForbiddenAdapter(sideEffect), /B1_P1_NO_OPERATIONAL_EGRESS/)
  assert.equal(count, 0)
})
test('P1-COMPOSE-01 all synthetic observations match while operational authority stays false', () => {
  const r = inspectSyntheticPreflight(makeSyntheticContext())
  assert.equal(r.testOnlyAllObservationsMatch, true)
  assert.equal(r.operationalDecision, 'DENY')
  assert.equal(r.runtimeAuthority, false)
})
test('P1-COMPOSE-02 any trust, PoP, price, cap or egress failure rejects composition', () => {
  const s = makeSyntheticContext()
  const variants = [
    { ...s, root: { ...s.root, epoch: 4 } },
    { ...s, identity: { ...s.identity, usedNonces: ['TEST_ONLY_NONCE_A'] } },
    { ...s, money: { ...s.money, bound: { ...s.money.bound, maxSends: 4 } } },
    { ...s, topology: { ...s.topology, runner: { ...s.topology.runner, bindings: ['AI'] } } },
    { ...s, caps: { ...s.caps, project: { cap: 10n, spent: 0n, holds: [] } } },
  ]
  for (const input of variants) {
    const r = inspectSyntheticPreflight(input)
    assert.equal(r.testOnlyAllObservationsMatch, false)
    assert.equal(r.operationalDecision, 'DENY')
  }
})
test('P1-COMPOSE-03 null and untrusted object are always denied', () => {
  for (const input of [null, undefined, {}, { grant: true, permission: 'ALLOW' }]) {
    const r = inspectSyntheticPreflight(input)
    assert.equal(r.operationalDecision, 'DENY')
    assert.equal(r.testOnlyAllObservationsMatch, false)
  }
})

test('P1-COMPOSE-04 malicious getters and throwing proxies fail closed', () => {
  const malicious = Object.defineProperty({}, 'root', {
    enumerable: true,
    get() {
      throw new Error('TEST_ONLY_GETTER')
    },
  })
  const trap = new Proxy(
    {},
    {
      get() {
        throw new Error('TEST_ONLY_PROXY')
      },
    },
  )
  for (const input of [malicious, trap]) {
    const r = inspectSyntheticPreflight(input)
    assert.equal(r.testOnlyAllObservationsMatch, false)
    assert.equal(r.operationalDecision, 'DENY')
    assert.equal(r.runtimeAuthority, false)
  }
})

test('P1-COMPOSE-05 individually matching but cross-epoch mismatch fails composition', () => {
  const s = makeSyntheticContext()
  const input = { ...s, root: { ...s.root, epoch: 4, snapshot: { ...s.root.snapshot, epoch: 4 } } }
  const r = inspectSyntheticPreflight(input)
  assert.equal(r.testOnlyAllObservationsMatch, false)
  assert.equal(r.operationalDecision, 'DENY')
})

test('P1-COMPOSE-06 extra operational permission field fails closed', () => {
  const input = { ...makeSyntheticContext(), operationalPermit: true }
  const r = inspectSyntheticPreflight(input)
  assert.equal(r.testOnlyAllObservationsMatch, false)
  assert.equal(r.runtimeAuthority, false)
  assert.equal(r.operationalDecision, 'DENY')
})
