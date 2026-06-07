import { test, expect } from './fixtures'
import { PrismaClient } from '@prisma/client'

test.describe('Settings — organisation', () => {
  test('opdatér organisation-navn og verificér persistens', async ({ loggedInPage: page }) => {
    await page.goto('/settings')
    // PageHeader rendrer <h1> — matcher direkte
    await expect(page.getByRole('heading', { name: 'Organisation' })).toBeVisible()

    const newName = `OptikGruppen E2E ${Date.now()}`
    // OrganizationForm: label "Navn" wrapper-style (<label><span>Navn</span><input></label>)
    // .first(): /settings renderer org-formen to gange i DOM (desktop + mobil-layout)
    await page.getByLabel('Navn', { exact: true }).first().fill(newName)
    await page.getByRole('button', { name: /Gem ændringer/ }).click()

    await expect(page.getByText(/Organisation opdateret/)).toBeVisible({ timeout: 10_000 })

    // Verificér i DB — E2E_DATABASE_URL er kun sat i webServer.env; fald tilbage til DATABASE_URL
    const dbUrl = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL
    const prisma = new PrismaClient({
      datasources: { db: { url: dbUrl } },
    })
    const org = await prisma.organization.findFirst()
    expect(org?.name).toBe(newName)

    // Reset til seed-værdi for ikke at forurene andre tests
    await prisma.organization.updateMany({ data: { name: 'OptikGruppen A/S' } })
    await prisma.$disconnect()
  })

  test('brugere-tabel viser alle seed-brugere', async ({ loggedInPage: page }) => {
    // Brugere er i ?section=brugere — ikke i org-default-sektionen
    // Seed indeholder 3 brugere: Philip Larsen, Maria Sørensen, Thomas Mikkelsen
    await page.goto('/settings?section=brugere')
    await page.waitForLoadState('networkidle')
    // Brug mere præcis locator — brugertabellen i main-content (undgå sidebar-match)
    const main = page.locator('[id="main-content"], main, .main-content').first()
    await expect(main.getByText('Philip Larsen')).toBeVisible({ timeout: 10_000 })
    await expect(main.getByText('Maria Sørensen')).toBeVisible()
    await expect(main.getByText('Thomas Mikkelsen')).toBeVisible()
  })
})
