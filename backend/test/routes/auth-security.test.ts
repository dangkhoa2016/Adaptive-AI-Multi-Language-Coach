import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import app from '../../src/index'
import { createJwt, hashToken, verifyJwt } from '../../src/services/auth'
import { createMockRateLimiter } from '../helpers'

const db = (env as { DB: D1Database }).DB
const secret = 'synthetic-auth-security-secret'
const bindings = () => ({
  ...env,
  DB: db,
  JWT_SECRET: secret,
  ENVIRONMENT: 'local',
  PUBLIC_APP_ORIGIN: 'http://localhost',
  RATE_LIMITER_API: createMockRateLimiter(true),
  RATE_LIMITER_AUTH: createMockRateLimiter(true),
})
const request = (
  path: string,
  body?: unknown,
  cookie?: string,
  overrides: Record<string, unknown> = {},
) =>
  app.fetch(
    new Request(`http://localhost/api/auth/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        Origin:
          typeof overrides.PUBLIC_APP_ORIGIN === 'string'
            ? overrides.PUBLIC_APP_ORIGIN
            : 'http://localhost',
        'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
    { ...bindings(), ...overrides } as never,
  )
async function seed(raw: string, expiry = Date.now() + 60000) {
  await db
    .prepare('INSERT INTO magic_tokens (token_hash, email, expires_at) VALUES (?, ?, ?)')
    .bind(
      await hashToken(raw),
      'synthetic-security@example.invalid',
      new Date(expiry).toISOString(),
    )
    .run()
}
async function signed(header: unknown, payload: unknown) {
  const encode = (value: unknown) =>
    btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const data = `${encode(header)}.${encode(payload)}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data)))
  return `${data}.${btoa(String.fromCharCode(...sig))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')}`
}

describe('auth security on real D1', () => {
  beforeEach(async () => {
    await db.prepare('DELETE FROM magic_tokens').run()
    await db.prepare('DELETE FROM quota_buckets').run()
    await db.prepare('DELETE FROM email_providers_config').run()
    vi.restoreAllMocks()
  })

  it('only one concurrent verification consumes a token and provisions one user', async () => {
    await seed('synthetic-concurrent-token')
    const responses = await Promise.all([
      request('verify', { token: 'synthetic-concurrent-token' }),
      request('verify', { token: 'synthetic-concurrent-token' }),
    ])
    expect(responses.map((r) => r.status).sort()).toEqual([200, 401])
    expect((await request('verify', { token: 'synthetic-concurrent-token' })).status).toBe(401)
    const count = await db
      .prepare('SELECT COUNT(*) AS n FROM users WHERE email = ?')
      .bind('synthetic-security@example.invalid')
      .first<{ n: number }>()
    expect(count?.n).toBe(1)
  })

  it('concurrent tokens for the same email reuse the existing user safely', async () => {
    await seed('synthetic-provision-first')
    await seed('synthetic-provision-second')
    const responses = await Promise.all([
      request('verify', { token: 'synthetic-provision-first' }),
      request('verify', { token: 'synthetic-provision-second' }),
    ])
    expect(responses.map((response) => response.status)).toEqual([200, 200])
    const users = await Promise.all(
      responses.map((response) => response.json() as Promise<{ user: { id: string } }>),
    )
    expect(users[0].user.id).toBe(users[1].user.id)
  })

  it('expires a token at the exact expiry instant', async () => {
    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now)
    await seed('synthetic-expiry-token', now)
    expect((await request('verify', { token: 'synthetic-expiry-token' })).status).toBe(401)
  })

  it('uses local HTTP cookies only with explicit loopback config and secure cookies for HTTPS', async () => {
    await seed('synthetic-local-token')
    const local = await request('verify', { token: 'synthetic-local-token' })
    expect(local.status).toBe(200)
    expect(local.headers.get('set-cookie')).toContain('HttpOnly')
    expect(local.headers.get('set-cookie')).toContain('SameSite=Lax')
    expect(local.headers.get('set-cookie')).not.toContain('Secure')
    await seed('synthetic-https-token')
    const secure = await request('verify', { token: 'synthetic-https-token' }, undefined, {
      ENVIRONMENT: 'production',
      PUBLIC_APP_ORIGIN: 'https://coach.example.invalid',
    })
    expect(secure.headers.get('set-cookie')).toContain('Secure')
  })

  it('revokes copied session cookies at logout and stores only their hash', async () => {
    await seed('synthetic-logout-token')
    const login = await request('verify', { token: 'synthetic-logout-token' })
    const cookie = login.headers.get('set-cookie')!.split(';')[0]
    expect((await request('me', undefined, cookie)).status).toBe(200)
    expect((await request('logout', {}, cookie)).status).toBe(200)
    expect((await request('me', undefined, cookie)).status).toBe(401)
    const row = await db
      .prepare('SELECT token_hash FROM revoked_sessions WHERE token_hash = ?')
      .bind(await hashToken(cookie.slice('auth_token='.length)))
      .first<{ token_hash: string }>()
    expect(row?.token_hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('never logs token, email, or provider exception contents on mail failure', async () => {
    await db
      .prepare(
        `INSERT INTO email_providers_config (provider_id, provider_name, config_json) VALUES ('resend', 'synthetic', '{"apiKey":"synthetic-key"}')`,
      )
      .run()
    let raw = ''
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
      const html = JSON.parse(init?.body as string).html as string
      raw = html.match(/token=([^"<]+)/)![1]
      throw new Error('synthetic-delivery-failure')
    })
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const res = await request('request', { email: 'synthetic-mailfail@example.invalid' })
    expect(res.status).toBe(200)
    const output = JSON.stringify(log.mock.calls)
    expect(output).not.toContain('synthetic-mailfail')
    expect(raw).not.toBe('')
    expect(output).not.toContain(raw)
  })

  it('builds the mail link from trusted config and stores only its hash', async () => {
    await db
      .prepare(
        `INSERT INTO email_providers_config (provider_id, provider_name, config_json) VALUES ('resend', 'synthetic', '{"apiKey":"synthetic-key"}')`,
      )
      .run()
    let captured = ''
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
      captured = JSON.parse(init?.body as string).html
      return new Response(null, { status: 200 })
    })
    expect((await request('request', { email: 'synthetic-capture@example.invalid' })).status).toBe(
      200,
    )
    expect(captured).toContain('http://localhost/auth/verify?token=')
    const raw = captured.match(/token=([^"<]+)/)![1]
    const stored = await db
      .prepare('SELECT token_hash FROM magic_tokens WHERE email = ?')
      .bind('synthetic-capture@example.invalid')
      .first<{ token_hash: string }>()
    expect(stored?.token_hash).toBe(await hashToken(raw))
    expect(stored?.token_hash).not.toBe(raw)
  })

  it('scrubs provider exceptions from delivery logs', async () => {
    await db
      .prepare(
        `INSERT INTO email_providers_config (provider_id, provider_name, config_json) VALUES ('resend', 'synthetic', '{"apiKey":"synthetic-key"}')`,
      )
      .run()
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new Error('SYNTHETIC_PROVIDER_SECRET synthetic-provider@example.invalid'),
    )
    expect((await request('request', { email: 'synthetic-provider@example.invalid' })).status).toBe(
      200,
    )
    expect(JSON.stringify(log.mock.calls)).not.toContain('SYNTHETIC_PROVIDER_SECRET')
    expect(JSON.stringify(log.mock.calls)).not.toContain('synthetic-provider@')
  })

  it('rejects malicious Origin without sending email', async () => {
    const response = await app.fetch(
      new Request('http://localhost/api/auth/request', {
        method: 'POST',
        headers: { Origin: 'https://evil.invalid', 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'synthetic-foreign@example.invalid' }),
      }),
      bindings() as never,
    )
    expect(response.status).toBe(403)
    const count = await db.prepare('SELECT COUNT(*) AS n FROM magic_tokens').first<{ n: number }>()
    expect(count?.n).toBe(0)
  })

  it('fails closed for unsafe application origin configuration', async () => {
    expect(
      (
        await request('request', { email: 'synthetic-origin@example.invalid' }, undefined, {
          ENVIRONMENT: 'production',
          PUBLIC_APP_ORIGIN: 'http://evil.invalid',
        })
      ).status,
    ).toBe(503)
  })

  it('does not create recipient quota keys once the global budget is exhausted', async () => {
    const now = Math.floor(Date.now() / 1000)
    await db
      .prepare('INSERT INTO quota_buckets (key, bucket, used, expires_at) VALUES (?, ?, 200, ?)')
      .bind(await hashToken('auth-global'), Math.floor(now / 3600), now + 3600)
      .run()
    const response = await request('request', { email: 'synthetic-global@example.invalid' })
    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('3600')
    const count = await db.prepare('SELECT COUNT(*) AS n FROM quota_buckets').first<{ n: number }>()
    expect(count?.n).toBe(1)
  })

  it('fails closed without logging quota infrastructure error details', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const response = await request(
      'request',
      { email: 'synthetic-infra@example.invalid' },
      undefined,
      {
        DB: {
          prepare: () => {
            throw new Error('SYNTHETIC_DATABASE_SECRET')
          },
        },
      },
    )
    expect(response.status).toBe(503)
    expect(JSON.stringify(await response.json())).not.toContain('SYNTHETIC_DATABASE_SECRET')
    expect(JSON.stringify(log.mock.calls)).not.toContain('SYNTHETIC_DATABASE_SECRET')
  })

  it('limits normalized email with the same rate response for every recipient', async () => {
    const responses = []
    for (let n = 0; n < 5; n++)
      responses.push(
        await request('request', {
          email: n % 2 ? 'SYNTHETIC-quota@example.invalid' : 'synthetic-quota@example.invalid',
        }),
      )
    expect(responses.map((r) => r.status)).toEqual([200, 200, 200, 429, 429])
    const count = await db
      .prepare('SELECT COUNT(*) AS n FROM magic_tokens WHERE email = ?')
      .bind('synthetic-quota@example.invalid')
      .first<{ n: number }>()
    expect(count?.n).toBe(3)
  })
})

describe('JWT validation', () => {
  it('rejects missing secrets', async () => {
    await expect(createJwt('synthetic-user', '')).rejects.toThrow()
    expect(await verifyJwt(await createJwt('synthetic-user', secret), '')).toBeNull()
  })
  it('rejects signed malformed headers and claims, including expiry equality', async () => {
    const now = Math.floor(Date.now() / 1000)
    for (const [header, payload] of [
      [
        { alg: 'none', typ: 'JWT' },
        { sub: 'u', iat: now, exp: now + 60 },
      ],
      [
        { alg: 'HS256', typ: 'JWT' },
        { sub: '', iat: now, exp: now + 60 },
      ],
      [
        { alg: 'HS256', typ: 'JWT' },
        { sub: 'u', exp: now + 60 },
      ],
      [
        { alg: 'HS256', typ: 'JWT' },
        { sub: 'u', iat: now + 120, exp: now + 300 },
      ],
      [
        { alg: 'HS256', typ: 'JWT' },
        { sub: 'u', iat: now - 60, exp: now },
      ],
    ])
      expect(await verifyJwt(await signed(header, payload), secret)).toBeNull()
  })
})
