import { test, expect } from './fixtures'

test.describe('Global search', () => {
  test('søgning på "optik" returnerer selskaber + kontrakter', async ({ loggedInPage: page }) => {
    await page.goto('/search?q=optik')
    // PanelHeader bruger <span> ikke <heading> — matcher via tekst i panel-header-kontekst
    await expect(page.getByText('Selskaber', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Kontrakter', { exact: true }).first()).toBeVisible()
    // Mindst 1 selskab vises
    await expect(page.getByText('Optik Østerbro ApS').first()).toBeVisible()
  })

  test('søgning på "GDPR" returnerer både sager og opgaver', async ({ loggedInPage: page }) => {
    await page.goto('/search?q=GDPR')
    // PanelHeader bruger <span> ikke <heading> — matcher via tekst
    await expect(page.getByText('Sager', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Opgaver', { exact: true }).first()).toBeVisible()
  })

  test('tom søgning viser quick-access panel', async ({ loggedInPage: page }) => {
    // Quick-access panel vises ved tom query (/search uden ?q=) — ikke ved 1 tegn
    // (klienten har hasQuery=true selv med 1 tegn, men server sender results=null)
    await page.goto('/search')
    await expect(page.getByText('Hurtig adgang', { exact: true })).toBeVisible()
  })
})
