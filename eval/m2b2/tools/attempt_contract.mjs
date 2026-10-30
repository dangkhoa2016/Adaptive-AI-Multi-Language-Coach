// Offline-only contract helpers. No fetch, Workers bindings, provider or secret imports.
import { createHash } from 'node:crypto'
const CHECK = (v, why) => {
  if (!v) throw Error(why)
}
const LOCALES = new Set(['en', 'vi'])
const TOPICS = new Set([
  'travel',
  'food',
  'work',
  'education',
  'health',
  'technology',
  'shopping',
  'entertainment',
  'daily_life',
  'nature',
])
const MODES = new Set(['word', 'phrase', 'mix'])
const LEVELS = new Set(['A1', 'A2', 'B1', 'B2'])
const OUTCOMES = new Set(['HTTP_RESPONSE', 'NETWORK_ERROR', 'TIMEOUT'])
const SCENARIOS = new Set(
  Array.from({ length: 12 }, (_, i) => `GEN-${String(i + 1).padStart(2, '0')}`),
)
function utcTimestamp(value) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)
  )
    return false
  const milliseconds = Date.parse(value)
  const canonical = value.includes('.') ? value : value.slice(0, -1) + '.000Z'
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === canonical
}
const sha256 = (s) => createHash('sha256').update(s).digest('hex')
// Explicit canonicalization for portable request hashes; not a model prompt hash.
const canonicalize = (x) =>
  Array.isArray(x)
    ? x.map(canonicalize)
    : x && typeof x === 'object'
      ? Object.fromEntries(
          Object.keys(x)
            .sort()
            .map((k) => [k, canonicalize(x[k])]),
        )
      : x
export const hashRequest = (req) => sha256(JSON.stringify(canonicalize(req)))
export function validateCapturedAttempt(x) {
  CHECK(x && x.record_kind === 'CAPTURED_ATTEMPT', 'record kind')
  CHECK(['SYNTHETIC_TEST', 'AUTHORIZED_CAPTURE'].includes(x.evidence_origin), 'unclassified origin')
  CHECK(
    SCENARIOS.has(x.scenario_id) &&
      typeof x.attempt_id === 'string' &&
      x.attempt_id.trim().length > 0,
    'attempt identifiers',
  )
  CHECK(/^[a-f0-9]{40}$/.test(x.application_commit), 'application commit')
  CHECK(
    x.request &&
      LOCALES.has(x.request.source) &&
      LOCALES.has(x.request.target) &&
      x.request.source !== x.request.target &&
      x.request.uiLocale === 'en',
    'request locale',
  )
  CHECK(
    TOPICS.has(x.request.topic) && LEVELS.has(x.request.level) && MODES.has(x.request.mode),
    'request enum',
  )
  CHECK(
    Number.isInteger(x.request.count) && x.request.count >= 1 && x.request.count <= 50,
    'request count',
  )
  CHECK(x.request_sha256 === hashRequest(x.request), 'request hash')
  CHECK(utcTimestamp(x.attempt_started_utc), 'start timestamp')
  CHECK(utcTimestamp(x.attempt_finished_utc), 'end timestamp')
  CHECK(
    typeof x.elapsed_ms_monotonic === 'number' &&
      Number.isFinite(x.elapsed_ms_monotonic) &&
      x.elapsed_ms_monotonic >= 0,
    'monotonic timing',
  )
  CHECK(OUTCOMES.has(x.transport_outcome), 'transport outcome')
  CHECK(
    (Number.isInteger(x.http_status) && x.http_status >= 100 && x.http_status <= 599) ||
      (x.http_status === null && x.transport_outcome !== 'HTTP_RESPONSE'),
    'http status',
  )
  if (x.transport_outcome !== 'HTTP_RESPONSE')
    CHECK(x.http_status === null && x.response === null, 'network/timeout cannot invent HTTP body')
  CHECK(
    x.provider && ['UNKNOWN_NOT_EVALUATED', 'VERIFIED'].includes(x.provider.model_identity_status),
    'provider identity status',
  )
  if (x.provider.model_identity_status === 'VERIFIED')
    CHECK(
      typeof x.provider.model_name === 'string' &&
        x.provider.model_name &&
        typeof x.provider.model_revision === 'string' &&
        x.provider.model_revision,
      'model identity must be verified',
    )
  for (const field of ['prompt_hash_sha256', 'model_config_hash_sha256'])
    CHECK(
      x.provider[field] === null || /^[a-f0-9]{64}$/.test(x.provider[field]),
      `invalid ${field}`,
    )
  CHECK(
    x.provider.verified_cost_usd === null ||
      (typeof x.provider.verified_cost_usd === 'number' &&
        x.provider.verified_cost_usd >= 0 &&
        Number.isFinite(x.provider.verified_cost_usd)),
    'cost not verified',
  )
  for (const field of ['usage_input_tokens', 'usage_output_tokens']) {
    const value = x.provider[field]
    CHECK(
      value === undefined || value === null || (Number.isSafeInteger(value) && value >= 0),
      'invalid token usage',
    )
  }
  if (x.http_status === 200) {
    CHECK(x.error_code === null, 'success cannot contain an error code')
    CHECK(x.transport_outcome === 'HTTP_RESPONSE', 'successful status requires response')
    const r = x.response
    CHECK(r && Array.isArray(r.pairs), 'success pairs')
    CHECK(
      r.requestedCount === x.request.count && r.returnedCount === r.pairs.length,
      'response counts',
    )
    CHECK(r.pairs.length >= 1 && r.pairs.length <= x.request.count, 'response pair limits')
    CHECK(r.partial === r.returnedCount < x.request.count, 'partial flag')
    CHECK(typeof r.isFallback === 'boolean' && typeof r.cacheHit === 'boolean', 'provenance flags')
    for (const pair of r.pairs)
      CHECK(
        typeof pair.source === 'string' &&
          pair.source.trim() &&
          typeof pair.target === 'string' &&
          pair.target.trim(),
        'pair text',
      )
  } else if (x.transport_outcome === 'HTTP_RESPONSE') {
    CHECK(
      x.response === null && typeof x.error_code === 'string' && x.error_code.length > 0,
      'failed attempt status',
    )
  }
  if (x.transport_outcome !== 'HTTP_RESPONSE')
    CHECK(
      typeof x.error_code === 'string' && x.error_code.trim().length > 0,
      'missing transport error code',
    )
  CHECK(x.semantic_scores === null && x.human_review_status === 'NOT_EVALUATED', 'not human scored')
  CHECK(
    x.pronunciation_score === undefined || x.pronunciation_score === null,
    'not pronunciation scored',
  )
  return true
}
export function summarizeAttempts(attempts) {
  CHECK(Array.isArray(attempts), 'attempt list')
  const ids = new Set(),
    origins = new Set()
  let success = 0,
    full = 0,
    returned = 0,
    requested = 0,
    cache = 0,
    fallback = 0,
    fail = 0,
    networkErrors = 0
  for (const x of attempts) {
    validateCapturedAttempt(x)
    origins.add(x.evidence_origin)
    CHECK(origins.size <= 1, 'mixed evidence origins require separate summaries')
    CHECK(!ids.has(x.attempt_id), 'duplicate attempt ID')
    ids.add(x.attempt_id)
    requested += x.request.count
    if (x.http_status === 200) {
      success++
      returned += x.response.returnedCount
      if (!x.response.partial) full++
      if (x.response.cacheHit) cache++
      if (x.response.isFallback) fallback++
    } else {
      fail++
      if (x.http_status === null) networkErrors++
    }
  }
  const n = attempts.length
  return {
    attempts: n,
    success,
    failed: fail,
    network_errors: networkErrors,
    full_deliveries: full,
    requested_pairs: requested,
    returned_pairs: returned,
    cache_deliveries: cache,
    fallback_deliveries: fallback,
    full_delivery_rate: n ? full / n : null,
    pair_yield: requested ? returned / requested : null,
    evidence_classification: n
      ? origins.has('SYNTHETIC_TEST')
        ? 'SYNTHETIC_ONLY'
        : 'AUTHORIZED_CAPTURE_CLASSIFIED_ONLY'
      : 'NOT_RUN',
    synthetic_attempts: origins.has('SYNTHETIC_TEST') ? n : 0,
    authorized_capture_attempts: origins.has('AUTHORIZED_CAPTURE') ? n : 0,
    independent_model_samples: 'NOT_DETERMINABLE_FROM_DELIVERY_COUNTS',
    semantic_accuracy: null,
    semantic_quality: 'NOT_EVALUATED',
  }
}
