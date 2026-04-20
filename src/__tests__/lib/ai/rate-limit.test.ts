import { describe, it, expect, beforeEach, vi } from 'vitest'
import { checkUploadRateLimit, resetRateLimiter } from '@/lib/ai/rate-limit'

describe('upload rate-limiter', () => {
  beforeEach(() => resetRateLimiter())

  it('tillader 10 requests pr. minut per org', () => {
    const orgId = 'org-1'
    for (let i = 0; i < 10; i++) {
      expect(checkUploadRateLimit(orgId).allowed).toBe(true)
    }
    expect(checkUploadRateLimit(orgId).allowed).toBe(false)
  })

  it('organisationer har separate buckets', () => {
    for (let i = 0; i < 10; i++) checkUploadRateLimit('org-1')
    expect(checkUploadRateLimit('org-1').allowed).toBe(false)
    expect(checkUploadRateLimit('org-2').allowed).toBe(true)
  })

  it('refiller efter tidsperioden', () => {
    vi.useFakeTimers()
    for (let i = 0; i < 10; i++) checkUploadRateLimit('org-1')
    expect(checkUploadRateLimit('org-1').allowed).toBe(false)
    vi.advanceTimersByTime(61_000)
    expect(checkUploadRateLimit('org-1').allowed).toBe(true)
    vi.useRealTimers()
  })
})
