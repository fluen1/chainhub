import { test, expect } from './fixtures'

test.describe('keyboard navigation', () => {
  test('Tab navigerer gennem sidebar-links', async ({ loggedInPage: page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Tab ind i sidebar (spring skip-link over)
    await page.keyboard.press('Tab') // skip-to-content link
    await page.keyboard.press('Tab') // første sidebar-link

    const activeElement = await page.evaluate(() => document.activeElement?.tagName)
    expect(activeElement).toBe('A')
  })

  test('Skip-to-content link virker', async ({ loggedInPage: page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Først Tab fokuserer skip-link
    await page.keyboard.press('Tab')
    const skipLink = page.locator('a[href="#main-content"]')
    await expect(skipLink).toBeFocused()

    // Enter aktiverer skip-link
    await page.keyboard.press('Enter')

    // Fokus er nu på main-content
    const focusedId = await page.evaluate(() => document.activeElement?.id)
    expect(focusedId).toBe('main-content')
  })

  test('Escape lukker modal/dialog', async ({ loggedInPage: page }) => {
    await page.goto('/companies')
    await page.waitForLoadState('networkidle')

    // Åbn opret-dialog
    const createButton = page.locator('button', { hasText: 'Opret selskab' })
    if (await createButton.isVisible()) {
      await createButton.click()

      // Verificér dialog er åben
      const dialog = page.locator('[role="dialog"]')
      await expect(dialog).toBeVisible()

      // Escape lukker den
      await page.keyboard.press('Escape')
      await expect(dialog).not.toBeVisible()
    }
  })

  test('Mobil: burger-menu åbner sidebar via Enter', async ({ loggedInPage: page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Find burger-knap og aktiver med keyboard
    const burgerButton = page.locator('button[aria-label]').first()
    await burgerButton.focus()
    await page.keyboard.press('Enter')

    // Sidebar-drawer åbner
    const drawer = page.locator('[role="dialog"][aria-modal="true"]')
    await expect(drawer).toBeVisible()

    // Escape lukker drawer
    await page.keyboard.press('Escape')
    await expect(drawer).not.toBeVisible()
  })
})
