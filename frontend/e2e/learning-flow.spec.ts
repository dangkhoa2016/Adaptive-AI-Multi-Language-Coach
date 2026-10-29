import { test, expect } from '@playwright/test'

test.describe('Learning flow', () => {
  test('selects languages and navigates to flashcard view', async ({ page }) => {
    await page.goto('/')
    await page.selectOption('#source', 'en')
    await page.selectOption('#target', 'vi')
    const generated = page.waitForResponse((r) => r.url().endsWith('/api/generate'))
    await page.getByText('Start learning').click()
    const response = await generated
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.isFallback).toBe(true)
    expect(body.pairs[0]).toMatchObject({ source: 'airport', target: 'sân bay' })
    await expect(page.getByText('Flashcards')).toBeVisible()
    await expect(page.getByText('airport', { exact: true }).first()).toBeVisible()
    test.info().annotations.push({
      type: 'HTTP',
      description: 'POST /api/generate=200; explicit en/vi D1 fixture; no live AI',
    })

    const statuses: number[] = []
    for (let n = 0; n < 10; n++) {
      statuses.push((await page.request.post('/api/generate', { data: {} })).status())
    }
    expect(statuses).toEqual([400, 400, 400, 400, 400, 400, 400, 400, 400, 429])
    expect((await page.request.get('/api/locales')).status()).toBe(200)
    expect((await page.request.get('/api/review/stats')).status()).toBe(401)
    const capture = await page.request.get('http://127.0.0.1:8788')
    expect((await capture.json()).blockedEgress).toBe(0)
    test.info().annotations.push({
      type: 'HTTP',
      description: 'AI quota 10/60s enforced=429; locales=200; review/stats=401',
    })
  })
})
