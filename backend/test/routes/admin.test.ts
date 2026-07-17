import { describe, expect, it } from 'vitest'
import { fetchWithEnv } from '../helpers'

describe('admin settings', () => {
  it('GET /admin/settings returns seeded env settings', async () => {
    const res = await fetchWithEnv('http://localhost/api/admin/settings')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { settings: Array<{ key: string }> }
    expect(Array.isArray(body.settings)).toBe(true)
    expect(body.settings.length).toBeGreaterThan(0)
    const keys = body.settings.map((s) => s.key)
    expect(keys).toContain('AI_ENDPOINT_URL')
    expect(keys).toContain('EMAIL_FROM')
  })

  it('PATCH /admin/settings/:key creates a new setting', async () => {
    const res = await fetchWithEnv('http://localhost/api/admin/settings/TEST_KEY', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: 'test-value' }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { success: boolean; key: string; encrypted: boolean }
    expect(body.success).toBe(true)
    expect(body.key).toBe('TEST_KEY')
    expect(body.encrypted).toBe(false)
  })

  it('GET /admin/settings includes newly created setting', async () => {
    const res = await fetchWithEnv('http://localhost/api/admin/settings')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { settings: Array<{ key: string; value: string }> }
    const keys = body.settings.map((s) => s.key)
    expect(keys).toContain('TEST_KEY')
    const setting = body.settings.find((s) => s.key === 'TEST_KEY')
    expect(setting!.value).toBe('test-value')
  })

  it('PATCH /admin/settings/:key rejects env. prefix', async () => {
    const res = await fetchWithEnv('http://localhost/api/admin/settings/env.SECRET', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: 'test' }),
    })
    expect(res.status).toBe(400)
  })

  it('PATCH /admin/settings/:key rejects missing value', async () => {
    const res = await fetchWithEnv('http://localhost/api/admin/settings/TEST_KEY2', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })
})
