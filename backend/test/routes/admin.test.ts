import { describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import { fetchWithEnv } from '../helpers'
import { createJwt } from '../../src/services/auth'

async function withAuth(): Promise<{ headers: Record<string, string> }> {
  const token = await createJwt('test-admin-id', (env as { JWT_SECRET: string }).JWT_SECRET)
  return { headers: { cookie: `auth_token=${token}`, origin: 'http://localhost' } }
}

describe('admin settings', () => {
  it('GET /admin/settings returns seeded env settings', async () => {
    const auth = await withAuth()
    const res = await fetchWithEnv('http://localhost/api/admin/settings', {
      headers: { ...auth.headers },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { settings: Array<{ key: string }> }
    expect(Array.isArray(body.settings)).toBe(true)
    expect(body.settings.length).toBeGreaterThan(0)
    const keys = body.settings.map((s) => s.key)
    expect(keys).toContain('AI_ENDPOINT_URL')
    expect(keys).toContain('AI_MODEL_NAME')
  })

  it('PATCH /admin/settings/:key updates an allowed setting', async () => {
    const auth = await withAuth()
    const res = await fetchWithEnv('http://localhost/api/admin/settings/AI_MODEL_NAME', {
      method: 'PATCH',
      headers: { ...auth.headers, 'content-type': 'application/json' },
      body: JSON.stringify({ value: 'test-value' }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { success: boolean; key: string; encrypted: boolean }
    expect(body.success).toBe(true)
    expect(body.key).toBe('AI_MODEL_NAME')
    expect(body.encrypted).toBe(false)
  })

  it('GET /admin/settings includes updated setting metadata', async () => {
    const auth = await withAuth()
    const res = await fetchWithEnv('http://localhost/api/admin/settings', {
      headers: { ...auth.headers },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      settings: Array<{ key: string; configured: boolean; masked: string }>
    }
    const keys = body.settings.map((s) => s.key)
    expect(keys).toContain('AI_MODEL_NAME')
    const setting = body.settings.find((s) => s.key === 'AI_MODEL_NAME')
    expect(setting!.configured).toBe(true)
    expect(setting!.masked).toBe('********')
  })

  it('PATCH /admin/settings/:key rejects env. prefix', async () => {
    const auth = await withAuth()
    const res = await fetchWithEnv('http://localhost/api/admin/settings/env.SECRET', {
      method: 'PATCH',
      headers: { ...auth.headers, 'content-type': 'application/json' },
      body: JSON.stringify({ value: 'test' }),
    })
    expect(res.status).toBe(400)
  })

  it('PATCH /admin/settings/:key rejects missing value', async () => {
    const auth = await withAuth()
    const res = await fetchWithEnv('http://localhost/api/admin/settings/AI_MODEL_NAME', {
      method: 'PATCH',
      headers: { ...auth.headers, 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })

  it('PATCH /admin/settings/:key creates audit log entry', async () => {
    const auth = await withAuth()
    const res = await fetchWithEnv('http://localhost/api/admin/settings/AI_MODEL_NAME', {
      method: 'PATCH',
      headers: { ...auth.headers, 'content-type': 'application/json' },
      body: JSON.stringify({ value: 'audit-value' }),
    })
    expect(res.status).toBe(200)

    // Verify audit log entry
    const auditRes = await fetchWithEnv('http://localhost/api/admin/audit-log?limit=10', {
      headers: { ...auth.headers },
    })
    expect(auditRes.status).toBe(200)
    const body = (await auditRes.json()) as {
      entries: Array<{
        action: string
        target: string
        details: string
        user_id: string
      }>
      total: number
      page: number
      limit: number
    }
    expect(body.total).toBeGreaterThanOrEqual(1)
    expect(body.page).toBe(1)
    expect(body.limit).toBe(10)
    const entry = body.entries.find((e) => e.target === 'AI_MODEL_NAME')
    expect(entry).toBeDefined()
    expect(entry!.action).toBe('update_setting')
    expect(entry!.user_id).toBe('test-admin-id')
    const details = JSON.parse(entry!.details)
    expect(details).not.toHaveProperty('oldValue')
    expect(details).not.toHaveProperty('newValue')
    expect(details).toMatchObject({
      actor: 'test-admin-id',
      action: 'update_setting',
      key: 'AI_MODEL_NAME',
    })
  })
})

describe('admin role enforcement', () => {
  async function withUserAuth(): Promise<{ headers: Record<string, string> }> {
    const token = await createJwt('test-user-id', (env as { JWT_SECRET: string }).JWT_SECRET)
    return { headers: { cookie: `auth_token=${token}`, origin: 'http://localhost' } }
  }

  it('GET /admin/settings returns 403 for non-admin user', async () => {
    const auth = await withUserAuth()
    const res = await fetchWithEnv('http://localhost/api/admin/settings', {
      headers: { ...auth.headers },
    })
    expect(res.status).toBe(403)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('forbidden')
  })

  it('PATCH /admin/settings/:key returns 403 for non-admin user', async () => {
    const auth = await withUserAuth()
    const res = await fetchWithEnv('http://localhost/api/admin/settings/AI_MODEL_NAME', {
      method: 'PATCH',
      headers: { ...auth.headers, 'content-type': 'application/json' },
      body: JSON.stringify({ value: 'test' }),
    })
    expect(res.status).toBe(403)
  })

  it('GET /admin/audit-log returns 403 for non-admin user', async () => {
    const auth = await withUserAuth()
    const res = await fetchWithEnv('http://localhost/api/admin/audit-log', {
      headers: { ...auth.headers },
    })
    expect(res.status).toBe(403)
  })
})
