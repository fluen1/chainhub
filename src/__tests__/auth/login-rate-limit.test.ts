import { describe, it, expect, beforeEach } from 'vitest'
import { checkLoginRateLimit, resetLoginRateLimiter } from '@/lib/auth/login-rate-limit'

describe('checkLoginRateLimit', () => {
  beforeEach(() => {
    resetLoginRateLimiter()
  })

  it('tillader op til 5 forsøg', () => {
    for (let i = 0; i < 5; i++) {
      const result = checkLoginRateLimit('test@example.com')
      expect(result.allowed).toBe(true)
    }
  })

  it('blokerer efter 5 forsøg', () => {
    for (let i = 0; i < 5; i++) {
      checkLoginRateLimit('test@example.com')
    }
    const result = checkLoginRateLimit('test@example.com')
    expect(result.allowed).toBe(false)
    expect(result.retryAfterMs).toBeGreaterThan(0)
  })

  it('isolerer per email', () => {
    for (let i = 0; i < 5; i++) {
      checkLoginRateLimit('a@example.com')
    }
    const result = checkLoginRateLimit('b@example.com')
    expect(result.allowed).toBe(true)
  })

  it('normaliserer email til lowercase', () => {
    for (let i = 0; i < 5; i++) {
      checkLoginRateLimit('Test@Example.COM')
    }
    const result = checkLoginRateLimit('test@example.com')
    expect(result.allowed).toBe(false)
  })
})
