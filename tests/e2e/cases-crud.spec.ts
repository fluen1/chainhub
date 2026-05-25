import { test, expect } from './fixtures'

test.describe('Cases CRUD', () => {
  test('opret ny sag og verificér redirect til sag-detalje', async ({ loggedInPage: page }) => {
    const title = `E2E Sag ${Date.now()}`

    await page.goto('/cases')

    // Opret-knap er en BButton med href (renderes som <a>)
    await page.getByRole('link', { name: /Opret sag/i }).click()
    await expect(page).toHaveURL(/\/cases\/new/)

    // Udfyld titel
    await page.getByLabel('Titel', { exact: true }).fill(title)

    // Vælg sagstype — "Andet" kræver ingen undertype
    await page.getByLabel('Sagstype').selectOption({ label: 'Andet' })

    // Vælg mindst ét selskab fra checkbox-listen
    // Klik første checkbox i "Tilknyttede selskaber"-gruppen
    const companyCheckbox = page
      .getByRole('group', { name: /Tilknyttede selskaber/i })
      .locator('input[type="checkbox"]')
      .first()
    await companyCheckbox.check()

    // Indsend
    await page.getByRole('button', { name: /Opret sag/i }).click()

    // Toast "Sag oprettet" vises
    await expect(page.getByText('Sag oprettet')).toBeVisible({ timeout: 10_000 })

    // Efter oprettelse redirectes til /cases/[id]
    await expect(page).toHaveURL(/\/cases\/[0-9a-f-]+/, { timeout: 10_000 })
  })

  test('sag med undertype GDPR kan oprettes', async ({ loggedInPage: page }) => {
    const title = `E2E GDPR ${Date.now()}`

    await page.goto('/cases/new')

    await page.getByLabel('Titel', { exact: true }).fill(title)

    // Vælg type Compliance, undertype GDPR
    await page.getByLabel('Sagstype').selectOption({ label: 'Compliance' })
    await page.getByLabel('Undertype').selectOption({ label: 'GDPR' })

    // Vælg selskab
    const companyCheckbox = page
      .getByRole('group', { name: /Tilknyttede selskaber/i })
      .locator('input[type="checkbox"]')
      .first()
    await companyCheckbox.check()

    await page.getByRole('button', { name: /Opret sag/i }).click()
    await expect(page.getByText('Sag oprettet')).toBeVisible({ timeout: 10_000 })
    await expect(page).toHaveURL(/\/cases\/[0-9a-f-]+/, { timeout: 10_000 })
  })
})
