import { describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import { fetchWithEnv } from '../helpers'
import { createJwt } from '../../src/services/auth'
import { encrypt, decrypt } from '../../src/services/crypto'
import { getEnvSettingDecrypted } from '../../src/services/envSettings'

const bindings = env as { DB: D1Database; JWT_SECRET: string; ENCRYPTION_KEY: string }
const secret = JSON.stringify(['synthetic-admin-key-never-return'])
async function headers(user = 'test-admin-id') {
  return {
    cookie: `auth_token=${await createJwt(user, bindings.JWT_SECRET)}`,
    origin: 'http://localhost',
    'content-type': 'application/json',
  }
}
async function patch(key: string, value: unknown, user = 'test-admin-id') {
  return fetchWithEnv(`http://localhost/api/admin/settings/${key}`, {
    method: 'PATCH',
    headers: await headers(user),
    body: JSON.stringify(value),
  })
}

describe('admin secret security with real D1', () => {
  it('forces encryption and exposes metadata only in every response and audit entry', async () => {
    const response = await patch('AI_KEYS', { value: secret, encrypted: false })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ encrypted: true })
    const row = await bindings.DB.prepare('SELECT value FROM system_settings WHERE key = ?')
      .bind('env.AI_KEYS')
      .first<{ value: string }>()
    expect(row!.value.includes('synthetic-admin-key')).toBe(false)
    expect(await getEnvSettingDecrypted(bindings.DB, bindings.ENCRYPTION_KEY, 'AI_KEYS')).toBe(
      secret,
    )
    const res = await fetchWithEnv('http://localhost/api/admin/settings', {
      headers: await headers(),
    })
    const data = (await res.json()) as { settings: Record<string, unknown>[] }
    expect(data.settings.find((s) => s.key === 'AI_KEYS')).toMatchObject({
      configured: true,
      encrypted: true,
      masked: '********',
    })
    expect(data.settings.every((s) => !('value' in s) && 'updatedAt' in s)).toBe(true)
    const audit = await fetchWithEnv('http://localhost/api/admin/audit-log', {
      headers: await headers(),
    })
    const text = await audit.text()
    expect(text.includes('synthetic-admin-key')).toBe(false)
    expect(text.includes('oldValue')).toBe(false)
    expect(text.includes('newValue')).toBe(false)
    const stored = await bindings.DB.prepare('SELECT details FROM audit_log WHERE target = ?')
      .bind('AI_KEYS')
      .all<{ details: string }>()
    expect(
      stored.results.every(
        (r) => !r.details.includes('synthetic-admin-key') && !r.details.includes('Value'),
      ),
    ).toBe(true)
  })

  it('rejects arbitrary keys and invalid key-specific values', async () => {
    for (const [key, value] of [
      ['UNKNOWN_SECRET', 'secret'],
      ['AI_KEYS', 'plain-key'],
      ['AI_KEYS', '[]'],
      ['AI_MODEL_NAME', ''],
      ['AI_ENDPOINT_URL', 'javascript:alert(1)'],
      ['AI_MODEL_OPTIONS', '[]'],
      ['AI_MODEL_OPTIONS', '{"api_key":"credential"}'],
      ['AI_MODEL_OPTIONS', '{"model":"override"}'],
    ]) {
      expect((await patch(key, { value })).status).toBe(400)
    }
  })

  it('does not expose historical audit payloads or mutate their stored record', async () => {
    const details = JSON.stringify({
      oldValue: secret,
      newValue: secret,
      nested: { token: secret },
    })
    await bindings.DB.prepare(
      'INSERT INTO audit_log (id,user_id,action,target,details,created_at) VALUES (?,?,?,?,?,?)',
    )
      .bind(
        'historical-secret',
        'test-admin-id',
        'update_setting',
        'AI_KEYS',
        details,
        '2099-01-01',
      )
      .run()
    const res = await fetchWithEnv('http://localhost/api/admin/audit-log', {
      headers: await headers(),
    })
    expect((await res.text()).includes('synthetic-admin-key')).toBe(false)
    const stored = await bindings.DB.prepare('SELECT details FROM audit_log WHERE id = ?')
      .bind('historical-secret')
      .first<{ details: string }>()
    expect(stored?.details === details).toBe(true)
  })

  it('rejects plaintext and corrupt stored secrets without falling back or rewriting', async () => {
    for (const value of [secret, 'A'.repeat(64), 'enc:v1:corrupt']) {
      await bindings.DB.prepare('INSERT OR REPLACE INTO system_settings (key,value) VALUES (?,?)')
        .bind('env.AI_KEYS', value)
        .run()
      await expect(
        getEnvSettingDecrypted(bindings.DB, bindings.ENCRYPTION_KEY, 'AI_KEYS', 'unsafe-fallback'),
      ).rejects.toThrow()
      const res = await fetchWithEnv('http://localhost/api/admin/settings', {
        headers: await headers(),
      })
      expect(res.status).toBe(200)
      expect((await res.text()).includes('synthetic-admin-key')).toBe(false)
      const stored = await bindings.DB.prepare('SELECT value FROM system_settings WHERE key=?')
        .bind('env.AI_KEYS')
        .first<{ value: string }>()
      expect(stored?.value === value).toBe(true)
    }
  })

  it('supports authenticated legacy ciphertext and rejects wrong encryption keys', async () => {
    const ciphertext = await encrypt(secret, bindings.ENCRYPTION_KEY)
    await bindings.DB.prepare('INSERT OR REPLACE INTO system_settings (key,value) VALUES (?,?)')
      .bind('env.AI_KEYS', ciphertext)
      .run()
    expect(await getEnvSettingDecrypted(bindings.DB, bindings.ENCRYPTION_KEY, 'AI_KEYS')).toBe(
      secret,
    )
    await expect(
      getEnvSettingDecrypted(bindings.DB, 'wrong-key', 'AI_KEYS', 'unsafe-fallback'),
    ).rejects.toThrow()
    expect(await decrypt(ciphertext, bindings.ENCRYPTION_KEY)).toBe(secret)
  })

  it('requires admin authentication on reads and mutations', async () => {
    for (const path of ['settings', 'audit-log']) {
      expect((await fetchWithEnv(`http://localhost/api/admin/${path}`)).status).toBe(401)
      expect(
        (
          await fetchWithEnv(`http://localhost/api/admin/${path}`, {
            headers: await headers('test-user-id'),
          })
        ).status,
      ).toBe(403)
    }
    expect((await patch('AI_KEYS', { value: secret }, 'test-user-id')).status).toBe(403)
    expect(
      (
        await fetchWithEnv('http://localhost/api/admin/settings/AI_KEYS', {
          method: 'PATCH',
          headers: { origin: 'http://localhost', 'content-type': 'application/json' },
          body: JSON.stringify({ value: secret }),
        })
      ).status,
    ).toBe(401)
  })
  it('rolls back setting changes when the audit insert fails', async () => {
    const before = await bindings.DB.prepare('SELECT value FROM system_settings WHERE key = ?')
      .bind('env.AI_MODEL_NAME')
      .first<{ value: string }>()
    await bindings.DB.prepare(
      "CREATE TRIGGER fail_admin_audit BEFORE INSERT ON audit_log BEGIN SELECT RAISE(ABORT, 'synthetic audit failure'); END",
    ).run()
    try {
      expect((await patch('AI_MODEL_NAME', { value: 'synthetic-next-model' })).status).toBe(500)
      const after = await bindings.DB.prepare('SELECT value FROM system_settings WHERE key = ?')
        .bind('env.AI_MODEL_NAME')
        .first<{ value: string }>()
      expect(after?.value === before?.value).toBe(true)
    } finally {
      await bindings.DB.prepare('DROP TRIGGER fail_admin_audit').run()
    }
  })

  it('rejects expired admin sessions for reads and mutation', async () => {
    const encode = (value: string) =>
      btoa(value).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
    const unsigned =
      encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })) +
      '.' +
      encode(JSON.stringify({ sub: 'test-admin-id', iat: 1, exp: 2 }))
    const signingKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(bindings.JWT_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const signature = new Uint8Array(
      await crypto.subtle.sign('HMAC', signingKey, new TextEncoder().encode(unsigned)),
    )
    const auth = {
      origin: 'http://localhost',
      cookie: 'auth_token=' + unsigned + '.' + encode(String.fromCharCode(...signature)),
      'content-type': 'application/json',
    }
    expect(
      (await fetchWithEnv('http://localhost/api/admin/settings', { headers: auth })).status,
    ).toBe(401)
    expect(
      (await fetchWithEnv('http://localhost/api/admin/audit-log', { headers: auth })).status,
    ).toBe(401)
    expect(
      (
        await fetchWithEnv('http://localhost/api/admin/settings/AI_KEYS', {
          method: 'PATCH',
          headers: auth,
          body: JSON.stringify({ value: secret }),
        })
      ).status,
    ).toBe(401)
  })
})
