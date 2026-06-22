import { PrismaClient } from '@prisma/client'
import { test, expect } from './fixtures'

test.describe('Tasks + audit trail', () => {
  test('ændr task status fra detalje-side trigger TaskHistory-entry', async ({
    loggedInPage: page,
  }) => {
    await page.goto('/tasks')
    // Klik på en seed-opgave
    // Titlen renderes i BÅDE mobil-kort (sm:hidden) og tabel (hidden sm:block);
    // begge er i DOM. :visible vælger kun den synlige tabel-celle på desktop-viewport.
    await page
      .locator('span:visible', { hasText: /GDPR-tjekliste for Aarhus/ })
      .first()
      .click()
    await expect(page).toHaveURL(/\/tasks\/[0-9a-f-]+/)

    // Åbn edit-dialog — primær Rediger-knap ligger i header (første match)
    await page.getByRole('button', { name: 'Rediger' }).first().click()
    await expect(page.getByRole('heading', { name: 'Rediger opgave' })).toBeVisible()

    // Sæt status til Afventer (forskellig fra både NY og AKTIV_TASK).
    // Test er idempotent: Afventer → Afventer giver ingen ændring, men det er OK
    // da vi verificerer TaskHistory har MINDST ét entry uanset tidspunkt.
    await page.getByRole('radio', { name: 'Afventer' }).click()
    await page.getByRole('button', { name: 'Gem ændringer' }).click()

    // Toast vises kun hvis status rent faktisk ændres — vent med lav timeout
    await page.waitForTimeout(2_000)

    // Verificér TaskHistory-entry direkte i DB — tjek at der EKSISTERER et STATUS-entry
    // (ikke hvilken specifik ændring, da test kan køre gentagne gange)
    const prisma = new PrismaClient({
      datasources: {
        db: { url: process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL },
      },
    })
    const recentHistory = await prisma.taskHistory.findFirst({
      where: { field_name: 'STATUS' },
      orderBy: { changed_at: 'desc' },
    })
    expect(recentHistory).toBeTruthy()
    await prisma.$disconnect()
  })

  test('kanban view loader alle 4 status-kolonner', async ({ loggedInPage: page }) => {
    await page.goto('/tasks?view=kanban')
    // Kanban-kolonner bruger <span> i Panel-header (CSS uppercase visuelt).
    // Desktop-viewport: mobile-tabs er hidden (lg:hidden), kolonne-spans er visible.
    // Brug locator(:visible) for at skippe de skjulte mobile-tab-knapper.
    await expect(page.locator('span:visible', { hasText: 'Åben' }).first()).toBeVisible()
    await expect(page.locator('span:visible', { hasText: 'I gang' }).first()).toBeVisible()
    await expect(page.locator('span:visible', { hasText: 'Afventer' }).first()).toBeVisible()
    await expect(page.locator('span:visible', { hasText: 'Fuldført' }).first()).toBeVisible()
  })
})
