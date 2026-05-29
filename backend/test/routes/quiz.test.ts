import { describe, expect, it, beforeEach } from 'vitest'
import { fetchWithEnv, resetKV } from './helpers'

describe('quiz endpoint', () => {
  beforeEach(() => resetKV())

  it('generates quiz questions from pairs', async () => {
    const pairs = [
      { source: 'hello', target: 'xin chào', isPhrase: false },
      { source: 'thank you', target: 'cảm ơn', isPhrase: true },
      { source: 'goodbye', target: 'tạm biệt', isPhrase: false },
      { source: 'sorry', target: 'xin lỗi', isPhrase: false },
    ]
    const res = await fetchWithEnv('http://localhost/api/quiz', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pairs }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      questions: { pair: unknown; options: string[]; correctIndex: number }[]
    }
    expect(body.questions.length).toBe(4)
    for (const q of body.questions) {
      expect(q.options.length).toBe(4)
      expect(q.correctIndex).toBeGreaterThanOrEqual(0)
      expect(q.correctIndex).toBeLessThan(4)
    }
  })

  it('rejects empty pairs', async () => {
    const res = await fetchWithEnv('http://localhost/api/quiz', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pairs: [] }),
    })
    expect(res.status).toBe(400)
  })

  it('rejects missing pairs field', async () => {
    const res = await fetchWithEnv('http://localhost/api/quiz', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })
})
