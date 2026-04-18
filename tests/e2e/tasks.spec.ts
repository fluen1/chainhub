import { test, expect } from './fixtures'
import { PrismaClient } from '@prisma/client'

test.describe('Tasks + audit trail', () => {
  test('ændr task status fra detalje-side trigger TaskHistory-entry', async ({
    loggedInPage: page,
  }) => {
    await page.goto('/tasks')
    // Klik på en seed-opgave
    await page
      .getByText(/GDPR-tjekliste for Aarhus/)
      .first()
      .click()
    await expect(page).toHaveURL(/\/tasks\/[0-9a-f-]+/)

    // Åbn edit-dialog
    await page.getByRole('button', { name: 'Redigér' }).click()
    await expect(page.getByRole('heading', { name: 'Redigér opgave' })).toBeVisible()

    // Ændr status
    const statusSelect = page.getByLabel('Status', { exact: true })
    await statusSelect.selectOption({ label: 'Aktiv' })
    await page.getByRole('button', { name: /Gem/ }).click()

    // Vent på toast
    await expect(page.getByText(/Opgave opdateret/)).toBeVisible({ timeout: 10_000 })

    // Verificér TaskHistory-entry direkte i DB (TaskHistory bruges direkte for tasks,
    // ikke AuditLog — bedre struktur for tasks per session 2 design)
    const prisma = new PrismaClient({
      datasources: { db: { url: process.env.E2E_DATABASE_URL } },
    })
    const recentHistory = await prisma.taskHistory.findFirst({
      where: { field_name: 'STATUS' },
      orderBy: { changed_at: 'desc' },
    })
    expect(recentHistory).toBeTruthy()
    expect(recentHistory!.new_value).toBe('AKTIV_TASK')
    await prisma.$disconnect()
  })

  test('kanban view loader alle 4 status-kolonner', async ({ loggedInPage: page }) => {
    await page.goto('/tasks?view=kanban')
    await expect(page.getByRole('heading', { name: 'Ny' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Aktiv' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Afventer' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Lukket' })).toBeVisible()
  })
})
