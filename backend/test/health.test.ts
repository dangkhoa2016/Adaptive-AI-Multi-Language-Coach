import { SELF } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'

describe('health', () => {
  it('returns ok', async () => {
    const res = await SELF.fetch('http://example.com/health')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean }
    expect(body.ok).toBe(true)
  })
})

describe('locales endpoint', () => {
  it('returns supported locales', async () => {
    const res = await SELF.fetch('http://example.com/api/locales')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { locales: { code: string; label: string }[] }
    expect(body.locales.length).toBe(8)
    expect(body.locales.find((l) => l.code === 'vi')?.label).toBe('Tiếng Việt')
  })
})
