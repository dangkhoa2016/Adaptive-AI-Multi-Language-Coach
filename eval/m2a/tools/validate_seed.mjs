#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import process from 'node:process'

export function parseJsonl(content) {
  return content
    .split(/\r?\n/u)
    .filter((line) => line.trim().length)
    .map((line, idx) => {
      try {
        return JSON.parse(line)
      } catch {
        throw Error(`JSONL parse error at line ${idx + 1}`)
      }
    })
}
const nonblank = (s) => typeof s === 'string' && s.trim().length > 0
export function validateLexicalCases(data) {
  const errors = []
  const ids = new Set()
  const counts = { ENVI: 0, VIEN: 0 }
  if (!Array.isArray(data) || data.length === 0) errors.push('empty dataset')
  for (const [index, c] of data.entries()) {
    const label = `line ${index + 1}`
    if (!c || typeof c !== 'object' || Array.isArray(c)) {
      errors.push(`${label}: not object`)
      continue
    }
    if (!/^(ENVI|VIEN)-\d{3}$/u.test(c.id ?? '')) errors.push(`${label}: invalid id`)
    if (ids.has(c.id)) errors.push(`${label}: duplicate id ${c.id}`)
    ids.add(c.id)
    if (!['ENVI', 'VIEN'].includes(c.direction)) errors.push(`${label}: unknown direction`)
    else counts[c.direction]++
    const expected = c.direction === 'ENVI' ? ['en', 'vi'] : ['vi', 'en']
    if (c.source_locale !== expected[0] || c.target_locale !== expected[1])
      errors.push(`${label}: locale/direction mismatch`)
    for (const k of ['source_text', 'context', 'annotation_note', 'provenance', 'rights_status']) {
      if (!nonblank(c[k])) errors.push(`${label}: ${k} empty`)
    }
    if (
      !Array.isArray(c.accepted_reference_translations) ||
      !c.accepted_reference_translations.length ||
      !c.accepted_reference_translations.every(nonblank)
    )
      errors.push(`${label}: no valid accepted translations`)
    if (!Array.isArray(c.known_wrong_translations) || !c.known_wrong_translations.every(nonblank))
      errors.push(`${label}: invalid wrong translations`)
    if (!['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(c.level_hint))
      errors.push(`${label}: invalid level`)
    if (!Array.isArray(c.tags) || !c.tags.length || !c.tags.every(nonblank))
      errors.push(`${label}: invalid tags`)
    if (c.review_status !== 'DRAFT_UNREVIEWED')
      errors.push(`${label}: cannot claim human approval in draft seed`)
    if (c.rights_status !== 'INTERNAL_ONLY_OWNER_PUBLICATION_DECISION_PENDING')
      errors.push(`${label}: unapproved publication rights`)
    const textFields = [
      c.source_text,
      c.context,
      ...(Array.isArray(c.accepted_reference_translations)
        ? c.accepted_reference_translations
        : []),
      ...(Array.isArray(c.known_wrong_translations) ? c.known_wrong_translations : []),
    ]
    if (textFields.some((x) => typeof x === 'string' && x !== x.normalize('NFC')))
      errors.push(`${label}: non-NFC text`)
  }
  return {
    status: errors.length ? 'FAIL' : 'PASS_DATA_CONTRACT_ONLY',
    case_count: data.length,
    directions: counts,
    errors,
  }
}
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const path =
    process.argv[2] ?? new URL('../data/lexical_cases.draft.jsonl', import.meta.url).pathname
  const result = validateLexicalCases(parseJsonl(readFileSync(path, 'utf8')))
  process.stdout.write(JSON.stringify(result, null, 2) + '\n')
  process.exitCode = result.errors.length ? 1 : 0
}
