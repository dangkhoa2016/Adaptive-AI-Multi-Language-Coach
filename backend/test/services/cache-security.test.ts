import { afterEach, describe, expect, it } from 'vitest'
import {
  buildCacheKey,
  generationCacheNamespace,
  readCache,
  writeCache,
} from '../../src/services/cache'
import { createMockEnv, resetSystemSettings, systemSettingsStore } from '../helpers'

afterEach(resetSystemSettings)
describe('public generation cache boundaries', () => {
  it('separates locale, model/options, schema version and delimiter-bearing inputs', async () => {
    const db = (createMockEnv() as { DB: D1Database }).DB
    const initial = await generationCacheNamespace(db)
    systemSettingsStore.set('env.AI_MODEL_NAME', 'synthetic-model-v2')
    const changedModel = await generationCacheNamespace(db)
    expect(changedModel).not.toBe(initial)
    systemSettingsStore.set('env.AI_MODEL_OPTIONS', '{"temperature":0.2}')
    expect(await generationCacheNamespace(db)).not.toBe(changedModel)
    const key = buildCacheKey('en', 'vi', 'travel', 'A1', 2, 'word', initial)
    expect(key).toContain('cache:v3:')
    expect(buildCacheKey('en', 'fr', 'travel', 'A1', 2, 'word', initial)).not.toBe(key)
    expect(buildCacheKey('en', 'vi', 'a|b', 'c', 2, 'word')).not.toBe(
      buildCacheKey('en', 'vi', 'a', 'b|c', 2, 'word'),
    )
  })
  it('preserves fallback disclosure and rejects unlabelled or invalid legacy payloads', async () => {
    let stored: unknown
    const kv = {
      get: async () => stored,
      put: async (_key: string, raw: string) => {
        stored = JSON.parse(raw)
      },
    } as unknown as KVNamespace
    const pairs = [
      {
        source: 'hello',
        target: 'xin chào',
        isPhrase: false,
        ipa: '',
        pos: '',
        exampleSource: '',
        exampleTarget: '',
      },
    ]
    await writeCache(kv, 'synthetic-public-key', pairs, true)
    expect(await readCache(kv, 'synthetic-public-key')).toEqual({ pairs, isFallback: true })
    stored = pairs
    expect(await readCache(kv, 'synthetic-public-key')).toBeNull()
    stored = { pairs: [{ source: '', target: 'invalid' }], isFallback: false }
    expect(await readCache(kv, 'synthetic-public-key')).toBeNull()
  })
})
