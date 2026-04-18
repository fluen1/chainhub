import { test, expect } from './fixtures'

test.describe('Companies CRUD', () => {
  test('opret nyt selskab og se det i listen', async ({ loggedInPage: page }) => {
    const cvr = String(Math.floor(10000000 + Math.random() * 89999999))
    const name = `E2E Test ApS ${Date.now()}`

    await page.goto('/companies')
    await page.getByRole('link', { name: /Nyt selskab/i }).click()
    await expect(page).toHaveURL(/\/companies\/new/)

    await page.getByLabel('Navn', { exact: true }).fill(name)
    await page.getByLabel('CVR', { exact: true }).fill(cvr)
    await page.getByLabel(/By/i).fill('København K')
    await page.getByRole('button', { name: /Opret/i }).click()

    // Efter oprettelse vises selskabet på /companies eller /companies/[id]
    await expect(page).toHaveURL(/\/companies/, { timeout: 10_000 })
    await page.goto('/companies')
    await expect(page.getByText(name)).toBeVisible()
  })

  test('selskabs-detalje viser alle hovedsektioner', async ({ loggedInPage: page }) => {
    // Brug seed-selskab Tandlæge Østerbro ApS
    await page.goto('/companies')
    await page.getByText('Tandlæge Østerbro ApS').click()
    // Sektioner fra /companies/[id] single-page
    await expect(page.getByRole('heading', { name: 'Ejerskab' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Kontrakter' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Sager' })).toBeVisible()
  })
})
