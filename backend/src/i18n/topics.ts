export const TOPIC_KEYS = [
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
] as const

export type TopicKey = (typeof TOPIC_KEYS)[number]

interface TopicRow {
  key: TopicKey
  label: string
}

/**
 * Fetch topics from D1 database, returning translated labels for the given locale.
 */
export async function getTopicsFromDB(db: D1Database, locale: string): Promise<TopicRow[]> {
  const column = `label_${locale}`
  const { results } = await db
    .prepare(`SELECT key, ${column} as label FROM topics ORDER BY rowid`)
    .all<TopicRow>()

  return results ?? []
}
