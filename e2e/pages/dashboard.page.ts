import type { Page, Locator } from '@playwright/test'

/**
 * Page Object Model: Dashboard
 * Dansk sprog i selectors
 */
export class DashboardPage {
  readonly page: Page
  readonly heading: Locator
  readonly companyList: Locator
  readonly navigationLinks: Locator
  readonly logoutButton: Locator
  readonly userMenuButton: Locator

  constructor(page: Page) {
    this.page = page
    // Danske selectors
    this.heading = page.getByRole('heading', {
      name: /Portfolio|Oversigt|Dashboard/i,
    })
    this.companyList = page.getByTestId('company-list')
    this.navigationLinks = page.getByRole('navigation')
    this.logoutButton = page.getByRole('button', { name: /Log ud|Logout/i })
    this.userMenuButton = page.getByRole('button', { name: /Profil|Bruger|konto/i })
  }

  async goto() {
    await this.page.goto('/')
    await this.page.waitForLoadState('networkidle')
  }

  async expectToBeOnDashboard() {
    await this.page.waitForURL(/^\/?$|\/dashboard/, { timeout: 10_000 })
  }

  async expectToBeRedirectedToLogin() {
    await this.page.waitForURL(/\/login/, { timeout: 10_000 })
  }

  isHeadingVisible() {
    return this.heading.isVisible()
  }
}