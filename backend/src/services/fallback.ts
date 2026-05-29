import type { VocabPair } from './schemas'

/**
 * Fetch fallback vocabulary pairs from D1 database.
 * Returns specific pairs if found, otherwise generic pairs.
 */
function mapRowToVocabPair(row: Record<string, unknown>): VocabPair {
  return {
    source: row.source as string,
    target: row.target as string,
    exampleSource: (row.exampleSource as string) ?? '',
    exampleTarget: (row.exampleTarget as string) ?? '',
    ipa: (row.ipa as string) ?? '',
    pos: (row.pos as string) ?? '',
    isPhrase: Boolean(row.isPhrase),
  }
}

export async function getFallbackPairsFromDB(
  db: D1Database,
  req: { source: string; target: string; topic: string; level: string },
): Promise<VocabPair[]> {
  // Try specific match first
  const { results: specific } = await db
    .prepare(
      `SELECT source, target, example_source as "exampleSource", example_target as "exampleTarget",
              ipa, pos, is_phrase as "isPhrase"
       FROM fallback_pairs
       WHERE source_lang = ? AND target_lang = ? AND topic = ? AND level = ?`,
    )
    .bind(req.source, req.target, req.topic, req.level)
    .all<Record<string, unknown>>()

  if (specific && specific.length > 0) return specific.map(mapRowToVocabPair)

  // Fall back to generic pairs
  const { results: generic } = await db
    .prepare(
      `SELECT source, target, example_source as "exampleSource", example_target as "exampleTarget",
              ipa, pos, is_phrase as "isPhrase"
       FROM fallback_pairs
       WHERE source_lang = '*' AND target_lang = '*' AND topic = '*' AND level = '*'`,
    )
    .all<Record<string, unknown>>()

  return generic ? generic.map(mapRowToVocabPair) : []
}
