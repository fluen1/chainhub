import { test, expect } from './fixtures'

test.describe('Global search', () => {
  test('søgning på "tandlæge" returnerer selskaber + kontrakter', async ({
    loggedInPage: page,
  }) => {
    await page.goto('/search?q=tandl%C3%A6ge')
    await expect(page.getByRole('heading', { name: /Selskaber \(/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Kontrakter \(/ })).toBeVisible()
    // Mindst 1 selskab vises
    await expect(page.getByText('Tandlæge Østerbro ApS')).toBeVisible()
  })

  test('søgning på "GDPR" returnerer både sager og opgaver', async ({ loggedInPage: page }) => {
    await page.goto('/search?q=GDPR')
    await expect(page.getByRole('heading', { name: /Sager \(/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Opgaver \(/ })).toBeVisible()
  })

  test('søgning under 2 tegn viser quick-access panel', async ({ loggedInPage: page }) => {
    await page.goto('/search?q=a')
    await expect(page.getByText(/Skriv mindst 2 tegn/)).toBeVisible()
  })
})
