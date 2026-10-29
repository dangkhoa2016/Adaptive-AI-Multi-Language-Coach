import { env } from 'cloudflare:test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import app from '../../src/index'
import type { Bindings } from '../../src/env'
import * as mail from '../../src/services/mail'
import { getFallbackPairsFromDB } from '../../src/services/fallback'

const testDB = (env as unknown as Bindings).DB

// Finite deterministic binding double: enforce real quota semantics without a wall-clock race.
function quota(max: number) {
  const counts = new Map<string, number>()
  return {
    counts,
    async limit({ key }: { key: string }) {
      const used = (counts.get(key) ?? 0) + 1
      counts.set(key, used)
      return { success: used <= max }
    },
  }
}
function setup() {
  const api = quota(3)
  const auth = quota(3)
  const bindings = {
    ...env,
    RATE_LIMITER_API: api,
    RATE_LIMITER_AUTH: auth,
  } as unknown as Bindings
  const call = (path: string, body?: string, method = body === undefined ? 'GET' : 'POST') =>
    app.fetch(
      new Request(`http://localhost/api${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '192.0.2.10' },
        body,
      }),
      bindings,
    )
  return { api, auth, call }
}

afterEach(() => vi.restoreAllMocks())

describe('M0 auth body contracts with local D1', () => {
  it('accepts an object email and persists its hashed token; external mail is stubbed', async () => {
    vi.spyOn(mail, 'sendEmail').mockResolvedValue(true)
    const { call } = setup()
    const res = await call('/auth/request', JSON.stringify({ email: 'synthetic@example.invalid' }))
    expect(res.status).toBe(200)
    const row = await testDB
      .prepare('SELECT token_hash FROM magic_tokens WHERE email = ?')
      .bind('synthetic@example.invalid')
      .first<{ token_hash: string }>()
    expect(row?.token_hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it.each(['{', '', 'null', '[]', '42', '"already serialized"', '{"email":42}'])(
    'rejects malformed or non-object request input with 400: %s',
    async (body) => {
      const { call } = setup()
      expect((await call('/auth/request', body)).status).toBe(400)
    },
  )

  it.each(['{', '', 'null', '[]', '42', '"already serialized"', '{"token":42}'])(
    'rejects malformed or non-object verify input with 400: %s',
    async (body) => {
      const { call } = setup()
      expect((await call('/auth/verify', body)).status).toBe(400)
    },
  )

  it('returns 401 for a well-formed but invalid token', async () => {
    const { call } = setup()
    expect((await call('/auth/verify', '{"token":"synthetic-invalid-token"}')).status).toBe(401)
  })
})

describe('M0 mounted route quota isolation', () => {
  it('read-only endpoints neither consume AI nor auth quotas, even when quotas are exhausted', async () => {
    const { call, api, auth } = setup()
    for (let n = 0; n < 5; n++) {
      expect((await call('/locales')).status).toBe(200)
      expect((await call('/topics')).status).toBe(200)
      expect((await call('/review/stats')).status).toBe(401)
      expect((await call('/review/streak')).status).toBe(401)
    }
    expect([...api.counts.values()]).toEqual([])
    expect([...auth.counts.values()]).toEqual([])
  })

  it('one AI endpoint consumes one shared AI quota unit and no auth quota', async () => {
    const { call, api, auth } = setup()
    expect((await call('/quiz', '{}')).status).toBe(400)
    expect([...api.counts.values()]).toEqual([1])
    expect([...auth.counts.values()]).toEqual([])
    expect((await call('/tts', '{}')).status).toBe(400)
    expect((await call('/stt', '', 'POST')).status).toBe(400)
    expect((await call('/generate', '{}')).status).toBe(429)
    expect((await call('/locales')).status).toBe(200)
    expect((await call('/auth/verify', '{"token":"synthetic-invalid-token"}')).status).toBe(401)
  })

  it('auth POSTs enforce their quota without charging unrelated AI endpoints or GET me', async () => {
    const { call, api, auth } = setup()
    for (let n = 0; n < 3; n++) {
      expect((await call('/auth/verify', '{"token":"synthetic-invalid-token"}')).status).toBe(401)
    }
    expect((await call('/auth/verify', '{"token":"synthetic-invalid-token"}')).status).toBe(429)
    expect((await call('/auth/me')).status).toBe(401)
    expect((await call('/quiz', '{}')).status).toBe(400)
    expect([...auth.counts.values()]).toEqual([4])
    expect([...api.counts.values()]).toEqual([1])
  })
})

describe('M0 fallback language contract', () => {
  it('ignores historical cache entries that may contain wrong-language fallback', async () => {
    const day = new Date().toISOString().slice(0, 10)
    await (env as unknown as Bindings).CACHE.put(
      `cache:fr|de|travel|A1|3|mix|${day}`,
      JSON.stringify([{ source: 'hello', target: 'xin chào' }]),
    )
    const { call } = setup()
    const res = await call(
      '/generate',
      JSON.stringify({
        source: 'fr',
        target: 'de',
        topic: 'travel',
        level: 'A1',
        count: 3,
        mode: 'mix',
      }),
    )
    expect(res.status).toBe(503)
    expect(await res.json()).toMatchObject({ error: 'fallback_unavailable' })
  })

  it('never serves unlabelled wildcard English/Vietnamese data for French/German', async () => {
    const pairs = await getFallbackPairsFromDB(testDB, {
      source: 'fr',
      target: 'de',
      topic: 'travel',
      level: 'A1',
    })
    expect(pairs).toEqual([])
  })

  it('keeps the explicitly labelled English/Vietnamese travel fixture', async () => {
    const pairs = await getFallbackPairsFromDB(testDB, {
      source: 'en',
      target: 'vi',
      topic: 'travel',
      level: 'A1',
    })
    expect(pairs[0]).toMatchObject({ source: 'airport', target: 'sân bay' })
  })

  it('reports unavailable generation rather than caching wrong-language fallback', async () => {
    const { call } = setup()
    const res = await call(
      '/generate',
      JSON.stringify({
        source: 'fr',
        target: 'de',
        topic: 'travel',
        level: 'A1',
        count: 3,
        mode: 'mix',
      }),
    )
    expect(res.status).toBe(503)
    expect(await res.json()).toMatchObject({ error: 'fallback_unavailable' })
  })
})
