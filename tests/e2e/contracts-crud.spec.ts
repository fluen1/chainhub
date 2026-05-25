import { test, expect } from './fixtures'

test.describe('Contracts CRUD', () => {
  test('opret ny kontrakt og verificér redirect til kontrakt-detalje', async ({
    loggedInPage: page,
  }) => {
    const displayName = `E2E Lejekontrakt ${Date.now()}`

    await page.goto('/contracts')

    // Opret-knap er en BButton med href (renderes som <a>)
    await page
      .getByRole('link', { name: /Opret kontrakt/i })
      .first()
      .click()
    await expect(page).toHaveURL(/\/contracts\/new/)

    // Vælg selskab — første option i listen (forudsætter seed-data)
    const companySelect = page.getByLabel('Tilknyttet selskab')
    await companySelect.selectOption({ index: 1 })

    // Vælg kontrakttype — Lejekontrakt (Erhverv) kræver min. INTERN sensitivity
    await page.getByLabel('Kontrakttype').selectOption({ label: 'Lejekontrakt — Erhverv' })

    // Sensitivity er auto-sat til INTERN — beholdes som default

    // Udfyld navn
    await page.getByLabel('Kontraktens navn', { exact: true }).fill(displayName)

    // Indsend
    await page.getByRole('button', { name: /Opret kontrakt/i }).click()

    // Toast "Kontrakt oprettet" vises
    await expect(page.getByText('Kontrakt oprettet')).toBeVisible({ timeout: 10_000 })

    // Redirect til kontrakt-detalje
    await expect(page).toHaveURL(/\/contracts\/[0-9a-f-]+/, { timeout: 10_000 })
  })

  test('kontrakt med udløbsdato og opsigelsesvarsel kan oprettes', async ({
    loggedInPage: page,
  }) => {
    const displayName = `E2E Leverandør ${Date.now()}`

    await page.goto('/contracts/new')

    // Vælg selskab
    const companySelect = page.getByLabel('Tilknyttet selskab')
    await companySelect.selectOption({ index: 1 })

    // Leverandørkontrakt kræver min. INTERN
    await page.getByLabel('Kontrakttype').selectOption({ label: 'Leverandørkontrakt' })
    await page.getByLabel('Kontraktens navn', { exact: true }).fill(displayName)

    // Sæt startdato og udløbsdato
    await page.getByLabel('Startdato', { exact: true }).fill('2025-01-01')
    await page.getByLabel('Udløbsdato', { exact: true }).fill('2026-12-31')
    await page.getByLabel('Opsigelsesvarsel (dage)', { exact: true }).fill('30')

    await page.getByRole('button', { name: /Opret kontrakt/i }).click()
    await expect(page.getByText('Kontrakt oprettet')).toBeVisible({ timeout: 10_000 })
    await expect(page).toHaveURL(/\/contracts\/[0-9a-f-]+/, { timeout: 10_000 })
  })
})
