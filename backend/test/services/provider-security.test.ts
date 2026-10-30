import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { callAI } from '../../src/services/ai'
import { encrypt } from '../../src/services/crypto'
import {
  createMockEnv,
  resetSystemSettings,
  resetSavedAiContent,
  savedAiContent,
  systemSettingsStore,
} from '../helpers'
import type { GenerateRequest } from '../../src/services/schemas'

const request: GenerateRequest = {
  source: 'en',
  target: 'vi',
  topic: 'travel',
  level: 'A1',
  count: 1,
  mode: 'word',
  uiLocale: 'en',
}
const pairs = [
  {
    source: 'hello',
    target: 'xin chào',
    exampleSource: '',
    exampleTarget: '',
    ipa: '',
    pos: '',
    isPhrase: false,
  },
]
const validResponse = () =>
  Response.json({
    output: [
      { type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ pairs }) }] },
    ],
  })
const marker = 'SYNTHETIC_PROVIDER_PRIVATE_MARKER'

beforeEach(async () => {
  resetSystemSettings()
  resetSavedAiContent()
  systemSettingsStore.set(
    'env.AI_KEYS',
    'enc:v1:' +
      (await encrypt(
        JSON.stringify([marker, 'synthetic-second', 'synthetic-third', 'synthetic-fourth']),
        'test-encryption-key-32-chars!!',
      )),
  )
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('AI provider safety', () => {
  it('never sends credentials to an untrusted stored origin', async () => {
    systemSettingsStore.set('env.AI_ENDPOINT_URL', 'https://untrusted.example/v1/responses')
    const fetch = vi.fn().mockResolvedValue(validResponse())
    vi.stubGlobal('fetch', fetch)
    expect(await callAI(createMockEnv(), request)).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('allows only exact trusted deployment origins and disables redirects', async () => {
    systemSettingsStore.set('env.AI_ENDPOINT_URL', 'https://provider.example/v1/responses')
    const fetch = vi.fn().mockResolvedValue(validResponse())
    vi.stubGlobal('fetch', fetch)
    expect(
      await callAI(createMockEnv({ AI_PROVIDER_ORIGINS: 'https://provider.example' }), request),
    ).toEqual(pairs)
    expect(fetch.mock.calls[0][1].redirect).toBe('manual')
    expect(fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal)
  })

  it('rejects invalid trusted-origin deployment config without fetch', async () => {
    const fetch = vi.fn().mockResolvedValue(validResponse())
    vi.stubGlobal('fetch', fetch)
    for (const config of [
      '',
      'http://api.openai.com',
      'https://user:password@api.openai.com',
      'https://api.openai.com/path',
      'https://api.openai.com,',
    ]) {
      expect(await callAI(createMockEnv({ AI_PROVIDER_ORIGINS: config }), request)).toBeNull()
    }
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects legacy stored request-option smuggling instead of forwarding it', async () => {
    const fetch = vi.fn().mockResolvedValue(validResponse())
    vi.stubGlobal('fetch', fetch)
    for (const value of [
      '{"model":"override","input":"private"}',
      '{"Authorization":"credential"}',
      '[]',
      'invalid',
    ]) {
      systemSettingsStore.set('env.AI_MODEL_OPTIONS', value)
      expect(await callAI(createMockEnv(), request)).toBeNull()
    }
    expect(fetch).not.toHaveBeenCalled()
  })

  it('bounds failed rotation to three key attempts', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 401 }))
    vi.stubGlobal('fetch', fetch)
    expect(await callAI(createMockEnv(), request)).toBeNull()
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('stops after a hanging fetch instead of retrying ambiguous inference', async () => {
    vi.useFakeTimers()
    const fetch = vi.fn().mockImplementation(() => new Promise(() => {}))
    vi.stubGlobal('fetch', fetch)
    const result = callAI(createMockEnv(), request)
    // Flush encryption and DB setup before advancing the network timeout.
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    await vi.advanceTimersByTimeAsync(5000)
    expect(await result).toBeNull()
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls.every((call) => call[1].signal.aborted)).toBe(true)
  })

  it('stops after stalled body without retrying an accepted inference', async () => {
    vi.useFakeTimers()
    const fetch = vi
      .fn()
      .mockImplementation(async () => new Response(new ReadableStream({ start() {} })))
    vi.stubGlobal('fetch', fetch)
    const result = callAI(createMockEnv(), request)
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    await vi.advanceTimersByTimeAsync(5000)
    expect(await result).toBeNull()
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('rejects oversized declared and streamed bodies without saving provider data', async () => {
    const declaredTooLarge = validResponse()
    declaredTooLarge.headers.set('content-length', '10000000')
    const oversizedJson = new TextEncoder().encode(
      JSON.stringify({
        output: [
          { type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ pairs }) }] },
        ],
        padding: ' '.repeat(262145),
      }),
    )
    const streamedTooLarge = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(oversizedJson.subarray(0, 140000))
          controller.enqueue(oversizedJson.subarray(140000))
          controller.close()
        },
      }),
    )
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(declaredTooLarge)
      .mockResolvedValueOnce(streamedTooLarge)

    vi.stubGlobal('fetch', fetch)
    expect(await callAI(createMockEnv(), request)).toBeNull()
    expect(await callAI(createMockEnv(), request)).toBeNull()
    expect(savedAiContent).toHaveLength(0)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('never logs raw provider text, error messages or keys', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error(marker))
      .mockResolvedValueOnce(
        Response.json({
          output: [{ type: 'message', content: [{ type: 'output_text', text: marker }] }],
        }),
      )
      .mockResolvedValueOnce(new Response(marker, { status: 503 }))
    vi.stubGlobal('fetch', fetch)
    expect(await callAI(createMockEnv(), request)).toBeNull()
    expect(await callAI(createMockEnv(), request)).toBeNull()
    expect(await callAI(createMockEnv(), request)).toBeNull()
    expect(JSON.stringify(error.mock.calls).includes(marker)).toBe(false)
    expect(
      error.mock.calls.every(
        (call) => call.length === 1 && call[0] === '[ai] provider_unavailable',
      ),
    ).toBe(true)
  })
  it('uses the same validated settings snapshot supplied for the cache namespace', async () => {
    systemSettingsStore.set('env.AI_MODEL_NAME', 'changed-after-snapshot')
    const fetch = vi.fn().mockResolvedValue(validResponse())
    vi.stubGlobal('fetch', fetch)
    const snapshot = {
      aiEndpointUrl: 'https://api.openai.com/v1/responses',
      aiModelName: 'snapshot-model',
      aiModelOptions: { temperature: 0 },
    }
    expect(await callAI(createMockEnv(), request, 'snapshot-namespace', snapshot)).toEqual(pairs)
    expect(JSON.parse(fetch.mock.calls[0][1].body).model).toBe('snapshot-model')
  })

  it('bounds slow explicit rejections followed by a timeout to fifteen seconds total', async () => {
    vi.useFakeTimers()
    let calls = 0
    const fetch = vi.fn().mockImplementation(() => {
      calls++
      if (calls < 3)
        return new Promise((resolve) =>
          setTimeout(() => resolve(new Response(null, { status: 429 })), 4900),
        )
      return new Promise(() => {})
    })
    vi.stubGlobal('fetch', fetch)
    const result = callAI(createMockEnv(), request)
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    await vi.advanceTimersByTimeAsync(15000)
    expect(await result).toBeNull()
    expect(fetch).toHaveBeenCalledTimes(3)
  })
})
