import { describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import { fetchWithEnv } from '../helpers'
import { createJwt } from '../../src/services/auth'

async function withAdminAuth(): Promise<{ headers: Record<string, string> }> {
  const token = await createJwt('test-admin-id', (env as { JWT_SECRET: string }).JWT_SECRET)
  return { headers: { cookie: `auth_token=${token}` } }
}

async function withUserAuth(): Promise<{ headers: Record<string, string> }> {
  const token = await createJwt('test-user-id', (env as { JWT_SECRET: string }).JWT_SECRET)
  return { headers: { cookie: `auth_token=${token}` } }
}

describe('requireAdmin middleware', () => {
  it('allows admin user through', async () => {
    const auth = await withAdminAuth()
    const res = await fetchWithEnv('http://localhost/api/admin/settings', {
      headers: { ...auth.headers },
    })
    expect(res.status).toBe(200)
  })

  it('returns 403 for non-admin user', async () => {
    const auth = await withUserAuth()
    const res = await fetchWithEnv('http://localhost/api/admin/settings', {
      headers: { ...auth.headers },
    })
    expect(res.status).toBe(403)
    const body = (await res.json()) as { error: string; message: string }
    expect(body.error).toBe('forbidden')
    expect(body.message).toBe('Admin access required')
  })

  it('returns 401 for unauthenticated request', async () => {
    const res = await fetchWithEnv('http://localhost/api/admin/settings')
    expect(res.status).toBe(401)
  })
})
