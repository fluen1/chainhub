import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  isLoginRateLimited,
  recordFailedLoginAttempt,
  resetLoginRateLimiter,
} from '@/lib/auth/login-rate-limit'

vi.mock('@upstash/redis', () => ({ Redis: vi.fn() }))
vi.mock('@upstash/ratelimit', () => ({ Ratelimit: vi.fn() }))

describe('login rate-limiter', () => {
  beforeEach(() => {
    resetLoginRateLimiter()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('er ikke blokeret uden forudgående fejlede forsøg', async () => {
    const result = await isLoginRateLimited('test@example.com')
    expect(result.limited).toBe(false)
  })

  it('blokerer ikke efter færre end 5 fejlede forsøg', async () => {
    for (let i = 0; i < 4; i++) {
      await recordFailedLoginAttempt('test@example.com')
    }
    const result = await isLoginRateLimited('test@example.com')
    expect(result.limited).toBe(false)
  })

  it('blokerer efter 5 fejlede forsøg', async () => {
    for (let i = 0; i < 5; i++) {
      await recordFailedLoginAttempt('test@example.com')
    }
    const result = await isLoginRateLimited('test@example.com')
    expect(result.limited).toBe(true)
    expect(result.retryAfterMs).toBeGreaterThan(0)
  })

  it('vellykket login (ingen recordFailedLoginAttempt) tæller ikke med i blokeringen', async () => {
    // Simulér 4 fejlede + 10 vellykkede logins (isLoginRateLimited kaldes uden record)
    for (let i = 0; i < 4; i++) {
      await recordFailedLoginAttempt('test@example.com')
    }
    for (let i = 0; i < 10; i++) {
      await isLoginRateLimited('test@example.com') // blot check — ingen optælling
    }
    const result = await isLoginRateLimited('test@example.com')
    expect(result.limited).toBe(false)
  })

  it('isolerer per email', async () => {
    for (let i = 0; i < 5; i++) {
      await recordFailedLoginAttempt('a@example.com')
    }
    const result = await isLoginRateLimited('b@example.com')
    expect(result.limited).toBe(false)
  })

  it('normaliserer email til lowercase', async () => {
    for (let i = 0; i < 5; i++) {
      await recordFailedLoginAttempt('Test@Example.COM')
    }
    const result = await isLoginRateLimited('test@example.com')
    expect(result.limited).toBe(true)
  })

  it('ophæver blokering efter vinduet er udløbet', async () => {
    vi.useFakeTimers()

    for (let i = 0; i < 5; i++) {
      await recordFailedLoginAttempt('test@example.com')
    }

    // Bekræft at brugeren er blokeret
    expect((await isLoginRateLimited('test@example.com')).limited).toBe(true)

    // Fremryk tid forbi 15-minutters vinduet
    vi.advanceTimersByTime(15 * 60 * 1000 + 1)

    // Brugeren skal nu være fri igen
    const result = await isLoginRateLimited('test@example.com')
    expect(result.limited).toBe(false)
  })
})
