import { describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import { fetchWithEnv } from '../helpers'
import { createJwt } from '../../src/services/auth'

async function withAuth(): Promise<{ headers: Record<string, string> }> {
  const token = await createJwt('test-admin-id', (env as { JWT_SECRET: string }).JWT_SECRET)
  return { headers: { cookie: `auth_token=${token}` } }
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

  it('PATCH /admin/settings/:key creates a new setting', async () => {
    const auth = await withAuth()
    const res = await fetchWithEnv('http://localhost/api/admin/settings/TEST_KEY', {
      method: 'PATCH',
      headers: { ...auth.headers, 'content-type': 'application/json' },
      body: JSON.stringify({ value: 'test-value' }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { success: boolean; key: string; encrypted: boolean }
    expect(body.success).toBe(true)
    expect(body.key).toBe('TEST_KEY')
    expect(body.encrypted).toBe(false)
  })

  it('GET /admin/settings includes newly created setting', async () => {
    const auth = await withAuth()
    const res = await fetchWithEnv('http://localhost/api/admin/settings', {
      headers: { ...auth.headers },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { settings: Array<{ key: string; value: string }> }
    const keys = body.settings.map((s) => s.key)
    expect(keys).toContain('TEST_KEY')
    const setting = body.settings.find((s) => s.key === 'TEST_KEY')
    expect(setting!.value).toBe('test-value')
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
    const res = await fetchWithEnv('http://localhost/api/admin/settings/TEST_KEY2', {
      method: 'PATCH',
      headers: { ...auth.headers, 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })

  it('PATCH /admin/settings/:key creates audit log entry', async () => {
    const auth = await withAuth()
    const res = await fetchWithEnv('http://localhost/api/admin/settings/AUDIT_TEST_KEY', {
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
    const entry = body.entries.find((e) => e.target === 'AUDIT_TEST_KEY')
    expect(entry).toBeDefined()
    expect(entry!.action).toBe('update_setting')
    expect(entry!.user_id).toBe('test-admin-id')
    const details = JSON.parse(entry!.details)
    expect(details).toHaveProperty('oldValue')
    expect(details).toHaveProperty('newValue')
    expect(details.newValue).toBe('audit-value')
  })
})

describe('admin role enforcement', () => {
  async function withUserAuth(): Promise<{ headers: Record<string, string> }> {
    const token = await createJwt('test-user-id', (env as { JWT_SECRET: string }).JWT_SECRET)
    return { headers: { cookie: `auth_token=${token}` } }
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
    const res = await fetchWithEnv('http://localhost/api/admin/settings/TEST_KEY', {
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
