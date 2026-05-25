import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  isLoginRateLimited,
  recordFailedLoginAttempt,
  resetLoginRateLimiter,
} from '@/lib/auth/login-rate-limit'

describe('login rate-limiter', () => {
  beforeEach(() => {
    resetLoginRateLimiter()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('er ikke blokeret uden forudgående fejlede forsøg', () => {
    const result = isLoginRateLimited('test@example.com')
    expect(result.limited).toBe(false)
  })

  it('blokerer ikke efter færre end 5 fejlede forsøg', () => {
    for (let i = 0; i < 4; i++) {
      recordFailedLoginAttempt('test@example.com')
    }
    const result = isLoginRateLimited('test@example.com')
    expect(result.limited).toBe(false)
  })

  it('blokerer efter 5 fejlede forsøg', () => {
    for (let i = 0; i < 5; i++) {
      recordFailedLoginAttempt('test@example.com')
    }
    const result = isLoginRateLimited('test@example.com')
    expect(result.limited).toBe(true)
    expect(result.retryAfterMs).toBeGreaterThan(0)
  })

  it('vellykket login (ingen recordFailedLoginAttempt) tæller ikke med i blokeringen', () => {
    // Simulér 4 fejlede + 10 vellykkede logins (isLoginRateLimited kaldes uden record)
    for (let i = 0; i < 4; i++) {
      recordFailedLoginAttempt('test@example.com')
    }
    for (let i = 0; i < 10; i++) {
      isLoginRateLimited('test@example.com') // blot check — ingen optælling
    }
    const result = isLoginRateLimited('test@example.com')
    expect(result.limited).toBe(false)
  })

  it('isolerer per email', () => {
    for (let i = 0; i < 5; i++) {
      recordFailedLoginAttempt('a@example.com')
    }
    const result = isLoginRateLimited('b@example.com')
    expect(result.limited).toBe(false)
  })

  it('normaliserer email til lowercase', () => {
    for (let i = 0; i < 5; i++) {
      recordFailedLoginAttempt('Test@Example.COM')
    }
    const result = isLoginRateLimited('test@example.com')
    expect(result.limited).toBe(true)
  })

  it('ophæver blokering efter vinduet er udløbet', () => {
    vi.useFakeTimers()

    for (let i = 0; i < 5; i++) {
      recordFailedLoginAttempt('test@example.com')
    }

    // Bekræft at brugeren er blokeret
    expect(isLoginRateLimited('test@example.com').limited).toBe(true)

    // Fremryk tid forbi 15-minutters vinduet
    vi.advanceTimersByTime(15 * 60 * 1000 + 1)

    // Brugeren skal nu være fri igen
    const result = isLoginRateLimited('test@example.com')
    expect(result.limited).toBe(false)
  })
})
