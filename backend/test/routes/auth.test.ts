import { describe, expect, it, beforeEach } from 'vitest'
import { createMockRateLimiter } from '../helpers'
import { createJwt, verifyJwt, hashToken } from '../../src/services/auth'

const JWT_SECRET = 'test-jwt-secret-32-chars-long!!'

// In-memory stores for mock DB
const magicTokens = new Map<
  string,
  { token_hash: string; email: string; expires_at: string; used: number }
>()
const users = new Map<string, { id: string; email: string; email_verified: number }>()

function createMockDB(): D1Database {
  return {
    prepare: (sql: string) => ({
      bind: (...values: unknown[]) => ({
        run: async () => {
          if (sql.includes('INSERT INTO magic_tokens')) {
            magicTokens.set(values[0] as string, {
              token_hash: values[0] as string,
              email: values[1] as string,
              expires_at: values[2] as string,
              used: 0,
            })
          }
          if (sql.includes('UPDATE magic_tokens SET used = 1')) {
            const t = magicTokens.get(values[0] as string)
            if (t) t.used = 1
          }
          if (sql.includes('INSERT INTO users')) {
            users.set(values[0] as string, {
              id: values[0] as string,
              email: values[1] as string,
              email_verified: 1,
            })
          }
          return { success: true }
        },
        first: async <T>() => {
          if (sql.includes('FROM magic_tokens WHERE token_hash =')) {
            return magicTokens.get(values[0] as string) as unknown as T | null
          }
          if (sql.includes('FROM users WHERE email =')) {
            for (const [, u] of users) {
              if (u.email === values[0]) return u as unknown as T
            }
            return null
          }
          if (sql.includes('FROM users WHERE id =')) {
            const u = users.get(values[0] as string)
            return (u ?? null) as unknown as T | null
          }
          return null
        },
        all: async () => ({ results: [], success: true }),
        raw: async () => [],
      }),
      all: async () => ({ results: [], success: true }),
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
  const pass = createMockRateLimiter(true)
  const env = {
    DB: createMockDB(),
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

describe('auth service', () => {
  it('creates and verifies a valid JWT', async () => {
    const jwt = await createJwt('user-123', JWT_SECRET)
    expect(jwt).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)

    const payload = await verifyJwt(jwt, JWT_SECRET)
    expect(payload).not.toBeNull()
    expect(payload!.sub).toBe('user-123')
    expect(payload!.iat).toBeDefined()
    expect(payload!.exp).toBeDefined()
  })

  it('rejects tampered JWT', async () => {
    const jwt = await createJwt('user-123', JWT_SECRET)
    const [h, p, _s] = jwt.split('.')
    const tampered = `${h}.${p}.tampered`
    const payload = await verifyJwt(tampered, JWT_SECRET)
    expect(payload).toBeNull()
  })

  it('rejects JWT with wrong secret', async () => {
    const jwt = await createJwt('user-123', JWT_SECRET)
    const payload = await verifyJwt(jwt, 'wrong-secret')
    expect(payload).toBeNull()
  })

  it('hashes tokens consistently', async () => {
    const h1 = await hashToken('hello')
    const h2 = await hashToken('hello')
    expect(h1).toBe(h2)
    expect(h1).toMatch(/^[0-9a-f]{64}$/)
  })

  it('produces different hashes for different tokens', async () => {
    const h1 = await hashToken('token-a')
    const h2 = await hashToken('token-b')
    expect(h1).not.toBe(h2)
  })
})

describe('auth routes', () => {
  beforeEach(() => {
    magicTokens.clear()
    users.clear()
  })

  it('POST /api/auth/request rejects invalid email', async () => {
    const res = await callApp('http://localhost/api/auth/request', {
      method: 'POST',
      body: JSON.stringify({ email: 'bad' }),
    })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('invalid_email')
  })

  it('POST /api/auth/request accepts valid email', async () => {
    const res = await callApp('http://localhost/api/auth/request', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com' }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { success: boolean }
    expect(body.success).toBe(true)
  })

  it('POST /api/auth/verify with valid token creates user and sets cookie', async () => {
    const rawToken = 'test-magic-token-abc-123'
    const tokenHash = await hashToken(rawToken)
    magicTokens.set(tokenHash, {
      token_hash: tokenHash,
      email: 'user@test.com',
      expires_at: new Date(Date.now() + 3600000).toISOString(),
      used: 0,
    })

    const res = await callApp('http://localhost/api/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ token: rawToken }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      success: boolean
      user: { email: string; id: string }
    }
    expect(body.success).toBe(true)
    expect(body.user.email).toBe('user@test.com')
    expect(body.user.id).toBeDefined()
    const setCookie = res.headers.get('set-cookie')
    expect(setCookie).toContain('auth_token')
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('Secure')
  })

  it('POST /api/auth/verify rejects already-used token', async () => {
    const rawToken = 'used-token-xyz'
    const tokenHash = await hashToken(rawToken)
    magicTokens.set(tokenHash, {
      token_hash: tokenHash,
      email: 'used@test.com',
      expires_at: new Date(Date.now() + 3600000).toISOString(),
      used: 1,
    })

    const res = await callApp('http://localhost/api/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ token: rawToken }),
    })
    expect(res.status).toBe(401)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('token_used')
  })

  it('POST /api/auth/verify rejects expired token', async () => {
    const rawToken = 'expired-token'
    const tokenHash = await hashToken(rawToken)
    magicTokens.set(tokenHash, {
      token_hash: tokenHash,
      email: 'expired@test.com',
      expires_at: new Date(Date.now() - 3600000).toISOString(),
      used: 0,
    })

    const res = await callApp('http://localhost/api/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ token: rawToken }),
    })
    expect(res.status).toBe(401)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('token_expired')
  })

  it('GET /api/auth/me returns 401 without cookie', async () => {
    const res = await callApp('http://localhost/api/auth/me')
    expect(res.status).toBe(401)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('unauthorized')
  })

  it('GET /api/auth/me returns user with valid cookie', async () => {
    const userId = crypto.randomUUID()
    users.set(userId, {
      id: userId,
      email: 'me@test.com',
      email_verified: 1,
    })
    const jwt = await createJwt(userId, JWT_SECRET)

    const res = await callApp('http://localhost/api/auth/me', {}, `auth_token=${jwt}`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      user: { email: string; emailVerified: boolean }
    }
    expect(body.user.email).toBe('me@test.com')
    expect(body.user.emailVerified).toBe(true)
  })

  it('POST /api/auth/logout clears the auth cookie', async () => {
    const res = await callApp('http://localhost/api/auth/logout', { method: 'POST' })
    expect(res.status).toBe(200)
    const setCookie = res.headers.get('set-cookie')
    expect(setCookie).toContain('auth_token=;')
  })
})
