import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('env validation', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('kaster fejl ved manglende DATABASE_URL', async () => {
    delete process.env.DATABASE_URL
    process.env.NEXTAUTH_SECRET = 'test-secret'
    process.env.NEXTAUTH_URL = 'http://localhost:3000'
    await expect(import('@/lib/env')).rejects.toThrow('DATABASE_URL')
  })

  it('kaster fejl ved manglende NEXTAUTH_SECRET', async () => {
    process.env.DATABASE_URL = 'postgresql://test'
    delete process.env.NEXTAUTH_SECRET
    process.env.NEXTAUTH_URL = 'http://localhost:3000'
    await expect(import('@/lib/env')).rejects.toThrow('NEXTAUTH_SECRET')
  })

  it('accepterer gyldige env vars', async () => {
    process.env.DATABASE_URL = 'postgresql://test'
    process.env.NEXTAUTH_SECRET = 'test-secret'
    process.env.NEXTAUTH_URL = 'http://localhost:3000'
    const mod = await import('@/lib/env')
    expect(mod.env.DATABASE_URL).toBe('postgresql://test')
  })
})
