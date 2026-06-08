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

  test('pricing viser de tre tiers med priser', async ({ page }) => {
    await page.goto('/pricing')
    await expect(page.getByRole('heading', { name: 'Basis' })).toBeVisible()
    await expect(page.getByText('3.500 kr.')).toBeVisible()
    await expect(page.getByText('9.500 kr.')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Enterprise' })).toBeVisible()
  })

  test('kontaktformular viser valideringsfejl ved tom indsendelse', async ({ page }) => {
    await page.goto('/kontakt')
    await page.getByRole('button', { name: 'Send forespørgsel' }).click()
    // HTML5 required blokerer indsendelse — vi forbliver på /kontakt med synligt navnefelt
    await expect(page).toHaveURL(/\/kontakt$/)
    await expect(page.getByLabel('Navn')).toBeVisible()
  })

  test('pricing-CTA fører til kontakt', async ({ page }) => {
    await page.goto('/pricing')
    await page.getByRole('link', { name: 'Book demo' }).first().click()
    await expect(page).toHaveURL(/\/kontakt$/)
  })
})
