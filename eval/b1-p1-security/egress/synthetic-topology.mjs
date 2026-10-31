// Graph observation ONLY. Does not constrain Cloudflare Workers, sockets or runtime bindings.
const nodes = ['runner', 'broker', 'provider', 'ledger', 'audit']
const approved = new Set(['runner>broker', 'broker>provider', 'broker>ledger', 'broker>audit'])
const closed = (o, f) =>
  !!o &&
  typeof o === 'object' &&
  !Array.isArray(o) &&
  Object.keys(o).length === f.length &&
  f.every((k) => Object.hasOwn(o, k))
const result = (match = false, reason = 'TOPOLOGY_UNKNOWN') =>
  Object.freeze({
    kind: 'TEST_ONLY_GRAPH_OBSERVATION',
    testOnlyGraphMatches: match,
    reason,
    operationalDecision: 'DENY',
  })
export function inspectSyntheticTopology(graph) {
  try {
    if (
      !closed(graph, ['marker', 'runner', 'nodes', 'edges']) ||
      graph.marker !== 'TEST_ONLY_STATIC_GRAPH' ||
      !closed(graph.runner, ['globalOutbound', 'bindings', 'connectAvailable']) ||
      graph.runner.globalOutbound !== 'none' ||
      graph.runner.connectAvailable !== false ||
      !Array.isArray(graph.runner.bindings) ||
      graph.runner.bindings.length !== 1 ||
      graph.runner.bindings[0] !== 'TEST_ONLY_BROKER' ||
      !Array.isArray(graph.nodes) ||
      graph.nodes.length !== nodes.length ||
      new Set(graph.nodes).size !== nodes.length ||
      nodes.some((name) => !graph.nodes.includes(name)) ||
      !Array.isArray(graph.edges) ||
      graph.edges.length !== approved.size
    )
      return result()
    const seen = new Set()
    for (const edge of graph.edges) {
      if (!closed(edge, ['from', 'to']) || !nodes.includes(edge.from) || !nodes.includes(edge.to))
        return result()
      const pair = edge.from + '>' + edge.to
      if (!approved.has(pair) || seen.has(pair)) return result(false, 'BYPASS_OR_DUPLICATE_EDGE')
      seen.add(pair)
    }
    return result(seen.size === approved.size, 'TEST_ONLY_STATIC_MATCH')
  } catch {
    return result()
  }
}
export function probeSyntheticForbiddenAdapter(callback) {
  void callback // never invoke caller-provided outbound function
  throw new Error('B1_P1_NO_OPERATIONAL_EGRESS')
}
