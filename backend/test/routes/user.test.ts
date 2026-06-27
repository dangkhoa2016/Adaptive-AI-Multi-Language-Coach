import { describe, expect, it, beforeEach } from 'vitest'

const users = new Map<
  string,
  {
    id: string
    email: string
    email_verified: number
    activation_method: string | null
    activated_date: string | null
    timezone: string
    created_at: string
  }
>()
const learnedPairs = new Map<string, Array<Record<string, unknown>>>()

function createMockDB(): D1Database {
  return {
    prepare: (sql: string) => ({
      bind: (...values: unknown[]) => ({
        first: async <T>() => {
          if (sql.includes('FROM users WHERE id =')) {
            return (users.get(values[0] as string) ?? null) as unknown as T | null
          }
          return null
        },
        all: async <T>() => {
          if (sql.includes('FROM learned_pairs WHERE user_id =')) {
            return {
              results: (learnedPairs.get(values[0] as string) ?? []) as unknown as T[],
              success: true,
            }
          }
          return { results: [] as unknown as T[], success: true }
        },
        run: async () => ({ success: true }),
        raw: async () => [],
      }),
      all: async <T>() => ({ results: [] as unknown as T[], success: true }),
      first: async () => null,
      run: async () => ({ success: true }),
      raw: async () => [],
    }),
    batch: async () => [],
    exec: async () => ({ success: true }),
    dump: async () => new ArrayBuffer(0),
  } as unknown as D1Database
}

async function callApp(url: string, init?: RequestInit, cookie?: string): Promise<Response> {
  const { default: app } = await import('../../src/index')
  const env = {
    DB: createMockDB(),
    CACHE: {} as KVNamespace,
    RATE_LIMITER_API: { limit: async () => ({ success: true }) } as unknown as RateLimit,
    RATE_LIMITER_AUTH: { limit: async () => ({ success: true }) } as unknown as RateLimit,
    ENCRYPTION_KEY: 'test-key-32-chars-xxxxxxxxxxxxx',
    JWT_SECRET: 'test-jwt-secret-32-chars-long!!',
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

describe('user routes', () => {
  const userId = 'user-gdpr-1'

  beforeEach(() => {
    users.clear()
    learnedPairs.clear()
    users.set(userId, {
      id: userId,
      email: 'gdpr@test.com',
      email_verified: 1,
      activation_method: 'open_email',
      activated_date: '2026-06-01',
      timezone: 'UTC',
      created_at: '2026-05-01',
    })
    learnedPairs.set(userId, [
      {
        source: 'en',
        target: 'vi',
        source_text: 'hello',
        target_text: 'xin chào',
        is_phrase: 0,
        ease: 2.5,
        interval_days: 0,
        due_date: '2026-06-01',
        repetitions: 0,
        status: 'learning',
        created_at: '2026-05-01',
      },
    ])
  })

  it('GET /api/user/export returns 401 without auth', async () => {
    const res = await callApp('http://localhost/api/user/export')
    expect(res.status).toBe(401)
  })

  it('GET /api/user/export returns user data JSON', async () => {
    const { createJwt } = await import('../../src/services/auth')
    const jwt = await createJwt(userId, 'test-jwt-secret-32-chars-long!!')
    const res = await callApp('http://localhost/api/user/export', {}, `auth_token=${jwt}`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/json')
    expect(res.headers.get('content-disposition')).toContain('attachment')
    const body = (await res.json()) as { user: { email: string }; learnedPairs: unknown[] }
    expect(body.user.email).toBe('gdpr@test.com')
    expect(body.learnedPairs).toHaveLength(1)
  })
})
