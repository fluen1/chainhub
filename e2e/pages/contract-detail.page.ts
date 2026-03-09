import type { Page, Locator } from '@playwright/test'

/**
 * Page Object Model: Kontrakt detalje-side
 * Dansk sprog i selectors
 */
export class ContractDetailPage {
  readonly page: Page
  readonly contractTitle: Locator
  readonly statusBadge: Locator
  readonly sensitivityBadge: Locator

  // Status-handlinger
  readonly changeStatusButton: Locator
  readonly statusSelect: Locator
  readonly confirmStatusButton: Locator

  // Arkivér
  readonly archiveButton: Locator
  readonly confirmArchiveButton: Locator
  readonly archiveConfirmDialog: Locator

  // Toast
  readonly successToast: Locator
  readonly errorToast: Locator

  constructor(page: Page) {
    this.page = page

    // Danske selectors
    this.contractTitle = page.getByRole('heading', { level: 1 })
    this.statusBadge = page.getByTestId('contract-status-badge')
    this.sensitivityBadge = page.getByTestId('contract-sensitivity-badge')

    this.changeStatusButton = page.getByRole('button', { name: /Skift status|Opdater status/i })
    this.statusSelect = page.getByLabel(/Ny status/i)
    this.confirmStatusButton = page.getByRole('button', { name: /Bekræft|Opdater/i })

    this.archiveButton = page.getByRole('button', { name: /Arkivér|Slet/i })
    this.archiveConfirmDialog = page.getByRole('dialog', {
      name: /Arkivér kontrakt|Er du sikker/i,
    })
    this.confirmArchiveButton = page.getByRole('button', { name: /Bekræft arkivering|Ja, arkivér/i })

    this.successToast = page.locator('[data-sonner-toast][data-type="success"]')
    this.errorToast = page.locator('[data-sonner-toast][data-type="error"]')
  }

  async goto(contractId: string) {
    await this.page.goto(`/contracts/${contractId}`)
    await this.page.waitForLoadState('networkidle')
  }

  async archiveContract() {
    await this.archiveButton.click()
    await this.archiveConfirmDialog.waitFor({ state: 'visible', timeout: 5_000 })
    await this.confirmArchiveButton.click()
  }

  async changeStatus(newStatus: string) {
    await this.changeStatusButton.click()
    await this.statusSelect.selectOption(newStatus)
    await this.confirmStatusButton.click()
  }

  async expectStatus(status: string) {
    await this.statusBadge.waitFor({ state: 'visible' })
    const text = await this.statusBadge.textContent()
    return text?.toLowerCase().includes(status.toLowerCase())
  }
}