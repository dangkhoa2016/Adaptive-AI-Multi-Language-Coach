import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateTtsAudio } from '../../src/services/tts'
import { transcribeAudio } from '../../src/services/stt'

const model = 'synthetic-speech-model'
const audio = new ArrayBuffer(1)
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})
const services = [
  {
    name: 'TTS',
    invoke: (ai: never) => generateTtsAudio('hello', 'en', ai, model),
    good: { audio },
    message: 'TTS generation failed',
  },
  {
    name: 'STT',
    invoke: (ai: never) => transcribeAudio(audio, ai, model),
    good: { text: ' hello ' },
    message: 'STT transcription failed',
  },
]

describe.each(services)('$name provider safety', ({ invoke, good, message }) => {
  it('fails after ten seconds, clears the deadline, and never retries', async () => {
    vi.useFakeTimers()
    const ai = { run: vi.fn(() => new Promise(() => {})) }
    const pending = expect(invoke(ai as never)).rejects.toThrow(message)
    await vi.advanceTimersByTimeAsync(10_000)
    await pending
    expect(ai.run).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })
  it('clears the deadline after success', async () => {
    vi.useFakeTimers()
    await invoke({ run: vi.fn().mockResolvedValue(good) } as never)
    expect(vi.getTimerCount()).toBe(0)
  })
  it('does not expose or log provider exception details', async () => {
    vi.useFakeTimers()
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(
      invoke({
        run: vi.fn().mockRejectedValue(new Error('synthetic-provider-private-detail')),
      } as never),
    ).rejects.toThrow(new RegExp(`^${message}$`))
    expect(log).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('TTS response bounds', () => {
  it.each([
    null,
    {},
    { audio: null },
    { audio: 'base64' },
    { audio: new Uint8Array(2) },
    { audio: new ArrayBuffer(0) },
    { audio: new ArrayBuffer(5 * 1024 * 1024 + 1) },
  ])('rejects malformed, empty, or oversized audio (%#)', async (response) => {
    await expect(
      generateTtsAudio('hi', 'en', { run: vi.fn().mockResolvedValue(response) } as never, model),
    ).rejects.toThrow('TTS generation failed')
  })
  it('accepts the maximum supported audio response and preserves bytes', async () => {
    const data = new Uint8Array(5 * 1024 * 1024)
    data[0] = 71
    const result = await generateTtsAudio(
      'hi',
      'en',
      { run: vi.fn().mockResolvedValue({ audio: data.buffer }) } as never,
      model,
    )
    const bytes = new Uint8Array(await new Response(result.body).arrayBuffer())
    expect(bytes.byteLength).toBe(5 * 1024 * 1024)
    expect(bytes[0]).toBe(71)
  })
})

describe('STT response bounds', () => {
  it.each([
    null,
    {},
    { text: null },
    { text: 1 },
    { text: '' },
    { text: '  \n ' },
    { text: 'a'.repeat(2001) },
    { text: ' '.repeat(2001) + 'x' },
  ])('rejects malformed, empty, or oversized transcription (%#)', async (response) => {
    await expect(
      transcribeAudio(audio, { run: vi.fn().mockResolvedValue(response) } as never, model),
    ).rejects.toThrow('STT transcription failed')
  })
  it('accepts two thousand characters and trims a valid response', async () => {
    const ai = { run: vi.fn().mockResolvedValue({ text: 'a'.repeat(2000) }) }
    expect(await transcribeAudio(audio, ai as never, model)).toHaveLength(2000)
    ai.run.mockResolvedValue({ text: '  hello  ' })
    expect(await transcribeAudio(audio, ai as never, model)).toBe('hello')
    expect(ai.run).toHaveBeenLastCalledWith(model, { audio: [0] })
  })
})
