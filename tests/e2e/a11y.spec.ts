import AxeBuilder from '@axe-core/playwright'
import { test, expect } from './fixtures'

// Pages der scannes — må ikke have critical/serious violations
const PAGES = [
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/companies', label: 'Portfolio (companies list)' },
  { path: '/contracts', label: 'Contracts list' },
  { path: '/cases', label: 'Cases list' },
  { path: '/tasks', label: 'Tasks list' },
  { path: '/persons', label: 'Persons list' },
  { path: '/documents', label: 'Documents list' },
  { path: '/calendar', label: 'Calendar' },
  { path: '/search', label: 'Global search' },
  { path: '/settings', label: 'Settings' },
]

test.describe('a11y — axe-core scans', () => {
  for (const { path, label } of PAGES) {
    test(`${label} har ingen critical/serious violations`, async ({ loggedInPage: page }) => {
      await page.goto(path)
      await page.waitForLoadState('networkidle', { timeout: 10_000 })

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()

      const critical = results.violations.filter((v) => v.impact === 'critical')
      const serious = results.violations.filter((v) => v.impact === 'serious')

      if (critical.length > 0 || serious.length > 0) {
        const summary = [...critical, ...serious]
          .map((v) => {
            const nodes = v.nodes
              .slice(0, 3)
              .map((n) => n.target.join(' '))
              .join('; ')
            return `  [${v.impact}] ${v.id}: ${v.description}\n    Elements: ${nodes}`
          })
          .join('\n')
        // eslint-disable-next-line no-console
        console.error(`\n[a11y] ${label} (${path}) violations:\n${summary}`)
      }

      expect(critical).toHaveLength(0)
      expect(serious).toHaveLength(0)
    })
  }
})
