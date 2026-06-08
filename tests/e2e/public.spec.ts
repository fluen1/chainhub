import { test, expect } from '@playwright/test'

test.describe('public-lag — tilgængeligt uden login', () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      try {
        localStorage.setItem('chainhub-cookie-consent', 'denied')
      } catch {
        /* ignore */
      }
    })
  })

  test('forside loader på / uden redirect til login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('header har Log ind-knap når ikke logget ind', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'Log ind' }).first()).toBeVisible()
  })

  test('pricing viser de tre tiers med priser', async ({ page }) => {
    await page.goto('/pricing')
    await expect(page.getByRole('heading', { name: 'Basis' })).toBeVisible()
    await expect(page.getByText('3.500 kr.')).toBeVisible()
    await expect(page.getByText('9.500 kr.')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Enterprise' })).toBeVisible()
  })

  test('kontaktformular viser valideringsfejl ved tom indsendelse', async ({ page }) => {
    await page.goto('/kontakt')
    await page.getByRole('button', { name: 'Send forespørgsel' }).click()
    // HTML5 required blokerer indsendelse — vi forbliver på /kontakt med synligt navnefelt
    await expect(page).toHaveURL(/\/kontakt$/)
    await expect(page.getByLabel('Navn')).toBeVisible()
  })

  test('pricing-CTA fører til kontakt', async ({ page }) => {
    await page.goto('/pricing')
    await page.getByRole('link', { name: 'Book demo' }).first().click()
    await expect(page).toHaveURL(/\/kontakt$/)
  })

  test('legal-sider loader uden auth', async ({ page }) => {
    for (const path of [
      '/legal/vilkaar',
      '/legal/privatliv',
      '/legal/cookies',
      '/legal/databehandleraftale',
    ]) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    }
  })

  test('/terms og /privacy redirecter til /legal/*', async ({ page }) => {
    await page.goto('/terms')
    await expect(page).toHaveURL(/\/legal\/vilkaar$/)
    await page.goto('/privacy')
    await expect(page).toHaveURL(/\/legal\/privatliv$/)
  })

  test('databehandlerliste nævner OpenAI, ikke Anthropic', async ({ page }) => {
    await page.goto('/legal/privatliv')
    await expect(page.getByText('OpenAI')).toBeVisible()
    await expect(page.getByText('Anthropic')).toHaveCount(0)
  })

  test('docs-forside loader og sidebar-navigation virker', async ({ page }) => {
    await page.goto('/docs')
    await expect(page.getByRole('heading', { name: 'Kom godt i gang', level: 1 })).toBeVisible()
    // Naviger via docs-sidebar til en sektion
    await page
      .getByRole('navigation', { name: 'Dokumentation' })
      .getByRole('link', { name: 'Selskaber & ejerskab' })
      .click()
    await expect(page).toHaveURL(/\/docs\/selskaber$/)
    await expect(
      page.getByRole('heading', { name: 'Selskaber & ejerskab', level: 1 })
    ).toBeVisible()
  })

  test('Docs-link i header fører til /docs', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('banner').getByRole('link', { name: 'Docs' }).click()
    await expect(page).toHaveURL(/\/docs$/)
  })
})

test.describe('cookie-consent banner', () => {
  test('vises på forsiden og forsvinder efter valg', async ({ page }) => {
    await page.goto('/')
    const banner = page.getByRole('dialog', { name: 'Cookie-samtykke' })
    await expect(banner).toBeVisible()
    await page.getByRole('button', { name: 'Kun nødvendige' }).click()
    await expect(banner).toHaveCount(0)
    // Reload: valget huskes, banner vises ikke igen
    await page.reload()
    await expect(page.getByRole('dialog', { name: 'Cookie-samtykke' })).toHaveCount(0)
  })
})
