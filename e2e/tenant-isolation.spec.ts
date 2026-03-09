import { test, expect } from '@playwright/test'
import { loginViaUI } from './helpers/auth.helper'

/**
 * E2E: Tenant isolation tests
 * Verificerer at brugere ikke kan tilgå andre organisationers data via URL-manipulation
 */

test.describe('Tenant isolation — E2E', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !process.env.E2E_RUN_TENANT_TESTS,
      'Kræver E2E_RUN_TENANT_TESTS=true og multi-tenant testmiljø'
    )
  })

  test('tenant A cannot access tenant B companies via URL', async ({ page }) => {
    // Login som tenant A bruger
    await loginViaUI(
      page,
      process.env.E2E_TENANT_A_EMAIL ?? 'tenant-a@test.dk',
      process.env.E2E_TENANT_A_PASSWORD ?? 'TestPassword123!'
    )

    // Forsøg at tilgå tenant B's selskab via direkte URL
    const tenantBCompanyId = process.env.E2E_TENANT_B_COMPANY_ID ?? 'tenant-b-company-id'
    await page.goto(`/companies/${tenantBCompanyId}`)

    // Forventer 404, fejlbesked eller redirect
    const notFoundOrDenied = page.getByText(
      /ikke fundet|Adgang nægtet|Du har ikke adgang|404/i
    )
    await expect(notFoundOrDenied).toBeVisible({ timeout: 5_000 })
  })

  test('tenant A cannot access tenant B contracts via URL', async ({ page }) => {
    await loginViaUI(
      page,
      process.env.E2E_TENANT_A_EMAIL ?? 'tenant-a@test.dk',
      process.env.E2E_TENANT_A_PASSWORD ?? 'TestPassword123!'
    )

    const tenantBContractId = process.env.E2E_TENANT_B_CONTRACT_ID ?? 'tenant-b-contract-id'
    await page.goto(`/contracts/${tenantBContractId}`)

    const notFoundOrDenied = page.getByText(
      /ikke fundet|Adgang nægtet|Du har ikke adgang|404/i
    )
    await expect(notFoundOrDenied).toBeVisible({ timeout: 5_000 })
  })
})