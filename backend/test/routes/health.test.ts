import { describe, expect, it, beforeEach } from 'vitest'
import { fetchWithEnv, resetKV } from './helpers'

describe('health', () => {
  beforeEach(() => resetKV())

  it('returns ok', async () => {
    const res = await fetchWithEnv('http://localhost/health')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean }
    expect(body.ok).toBe(true)
  })
})

describe('locales endpoint', () => {
  beforeEach(() => resetKV())

  it('returns supported locales', async () => {
    const res = await fetchWithEnv('http://localhost/api/locales')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { locales: { code: string; label: string }[] }
    expect(body.locales.length).toBe(8)
    expect(body.locales.find((l) => l.code === 'vi')?.label).toBe('Tiếng Việt')
  })
})
