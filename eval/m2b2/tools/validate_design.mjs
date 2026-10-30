import console from 'node:console'
import process from 'node:process'
import { isDeepStrictEqual } from 'node:util'
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = 'data/source/'
const PLAN = 'data/planning/'
const GROUPS = {
  MAIN_EXACT: new Set(['GEN-04', 'GEN-06', 'GEN-07', 'GEN-09', 'GEN-11']),
  EXPLORATORY_APPROXIMATE: new Set(['GEN-01', 'GEN-02', 'GEN-05', 'GEN-08']),
  BLOCKED_ORIGINAL_INTENT: new Set(['GEN-03', 'GEN-10', 'GEN-12']),
}
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
const LEVELS = new Set(['A1', 'A2', 'B1', 'B2'])
const MODES = new Set(['word', 'phrase', 'mix'])
const REQUIRED_SOURCE = [
  'dataset_metadata.json',
  'generation_scenarios.original.jsonl',
  'generation_scenarios.proposed.jsonl',
  'input_provenance.json',
  'lexical_cases.draft.jsonl',
  'lexical_reference_review.pending.jsonl',
  'model_output_review.empty_template.json',
]
const PINNED_B1_SOURCE = {
  // These static pins are taken from the supplied B1 ZIP, not calculated from candidate files.
  // The package manifest separately verifies tool and input integrity.
  'lexical_cases.draft.jsonl': '820e94e6b2b07c957214871f9435e6b320f82ec44789c06cf6f208271ddb7782',
  'generation_scenarios.original.jsonl':
    '20611ea689f4c6060375d89a0a55c81d6ec3ba5e4a49a1525e004a884d75bc34',
  'generation_scenarios.proposed.jsonl':
    '3803f372074ba7721a19902d080018584449413f6b16e097badf0a94634aa55e',
  'dataset_metadata.json': 'c9098fefbce98fd16117a3ed308cb2b87815a31290ae708426426adab0cb570c',
  'input_provenance.json': 'b1671cd9798ae06d7f65892bbe3afd33acd562782bdb6997fde62cd7edf9fed5',
  'lexical_reference_review.pending.jsonl':
    '4757afe9b2275ef40852a3d7d729a3a9f4c44c6b6191e30f138c87ec4aa93d84',
  'model_output_review.empty_template.json':
    'a2ae816d8f19a1384ae6bb7fcbea244e7f91a2a7e7978546150ff816bdb98ad4',
}

// Fixed pending-design state, not derived from candidate input files.
const EMPTY_CAPTURE = {
  record_kind: 'EMPTY_TEMPLATE_NOT_A_RUN',
  execution_status: 'NOT_RUN',
  evidence_origin: 'UNPOPULATED',
  scenario_id: null,
  attempt_id: null,
  attempt_started_utc: null,
  attempt_finished_utc: null,
  elapsed_ms_monotonic: null,
  application_commit: null,
  request: null,
  request_sha256: null,
  http_status: null,
  transport_outcome: null,
  error_code: null,
  response: {
    pairs: null,
    requestedCount: null,
    returnedCount: null,
    partial: null,
    isFallback: null,
    cacheHit: null,
  },
  provider: {
    provider_kind: null,
    model_name: null,
    model_revision: null,
    model_identity_status: 'UNKNOWN_NOT_EVALUATED',
    prompt_hash_sha256: null,
    model_config_hash_sha256: null,
    usage_input_tokens: null,
    usage_output_tokens: null,
    verified_cost_usd: null,
  },
  human_review_status: 'NOT_EVALUATED',
  semantic_scores: null,
  pronunciation_score: null,
}
const EMPTY_METRICS = {
  successful_deliveries: null,
  full_delivery_rate: null,
  pair_yield: null,
  model_only_semantic_accuracy: null,
  semantic_quality_status: 'NOT_EVALUATED',
  ipa_quality: null,
  tts_stt_quality: null,
  wilson_ci: null,
}
const EMPTY_LANES = {
  reference_curation: {
    draft_cases: 32,
    reviewer_slots: 64,
    completed_reviews: 0,
    status: 'NOT_EVALUATED',
  },
  model_sample: {
    actual_samples: 0,
    status: 'NOT_RUN',
  },
  speech: {
    status: 'NOT_RUN',
  },
}
const PENDING_PREREQUISITES = {
  owner_topic_mode_approval: false,
  rubric_approved: false,
  reviewers_approved: false,
  rights_confirmed: false,
  budget_cap_usd: null,
  approved_provider_model_revision: null,
  approved_sandbox_environment: null,
  provider_auth_secret_present: false,
}
function requireNfc(value) {
  if (typeof value === 'string')
    check(value.normalize('NFC') === value, 'planning text must be NFC')
  else if (Array.isArray(value)) value.forEach(requireNfc)
  else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      requireNfc(key)
      requireNfc(child)
    }
  }
}

function check(cond, message) {
  if (!cond) throw Error(message)
}
function load(root, name) {
  return JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'))
}
function jsonl(root, name) {
  const raw = fs.readFileSync(path.join(root, name), 'utf8')
  check(raw.length && raw.endsWith('\n'), `${name}: newline required`)
  check(
    !raw
      .split('\n')
      .slice(0, -1)
      .some((s) => !s.trim()),
    `${name}: empty line`,
  )
  return raw
    .slice(0, -1)
    .split('\n')
    .map((s, i) => {
      try {
        return JSON.parse(s)
      } catch {
        throw Error(`${name}: invalid JSON line ${i + 1}`)
      }
    })
}
function sha(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}
function serial(a) {
  return JSON.stringify(a)
}
export function validate(root = ROOT) {
  const pins = load(root, `${PLAN}source_anchors.json`)
  check(
    pins.baseline_m2b1_commit === 'c5f61515b6ff363ef35ee5abb6474ddec5f549b1',
    'baseline mismatch',
  )
  const names = Object.keys(pins.immutable_source_sha256)
  check(
    names.length === REQUIRED_SOURCE.length &&
      REQUIRED_SOURCE.every((n) => names.includes(SOURCE + n)),
    'unexpected source pin paths',
  )
  for (const name of REQUIRED_SOURCE) {
    const actual = sha(fs.readFileSync(path.join(root, SOURCE + name)))
    check(pins.immutable_source_sha256[SOURCE + name] === actual, `original input altered: ${name}`)
    if (PINNED_B1_SOURCE[name])
      check(actual === PINNED_B1_SOURCE[name], `external B1 hash mismatch: ${name}`)
  }
  const original = jsonl(root, SOURCE + 'generation_scenarios.original.jsonl')
  const proposed = jsonl(root, SOURCE + 'generation_scenarios.proposed.jsonl')
  const decisions = jsonl(root, PLAN + 'scenario_decisions.proposed.jsonl')
  const lexical = jsonl(root, SOURCE + 'lexical_cases.draft.jsonl')
  const reviews = jsonl(root, SOURCE + 'lexical_reference_review.pending.jsonl')
  requireNfc([pins, decisions])
  check(
    original.length === 12 && proposed.length === 12 && decisions.length === 12,
    '12 scenarios required',
  )
  check(lexical.length === 32 && reviews.length === 64, '32 lexical / 64 slots required')
  check(new Set(decisions.map((x) => x.scenario_id)).size === 12, 'duplicate decision ids')
  check(
    new Set(reviews.map((x) => `${x.case_id}:${x.reviewer_slot}`)).size === 64,
    'duplicate reviewer slots',
  )
  check(
    reviews.every(
      (x) =>
        x.review_status === 'PENDING' &&
        x.reviewer_id === null &&
        x.reviewed_at_utc === null &&
        [
          'semantic_accuracy',
          'context_alignment',
          'naturalness',
          'reference_suitability',
          'critical_error',
          'language_direction_error',
          'notes',
          'accent_dialect',
        ].every((k) => x[k] === null),
    ),
    'unreviewed slots modified',
  )
  const total = { ENVI: 0, VIEN: 0 },
    groups = { MAIN_EXACT: [], EXPLORATORY_APPROXIMATE: [], BLOCKED_ORIGINAL_INTENT: [] }
  for (let i = 0; i < 12; i++) {
    const o = original[i],
      p = proposed[i],
      d = decisions[i],
      r = d.proposed_request
    check(o.id === p.id && p.id === d.scenario_id, 'scenario ordering/identity drift')
    check(
      serial(d.original_intent) === serial(p.original_intent) &&
        serial(r) === serial(p.proposed_request),
      'proposed request changed from B1',
    )
    check(
      d.source_original_sha256 === PINNED_B1_SOURCE['generation_scenarios.original.jsonl'],
      'original scenario provenance drift',
    )
    check(d.topic_match === p.topic_match, 'topic match changed')
    check(TOPICS.has(r.topic) && LEVELS.has(r.level) && MODES.has(r.mode), 'backend enum mismatch')
    check(
      ['en', 'vi'].includes(r.source) &&
        ['en', 'vi'].includes(r.target) &&
        r.source !== r.target &&
        r.uiLocale === 'en',
      'language direction or UI locale mismatch',
    )
    check(
      r.source === o.source_locale &&
        r.target === o.target_locale &&
        r.level === o.level_intent &&
        r.count === o.requested_count,
      'original intention changed',
    )
    check(Number.isInteger(r.count) && r.count >= 1 && r.count <= 50, 'invalid count')
    check(
      d.owner_topic_approval === 'PENDING' &&
        d.owner_mode_approval === 'PENDING' &&
        d.inference_authorization === 'NOT_AUTHORIZED' &&
        d.execution_status === 'NOT_RUN' &&
        d.semantic_quality === 'NOT_EVALUATED',
      'unauthorized status or fake result',
    )
    const group = Object.keys(GROUPS).find((group) => GROUPS[group].has(o.id))
    check(d.recommended_lane === group, 'scenario grouping drift')
    check(
      (group === 'MAIN_EXACT') === (d.topic_match === 'EXACT'),
      'main lane must have exact topic',
    )
    groups[group].push(o.id)
    if (group === 'MAIN_EXACT') total[r.source === 'en' ? 'ENVI' : 'VIEN'] += r.count
  }
  const plan = load(root, PLAN + 'pilot_plan.proposed.json')
  check(
    plan.phase === 'M2_B2_EVALUATION_DESIGN_ONLY' &&
      plan.runtime_inference_authorization === 'NOT_AUTHORIZED' &&
      plan.status === 'PROPOSED_OWNER_REVIEW_PENDING',
    'pilot unauthorized transition',
  )
  requireNfc(plan)
  check(plan.source_final_head === pins.baseline_m2b1_commit, 'source baseline mismatch')
  check(plan.stage_0?.gate === 'OWNER_SIGNOFF_REQUIRED', 'owner signoff gate missing')
  const pilot = plan.pilot_candidate
  check(
    pilot.main_scenario_attempts_if_once_each === 5 &&
      pilot.maximum_requested_pairs_for_single_main_pass === 46 &&
      serial(pilot.by_direction_requested_pairs_if_complete) === serial({ ENVI: 16, VIEN: 30 }),
    'pilot count assertion',
  )
  for (const [field, group] of [
    ['main_scenarios', 'MAIN_EXACT'],
    ['exploratory_scenarios', 'EXPLORATORY_APPROXIMATE'],
    ['blocked_original_intent', 'BLOCKED_ORIGINAL_INTENT'],
  ]) {
    check(
      serial(pilot[field]) === serial([...GROUPS[group]].sort()),
      `pilot ${field} grouping drift`,
    )
  }
  check(total.ENVI === 16 && total.VIEN === 30, 'directional total drift')
  check(
    pilot.executed_attempts === 0 &&
      pilot.collected_model_pairs === 0 &&
      pilot.independent_inferences === 0 &&
      pilot.human_reviews === 0 &&
      pilot.fallbacks === 0 &&
      pilot.cache_hits === 0 &&
      pilot.candidate_stage === 'NOT_RUN',
    'invented pilot outputs',
  )
  check(
    isDeepStrictEqual(plan.execution_prerequisites, PENDING_PREREQUISITES),
    'unexpected owner or provider approval',
  )
  check(isDeepStrictEqual(plan.metrics, EMPTY_METRICS), 'invented semantic metric')
  check(
    isDeepStrictEqual(plan.evaluation_lanes, EMPTY_LANES),
    'invented evaluation lane review or sample',
  )
  const capture = load(root, PLAN + 'attempt_capture.empty.json')
  requireNfc(capture)
  check(isDeepStrictEqual(capture, EMPTY_CAPTURE), 'fabricated capture sample')
  return {
    status: 'M2_B2_DESIGN_CONTRACT_PASS',
    baseline_m2b1_commit: pins.baseline_m2b1_commit,
    scenarios: 12,
    group_counts: Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.length])),
    pilot_requested_max_if_once_each: 46,
    by_direction: total,
    completed_human_reviews: 0,
    model_attempts: 0,
    model_samples: 0,
    semantic_quality: 'NOT_EVALUATED',
    live_inference: 'NOT_AUTHORIZED',
    speech: 'NOT_RUN',
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(JSON.stringify(validate(process.argv[2] || ROOT), null, 2))
  } catch (e) {
    console.error('DESIGN_VALIDATION_FAIL:', e.message)
    process.exitCode = 1
  }
}
