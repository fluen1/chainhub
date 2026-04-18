import { Page, expect } from '@playwright/test'

export const SEED_USER = {
  email: 'philip@chainhub.dk',
  password: 'password123',
  name: 'Philip Larsen',
}

/**
 * Login via NextAuth credentials-provider. Bruger UI flow så vi tester
 * det samme som brugeren. Returnerer når dashboard er loaded.
 */
export async function loginAs(page: Page, user = SEED_USER): Promise<void> {
  await page.goto('/login')
  await page.getByRole('textbox', { name: 'Email' }).fill(user.email)
  await page.getByRole('textbox', { name: 'Adgangskode' }).fill(user.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 })
}
