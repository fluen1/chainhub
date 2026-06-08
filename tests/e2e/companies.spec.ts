import { test, expect } from './fixtures'

test.describe('Companies CRUD', () => {
  test('opret nyt selskab og se det i listen', async ({ loggedInPage: page }) => {
    const cvr = String(Math.floor(10000000 + Math.random() * 89999999))
    const name = `E2E Test ApS ${Date.now()}`

    await page.goto('/companies')
    // Knap-tekst er "+ Opret selskab" (ikke "Nyt selskab") — rendres som <a>-link via BButton href
    await page.getByRole('link', { name: /Opret selskab/i }).click()
    await expect(page).toHaveURL(/\/companies\/new/)

    // CreateCompanyForm: label "Selskabsnavn*" (required) og "CVR-nummer" (BTextField)
    await page.getByLabel(/Selskabsnavn/i).fill(name)
    await page.getByLabel(/CVR-nummer/i).fill(cvr)
    await page.getByLabel(/By/i).fill('København K')
    await page.getByRole('button', { name: /Opret selskab/i }).click()

    // Efter oprettelse redirectes til /companies/[id] — vent på success-toast
    await expect(page.getByText('Selskab oprettet')).toBeVisible({ timeout: 10_000 })
    await expect(page).toHaveURL(/\/companies\//, { timeout: 10_000 })
    // Vent til detaljesiden er loadet (Breadcrumb viser "Selskaber › Nyt selskab" → "[navn]")
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name })).toBeVisible({ timeout: 10_000 })
  })

  test('selskabs-detalje viser alle hovedsektioner', async ({ loggedInPage: page }) => {
    // Brug seed-selskab Optik Østerbro ApS
    await page.goto('/companies')
    // Strict-mode fix: 2 elementer med "Optik Østerbro ApS" — klik tabel-rækken (første)
    await page.getByText('Optik Østerbro ApS').first().click()
    // PanelHeader bruger <span> ikke <heading> — matcher via tekst
    await expect(page.getByText('Ejerskab', { exact: true })).toBeVisible()
    await expect(page.getByText('Kontrakter', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Sager', { exact: true }).first()).toBeVisible()
  })
})
