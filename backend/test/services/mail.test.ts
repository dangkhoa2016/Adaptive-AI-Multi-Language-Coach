import { describe, expect, it, beforeEach, vi } from 'vitest'
import {
  sendEmail,
  getActiveProviders,
  resendProvider,
  postmarkProvider,
} from '../../src/services/mail'

function mockDB(rows: Array<Record<string, unknown>>): D1Database {
  return {
    prepare: (_sql: string) => ({
      bind: (..._values: unknown[]) => ({
        all: async <T>() => ({ results: rows as unknown as T[], success: true }),
        first: async <T>() => (rows[0] ?? null) as unknown as T | null,
        run: async () => ({ success: true }),
        raw: async () => [],
      }),
      all: async <T>() => ({ results: rows as unknown as T[], success: true }),
      first: async <T>() => (rows[0] ?? null) as unknown as T | null,
      run: async () => ({ success: true }),
      raw: async () => [],
    }),
    batch: async () => [],
    exec: async () => ({ success: true }),
    dump: async () => new ArrayBuffer(0),
  } as unknown as D1Database
}

describe('mail service', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
  })

  describe('getActiveProviders', () => {
    it('returns only active providers', async () => {
      const db = mockDB([
        {
          provider_id: 'resend',
          provider_name: 'Resend',
          is_active: 1,
          weight: 10,
          config_json: '{}',
        },
      ])
      const providers = await getActiveProviders(db)
      expect(providers).toHaveLength(1)
      expect(providers[0].provider_id).toBe('resend')
    })

    it('returns empty array when no active providers', async () => {
      const db = mockDB([])
      const providers = await getActiveProviders(db)
      expect(providers).toHaveLength(0)
    })
  })

  describe('sendEmail', () => {
    it('returns false and logs when no providers configured', async () => {
      const db = mockDB([])
      const result = await sendEmail(db, {
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>test</p>',
      })
      expect(result).toBe(false)
    })

    it('calls Resend adapter when it is the active provider', async () => {
      fetchSpy.mockResolvedValue(new Response(null, { status: 200 }))

      const db = mockDB([
        {
          provider_id: 'resend',
          provider_name: 'Resend',
          is_active: 1,
          weight: 10,
          config_json: '{"apiKey":"re_test"}',
        },
      ])
      const result = await sendEmail(db, {
        to: 'test@example.com',
        subject: 'Hello',
        html: '<p>body</p>',
      })
      expect(result).toBe(true)
      expect(fetchSpy).toHaveBeenCalledTimes(1)
      const callUrl = fetchSpy.mock.calls[0][0]
      expect(callUrl).toBe('https://api.resend.com/emails')
    })

    it('calls Postmark adapter when it is the active provider', async () => {
      fetchSpy.mockResolvedValue(new Response(null, { status: 200 }))

      const db = mockDB([
        {
          provider_id: 'postmark',
          provider_name: 'Postmark',
          is_active: 1,
          weight: 10,
          config_json: '{"serverToken":"pm_test"}',
        },
      ])
      const result = await sendEmail(db, {
        to: 'test@example.com',
        subject: 'Hello',
        html: '<p>body</p>',
      })
      expect(result).toBe(true)
      expect(fetchSpy).toHaveBeenCalledTimes(1)
      const callUrl = fetchSpy.mock.calls[0][0]
      expect(callUrl).toBe('https://api.postmarkapp.com/email')
    })

    it('falls back to next provider after an explicit rate rejection', async () => {
      fetchSpy
        .mockResolvedValueOnce(new Response(null, { status: 429 }))
        .mockResolvedValueOnce(new Response(null, { status: 200 }))

      const db = mockDB([
        {
          provider_id: 'resend',
          provider_name: 'Resend',
          is_active: 1,
          weight: 5,
          config_json: '{"apiKey":"re_test"}',
        },
        {
          provider_id: 'postmark',
          provider_name: 'Postmark',
          is_active: 1,
          weight: 5,
          config_json: '{"serverToken":"pm_test"}',
        },
      ])
      const result = await sendEmail(db, {
        to: 'test@example.com',
        subject: 'Hello',
        html: '<p>body</p>',
      })
      expect(result).toBe(true)
      expect(fetchSpy).toHaveBeenCalledTimes(2)
    })

    it('returns false when all providers fail', async () => {
      fetchSpy.mockResolvedValue(new Response(null, { status: 500 }))

      const db = mockDB([
        {
          provider_id: 'resend',
          provider_name: 'Resend',
          is_active: 1,
          weight: 10,
          config_json: '{"apiKey":"re_test"}',
        },
      ])
      const result = await sendEmail(db, {
        to: 'test@example.com',
        subject: 'Hello',
        html: '<p>body</p>',
      })
      expect(result).toBe(false)
    })

    it('respects force_email_provider whitelist', async () => {
      fetchSpy.mockResolvedValue(new Response(null, { status: 200 }))

      const allRows = [
        {
          provider_id: 'resend',
          provider_name: 'Resend',
          is_active: 1,
          weight: 10,
          config_json: '{"apiKey":"re_test"}',
        },
        {
          provider_id: 'postmark',
          provider_name: 'Postmark',
          is_active: 1,
          weight: 10,
          config_json: '{"serverToken":"pm_test"}',
        },
      ]

      let callCount = 0
      const db = {
        prepare: (sql: string) => ({
          bind: (..._values: unknown[]) => ({
            all: async <T>() => {
              if (sql.includes('FROM email_providers_config')) {
                return { results: allRows as unknown as T[], success: true }
              }
              return { results: [] as unknown as T[], success: true }
            },
            first: async <T>() => {
              if (sql.includes("key = 'force_email_provider'")) {
                const firstCall = callCount === 0
                callCount++
                return (firstCall ? { value: 'postmark' } : null) as unknown as T | null
              }
              return null as unknown as T | null
            },
            run: async () => ({ success: true }),
            raw: async () => [],
          }),
          all: async <T>() => {
            if (sql.includes('FROM email_providers_config')) {
              return { results: allRows as unknown as T[], success: true }
            }
            return { results: [] as unknown as T[], success: true }
          },
          first: async <T>() => {
            if (sql.includes("key = 'force_email_provider'")) {
              const firstCall = callCount === 0
              callCount++
              return (firstCall ? { value: 'postmark' } : null) as unknown as T | null
            }
            return null as unknown as T | null
          },
          run: async () => ({ success: true }),
          raw: async () => [],
        }),
        batch: async () => [],
        exec: async () => ({ success: true }),
        dump: async () => new ArrayBuffer(0),
      } as unknown as D1Database

      // First call — system check queries ran first. We need a fresh call.
      const result = await sendEmail(db, {
        to: 'test@example.com',
        subject: 'Hello',
        html: '<p>body</p>',
      })
      // The second call's whitelist check is filtered
      expect(result).toBe(true)
      expect(fetchSpy).toHaveBeenCalledTimes(1)
      expect(fetchSpy.mock.calls[0][0]).toBe('https://api.postmarkapp.com/email')
    })
  })

  describe('Resend adapter', () => {
    it('sends with correct payload', async () => {
      fetchSpy.mockResolvedValue(new Response(null, { status: 200 }))

      await resendProvider.send({
        to: 'user@test.com',
        subject: 'Test',
        html: '<p>test</p>',
        config: { apiKey: 're_key', from: 'noreply@vocab.app' },
      })

      expect(fetchSpy).toHaveBeenCalledTimes(1)
      const [, opts] = fetchSpy.mock.calls[0]
      expect(opts.method).toBe('POST')
      expect(opts.headers.Authorization).toBe('Bearer re_key')
      const body = JSON.parse(opts.body)
      expect(body.to).toEqual(['user@test.com'])
      expect(body.from).toBe('noreply@vocab.app')
    })

    it('returns false without apiKey', async () => {
      const result = await resendProvider.send({
        to: 'user@test.com',
        subject: 'Test',
        html: '<p>test</p>',
        config: {},
      })
      expect(result).toBe(false)
    })
  })

  describe('Postmark adapter', () => {
    it('sends with correct payload', async () => {
      fetchSpy.mockResolvedValue(new Response(null, { status: 200 }))

      await postmarkProvider.send({
        to: 'user@test.com',
        subject: 'Test',
        html: '<p>test</p>',
        config: { serverToken: 'pm_token', from: 'noreply@vocab.app' },
      })

      expect(fetchSpy).toHaveBeenCalledTimes(1)
      const [, opts] = fetchSpy.mock.calls[0]
      expect(opts.method).toBe('POST')
      expect(opts.headers['X-Postmark-Server-Token']).toBe('pm_token')
      const body = JSON.parse(opts.body)
      expect(body.To).toBe('user@test.com')
      expect(body.From).toBe('noreply@vocab.app')
    })

    it('returns false without serverToken', async () => {
      const result = await postmarkProvider.send({
        to: 'user@test.com',
        subject: 'Test',
        html: '<p>test</p>',
        config: {},
      })
      expect(result).toBe(false)
    })
  })
})
