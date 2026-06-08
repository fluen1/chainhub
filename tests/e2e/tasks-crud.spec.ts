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

    // Naviger til /tasks?search=<title> så kun den nyoprettede opgave vises —
    // robust mod data-akkumulering (uden due_date havner opgaven ellers på side 2+
    // pga. default-sortering due_date ASC NULLS LAST).
    await page.goto(`/tasks?search=${encodeURIComponent(title)}`)
    await expect(page.getByText(title)).toBeVisible()
  })

  test('opret opgave med prioritet Kritisk', async ({ loggedInPage: page }) => {
    const title = `E2E Kritisk ${Date.now()}`

    await page.goto('/tasks/new')

    await page.getByLabel('Titel', { exact: true }).fill(title)

    // BSegmentedField til prioritet — renderes som role="radio" (overskriver implicit button-role)
    await page.getByRole('radio', { name: 'Kritisk' }).click()

    await page.getByRole('button', { name: /Opret opgave/i }).click()
    await expect(page.getByText('Opgave oprettet')).toBeVisible({ timeout: 10_000 })
    await expect(page).toHaveURL(/\/tasks/, { timeout: 10_000 })

    // Naviger til /tasks?search=<title> så kun den nyoprettede opgave vises —
    // robust mod data-akkumulering (uden due_date havner opgaven ellers på side 2+
    // pga. default-sortering due_date ASC NULLS LAST).
    await page.goto(`/tasks?search=${encodeURIComponent(title)}`)
    await expect(page.getByText(title)).toBeVisible()
  })
})
