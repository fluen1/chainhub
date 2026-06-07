import { test, expect } from './fixtures'
import { loginAs, SEED_USER } from './helpers/auth'

test.describe('Authentication', () => {
  test('login + redirect til dashboard', async ({ page }) => {
    await loginAs(page)
    // loginAs asserter allerede /dashboard-redirect; verificér at brugeren
    // er identificeret i sidebar-footeren (hilsen blev fjernet i design-runde 2026-06).
    // getByTitle: activity-feed kan vise "Philip Larsen åbnede…"-entries — kun
    // footer-elementet har title-attribut, så locatoren er entydig under realistisk data.
    await expect(page.getByTitle(SEED_USER.name)).toBeVisible()
  })

  test('forkert password viser fejl-besked', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('textbox', { name: 'E-mail' }).fill(SEED_USER.email)
    await page.getByRole('textbox', { name: 'Adgangskode' }).fill('forkert-password')
    await page.getByRole('button', { name: 'Log ind', exact: true }).click()
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
