import { describe, expect, it, beforeEach } from 'vitest'
import { parseAIResponse, callAI } from '../../src/services/ai'
import {
  savedAiContent,
  resetSavedAiContent,
  resetSystemSettings,
  systemSettingsStore,
  createMockEnv,
} from '../helpers'
import type { GenerateRequest, VocabPair } from '../../src/services/schemas'

const VALID_PAIRS: VocabPair[] = [
  {
    source: 'hello',
    target: 'xin chào',
    exampleSource: 'Hello world',
    exampleTarget: 'Xin chào thế giới',
    ipa: '/həˈləʊ/',
    pos: 'interjection',
    isPhrase: false,
  },
  {
    source: 'goodbye',
    target: 'tạm biệt',
    exampleSource: 'Goodbye friend',
    exampleTarget: 'Tạm biệt bạn',
    ipa: '/ɡʊdˈbaɪ/',
    pos: 'interjection',
    isPhrase: false,
  },
]

describe('parseAIResponse', () => {
  it('parses valid JSON with pairs array', () => {
    const text = JSON.stringify({ pairs: VALID_PAIRS })
    const result = parseAIResponse(text)
    expect(result).toEqual(VALID_PAIRS)
  })

  it('parses JSON embedded in surrounding text', () => {
    const text = `Here are your results:\n\`\`\`json\n${JSON.stringify({ pairs: VALID_PAIRS })}\n\`\`\`\nHope this helps!`
    const result = parseAIResponse(text)
    expect(result).toEqual(VALID_PAIRS)
  })

  it('returns null for non-JSON text', () => {
    expect(parseAIResponse('Sorry, I cannot help with that.')).toBeNull()
  })

  it('returns null for malformed JSON', () => {
    expect(parseAIResponse('{"pairs": [{ broken }]}')).toBeNull()
  })

  it('returns null when pairs array is missing', () => {
    expect(parseAIResponse('{"data": []}')).toBeNull()
  })

  it('returns null when pair is missing required fields', () => {
    const incomplete = JSON.stringify({
      pairs: [{ source: 'hello' }],
    })
    expect(parseAIResponse(incomplete)).toBeNull()
  })

  it('validates isPhrase is boolean', () => {
    const badType = JSON.stringify({
      pairs: [
        {
          source: 'hello',
          target: 'xin chào',
          exampleSource: '',
          exampleTarget: '',
          ipa: '',
          pos: '',
          isPhrase: 'yes',
        },
      ],
    })
    expect(parseAIResponse(badType)).toBeNull()
  })
})

describe('callAI — key rotation and saveGeneratedContent', () => {
  beforeEach(() => {
    resetSystemSettings()
    resetSavedAiContent()
  })

  function setAiKeys(keys: string[]) {
    // Stored as raw JSON in D1 system_settings under 'env.AI_KEYS'
    // Not encrypted in tests — getEnvSettingDecrypted returns as-is when isEncrypted() is false
    systemSettingsStore.set('env.AI_KEYS', JSON.stringify(keys))
  }

  function mockFetchResponseWith(pairs: VocabPair[]) {
    return {
      ok: true,
      json: async () => ({
        output: [
          {
            type: 'message',
            content: [{ type: 'output_text', text: JSON.stringify({ pairs }) }],
          },
        ],
      }),
    }
  }

  // --- Key availability ---

  it('does not save to DB when AI_KEYS is empty', async () => {
    setAiKeys([])
    const env = createMockEnv()
    const req: GenerateRequest = {
      source: 'en',
      target: 'vi',
      topic: 'travel',
      level: 'A1',
      count: 5,
      uiLocale: 'en',
      mode: 'mix',
    }

    const result = await callAI(env, req)
    expect(result).toBeNull()
    expect(savedAiContent.length).toBe(0)
  })

  // --- Success path ---

  it('saves to DB after successful AI response parsing', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = async () => mockFetchResponseWith(VALID_PAIRS) as Response

    setAiKeys(['key-1', 'key-2'])

    const env = createMockEnv({})
    const req: GenerateRequest = {
      source: 'en',
      target: 'vi',
      topic: 'travel',
      level: 'A1',
      count: 2,
      uiLocale: 'en',
      mode: 'word',
    }

    try {
      const result = await callAI(env, req)
      expect(result).toEqual(VALID_PAIRS)
      expect(savedAiContent.length).toBe(1)
      const saved = savedAiContent[0]
      expect(saved.source_lang).toBe('en')
      expect(saved.target_lang).toBe('vi')
      expect(saved.topic).toBe('travel')
      expect(saved.level).toBe('A1')
      expect(saved.mode).toBe('word')
      expect(saved.count).toBe(2)
      expect(saved.cache_key).toContain('en|vi|travel|A1|2|word')

      const parsed = JSON.parse(saved.pairs_json) as VocabPair[]
      expect(parsed).toEqual(VALID_PAIRS)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  // --- Failure paths (no DB save) ---

  it('does not save to DB when AI returns non-OK response', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = async () => ({ ok: false, status: 500 }) as Response

    setAiKeys(['key-1'])

    const env = createMockEnv({})
    const req: GenerateRequest = {
      source: 'en',
      target: 'vi',
      topic: 'travel',
      level: 'A1',
      count: 5,
      uiLocale: 'en',
      mode: 'mix',
    }

    try {
      const result = await callAI(env, req)
      expect(result).toBeNull()
      expect(savedAiContent.length).toBe(0)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('does not save to DB when AI response fails parsing', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = async () =>
      ({
        ok: true,
        json: async () => ({
          output: [
            {
              type: 'message',
              content: [{ type: 'output_text', text: 'I cannot help with that' }],
            },
          ],
        }),
      }) as Response

    setAiKeys(['key-1'])

    const env = createMockEnv({})
    const req: GenerateRequest = {
      source: 'en',
      target: 'vi',
      topic: 'travel',
      level: 'A1',
      count: 5,
      uiLocale: 'en',
      mode: 'mix',
    }

    try {
      const result = await callAI(env, req)
      expect(result).toBeNull()
      expect(savedAiContent.length).toBe(0)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('does not save to DB when AI response has invalid pair schema', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = async () =>
      ({
        ok: true,
        json: async () => ({
          output: [
            {
              type: 'message',
              content: [
                {
                  type: 'output_text',
                  text: JSON.stringify({ pairs: [{ source: 'hello' }] }),
                },
              ],
            },
          ],
        }),
      }) as Response

    setAiKeys(['key-1'])

    const env = createMockEnv({})
    const req: GenerateRequest = {
      source: 'en',
      target: 'vi',
      topic: 'travel',
      level: 'A1',
      count: 5,
      uiLocale: 'en',
      mode: 'mix',
    }

    try {
      const result = await callAI(env, req)
      expect(result).toBeNull()
      expect(savedAiContent.length).toBe(0)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  // --- DB error resilience ---

  it('does not crash when DB insert fails', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = async () => mockFetchResponseWith(VALID_PAIRS) as Response

    const brokenDB = {
      prepare: (sql: string) => ({
        bind: (...values: unknown[]) => ({
          all: async <T>() => {
            if (sql.includes('FROM system_settings')) {
              const keyPattern = values[0] as string
              if (keyPattern === 'env.AI_KEYS') {
                return {
                  results: [{ value: JSON.stringify(['key-1']) }] as T[],
                  success: true,
                } as never
              }
              return { results: [] as T[], success: true } as never
            }
            return { results: [] as T[], success: true } as never
          },
          run: async () => {
            throw new Error('DB write failed')
          },
          first: async () => null,
          raw: async () => [],
        }),
        all: async <T>() => ({ results: [] as T[], success: true }) as never,
        first: async () => null,
        run: async () => ({ success: true }),
        raw: async () => [],
      }),
      batch: async () => [],
      exec: async () => ({ success: true }),
      dump: async () => new ArrayBuffer(0),
    } as unknown as D1Database

    const env = createMockEnv({ DB: brokenDB })
    const req: GenerateRequest = {
      source: 'en',
      target: 'vi',
      topic: 'travel',
      level: 'A1',
      count: 2,
      uiLocale: 'en',
      mode: 'word',
    }

    try {
      const result = await callAI(env, req)
      expect(result).toEqual(VALID_PAIRS)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  // --- Key rotation ---

  it('falls back to second key when first key returns non-OK', async () => {
    const originalFetch = globalThis.fetch
    let callCount = 0
    globalThis.fetch = async () => {
      callCount++
      if (callCount === 1) return { ok: false, status: 429 } as Response
      return mockFetchResponseWith(VALID_PAIRS) as Response
    }

    setAiKeys(['key-bad', 'key-good'])

    const env = createMockEnv({})
    const req: GenerateRequest = {
      source: 'en',
      target: 'vi',
      topic: 'travel',
      level: 'A1',
      count: 2,
      uiLocale: 'en',
      mode: 'word',
    }

    try {
      const result = await callAI(env, req)
      expect(result).toEqual(VALID_PAIRS)
      expect(callCount).toBe(2)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('falls back when first key throws network error', async () => {
    const originalFetch = globalThis.fetch
    let callCount = 0
    globalThis.fetch = async () => {
      callCount++
      if (callCount === 1) throw new Error('Network error')
      return mockFetchResponseWith(VALID_PAIRS) as Response
    }

    setAiKeys(['key-error', 'key-good'])

    const env = createMockEnv({})
    const req: GenerateRequest = {
      source: 'en',
      target: 'vi',
      topic: 'travel',
      level: 'A1',
      count: 2,
      uiLocale: 'en',
      mode: 'word',
    }

    try {
      const result = await callAI(env, req)
      expect(result).toEqual(VALID_PAIRS)
      expect(callCount).toBe(2)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('falls back when first key returns unparseable response', async () => {
    const originalFetch = globalThis.fetch
    let callCount = 0
    globalThis.fetch = async () => {
      callCount++
      if (callCount === 1)
        return {
          ok: true,
          json: async () => ({
            output: [{ type: 'message', content: [{ type: 'output_text', text: 'no json here' }] }],
          }),
        } as Response
      return mockFetchResponseWith(VALID_PAIRS) as Response
    }

    setAiKeys(['key-bad-response', 'key-good'])

    const env = createMockEnv({})
    const req: GenerateRequest = {
      source: 'en',
      target: 'vi',
      topic: 'travel',
      level: 'A1',
      count: 2,
      uiLocale: 'en',
      mode: 'word',
    }

    try {
      const result = await callAI(env, req)
      expect(result).toEqual(VALID_PAIRS)
      expect(callCount).toBe(2)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('returns null when all keys fail', async () => {
    const originalFetch = globalThis.fetch
    let callCount = 0
    globalThis.fetch = async () => {
      callCount++
      return { ok: false, status: 500 } as Response
    }

    setAiKeys(['key-1', 'key-2', 'key-3'])

    const env = createMockEnv({})
    const req: GenerateRequest = {
      source: 'en',
      target: 'vi',
      topic: 'travel',
      level: 'A1',
      count: 2,
      uiLocale: 'en',
      mode: 'word',
    }

    try {
      const result = await callAI(env, req)
      expect(result).toBeNull()
      expect(callCount).toBe(3)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
