import { test, expect } from './fixtures'

test.describe('Tasks CRUD', () => {
  test('opret ny opgave og verificér toast + redirect til /tasks', async ({
    loggedInPage: page,
  }) => {
    const title = `E2E Opgave ${Date.now()}`

    await page.goto('/tasks')

    // Opret-knap er en BButton med href (renderes som <a>)
    await page.getByRole('link', { name: /Opret opgave/i }).click()
    await expect(page).toHaveURL(/\/tasks\/new/)

    // Udfyld titel — BTextField bruger <label htmlFor>, så getByLabel virker
    await page.getByLabel('Titel', { exact: true }).fill(title)

    // Indsend — submit-knappen hedder "Opret opgave"
    await page.getByRole('button', { name: /Opret opgave/i }).click()

    // Toast "Opgave oprettet" vises
    await expect(page.getByText('Opgave oprettet')).toBeVisible({ timeout: 10_000 })

    // Efter oprettelse redirectes til /tasks
    await expect(page).toHaveURL(/\/tasks/, { timeout: 10_000 })

    // Opgaven vises i listen
    await expect(page.getByText(title)).toBeVisible()
  })

  test('opret opgave med prioritet Kritisk', async ({ loggedInPage: page }) => {
    const title = `E2E Kritisk ${Date.now()}`

    await page.goto('/tasks/new')

    await page.getByLabel('Titel', { exact: true }).fill(title)

    // BSegmentedField til prioritet — renderes som <button type="button">
    await page.getByRole('button', { name: 'Kritisk' }).click()

    await page.getByRole('button', { name: /Opret opgave/i }).click()
    await expect(page.getByText('Opgave oprettet')).toBeVisible({ timeout: 10_000 })
    await expect(page).toHaveURL(/\/tasks/, { timeout: 10_000 })
    await expect(page.getByText(title)).toBeVisible()
  })
})
