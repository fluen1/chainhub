import { test, expect } from '@playwright/test'
import { ContractsPage } from './pages/contracts.page'
import { ContractDetailPage } from './pages/contract-detail.page'
import { DashboardPage } from './pages/dashboard.page'
import { TEST_USERS, loginViaUI } from './helpers/auth.helper'

/**
 * E2E: Opret og arkivér kontrakt flow
 *
 * Disse tests kræver et kørende test-miljø med testdata.
 * De er markeret med skip medmindre E2E_RUN_CONTRACT_TESTS er sat.
 */

test.describe('Kontrakt flow — Opret og arkivér', () => {
  // Test-organisation og selskab (brug separate test-data)
  const TEST_COMPANY_ID = process.env.E2E_TEST_COMPANY_ID ?? 'test-company-e2e-001'
  const TEST_CONTRACT_NAME = `E2E Test Kontrakt ${Date.now()}`

  test.beforeEach(async ({ page }) => {
    test.skip(
      !process.env.E2E_RUN_CONTRACT_TESTS,
      'Kræver E2E_RUN_CONTRACT_TESTS=true og test-miljø'
    )

    // Login som GROUP_OWNER
    await loginViaUI(
      page,
      TEST_USERS.groupOwner.email,
      TEST_USERS.groupOwner.password
    )
  })

  test('opret kontrakt — happy path', async ({ page }) => {
    const contractsPage = new ContractsPage(page)
    await contractsPage.goto()

    // Åbn opret-formular
    await contractsPage.openCreateContractForm()

    // Udfyld dansk formular
    await contractsPage.fillContractForm({
      displayName: TEST_CONTRACT_NAME,
      systemType: 'EJERAFTALE',
      sensitivity: 'STANDARD',
      companyId: TEST_COMPANY_ID,
    })

    // Indsend
    await contractsPage.submitForm()

    // Verificer at kontrakt er oprettet
    await contractsPage.expectContractCreated(TEST_CONTRACT_NAME)
  })

  test('ny kontrakt oprettes med status UDKAST', async ({ page }) => {
    const contractsPage = new ContractsPage(page)
    await contractsPage.goto()

    await contractsPage.openCreateContractForm()
    await contractsPage.fillContractForm({
      displayName: TEST_CONTRACT_NAME,
      systemType: 'LEVERANDOERKONTRAKT',
      sensitivity: 'STANDARD',
      companyId: TEST_COMPANY_ID,
    })
    await contractsPage.submitForm()

    // Find den nye kontrakt og verificer UDKAST status
    const contractLink = await contractsPage.getContractByName(TEST_CONTRACT_NAME)
    await contractLink.click()

    const detailPage = new ContractDetailPage(page)
    const isUdkast = await detailPage.expectStatus('UDKAST')
    expect(isUdkast).toBe(true)
  })

  test('arkivér kontrakt', async ({ page }) => {
    // Navigér til en eksisterende kontrakt
    const detailPage = new ContractDetailPage(page)

    // Forudsæt at TEST_CONTRACT_ID er sat i miljøvariable
    const contractId = process.env.E2E_TEST_CONTRACT_ID
    if (!contractId) {
      test.skip(true, 'Kræver E2E_TEST_CONTRACT_ID miljøvariabel')
      return
    }

    await detailPage.goto(contractId)

    // Arkivér kontrakten
    await detailPage.archiveContract()

    // Verificer at vi er sendt tilbage til kontraktlisten eller kontrakt er arkiveret
    await page.waitForURL(/\/contracts/, { timeout: 10_000 })
    await expect(page).toHaveURL(/\/contracts/)
  })

  test('komplet flow: opret → skift status → arkivér', async ({ page }) => {
    const contractsPage = new ContractsPage(page)
    const detailPage = new ContractDetailPage(page)

    // 1. Opret kontrakt
    await contractsPage.goto()
    await contractsPage.openCreateContractForm()
    await contractsPage.fillContractForm({
      displayName: `E2E Flow Test ${Date.now()}`,
      systemType: 'NDA',
      sensitivity: 'INTERN',
      companyId: TEST_COMPANY_ID,
    })
    await contractsPage.submitForm()

    // 2. Gå til detalje-siden via URL
    await page.waitForURL(/\/contracts\/[\w-]+/)
    const contractUrl = page.url()
    const contractId = contractUrl.split('/contracts/')[1]

    // 3. Skift status UDKAST → TIL_REVIEW
    await detailPage.changeStatus('TIL_REVIEW')
    const isTilReview = await detailPage.expectStatus('TIL_REVIEW')
    expect(isTilReview).toBe(true)

    // 4. Arkivér (soft delete)
    await detailPage.archiveContract()

    // 5. Verificer redirect
    await expect(page).toHaveURL(/\/contracts/)
  })
})

test.describe('Kontrakt access control — E2E', () => {
  test('uautoriseret bruger kan ikke se kontrakter', async ({ page }) => {
    // Tilgå kontrakter uden session
    await page.goto('/contracts')

    // Skal redirectes til login
    await expect(page).toHaveURL(/\/login/)
  })

  test('COMPANY_MANAGER kan ikke tilgå STRENGT_FORTROLIG kontrakt (UI)', async ({ page }) => {
    test.skip(
      !process.env.E2E_RUN_CONTRACT_TESTS,
      'Kræver E2E_RUN_CONTRACT_TESTS=true'
    )

    const strictContractId = process.env.E2E_STRICT_CONTRACT_ID
    if (!strictContractId) {
      test.skip(true, 'Kræver E2E_STRICT_CONTRACT_ID')
      return
    }

    // Login som COMPANY_MANAGER
    await loginViaUI(
      page,
      TEST_USERS.companyManager.email,
      TEST_USERS.companyManager.password
    )

    // Forsøg at tilgå STRENGT_FORTROLIG kontrakt
    await page.goto(`/contracts/${strictContractId}`)

    // Forventer adgang nægtet besked eller redirect
    const errorMessage = page.getByText(
      /Du har ikke adgang|Adgang nægtet|ikke tilladelse/i
    )
    await expect(errorMessage).toBeVisible({ timeout: 5_000 })
  })
})