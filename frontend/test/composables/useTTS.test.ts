import { describe, expect, it, beforeEach, vi } from 'vitest'
import { useTTS } from '../../src/composables/useTTS'

beforeEach(() => {
  globalThis.SpeechSynthesisUtterance = vi.fn().mockImplementation(function (
    this: Record<string, any>,
    text: string,
  ) {
    this.text = text
    this.lang = ''
  }) as any
  window.speechSynthesis = {
    cancel: vi.fn(),
    speak: vi.fn(),
    getVoices: vi.fn().mockReturnValue([]),
    paused: false,
    pending: false,
    speaking: false,
    onvoiceschanged: null,
    resume: vi.fn(),
    pause: vi.fn(),
  } as unknown as SpeechSynthesis
})

describe('useTTS', () => {
  it('speak creates utterance with correct locale', () => {
    const { speak } = useTTS()
    speak('hello world', 'en')
    const utterance = vi.mocked(window.speechSynthesis.speak).mock.calls[0][0] as any
    expect(utterance.text).toBe('hello world')
    expect(utterance.lang).toBe('en-US')
  })

  it('cancel before speak prevents overlapping', () => {
    const { speak } = useTTS()
    speak('first', 'en')
    speak('second', 'en')
    expect(window.speechSynthesis.cancel).toHaveBeenCalledTimes(2)
    expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(2)
  })

  it('maps locale to correct voice code', () => {
    const { speak } = useTTS()
    speak('bonjour', 'fr')
    const u1 = vi.mocked(window.speechSynthesis.speak).mock.calls[0][0] as any
    expect(u1.lang).toBe('fr-FR')

    speak('guten tag', 'de')
    const u2 = vi.mocked(window.speechSynthesis.speak).mock.calls[1][0] as any
    expect(u2.lang).toBe('de-DE')

    speak('xin chào', 'vi')
    const u3 = vi.mocked(window.speechSynthesis.speak).mock.calls[2][0] as any
    expect(u3.lang).toBe('vi-VN')
  })

  it('falls back to en-US for unknown locale', () => {
    const { speak } = useTTS()
    speak('hello', 'zz' as any)
    const utterance = vi.mocked(window.speechSynthesis.speak).mock.calls[0][0] as any
    expect(utterance.lang).toBe('en-US')
  })

  it('handles missing speechSynthesis gracefully', () => {
    delete (window as any).speechSynthesis
    const { speak } = useTTS()
    expect(() => speak('hello', 'en')).not.toThrow()
  })
})
