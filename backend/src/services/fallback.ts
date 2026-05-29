import type { VocabPair } from './schemas'

/**
 * Fetch fallback vocabulary pairs from D1 database.
 * Returns specific pairs if found, otherwise generic pairs.
 */
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
    .all<VocabPair>()

  if (specific && specific.length > 0) return specific

  // Fall back to generic pairs
  const { results: generic } = await db
    .prepare(
      `SELECT source, target, example_source as "exampleSource", example_target as "exampleTarget",
              ipa, pos, is_phrase as "isPhrase"
       FROM fallback_pairs
       WHERE source_lang = '*' AND target_lang = '*' AND topic = '*' AND level = '*'`,
    )
    .all<VocabPair>()

  return generic ?? []
}
