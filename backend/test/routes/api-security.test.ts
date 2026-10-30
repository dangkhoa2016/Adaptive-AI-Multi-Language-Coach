import { env } from 'cloudflare:test'
import { describe, it, expect } from 'vitest'
import app from '../../src/index'
import { createJwt, hashToken } from '../../src/services/auth'
import { consumeQuota } from '../../src/services/requestQuota'
import type { Bindings } from '../../src/env'

function call(
  path: string,
  body: string,
  extra: Record<string, string> = {},
  override: Partial<Bindings> = {},
) {
  const bindings = {
    ...env,
    ENVIRONMENT: 'local',
    PUBLIC_APP_ORIGIN: 'http://localhost',
    RATE_LIMITER_API: { limit: async () => ({ success: true }) },
    RATE_LIMITER_AUTH: { limit: async () => ({ success: true }) },
    CACHE: { get: async () => null, put: async () => {} },
    ...override,
  } as unknown as Bindings
  return app.fetch(
    new Request('http://localhost/api' + path, {
      method: 'POST',
      body,
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost',
        'CF-Connecting-IP': '192.0.2.' + (path === '/generate' ? '91' : '90'),
        ...extra,
      },
    }),
    bindings,
  )
}

describe('M1 API security boundaries', () => {
  it('rejects foreign Origin and cross-site mutations before invoking providers', async () => {
    expect((await call('/generate', '{}', { Origin: 'https://evil.example.invalid' })).status).toBe(
      403,
    )
    expect((await call('/generate', '{}', { 'Sec-Fetch-Site': 'cross-site' })).status).toBe(403)
  })
  it('rejects oversized JSON even without a Content-Length header', async () => {
    expect((await call('/generate', ' '.repeat(65_537))).status).toBe(413)
  })
  it('checks actual streamed bytes even if Content-Length understates the size', async () => {
    expect((await call('/generate', ' '.repeat(65_537), { 'Content-Length': '2' })).status).toBe(
      413,
    )
  })
  it('rejects a quiz containing an invalid item rather than silently dropping it', async () => {
    const r = await call(
      '/quiz',
      JSON.stringify({
        pairs: [
          { source: 'hello', target: 'xin chào' },
          { source: '', target: 'bad' },
        ],
      }),
    )
    expect(r.status).toBe(400)
  })
  it('bounds quiz item count', async () => {
    const response = await call(
      '/quiz',
      JSON.stringify({
        pairs: Array.from({ length: 51 }, () => ({ source: 'hello', target: 'xin chào' })),
      }),
    )
    expect(response.status).toBe(400)
  })
  it('returns400 for malformed TTS JSON and unsupported locale input', async () => {
    expect((await call('/tts', '{')).status).toBe(400)
    expect((await call('/tts', '{"text":"hello","locale":"xx"}')).status).toBe(400)
  })
  it('rejects excessive TTS text and STT reference lengths', async () => {
    const response = await call('/tts', JSON.stringify({ text: 'x'.repeat(2001), locale: 'en' }))
    expect(response.status).toBe(400)
    expect(
      (await call('/stt?reference=' + 'x'.repeat(2001), 'audio', { 'Content-Type': 'audio/webm' }))
        .status,
    ).toBe(400)
  })
  it('returns503 for missing AI binding instead of exposing an internal error', async () => {
    const response = await call('/tts', '{"text":"hello","locale":"en"}', {}, { AI: undefined })
    expect(response.status).toBe(503)
  })
  it('bounds audio stream size without relying on advertised length', async () => {
    expect(
      (await call('/stt', 'x'.repeat(5 * 1024 * 1024 + 1), { 'Content-Type': 'audio/webm' }))
        .status,
    ).toBe(413)
  })
  it('shares account quota across IPs and rejects a revoked session before inference', async () => {
    const secret = 'synthetic-cost-quota-secret'
    const id = 'synthetic-cost-quota-user'
    const token = await createJwt(id, secret)
    const db = (env as unknown as Bindings).DB
    await consumeQuota(db, `cost:user:${id}`, 100, 86400)
    await db
      .prepare('UPDATE quota_buckets SET used = 100 WHERE key = ?')
      .bind(await hashToken(`cost:user:${id}`))
      .run()
    const payload =
      '{"source":"en","target":"vi","topic":"travel","level":"A1","count":1,"mode":"word"}'
    for (const ip of ['192.0.2.44', '192.0.2.45']) {
      const denied = await call(
        '/generate',
        payload,
        { Cookie: `auth_token=${token}`, 'CF-Connecting-IP': ip },
        { JWT_SECRET: secret },
      )
      expect(denied.status).toBe(429)
    }
    await db
      .prepare('INSERT INTO revoked_sessions(token_hash, expires_at) VALUES (?, ?)')
      .bind(await hashToken(token), Math.floor(Date.now() / 1000) + 3600)
      .run()
    expect(
      (await call('/generate', payload, { Cookie: `auth_token=${token}` }, { JWT_SECRET: secret }))
        .status,
    ).toBe(401)
    expect(
      (
        await call(
          '/generate',
          payload,
          { Cookie: `auth_token=${token}`, Origin: '' },
          { JWT_SECRET: secret },
        )
      ).status,
    ).toBe(403)
  })
  it('fails closed when the native limiter binding is absent', async () => {
    expect((await call('/generate', '{}', {}, { RATE_LIMITER_API: undefined })).status).toBe(503)
  })
  it('enforces durable guest generation quota even when the native binding allows requests', async () => {
    const payload =
      '{"source":"en","target":"vi","topic":"travel","level":"A1","count":1,"mode":"word"}'
    for (let i = 0; i < 20; i++) expect((await call('/generate', payload)).status).toBe(200)
    const blocked = await call('/generate', payload)
    expect(blocked.status).toBe(429)
    expect(blocked.headers.get('Retry-After')).toBeTruthy()
    const usage = await (env as unknown as Bindings).DB.prepare(
      'SELECT used AS total FROM quota_buckets WHERE key = ?',
    )
      .bind(await hashToken('cost:global'))
      .first<{ total: number }>()
    expect(usage?.total).toBe(20)
  })
})
