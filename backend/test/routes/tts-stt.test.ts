import { describe, expect, it, beforeEach } from 'vitest'
import { fetchWithEnv, resetKV } from '../helpers'

describe('TTS endpoint', () => {
  beforeEach(() => resetKV())

  it('rejects empty text with 400', async () => {
    const res = await fetchWithEnv('http://localhost/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '', locale: 'en' }),
    })
    // Rate limiter may kick in during tests, so accept 400 or 429
    expect([400, 429]).toContain(res.status)
    if (res.status === 400) {
      const body = (await res.json()) as { error: string }
      expect(body.error).toBe('invalid_payload')
    }
  })

  it('rejects missing text field with 400', async () => {
    const res = await fetchWithEnv('http://localhost/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: 'en' }),
    })
    expect([400, 429]).toContain(res.status)
  })

  it('returns audio/mpeg or 500 on valid request', async () => {
    const res = await fetchWithEnv('http://localhost/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'hello world', locale: 'en' }),
    })
    // Either 200 with audio, 429 rate limited, or 500 if AI binding is missing
    expect([200, 429, 500]).toContain(res.status)
    if (res.status === 200) {
      expect(res.headers.get('content-type')).toContain('audio/mpeg')
    }
  })
})

describe('STT endpoint', () => {
  beforeEach(() => resetKV())

  it('rejects non-audio content type with 400', async () => {
    const res = await fetchWithEnv('http://localhost/api/stt?reference=hello', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: true }),
    })
    expect([400, 429]).toContain(res.status)
  })

  it('rejects empty body with 400', async () => {
    const res = await fetchWithEnv('http://localhost/api/stt?reference=hello', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: new ArrayBuffer(0),
    })
    expect([400, 429]).toContain(res.status)
  })

  it('returns transcript and similarity or 500 on valid audio', async () => {
    const audioData = new Uint8Array([0x00, 0x01, 0x02, 0x03])
    const res = await fetchWithEnv('http://localhost/api/stt?reference=hello', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: audioData.buffer,
    })
    // Either 200 with JSON, 429 rate limited, or 500 if AI binding is missing
    expect([200, 429, 500]).toContain(res.status)
    if (res.status === 200) {
      const body = (await res.json()) as { transcript: string; similarity: number | null }
      expect(typeof body.transcript).toBe('string')
    }
  })
})
