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
    expect(res.status).toBe(400)
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
    expect(res.status).toBe(400)
  })

  it('returns503 when local AI binding is unavailable', async () => {
    const res = await fetchWithEnv('http://localhost/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'hello world', locale: 'en' }),
    })
    expect(res.status).toBe(503)
    expect(await res.json()).toMatchObject({ error: 'service_unavailable' })
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
    expect(res.status).toBe(400)
  })

  it('rejects empty body with 400', async () => {
    const res = await fetchWithEnv('http://localhost/api/stt?reference=hello', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: new ArrayBuffer(0),
    })
    expect(res.status).toBe(400)
  })

  it('returns503 for valid audio when local AI binding is unavailable', async () => {
    const audioData = new Uint8Array([0x00, 0x01, 0x02, 0x03])
    const res = await fetchWithEnv('http://localhost/api/stt?reference=hello', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: audioData.buffer,
    })
    expect(res.status).toBe(503)
    expect(await res.json()).toMatchObject({ error: 'service_unavailable' })
  })
})
