import { test, expect } from './fixtures'

test.describe('Persons CRUD', () => {
  test('opret ny person og verificér redirect til person-detalje', async ({
    loggedInPage: page,
  }) => {
    const ts = Date.now()
    const firstName = 'E2E'
    const lastName = `Person ${ts}`
    const email = `e2e.${ts}@eksempel.dk`

    await page.goto('/persons')

    // Opret-knap er en BButton med href (renderes som <a>)
    await page.getByRole('link', { name: /Tilføj person/i }).click()
    await expect(page).toHaveURL(/\/persons\/new/)

    // Udfyld obligatoriske felter
    await page.getByLabel('Fornavn', { exact: true }).fill(firstName)
    await page.getByLabel('Efternavn', { exact: true }).fill(lastName)

    // Valgfri felter
    await page.getByLabel('Email', { exact: true }).fill(email)
    await page.getByLabel('Telefon', { exact: true }).fill('+45 12 34 56 78')

    // Indsend
    await page.getByRole('button', { name: /Opret person/i }).click()

    // Toast "Person oprettet" vises
    await expect(page.getByText('Person oprettet')).toBeVisible({ timeout: 10_000 })

    // Redirect til person-detalje
    await expect(page).toHaveURL(/\/persons\/[0-9a-f-]+/, { timeout: 10_000 })
  })

  test('person uden email kan oprettes', async ({ loggedInPage: page }) => {
    const ts = Date.now()

    await page.goto('/persons/new')

    await page.getByLabel('Fornavn', { exact: true }).fill('Anonym')
    await page.getByLabel('Efternavn', { exact: true }).fill(`Testperson ${ts}`)

    // Email og telefon udelades
    await page.getByRole('button', { name: /Opret person/i }).click()

    await expect(page.getByText('Person oprettet')).toBeVisible({ timeout: 10_000 })
    await expect(page).toHaveURL(/\/persons\/[0-9a-f-]+/, { timeout: 10_000 })
  })

  test('validation: submit uden fornavn viser fejlbesked', async ({ loggedInPage: page }) => {
    await page.goto('/persons/new')

    // Udfyld kun efternavn
    await page.getByLabel('Efternavn', { exact: true }).fill('Onlylastnavn')

    await page.getByRole('button', { name: /Opret person/i }).click()

    // Fejlbesked "Fornavn er påkrævet" vises
    await expect(page.getByText('Fornavn er påkrævet')).toBeVisible()

    // Vi er stadig på /persons/new
    await expect(page).toHaveURL(/\/persons\/new/)
  })
})
