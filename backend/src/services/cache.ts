import type { VocabPair } from './schemas'
import type { Bindings } from '../env'

const CACHE_PREFIX = 'cache:'
const CACHE_TTL = 86400 // 24 hours in seconds

/**
 * Creates a cache key from the request parameters.
 */
export function buildCacheKey(
  source: string,
  target: string,
  topic: string,
  level: string,
  count: number,
  mode: string,
): string {
  const dayBucket = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const raw = `${source}|${target}|${topic}|${level}|${count}|${mode}|${dayBucket}`
  return CACHE_PREFIX + raw
}

/**
 * Attempts to read from KV cache. Returns null on failure (non-blocking).
 */
export async function readCache(kv: Bindings['CACHE'], key: string): Promise<VocabPair[] | null> {
  try {
    const raw = await kv.get(key, 'json')
    if (raw && Array.isArray(raw)) return raw as VocabPair[]
  } catch {
    // Cache unavailable, continue without it
  }
  return null
}

/**
 * Writes pairs to KV cache with TTL. Non-blocking on failure.
 */
export async function writeCache(
  kv: Bindings['CACHE'],
  key: string,
  pairs: VocabPair[],
): Promise<void> {
  try {
    await kv.put(key, JSON.stringify(pairs), { expirationTtl: CACHE_TTL })
  } catch {
    // Cache write failure is non-critical
  }
}
