import type { Page, Locator } from '@playwright/test'

/**
 * Page Object Model: Login Side
 * Dansk sprog i selectors
 */
export class LoginPage {
  readonly page: Page
  readonly emailInput: Locator
  readonly passwordInput: Locator
  readonly loginButton: Locator
  readonly microsoftLoginButton: Locator
  readonly errorMessage: Locator
  readonly loginForm: Locator

  constructor(page: Page) {
    this.page = page
    // Danske selectors
    this.emailInput = page.getByLabel('E-mail')
    this.passwordInput = page.getByLabel('Adgangskode')
    this.loginButton = page.getByRole('button', { name: 'Log ind' })
    this.microsoftLoginButton = page.getByRole('button', {
      name: /Log ind med Microsoft|Sign in with Microsoft/i,
    })
    this.errorMessage = page.getByRole('alert')
    this.loginForm = page.getByRole('form', { name: /log ind/i })
  }

  async goto() {
    await this.page.goto('/login')
    await this.page.waitForLoadState('networkidle')
  }

  async loginWithCredentials(email: string, password: string) {
    await this.emailInput.fill(email)
    await this.passwordInput.fill(password)
    await this.loginButton.click()
  }

  async expectToBeOnLoginPage() {
    await this.page.waitForURL(/\/login/, { timeout: 5_000 })
  }

  async expectErrorMessage(message: string) {
    await this.errorMessage.waitFor({ state: 'visible', timeout: 5_000 })
    const text = await this.errorMessage.textContent()
    return text?.includes(message)
  }
}