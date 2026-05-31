import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import type { Bindings, Variables } from '../../src/env'
import { structuredLogger } from '../../src/middleware/structuredLogger'

describe('structuredLogger middleware', () => {
  let app: Hono<{ Bindings: Bindings; Variables: Variables }>
  let logSpy: ReturnType<typeof vi.spyOn>
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    app = new Hono<{ Bindings: Bindings; Variables: Variables }>()
    app.use('*', structuredLogger())
    app.get('/ok', (c) => c.json({ ok: true }))
    app.get('/err', (c) => c.json({ error: 'fail' }, 500))
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    logSpy.mockRestore()
    errorSpy.mockRestore()
  })

  it('logs 200 responses with console.log', async () => {
    const req = new Request('http://localhost/ok')
    await app.fetch(req)

    expect(logSpy).toHaveBeenCalledTimes(1)
    const entry = JSON.parse(logSpy.mock.calls[0][0])
    expect(entry.method).toBe('GET')
    expect(entry.path).toBe('/ok')
    expect(entry.status).toBe(200)
    expect(typeof entry.requestId).toBe('string')
    expect(typeof entry.durationMs).toBe('number')
    expect(typeof entry.timestamp).toBe('string')
    expect(entry.remote).toBe('unknown')
  })

  it('logs 500 responses with console.error', async () => {
    const req = new Request('http://localhost/err')
    await app.fetch(req)

    expect(errorSpy).toHaveBeenCalledTimes(1)
    const entry = JSON.parse(errorSpy.mock.calls[0][0])
    expect(entry.status).toBe(500)
    expect(entry.path).toBe('/err')
  })

  it('extracts remote IP from cf-connecting-ip header', async () => {
    const req = new Request('http://localhost/ok', {
      headers: { 'cf-connecting-ip': '1.2.3.4' },
    })
    await app.fetch(req)

    const entry = JSON.parse(logSpy.mock.calls[0][0])
    expect(entry.remote).toBe('1.2.3.4')
  })

  it('falls back to x-forwarded-for if cf-connecting-ip missing', async () => {
    const req = new Request('http://localhost/ok', {
      headers: { 'x-forwarded-for': '5.6.7.8' },
    })
    await app.fetch(req)

    const entry = JSON.parse(logSpy.mock.calls[0][0])
    expect(entry.remote).toBe('5.6.7.8')
  })
})
