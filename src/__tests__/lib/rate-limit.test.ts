import { describe, it, expect, beforeEach } from 'vitest'
import { checkActionRateLimit, resetActionRateLimiter } from '@/lib/rate-limit'

describe('checkActionRateLimit', () => {
  beforeEach(() => {
    resetActionRateLimiter()
  })

  it('tillader normale requests', async () => {
    const result = await checkActionRateLimit('org-1')
    expect(result.limited).toBe(false)
  })

  it('blokerer efter 60 requests', async () => {
    for (let i = 0; i < 60; i++) {
      await checkActionRateLimit('org-1')
    }
    const result = await checkActionRateLimit('org-1')
    expect(result.limited).toBe(true)
  })

  it('isolerer per organisation', async () => {
    for (let i = 0; i < 60; i++) {
      await checkActionRateLimit('org-1')
    }
    const result = await checkActionRateLimit('org-2')
    expect(result.limited).toBe(false)
  })
})
