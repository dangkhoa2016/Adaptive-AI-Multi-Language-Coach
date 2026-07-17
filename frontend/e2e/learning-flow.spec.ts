import { test, expect } from '@playwright/test'

test.describe('Learning flow', () => {
  test('selects languages and navigates to flashcard view', async ({ page }) => {
    await page.goto('/')

    await page.selectOption('#source', 'fr')
    await page.selectOption('#target', 'de')

    await page.getByText('Start learning').click()

    await expect(page.getByText('Flashcards')).toBeVisible()
  })
})
