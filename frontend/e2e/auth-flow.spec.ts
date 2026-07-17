import { test, expect } from '@playwright/test'

test.describe('Auth flow', () => {
  test('displays sign-in page and sends magic link', async ({ page }) => {
    await page.goto('/')

    await page.getByText('Sign in').click()
    await expect(page).toHaveURL('/login')

    await page.locator('#auth-email').fill('test@example.com')
    await page.getByText('Send magic link').click()

    await expect(page.getByText('Magic link sent!')).toBeVisible()
  })
})
