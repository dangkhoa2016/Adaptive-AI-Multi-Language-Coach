import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const DEFAULT_ROOT = path.resolve(HERE, '..')
const LOCALES = new Set(['en', 'vi', 'ja', 'ko', 'th', 'zh', 'fr', 'de'])
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
const SCORE_FIELDS = [
  'semantic_accuracy',
  'context_alignment',
  'naturalness',
  'reference_suitability',
]
// Independent anchors, verified against the original M2-A kickoff and baseline inputs.
const ORIGINAL_HASHES = Object.freeze({
  'data/lexical_cases.draft.jsonl':
    '820e94e6b2b07c957214871f9435e6b320f82ec44789c06cf6f208271ddb7782',
  'data/generation_scenarios.original.jsonl':
    '20611ea689f4c6060375d89a0a55c81d6ec3ba5e4a49a1525e004a884d75bc34',
  'data/dataset_metadata.json': 'c9098fefbce98fd16117a3ed308cb2b87815a31290ae708426426adab0cb570c',
})
function requireNfc(value) {
  if (typeof value === 'string') assert(value.normalize('NFC') === value, 'non-NFC text')
  else if (Array.isArray(value)) value.forEach(requireNfc)
  else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      requireNfc(key)
      requireNfc(child)
    }
  }
}
function assert(c, msg) {
  if (!c) throw Error(msg)
}
export function jsonl(filepath) {
  const s = fs.readFileSync(filepath, 'utf8')
  assert(s.length > 0 && s.endsWith('\n'), `${path.basename(filepath)} must end with newline`)
  return s
    .slice(0, -1)
    .split('\n')
    .map((line, i) => {
      assert(line.trim().length > 0, `${filepath} blank line ${i + 1}`)
      try {
        return JSON.parse(line)
      } catch (e) {
        throw Error(`${filepath} invalid JSON on line ${i + 1}: ${e.message}`, { cause: e })
      }
    })
}
function uniques(xs, label) {
  assert(new Set(xs).size === xs.length, `duplicate ${label}`)
}
export function validate(root = DEFAULT_ROOT) {
  const p = (x) => path.join(root, x)
  const source = jsonl(p('data/lexical_cases.draft.jsonl'))
  const orig = jsonl(p('data/generation_scenarios.original.jsonl'))
  const proposed = jsonl(p('data/generation_scenarios.proposed.jsonl'))
  const reviews = jsonl(p('annotations/lexical_reference_review.pending.jsonl'))
  const provenance = JSON.parse(fs.readFileSync(p('data/input_provenance.json'), 'utf8'))
  assert(
    provenance && typeof provenance === 'object' && !Array.isArray(provenance),
    'invalid provenance',
  )
  assert(
    JSON.stringify(Object.keys(provenance).sort()) ===
      JSON.stringify(Object.keys(ORIGINAL_HASHES).sort()),
    'provenance paths differ from pinned inputs',
  )
  for (const [f, expectedHash] of Object.entries(ORIGINAL_HASHES)) {
    assert(provenance[f]?.sha256 === expectedHash, `provenance anchor changed: ${f}`)
    const hash = crypto
      .createHash('sha256')
      .update(fs.readFileSync(p(f)))
      .digest('hex')
    assert(hash === expectedHash, `original input modified: ${f}`)
  }
  requireNfc([source, orig, proposed, reviews])
  assert(source.length === 32, 'expected 32 original lexical cases')
  uniques(
    source.map((x) => x.id),
    'lexical case IDs',
  )
  const countDir = { ENVI: 0, VIEN: 0 }
  for (const x of source) {
    assert(['ENVI', 'VIEN'].includes(x.direction), `${x.id} direction`)
    countDir[x.direction]++
    assert(x.review_status === 'DRAFT_UNREVIEWED', `${x.id} unexpectedly promoted`)
    assert(
      x.rights_status === 'INTERNAL_ONLY_OWNER_PUBLICATION_DECISION_PENDING',
      `${x.id} rights status`,
    )
    assert(
      LOCALES.has(x.source_locale) &&
        LOCALES.has(x.target_locale) &&
        x.source_locale !== x.target_locale,
      `${x.id} locales`,
    )
    assert(
      (x.direction === 'ENVI' && x.source_locale === 'en' && x.target_locale === 'vi') ||
        (x.direction === 'VIEN' && x.source_locale === 'vi' && x.target_locale === 'en'),
      `${x.id} direction mismatch`,
    )
    for (const val of [
      x.source_text,
      x.context,
      ...x.accepted_reference_translations,
      ...x.known_wrong_translations,
    ])
      assert(
        typeof val === 'string' && val && val.normalize('NFC') === val,
        `${x.id} invalid/NFD value`,
      )
  }
  assert(countDir.ENVI === 16 && countDir.VIEN === 16, 'expected 16 lexical cases per direction')
  assert(orig.length === 12 && proposed.length === 12, 'expected 12 scenarios')
  uniques(
    orig.map((x) => x.id),
    'original scenario IDs',
  )
  uniques(
    proposed.map((x) => x.id),
    'proposed scenario IDs',
  )
  let exact = 0,
    approx = 0
  for (let i = 0; i < 12; i++) {
    const o = orig[i],
      x = proposed[i],
      r = x.proposed_request
    assert(o.id === x.id, `scenario order/identity mismatch ${i}`)
    for (const [k, v] of Object.entries({
      source_locale: o.source_locale,
      target_locale: o.target_locale,
      topic_intent: o.topic_intent,
      level_intent: o.level_intent,
      requested_count: o.requested_count,
      mode: o.mode,
      focus: o.focus,
    }))
      assert(x.original_intent[k] === v, `${o.id} original intent changed: ${k}`)
    assert(
      LOCALES.has(r.source) &&
        LOCALES.has(r.target) &&
        r.source !== r.target &&
        LOCALES.has(r.uiLocale),
      `${o.id} locale enum`,
    )
    assert(r.uiLocale === 'en', `${o.id} proposed UI locale must remain en`)
    assert(
      r.source === o.source_locale && r.target === o.target_locale,
      `${o.id} language direction changed`,
    )
    assert(TOPICS.has(r.topic), `${o.id} topic enum`)
    assert(LEVELS.has(r.level) && r.level === o.level_intent, `${o.id} level enum`)
    assert(
      Number.isInteger(r.count) && r.count >= 1 && r.count <= 50 && r.count === o.requested_count,
      `${o.id} count bounds`,
    )
    assert(MODES.has(r.mode), `${o.id} mode enum`)
    assert(x.topic_match === 'EXACT' || x.topic_match === 'APPROXIMATE', `${o.id} match status`)
    if (x.topic_match === 'EXACT') {
      exact++
      assert(o.topic_intent === r.topic, `${o.id} falsely exact`)
    } else {
      approx++
      assert(o.topic_intent !== r.topic, `${o.id} falsely approximate`)
    }
    assert(typeof x.rationale === 'string' && x.rationale.length > 15, `${o.id} missing rationale`)
    assert(
      x.owner_review === 'PENDING' && x.mode_selection === 'PROPOSED_NOT_OWNER_APPROVED',
      `${o.id} unauthorized approval`,
    )
    assert(
      x.execution_status === 'NOT_RUN' && x.semantic_quality === 'NOT_EVALUATED',
      `${o.id} unverified quality or execution`,
    )
    assert(x.schema_compatible_proposal === true, `${o.id} not proposal`)
  }
  assert(exact === 5 && approx === 7, 'exact/approx mapping count differs from reviewed plan')
  assert(reviews.length === 64, 'expected 64 reviewer slots')
  uniques(
    reviews.map((x) => `${x.case_id}:${x.reviewer_slot}`),
    'case/slot reviewer assignments',
  )
  const cases = new Set(source.map((x) => x.id))
  for (const a of reviews) {
    assert(cases.has(a.case_id), `unknown review case ${a.case_id}`)
    assert(['A', 'B'].includes(a.reviewer_slot), `invalid reviewer slot`)
    assert(
      a.review_status === 'PENDING' && a.reviewer_id === null && a.reviewed_at_utc === null,
      `${a.case_id} falsely completed review`,
    )
    assert(a.assessment_kind === 'REFERENCE_CURATION', `${a.case_id} review lane mismatch`)
    for (const k of [...SCORE_FIELDS, 'critical_error', 'language_direction_error'])
      assert(a[k] === null, `${a.case_id} has an unreviewed rating/flag: ${k}`)
    assert(
      a.notes === null && a.accent_dialect === null,
      `${a.case_id} pending review fields must be blank`,
    )
  }
  for (const c of cases)
    assert(
      reviews.some((x) => x.case_id === c && x.reviewer_slot === 'A') &&
        reviews.some((x) => x.case_id === c && x.reviewer_slot === 'B'),
      `missing reviewer slots for ${c}`,
    )
  const template = JSON.parse(
    fs.readFileSync(p('annotations/model_output_review.empty_template.json'), 'utf8'),
  )
  const modelFields = [
    'sample_id',
    'scenario_id',
    'model_revision',
    'prompt_hash',
    'generated_pair_index',
    'reviewer_slot',
    'reviewer_id',
    'review_status',
    'semantic_accuracy',
    'context_alignment',
    'naturalness',
    'example_fidelity',
    'ipa_quality',
    'ipa_applicable',
    'critical_error',
    'language_direction_error',
    'notes',
    'accent_dialect',
    'reviewed_at_utc',
  ]
  assert(
    template &&
      typeof template === 'object' &&
      !Array.isArray(template) &&
      JSON.stringify(Object.keys(template).sort()) === JSON.stringify(modelFields.sort()),
    'model review template fields invalid',
  )
  assert(
    Object.entries(template).every(([key, value]) =>
      key === 'review_status' ? value === 'PENDING' : value === null,
    ),
    'model review template must remain blank',
  )
  return {
    status: 'OFFLINE_DATA_CONTRACT_PASS',
    lexical_cases: source.length,
    directions: countDir,
    scenarios: proposed.length,
    topic_exact: exact,
    topic_approximate: approx,
    proposed_schema_compatible: proposed.length,
    owner_approved_scenarios: 0,
    executed_scenarios: 0,
    review_slots: reviews.length,
    completed_human_reviews: 0,
    model_samples: 0,
    model_quality: 'NOT_EVALUATED',
    real_provider: 'NOT_RUN',
    speech: 'NOT_RUN',
    production_release: 'NOT_AUTHORIZED',
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(JSON.stringify(validate(process.argv[2] ?? DEFAULT_ROOT), null, 2))
  } catch (e) {
    console.error('CONTRACT_FAIL:', e.message)
    process.exitCode = 1
  }
}
