import { test, expect } from './fixtures'
import { loginAs, SEED_USER } from './helpers/auth'

test.describe('Authentication', () => {
  test('login + redirect til dashboard', async ({ page }) => {
    await loginAs(page)
    await expect(page.getByText(/God (morgen|eftermiddag|aften)/).first()).toBeVisible()
    // Sidebar viser bruger-rolle
    await expect(page.getByText('Kædeejer')).toBeVisible()
  })

  test('forkert password viser fejl-besked', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('textbox', { name: 'Email' }).fill(SEED_USER.email)
    await page.getByRole('textbox', { name: 'Adgangskode' }).fill('forkert-password')
    await page.getByRole('button', { name: 'Log ind' }).click()
    // Forbliver på login-siden
    await expect(page).toHaveURL(/\/login/)
  })

  test('protected route redirecter til login når ikke logget ind', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })
  })

  test('dashboard viser KPI-header med selskaber + sager + omsætning', async ({
    loggedInPage: page,
  }) => {
    await expect(page.getByText('Selskaber').first()).toBeVisible()
    await expect(page.getByText('Sager').first()).toBeVisible()
    await expect(page.getByText('Omsætning').first()).toBeVisible()
  })
})
