import { test, expect } from '@playwright/test'

test.describe('public-lag — tilgængeligt uden login', () => {
  test('forside loader på / uden redirect til login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('header har Log ind-knap når ikke logget ind', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'Log ind' }).first()).toBeVisible()
  })
})
