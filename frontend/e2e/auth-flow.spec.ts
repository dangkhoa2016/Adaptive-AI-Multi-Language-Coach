import { test, expect } from '@playwright/test'

test.describe('Auth flow', () => {
  test('displays sign-in page and sends magic link', async ({ page }) => {
    await page.goto('/')
    await page.getByText('Sign in').click()
    await expect(page).toHaveURL('/login')
    await page.locator('#auth-email').fill('synthetic@example.invalid')
    const sent = page.waitForResponse((r) => r.url().endsWith('/api/auth/request'))
    await page.getByText('Send magic link').click()
    const response = await sent
    expect(response.status()).toBe(200)
    expect(response.request().postDataJSON()).toEqual({ email: 'synthetic@example.invalid' })
    await expect(page.getByText('Magic link sent!')).toBeVisible()
    const capture = await page.request.get('http://127.0.0.1:8788')
    expect(await capture.json()).toEqual({ capturedMail: 1, blockedEgress: 0 })
    test.info().annotations.push({
      type: 'HTTP',
      description: 'POST /api/auth/request=200; mail captured locally',
    })

    // Same native auth quota, no security bypass. Invalid tokens contain no real credential.
    const statuses: number[] = []
    for (let n = 0; n < 3; n++) {
      const result = await page.request.post('/api/auth/verify', {
        data: { token: 'synthetic-invalid-token' },
      })
      statuses.push(result.status())
    }
    expect(statuses).toEqual([401, 401, 429])
    expect((await page.request.get('/api/auth/me')).status()).toBe(401)
    test.info().annotations.push({
      type: 'HTTP',
      description: 'verify=401,401,429; GET me=401 (quota isolated)',
    })
  })
})
