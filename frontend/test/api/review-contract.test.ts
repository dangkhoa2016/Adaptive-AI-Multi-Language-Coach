import { afterEach, expect, it, vi } from 'vitest'
import { gradeCard } from '../../src/api/client'

afterEach(() => vi.unstubAllGlobals())

it('serializes the card version and caller-owned retry key in the grade request', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ pair: { id: 'card', review_version: 8 } })))
  vi.stubGlobal('fetch', fetchMock)
  const result = await gradeCard('card', 4, 7, 'stable-submission-key')
  const [url, options] = fetchMock.mock.calls[0]
  expect(url).toBe('/api/review/grade')
  expect(JSON.parse(options.body)).toEqual({
    learnedPairId: 'card',
    quality: 4,
    expectedVersion: 7,
    idempotencyKey: 'stable-submission-key',
  })
  expect(result.review_version).toBe(8)
})

it('propagates a real server conflict to the review session', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ error: 'review_conflict', message: 'Review changed. Reload the card.' }),
          { status: 409 },
        ),
      ),
  )
  await expect(gradeCard('card', 4, 7, 'stable-submission-key')).rejects.toMatchObject({
    status: 409,
  })
})
