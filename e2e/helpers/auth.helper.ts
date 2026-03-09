import type { Page } from '@playwright/test'

/**
 * Auth helper til E2E tests
 * Simulerer login via cookie/session til tests
 */

export const TEST_USERS = {
  groupOwner: {
    email: process.env.E2E_GROUP_OWNER_EMAIL ?? 'owner@test-chainhub.dk',
    password: process.env.E2E_GROUP_OWNER_PASSWORD ?? 'TestPassword123!',
    name: 'Test Group Owner',
    role: 'GROUP_OWNER',
  },
  groupLegal: {
    email: process.env.E2E_GROUP_LEGAL_EMAIL ?? 'legal@test-chainhub.dk',
    password: process.env.E2E_GROUP_LEGAL_PASSWORD ?? 'TestPassword123!',
    name: 'Test Group Legal',
    role: 'GROUP_LEGAL',
  },
  companyManager: {
    email: process.env.E2E_COMPANY_MANAGER_EMAIL ?? 'manager@test-chainhub.dk',
    password: process.env.E2E_COMPANY_MANAGER_PASSWORD ?? 'TestPassword123!',
    name: 'Test Company Manager',
    role: 'COMPANY_MANAGER',
  },
} as const

/**
 * Logger ind via UI med credentials
 */
export async function loginViaUI(
  page: Page,
  email: string,
  password: string
) {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')

  // Danske selectors
  const emailInput = page.getByLabel('E-mail')
  const passwordInput = page.getByLabel('Adgangskode')
  const submitButton = page.getByRole('button', { name: 'Log ind' })

  await emailInput.fill(email)
  await passwordInput.fill(password)
  await submitButton.click()

  // Vent på redirect til dashboard
  await page.waitForURL(/^\/?$|\/dashboard/, { timeout: 15_000 })
}

/**
 * Logger ud
 */
export async function logout(page: Page) {
  const userMenu = page.getByRole('button', { name: /Profil|Bruger/i })
  await userMenu.click()
  const logoutButton = page.getByRole('menuitem', { name: /Log ud/i })
  await logoutButton.click()
  await page.waitForURL(/\/login/, { timeout: 5_000 })
}

/**
 * Sætter mock-session cookie for hurtigere tests (når app understøtter det)
 */
export async function setMockSession(
  page: Page,
  sessionData: {
    userId: string
    organizationId: string
    role: string
  }
) {
  await page.context().addCookies([
    {
      name: 'next-auth.session-token',
      value: Buffer.from(JSON.stringify(sessionData)).toString('base64'),
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
    },
  ])
}