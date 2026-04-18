import { test as base } from '@playwright/test'
import { loginAs } from './helpers/auth'

type Fixtures = {
  loggedInPage: import('@playwright/test').Page
}

export const test = base.extend<Fixtures>({
  loggedInPage: async ({ page }, use) => {
    await loginAs(page)
    await use(page)
  },
})

export { expect } from '@playwright/test'
