import { test, expect } from '@playwright/test'

test('rejects unavailable French/German fallback through the real local backend', async ({
  request,
}) => {
  const response = await request.post('/api/generate', {
    // A separate synthetic client keeps this case independent of the existing quota-exhaustion test.
    // The same native limiter still applies; no binding or response is mocked here.
    headers: { 'CF-Connecting-IP': '192.0.2.42' },
    data: { source: 'fr', target: 'de', topic: 'travel', level: 'A1', count: 3, mode: 'mix' },
  })
  expect(response.status()).toBe(503)
  expect(await response.json()).toMatchObject({ error: 'fallback_unavailable' })
  const capture = await request.get('http://127.0.0.1:8788')
  expect((await capture.json()).blockedEgress).toBe(0)
  test.info().annotations.push({
    type: 'HTTP',
    description:
      'POST /api/generate fr/de=503 fallback_unavailable; no wrong-language pairs or live AI',
  })
})
