import { describe, expect, it } from 'vitest'
import { createMockRateLimiter } from '../helpers'
import { createJwt } from '../../src/services/auth'

const JWT_SECRET = 'test-jwt-secret-32-chars-long!!'

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

function createMockDB(reviewLogs: Array<{ day: string; count: number }>): D1Database {
  const results = reviewLogs.map((r) => ({ day: r.day, count: r.count }))
  return {
    prepare: (_sql: string) => ({
      bind: (..._values: unknown[]) => ({
        all: async <T>() => ({ results: results as unknown as T[], success: true }) as never,
        first: async () => null,
        run: async () => ({ success: true }),
        raw: async () => [],
      }),
      all: async <T>() => ({ results: results as unknown as T[], success: true }) as never,
      first: async () => null,
      run: async () => ({ success: true }),
      raw: async () => [],
    }),
    batch: async () => [],
    exec: async () => ({ success: true }),
    dump: async () => new ArrayBuffer(0),
  } as unknown as D1Database
}

async function callApp(
  url: string,
  init?: RequestInit,
  cookie?: string,
  reviewLogs?: Array<{ day: string; count: number }>,
): Promise<Response> {
  const { default: app } = await import('../../src/index')
  const pass = createMockRateLimiter(true)
  const env = {
    DB: createMockDB(reviewLogs ?? []),
    CACHE: {} as KVNamespace,
    RATE_LIMITER_API: pass as unknown as RateLimit,
    RATE_LIMITER_AUTH: pass as unknown as RateLimit,
    ENCRYPTION_KEY: 'test-key',
    JWT_SECRET,
    AI: {} as Ai,
    ASSETS: {} as Fetcher,
  }
  const headers = new Headers(init?.headers)
  headers.set('content-type', 'application/json')
  if (cookie) headers.set('cookie', cookie)
  return app.fetch(new Request(url, { ...init, headers }), env, {
    waitUntil: () => {},
    passThroughOnException: () => {},
    props: {},
  })
}

describe('GET /api/review/streak', () => {
  it('returns 401 without auth', async () => {
    const res = await callApp('http://localhost/api/review/streak')
    expect(res.status).toBe(401)
  })

  it('returns streak stats for authenticated user with activity', async () => {
    const userId = crypto.randomUUID()
    const jwt = await createJwt(userId, JWT_SECRET)

    const logs = [
      { day: daysAgo(0), count: 5 },
      { day: daysAgo(1), count: 3 },
      { day: daysAgo(2), count: 2 },
      { day: daysAgo(4), count: 1 },
      { day: daysAgo(5), count: 4 },
      { day: daysAgo(6), count: 2 },
    ]

    const res = await callApp('http://localhost/api/review/streak', {}, `auth_token=${jwt}`, logs)
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      currentStreak: number
      longestStreak: number
      todayCount: number
      dailyActivity: Array<{ day: string; count: number }>
    }
    expect(body.currentStreak).toBe(3)
    expect(body.longestStreak).toBe(3)
    expect(body.todayCount).toBe(5)
    expect(body.dailyActivity).toHaveLength(6)
  })

  it('returns zeros for user with no activity', async () => {
    const userId = crypto.randomUUID()
    const jwt = await createJwt(userId, JWT_SECRET)

    const res = await callApp('http://localhost/api/review/streak', {}, `auth_token=${jwt}`, [])
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      currentStreak: number
      longestStreak: number
      todayCount: number
      dailyActivity: Array<{ day: string; count: number }>
    }
    expect(body.currentStreak).toBe(0)
    expect(body.longestStreak).toBe(0)
    expect(body.todayCount).toBe(0)
    expect(body.dailyActivity).toEqual([])
  })

  it('returns correct longest streak when current streak is broken', async () => {
    const userId = crypto.randomUUID()
    const jwt = await createJwt(userId, JWT_SECRET)

    const logs = [
      { day: daysAgo(0), count: 1 },
      { day: daysAgo(3), count: 1 },
      { day: daysAgo(4), count: 1 },
      { day: daysAgo(5), count: 1 },
    ]

    const res = await callApp('http://localhost/api/review/streak', {}, `auth_token=${jwt}`, logs)
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      currentStreak: number
      longestStreak: number
    }
    expect(body.currentStreak).toBe(1)
    expect(body.longestStreak).toBe(3)
  })
})
