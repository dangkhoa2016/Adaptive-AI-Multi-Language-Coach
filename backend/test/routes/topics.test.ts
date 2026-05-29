import { describe, expect, it, beforeEach } from 'vitest'
import { fetchWithEnv, resetKV } from './helpers'

describe('topics endpoint', () => {
  beforeEach(() => resetKV())

  it('returns topics in the resolved locale (vi)', async () => {
    const res = await fetchWithEnv('http://localhost/api/topics', {
      headers: { 'accept-language': 'vi' },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { topics: { key: string; label: string }[] }
    expect(body.topics.length).toBe(10)
    const travel = body.topics.find((t) => t.key === 'travel')
    expect(travel?.label).toBe('Du lịch')
  })

  it('returns topics in English by default', async () => {
    const res = await fetchWithEnv('http://localhost/api/topics')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { topics: { key: string; label: string }[] }
    const travel = body.topics.find((t) => t.key === 'travel')
    expect(travel?.label).toBe('Travel')
  })

  it('returns topics with lang query param (ja)', async () => {
    const res = await fetchWithEnv('http://localhost/api/topics?lang=ja')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { topics: { key: string; label: string }[] }
    const travel = body.topics.find((t) => t.key === 'travel')
    expect(travel?.label).toBe('旅行')
  })
})
