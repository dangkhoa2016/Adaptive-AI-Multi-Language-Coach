import { test, expect } from '@playwright/test'

// Credentials stay in browser/driver memory; never enable trace, video, or screenshots here.
test.use({ trace: 'off', video: 'off', screenshot: 'off' })

test('synthetic user signs in, generates EN/VI vocabulary, saves and grades it', async ({
  page,
}) => {
  await page.setExtraHTTPHeaders({ 'CF-Connecting-IP': '192.0.2.91' })
  await page.goto('/login')
  await page.locator('#auth-email').fill('synthetic@example.invalid')
  const requested = page.waitForResponse((response) => response.url().endsWith('/api/auth/request'))
  await page.getByRole('button', { name: 'Send magic link', exact: true }).click()
  expect((await requested).status()).toBe(200)
  await expect(page.getByText('Magic link sent!')).toBeVisible()

  expect((await page.request.get('http://127.0.0.1:8788/magic-link')).status()).toBe(403)
  const foreignRead = await page.request.post('http://127.0.0.1:8788/magic-link', {
    headers: { Origin: 'https://evil.invalid' },
  })
  expect(foreignRead.status()).toBe(403)
  const metadata = await (await page.request.get('http://127.0.0.1:8788')).json()
  expect(metadata.capturedMail).toBeGreaterThan(0)
  expect(metadata.blockedEgress).toBe(0)
  const capture = await page.request.post('http://127.0.0.1:8788/magic-link')
  expect(capture.status()).toBe(200)
  const { url } = (await capture.json()) as { url: string }
  expect(typeof url).toBe('string')
  // A second read cannot disclose the credential again.
  expect((await page.request.post('http://127.0.0.1:8788/magic-link')).status()).toBe(404)
  const verified = page.waitForResponse((response) => response.url().endsWith('/api/auth/verify'))
  // Visit the real Vue callback without putting the secret URL into a navigation call log.
  await page.evaluate((link) => {
    window.history.pushState({}, '', link)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, url)
  const verification = await verified
  expect(verification.status()).toBe(200)
  expect(typeof verification.request().postDataJSON()).toBe('object')
  await expect(page).toHaveURL('/')
  expect((await page.request.get('/api/auth/me')).status()).toBe(200)

  await page.selectOption('#source', 'en')
  await page.selectOption('#target', 'vi')
  const generated = page.waitForResponse((response) => response.url().endsWith('/api/generate'))
  await page.getByRole('button', { name: 'Start learning', exact: true }).click()
  const generation = await generated
  expect(generation.status()).toBe(200)
  const generatedBody = await generation.json()
  expect(generatedBody.isFallback).toBe(true)
  expect(generatedBody.pairs[0]).toMatchObject({ source: 'airport', target: 'sân bay' })
  await expect(page.getByRole('heading', { name: 'Flashcards', exact: true })).toBeVisible()
  const saved = page.waitForResponse((response) => response.url().endsWith('/api/vocab/save'))
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  const savedResponse = await saved
  expect(savedResponse.status()).toBe(200)
  expect((await savedResponse.json()).pair).toMatchObject({
    source: 'en',
    target: 'vi',
    source_text: 'airport',
    target_text: 'sân bay',
  })
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible()

  await page.goto('/review')
  await page.getByRole('button', { name: 'Start Review', exact: true }).click()
  await page.getByRole('button', { name: 'airport', exact: true }).click()
  const graded = page.waitForResponse((response) => response.url().endsWith('/api/review/grade'))
  await page.getByRole('button', { name: 'Good', exact: true }).click()
  const grade = await graded
  expect(grade.status()).toBe(200)
  const gradedPair = (await grade.json()).pair
  expect(gradedPair.review_version).toBe(1)
  expect(gradedPair.repetitions).toBe(1)
  await expect(page.getByRole('heading', { name: 'Review Complete!', exact: true })).toBeVisible()
  const history = await page.request.get('/api/review/history')
  expect(history.status()).toBe(200)
  expect((await history.json()).total).toBe(1)
  expect((await (await page.request.get('http://127.0.0.1:8788')).json()).blockedEgress).toBe(0)
  test.info().annotations.push({
    type: 'HTTP',
    description:
      'Real Vue login/request/verify=200; EN/VI generate/save/grade=200; history=1; no live provider egress',
  })
})
