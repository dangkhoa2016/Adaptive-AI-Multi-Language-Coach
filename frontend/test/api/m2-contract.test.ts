import { afterEach, expect, it, vi } from 'vitest'
import { createQuiz, generateVocab } from '../../src/api/client'

const req = {
  source: 'en',
  target: 'vi',
  topic: 'travel',
  level: 'A1',
  count: 2,
  uiLocale: 'en',
  mode: 'mix',
} as const
const pair = {
  source: 'hello',
  target: 'chào',
  exampleSource: '',
  exampleTarget: '',
  ipa: '',
  pos: '',
  isPhrase: false,
}
afterEach(() => vi.unstubAllGlobals())

it.each([
  { pairs: [pair], isFallback: true, cacheHit: false },
  {
    pairs: [pair],
    isFallback: true,
    cacheHit: false,
    requestedCount: 2,
    returnedCount: 1,
    partial: true,
  },
])(
  'preserves old/new generate response and sends locale codes separately from text',
  async (body) => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(body))
    vi.stubGlobal('fetch', fetchMock)
    expect(await generateVocab(req)).toEqual(body)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/generate')
    expect(JSON.parse(options.body)).toEqual(req)
  },
)

it('propagates unavailable quiz as an error for the existing QuizView catch path', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(Response.json({ error: 'quiz_unavailable' }, { status: 422 })),
  )
  await expect(createQuiz([pair])).rejects.toMatchObject({ status: 422 })
})

it('keeps the existing quiz success shape', async () => {
  const body = {
    questions: [{ pair, options: ['chào', 'cảm ơn', 'xin lỗi', 'tạm biệt'], correctIndex: 0 }],
  }
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(body)))
  expect(await createQuiz([pair])).toEqual(body)
})
