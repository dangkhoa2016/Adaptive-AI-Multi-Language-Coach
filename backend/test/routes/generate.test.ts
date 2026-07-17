import { describe, expect, it, beforeEach } from 'vitest'
import { exports } from 'cloudflare:workers'
import { fetchWithEnv, resetKV, createMockRateLimiter } from '../helpers'
import type { Bindings } from '../src/env'

/**
 * Helper to make a request with a custom env that bypasses rate limiting.
 * Uses `exports` from cloudflare:workers (pool-workers runtime) instead of
 * a dynamic import, which avoids module resolution issues in the sandbox.
 */
async function fetchWithPermissiveRateLimit(url: string, init: RequestInit): Promise<Response> {
  const passRateLimiter = createMockRateLimiter(true)
  const customEnv = {
    ASSETS: {} as Fetcher,
    CACHE: {
      get: async () => null,
      put: async () => {},
      delete: async () => {},
      list: async () => ({ keys: [] }),
      getWithMetadata: async () => ({ value: null, metadata: null }),
    } as unknown as KVNamespace,
    DB: {} as D1Database,
    RATE_LIMITER_API: passRateLimiter as unknown as RateLimit,
    RATE_LIMITER_AUTH: passRateLimiter as unknown as RateLimit,
    ENCRYPTION_KEY: 'test-key',
  } as Bindings

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (exports as any).default.fetch(new Request(url, init), customEnv, {
    waitUntil: () => {},
    passThroughOnException: () => {},
    props: {},
  })
}

describe('generate endpoint', () => {
  beforeEach(() => resetKV())

  it('returns vocab pairs with valid schema (en→vi, fallback)', async () => {
    const res = await fetchWithEnv('http://localhost/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'accept-language': 'en' },
      body: JSON.stringify({
        source: 'en',
        target: 'vi',
        topic: 'travel',
        level: 'A1',
        count: 5,
        mode: 'mix',
      }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      pairs: { source: string; target: string; isPhrase: boolean; pos: string }[]
      isFallback: boolean
    }
    expect(Array.isArray(body.pairs)).toBe(true)
    expect(body.pairs.length).toBeGreaterThan(0)
    expect(body.isFallback).toBe(true)
    const pair = body.pairs[0]
    expect(pair.source).toBeTruthy()
    expect(pair.target).toBeTruthy()
    expect(typeof pair.isPhrase).toBe('boolean')
  })

  it('rejects invalid request body', async () => {
    const res = await fetchWithPermissiveRateLimit('http://localhost/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ bad: 'data' }),
    })
    expect(res.status).toBe(400)
  })

  it('works for ja→en language pair', async () => {
    const res = await fetchWithEnv('http://localhost/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'accept-language': 'ja' },
      body: JSON.stringify({
        source: 'ja',
        target: 'en',
        topic: 'food',
        level: 'A2',
        count: 3,
        mode: 'word',
      }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { pairs: unknown[] }
    expect(body.pairs.length).toBeGreaterThan(0)
  })

  it('works for zh→fr language pair', async () => {
    const res = await fetchWithEnv('http://localhost/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'accept-language': 'zh' },
      body: JSON.stringify({
        source: 'zh',
        target: 'fr',
        topic: 'technology',
        level: 'B1',
        count: 3,
        mode: 'phrase',
      }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { pairs: unknown[] }
    expect(body.pairs.length).toBeGreaterThan(0)
  })

  it('returns Korean error message when accept-language=ko', async () => {
    const res = await fetchWithPermissiveRateLimit('http://localhost/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'accept-language': 'ko' },
      body: JSON.stringify({ bad: 'data' }),
    })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { message: string }
    expect(body.message).toContain('잘못된')
  })
})

describe('i18n error messages on generate', () => {
  it('returns Vietnamese error message when accept-language=vi', async () => {
    const res = await fetchWithPermissiveRateLimit('http://localhost/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'accept-language': 'vi' },
      body: JSON.stringify({ bad: 'data' }),
    })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { message: string }
    expect(body.message).toContain('không hợp lệ')
  })

  it('returns Japanese error message when accept-language=ja', async () => {
    const res = await fetchWithPermissiveRateLimit('http://localhost/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'accept-language': 'ja' },
      body: JSON.stringify({ bad: 'data' }),
    })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { message: string }
    expect(body.message).toContain('無効')
  })

  it('returns French error message when accept-language=fr', async () => {
    const res = await fetchWithPermissiveRateLimit('http://localhost/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'accept-language': 'fr' },
      body: JSON.stringify({ bad: 'data' }),
    })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { message: string }
    expect(body.message).toContain('invalide')
  })
})

describe('cache behavior', () => {
  it('returns cacheHit on second request for same params', async () => {
    // Use unique params to avoid cache collision with other tests
    const uniqueTopic = 'health' as string
    const payload = JSON.stringify({
      source: 'en',
      target: 'th',
      topic: uniqueTopic,
      level: 'B2',
      count: 2,
      mode: 'phrase',
    })

    const res1 = await fetchWithEnv('http://localhost/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payload,
    })
    const body1 = (await res1.json()) as { cacheHit: boolean; isFallback: boolean }
    expect(body1.cacheHit).toBe(false)

    const res2 = await fetchWithEnv('http://localhost/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payload,
    })
    const body2 = (await res2.json()) as { cacheHit: boolean }
    expect(body2.cacheHit).toBe(true)
  })
})

describe('rate limiting on generate', () => {
  it('accepts requests within rate limit', async () => {
    const res = await fetchWithEnv('http://localhost/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        source: 'en',
        target: 'vi',
        topic: 'travel',
        level: 'A1',
        count: 3,
        mode: 'word',
      }),
    })
    // With the test rate limiter set to 1000/60s, a single request should pass
    expect(res.status).toBe(200)
  })
})
