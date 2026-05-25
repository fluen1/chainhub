import { test, expect } from './fixtures'

test.describe('billing', () => {
  test('billing-side viser planer', async ({ loggedInPage: page }) => {
    await page.goto('/billing')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('body')).not.toBeEmpty()

    const planButton = page.locator('button, a', { hasText: /Starter|Vælg|Opgradér/ })
    const hasPlans = (await planButton.count()) > 0
    expect(hasPlans).toBe(true)
  })

  test('success-banner vises med ?success=1', async ({ loggedInPage: page }) => {
    await page.goto('/billing?success=1')
    await page.waitForLoadState('networkidle')

    const successBanner = page
      .locator('text=Betaling gennemført')
      .or(page.locator('text=abonnement'))
      .or(page.locator('[class*="green"]'))
    await expect(successBanner.first()).toBeVisible({ timeout: 5000 })
  })

  test('cancel-banner vises med ?canceled=1', async ({ loggedInPage: page }) => {
    await page.goto('/billing?canceled=1')
    await page.waitForLoadState('networkidle')

    const cancelBanner = page
      .locator('text=annulleret')
      .or(page.locator('text=Betalingen blev'))
      .or(page.locator('[class*="amber"]'))
    await expect(cancelBanner.first()).toBeVisible({ timeout: 5000 })
  })
})
