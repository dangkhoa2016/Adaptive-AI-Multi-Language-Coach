import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import app from '../../src/index'
import * as ai from '../../src/services/ai'
import * as fallback from '../../src/services/fallback'
import type { Bindings } from '../../src/env'
import { vocabPairSchema } from '../../src/services/schemas'

const pairs = ['one', 'two', 'three'].map((source, i) =>
  vocabPairSchema.parse({ source, target: ['một', 'hai', 'ba'][i] }),
)
const request = { source: 'en', target: 'vi', topic: 'travel', level: 'A1', count: 2, mode: 'mix' }
const bindings = env as unknown as Bindings
beforeEach(async () => {
  const { keys } = await bindings.CACHE.list()
  await Promise.all(keys.map(({ name }) => bindings.CACHE.delete(name)))
})
const call = (path: string, body: unknown) =>
  app.fetch(
    new Request(`http://localhost/api/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    bindings,
  )
afterEach(() => vi.restoreAllMocks())

describe('M2 generate count and provenance route seams (local D1/KV)', () => {
  it('reports a partial AI set explicitly and preserves metadata on cache hits', async () => {
    vi.spyOn(ai, 'callAI').mockResolvedValue([pairs[0]])
    for (const cacheHit of [false, true]) {
      const res = await call('generate', request)
      expect(res.status).toBe(200)
      expect(await res.json()).toMatchObject({
        pairs: [pairs[0]],
        isFallback: false,
        cacheHit,
        requestedCount: 2,
        returnedCount: 1,
        partial: true,
      })
    }
  })
  it('caps excess AI pairs and labels a full result', async () => {
    vi.spyOn(ai, 'callAI').mockResolvedValue(pairs)
    const res = await call('generate', request)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      pairs: pairs.slice(0, 2),
      requestedCount: 2,
      returnedCount: 2,
      partial: false,
    })
  })
  it('reports a short labelled fallback without pretending it is complete', async () => {
    vi.spyOn(ai, 'callAI').mockResolvedValue(null)
    vi.spyOn(fallback, 'getFallbackPairsFromDB').mockResolvedValue([pairs[0]])
    const res = await call('generate', request)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      isFallback: true,
      requestedCount: 2,
      returnedCount: 1,
      partial: true,
    })
  })
  it('rejects malformed fallback content before returning or caching it', async () => {
    vi.spyOn(ai, 'callAI').mockResolvedValue(null)
    vi.spyOn(fallback, 'getFallbackPairsFromDB').mockResolvedValue([{ ...pairs[0], target: '  ' }])
    const res = await call('generate', request)
    expect(res.status).toBe(503)
    expect(await res.json()).toMatchObject({ error: 'fallback_unavailable' })
  })
  it('returns unavailable for wrong-locale fallback and keeps reverse-direction cache separate', async () => {
    vi.spyOn(ai, 'callAI').mockResolvedValue(null)
    const res = await call('generate', { ...request, source: 'fr', target: 'de' })
    expect(res.status).toBe(503)
    expect(await res.json()).toMatchObject({ error: 'fallback_unavailable' })
    const forward = await call('generate', request)
    expect(forward.status).toBe(200)
    const reverse = await call('generate', { ...request, source: 'vi', target: 'en' })
    expect(reverse.status).toBe(503)
  })
})

describe('M2 quiz availability route contract', () => {
  it('returns explicit 422 instead of placeholder or duplicated distractors', async () => {
    const res = await call('quiz', { pairs: [pairs[0]] })
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({ error: 'quiz_unavailable' })
  })
  it('preserves four-choice success for a structurally valid target pool', async () => {
    const res = await call('quiz', {
      pairs: [...pairs, vocabPairSchema.parse({ source: 'four', target: 'bốn' })],
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      questions: { options: string[]; correctIndex: number; pair: { target: string } }[]
    }
    expect(body.questions).toHaveLength(4)
    for (const q of body.questions) {
      expect(new Set(q.options).size).toBe(4)
      expect(q.options.filter((s) => s === q.pair.target)).toHaveLength(1)
      expect(q.options[q.correctIndex]).toBe(q.pair.target)
    }
  })
})
