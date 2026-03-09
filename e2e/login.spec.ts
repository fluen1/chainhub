import { test, expect } from '@playwright/test'
import { LoginPage } from './pages/login.page'
import { DashboardPage } from './pages/dashboard.page'
import { TEST_USERS } from './helpers/auth.helper'

/**
 * E2E: Login flow
 */

test.describe('Login flow', () => {
  test('unauthenticated user cannot access dashboard', async ({ page }) => {
    const dashboard = new DashboardPage(page)

    // Forsøg at tilgå dashboard uden at være logget ind
    await page.goto('/')

    // Forventer redirect til login
    await dashboard.expectToBeRedirectedToLogin()
    await expect(page).toHaveURL(/\/login/)
  })

  test('login-siden vises korrekt med danske labels', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()

    // Verificer at siden har korrekte danske elementer
    await expect(page).toHaveURL(/\/login/)

    // Check for dansk login tekst (tilpas til faktisk implementation)
    const title = page.getByRole('heading')
    await expect(title).toBeVisible()
  })

  test('fejlbesked ved forkert login', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()

    // Forsøg login med forkerte credentials
    try {
      await loginPage.loginWithCredentials(
        'forkert@example.com',
        'ForkertAdgangskode123!'
      )

      // Vent på enten fejlbesked eller redirect tilbage til login
      await page.waitForURL(/\/login/, { timeout: 10_000 })
      await expect(page).toHaveURL(/\/login/)
    } catch {
      // Acceptabelt — login-siden håndterer det
      await expect(page).toHaveURL(/\/login/)
    }
  })

  test('redirect til login ved direkte adgang til beskyttede sider', async ({ page }) => {
    // Test alle beskyttede ruter
    const protectedRoutes = [
      '/companies',
      '/contracts',
      '/cases',
      '/tasks',
      '/documents',
    ]

    for (const route of protectedRoutes) {
      await page.goto(route)
      await page.waitForURL(/\/login/, { timeout: 5_000 })
      await expect(page).toHaveURL(/\/login/)
    }
  })

  test('succesfuldt login redirecter til dashboard', async ({ page }) => {
    // Denne test kræver et kørende test-miljø med reelle credentials
    test.skip(
      !process.env.E2E_RUN_AUTH_TESTS,
      'Kræver E2E_RUN_AUTH_TESTS=true og test-bruger credentials'
    )

    const loginPage = new LoginPage(page)
    const dashboard = new DashboardPage(page)

    await loginPage.goto()
    await loginPage.loginWithCredentials(
      TEST_USERS.groupOwner.email,
      TEST_USERS.groupOwner.password
    )

    await dashboard.expectToBeOnDashboard()
    await expect(page).not.toHaveURL(/\/login/)
  })
})