import { generateResponseSchema, type VocabPair } from './schemas'
import { getAppSettings, type AppSettings } from './appSettings'
import type { Bindings } from '../env'

// Invalidate legacy entries that may contain unlabelled, wrong-language fallback.
const CACHE_PREFIX = 'cache:v3:'
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
  configuration = 'default',
): string {
  const dayBucket = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const raw = JSON.stringify([source, target, topic, level, count, mode, dayBucket])
  return CACHE_PREFIX + configuration + ':' + raw
}

/**
 * Attempts to read from KV cache. Returns null on failure (non-blocking).
 */
export interface CachedGeneration {
  pairs: VocabPair[]
  isFallback: boolean
}

// Only public generation inputs/settings enter this namespace; never credentials or user data.
export async function generationCacheNamespace(
  db: D1Database,
  snapshot?: AppSettings,
): Promise<string> {
  const settings = snapshot ?? (await getAppSettings(db))
  const bytes = new TextEncoder().encode(JSON.stringify(settings))
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function readCache(
  kv: Bindings['CACHE'],
  key: string,
): Promise<CachedGeneration | null> {
  try {
    const raw = await kv.get(key, 'json')
    if (!raw || typeof raw !== 'object') return null
    const value = raw as Partial<CachedGeneration>
    const parsed = generateResponseSchema.safeParse({ pairs: value.pairs })
    if (parsed.success && typeof value.isFallback === 'boolean') {
      return { pairs: parsed.data.pairs, isFallback: value.isFallback }
    }
  } catch {
    // Cache unavailable, continue without it.
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
  isFallback: boolean,
): Promise<void> {
  try {
    await kv.put(key, JSON.stringify({ pairs, isFallback }), { expirationTtl: CACHE_TTL })
  } catch {
    // Cache write failure is non-critical
  }
}
