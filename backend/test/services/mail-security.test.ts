import { afterEach, describe, expect, it, vi } from 'vitest'
import { sendEmail, resendProvider, postmarkProvider } from '../../src/services/mail'

const providers = [
  {
    provider_id: 'resend',
    provider_name: 'synthetic',
    is_active: 1,
    weight: 1,
    config_json: '{"apiKey":"SYNTHETIC_MAIL_PRIVATE"}',
  },
  {
    provider_id: 'postmark',
    provider_name: 'synthetic',
    is_active: 1,
    weight: 1,
    config_json: '{"serverToken":"SYNTHETIC_MAIL_PRIVATE"}',
  },
]
const params = { to: 'synthetic@example.invalid', subject: 'synthetic', html: '<p>synthetic</p>' }
function database(): D1Database {
  return {
    prepare: () => ({ first: async () => null, all: async () => ({ results: providers }) }),
  } as unknown as D1Database
}
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('mail delivery safety', () => {
  it('settles at five seconds and never retries an ambiguous timeout', async () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}))
    let result: boolean | undefined
    const pending = sendEmail(database(), params).then((value) => {
      result = value
    })
    await vi.advanceTimersByTimeAsync(5000)
    expect(result).toBe(false)
    await pending
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0][1]?.signal?.aborted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each([resendProvider, postmarkProvider])(
    'disables redirects and cancels unread bodies',
    async (provider) => {
      const cancel = vi.fn()
      const body = new ReadableStream({ cancel })
      const fetch = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response(body, { status: 200 }))
      expect(
        await provider.send({
          ...params,
          config: { apiKey: 'synthetic', serverToken: 'synthetic' },
        }),
      ).toBe(true)
      expect(fetch.mock.calls[0][1]?.redirect).toBe('manual')
      expect(fetch.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal)
      expect(cancel).toHaveBeenCalledTimes(1)
    },
  )

  it('rejects a late response even if the deadline timer has not run yet', async () => {
    vi.useFakeTimers()
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      vi.setSystemTime(Date.now() + 5001)
      return new Response(null, { status: 200 })
    })
    expect(await sendEmail(database(), params)).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each([resendProvider, postmarkProvider])(
    'never starts a fetch with an exhausted budget',
    async (provider) => {
      const fetch = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response(null, { status: 200 }))
      await expect(
        provider.send({
          ...params,
          config: { apiKey: 'synthetic', serverToken: 'synthetic' },
          timeoutMs: 0,
        }),
      ).rejects.toThrow('Mail delivery unavailable')
      expect(fetch).not.toHaveBeenCalled()
    },
  )

  it.each([400, 408, 500, 502, 302])('never retries ambiguous HTTP status %s', async (status) => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
    expect(await sendEmail(database(), params)).toBe(false)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it.each([401, 403, 429])('may rotate after explicit provider rejection %s', async (status) => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
    expect(await sendEmail(database(), params)).toBe(true)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('bounds the total budget including unavailable D1 provider configuration', async () => {
    vi.useFakeTimers()
    const db = { prepare: () => ({ first: () => new Promise(() => {}) }) } as unknown as D1Database
    let result: boolean | undefined
    const pending = sendEmail(db, params).then((value) => {
      result = value
    })
    await vi.advanceTimersByTimeAsync(15000)
    expect(result).toBe(false)
    await pending
    expect(vi.getTimerCount()).toBe(0)
  })

  it('never sends after the total deadline even if a slow configuration read finishes late', async () => {
    vi.useFakeTimers()
    let finish: ((value: null) => void) | undefined
    const db = {
      prepare: () => ({
        first: () =>
          new Promise<null>((resolve) => {
            finish = resolve
          }),
        all: async () => ({ results: providers }),
      }),
    } as unknown as D1Database
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 200 }))
    let result: boolean | undefined
    const pending = sendEmail(db, params).then((value) => {
      result = value
    })
    await vi.advanceTimersByTimeAsync(15000)
    expect(result).toBe(false)
    finish?.(null)
    await vi.advanceTimersByTimeAsync(0)
    await pending
    expect(fetch).not.toHaveBeenCalled()
  })
})
