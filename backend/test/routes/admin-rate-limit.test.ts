import { describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import { fetchWithEnv } from '../helpers'
import { createJwt } from '../../src/services/auth'

async function withAuth(): Promise<{ headers: Record<string, string> }> {
  const token = await createJwt('test-admin-id', (env as { JWT_SECRET: string }).JWT_SECRET)
  return { headers: { cookie: `auth_token=${token}` } }
}

async function withUserAuth(): Promise<{ headers: Record<string, string> }> {
  const token = await createJwt('test-user-id', (env as { JWT_SECRET: string }).JWT_SECRET)
  return { headers: { cookie: `auth_token=${token}` } }
}

describe('admin rate limit stats', () => {
  it('returns stats for admin user', async () => {
    const auth = await withAuth()
    const res = await fetchWithEnv('http://localhost/api/admin/rate-limit-stats', {
      headers: { ...auth.headers },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { total: number; topIps: unknown[]; recent: unknown[] }
    expect(typeof body.total).toBe('number')
    expect(Array.isArray(body.topIps)).toBe(true)
    expect(Array.isArray(body.recent)).toBe(true)
  })

  it('returns 403 for non-admin user', async () => {
    const auth = await withUserAuth()
    const res = await fetchWithEnv('http://localhost/api/admin/rate-limit-stats', {
      headers: { ...auth.headers },
    })
    expect(res.status).toBe(403)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('forbidden')
  })

  it('returns 401 without auth', async () => {
    const res = await fetchWithEnv('http://localhost/api/admin/rate-limit-stats')
    expect(res.status).toBe(401)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('unauthorized')
  })

  it('includes rate limit events in stats', async () => {
    const testEnv = env as { DB: D1Database }
    const id = crypto.randomUUID()
    await testEnv.DB.prepare(
      'INSERT INTO rate_limit_events (id, ip, endpoint, timestamp) VALUES (?, ?, ?, ?)',
    )
      .bind(id, '192.168.1.1', '/api/test', new Date().toISOString())
      .run()

    const auth = await withAuth()
    const res = await fetchWithEnv('http://localhost/api/admin/rate-limit-stats', {
      headers: { ...auth.headers },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      total: number
      recent: Array<{ id: string; ip: string; endpoint: string }>
    }
    expect(body.total).toBeGreaterThanOrEqual(1)
    const found = body.recent.find((e) => e.id === id)
    expect(found).toBeDefined()
    expect(found!.ip).toBe('192.168.1.1')
    expect(found!.endpoint).toBe('/api/test')
  })
})
