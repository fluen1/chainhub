import type { Page, Locator } from '@playwright/test'

/**
 * Page Object Model: Kontrakter
 * Dansk sprog i selectors
 */
export class ContractsPage {
  readonly page: Page
  readonly heading: Locator
  readonly createContractButton: Locator
  readonly contractList: Locator
  readonly emptyState: Locator
  readonly successToast: Locator
  readonly errorToast: Locator

  // Opret kontrakt formular
  readonly displayNameInput: Locator
  readonly systemTypeSelect: Locator
  readonly sensitivitySelect: Locator
  readonly companySelect: Locator
  readonly submitButton: Locator
  readonly cancelButton: Locator

  constructor(page: Page) {
    this.page = page

    // Danske selectors
    this.heading = page.getByRole('heading', { name: /Kontrakter/i })
    this.createContractButton = page.getByRole('button', { name: /Opret kontrakt|Ny kontrakt/i })
    this.contractList = page.getByTestId('contract-list')
    this.emptyState = page.getByText(/Ingen kontrakter endnu|Opret den første/i)

    // Toast beskeder
    this.successToast = page.locator('[data-sonner-toast][data-type="success"]')
    this.errorToast = page.locator('[data-sonner-toast][data-type="error"]')

    // Formular felter
    this.displayNameInput = page.getByLabel(/Navn|Titel|Kontraktnavn/i)
    this.systemTypeSelect = page.getByLabel(/Type|Kontrakttype/i)
    this.sensitivitySelect = page.getByLabel(/Følsomhed|Sensitivitet/i)
    this.companySelect = page.getByLabel(/Selskab/i)
    this.submitButton = page.getByRole('button', { name: /Opret|Gem/i })
    this.cancelButton = page.getByRole('button', { name: /Annuller|Fortryd/i })
  }

  async goto() {
    await this.page.goto('/contracts')
    await this.page.waitForLoadState('networkidle')
  }

  async openCreateContractForm() {
    await this.createContractButton.click()
    await this.page.waitForSelector('[role="dialog"], form', { timeout: 5_000 })
  }

  async fillContractForm(data: {
    displayName: string
    systemType?: string
    sensitivity?: string
    companyId?: string
  }) {
    await this.displayNameInput.fill(data.displayName)

    if (data.systemType) {
      await this.systemTypeSelect.selectOption(data.systemType)
    }

    if (data.sensitivity) {
      await this.sensitivitySelect.selectOption(data.sensitivity)
    }

    if (data.companyId) {
      await this.companySelect.selectOption(data.companyId)
    }
  }

  async submitForm() {
    await this.submitButton.click()
  }

  async expectContractCreated(name: string) {
    await this.page.waitForSelector(`text=${name}`, { timeout: 10_000 })
  }

  async getContractByName(name: string): Promise<Locator> {
    return this.page.getByText(name)
  }

  async openContractOptions(contractId: string) {
    const contractRow = this.page.getByTestId(`contract-row-${contractId}`)
    const optionsButton = contractRow.getByRole('button', { name: /Handlinger|Mere|Options/i })
    await optionsButton.click()
  }
}