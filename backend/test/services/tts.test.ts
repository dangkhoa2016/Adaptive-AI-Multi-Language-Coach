import { describe, expect, it, vi } from 'vitest'
import { generateTtsAudio } from '../../src/services/tts'

describe('generateTtsAudio (stateless, no R2)', () => {
  function createMockAi(audioData?: ArrayBuffer) {
    return {
      run: vi.fn().mockResolvedValue(audioData ? { audio: audioData } : null),
    }
  }

  it('returns audio stream when AI model succeeds', async () => {
    const buffer = new ArrayBuffer(8)
    const ai = createMockAi(buffer)

    const result = await generateTtsAudio('hello', 'en', ai as never, '@cf/myshell-ai/melotts')

    expect(ai.run).toHaveBeenCalledWith('@cf/myshell-ai/melotts', {
      text: 'hello',
      lang: 'en',
    })
    expect(result.contentType).toBe('audio/mpeg')
    expect(result.body).toBeInstanceOf(ReadableStream)
  })

  it('throws when AI model returns no audio', async () => {
    const ai = createMockAi()

    await expect(
      generateTtsAudio('hello', 'en', ai as never, '@cf/myshell-ai/melotts'),
    ).rejects.toThrow('TTS model returned no audio')
  })

  it('throws when AI model returns empty object', async () => {
    const ai = {
      run: vi.fn().mockResolvedValue({}),
    }

    await expect(
      generateTtsAudio('hello', 'en', ai as never, '@cf/myshell-ai/melotts'),
    ).rejects.toThrow('TTS model returned no audio')
  })

  it('propagates AI model errors', async () => {
    const ai = {
      run: vi.fn().mockRejectedValue(new Error('AI service unavailable')),
    }

    await expect(
      generateTtsAudio('hello', 'en', ai as never, '@cf/myshell-ai/melotts'),
    ).rejects.toThrow('AI service unavailable')
  })
})

describe('mapLocaleToMelo', () => {
  const localeMappings: Array<[string, string]> = [
    ['en', 'en'],
    ['zh', 'zh'],
    ['ja', 'ja'],
    ['ko', 'ko'],
    ['fr', 'en'],
    ['vi', 'en'],
    ['th', 'en'],
    ['de', 'en'],
    ['unknown', 'en'],
  ]

  it.each(localeMappings)('maps %s → %s', async (locale, expectedLang) => {
    const ai = {
      run: vi.fn().mockResolvedValue({ audio: new ArrayBuffer(1) }),
    }

    await generateTtsAudio('test', locale, ai as never, 'test-model')

    expect(ai.run).toHaveBeenCalledWith('test-model', {
      text: 'test',
      lang: expectedLang,
    })
  })
})
