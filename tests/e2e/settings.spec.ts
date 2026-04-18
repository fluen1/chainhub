import { test, expect } from './fixtures'
import { PrismaClient } from '@prisma/client'

test.describe('Settings — organisation', () => {
  test('opdatér organisation-navn og verificér persistens', async ({ loggedInPage: page }) => {
    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: 'Organisation' })).toBeVisible()

    const newName = `TandlægeGruppen E2E ${Date.now()}`
    const nameInput = page.locator('input[type="text"]').first()
    await nameInput.fill(newName)
    await page.getByRole('button', { name: /Gem ændringer/ }).click()

    await expect(page.getByText(/Organisation opdateret/)).toBeVisible({ timeout: 10_000 })

    // Verificér i DB
    const prisma = new PrismaClient({
      datasources: { db: { url: process.env.E2E_DATABASE_URL } },
    })
    const org = await prisma.organization.findFirst()
    expect(org?.name).toBe(newName)

    // Reset til seed-værdi for ikke at forurene andre tests
    await prisma.organization.updateMany({ data: { name: 'TandlægeGruppen A/S' } })
    await prisma.$disconnect()
  })

  test('brugere-tabel viser alle 4 seed-brugere', async ({ loggedInPage: page }) => {
    await page.goto('/settings')
    await expect(page.getByText('Philip Larsen')).toBeVisible()
    await expect(page.getByText('Maria Sørensen')).toBeVisible()
    await expect(page.getByText('Thomas Mikkelsen')).toBeVisible()
    await expect(page.getByText('Torben Hansen')).toBeVisible()
  })
})
