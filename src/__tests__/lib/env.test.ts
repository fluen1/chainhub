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

  it('next build (production + NEXT_PHASE=phase-production-build) kræver IKKE runtime-secrets', async () => {
    // Hvorfor: `next build` sætter NODE_ENV=production men kører på dev/CI-maskiner
    // uden produktions-secrets. Kravene skal håndhæves ved runtime-boot, ikke ved build.
    vi.stubEnv('NODE_ENV', 'production')
    process.env.NEXT_PHASE = 'phase-production-build'
    process.env.DATABASE_URL = 'postgresql://test'
    process.env.NEXTAUTH_SECRET = 'test-secret'
    process.env.NEXTAUTH_URL = 'https://chainhub.dk'
    delete process.env.DIGEST_CRON_SECRET
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
    delete process.env.STRIPE_SECRET_KEY
    delete process.env.STRIPE_WEBHOOK_SECRET
    await expect(import('@/lib/env')).resolves.toBeDefined()
    vi.unstubAllEnvs()
  })

  it('production-RUNTIME (uden NEXT_PHASE) kræver runtime-secrets — fail-fast', async () => {
    // Hvorfor: i ægte produktion må appen ikke boote uden cron-secret,
    // rate-limit-Redis og Stripe-nøgler — fejl ved boot frem for stille degradering.
    vi.stubEnv('NODE_ENV', 'production')
    delete process.env.NEXT_PHASE
    process.env.DATABASE_URL = 'postgresql://test'
    process.env.NEXTAUTH_SECRET = 'test-secret'
    process.env.NEXTAUTH_URL = 'https://chainhub.dk'
    delete process.env.DIGEST_CRON_SECRET
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
    delete process.env.STRIPE_SECRET_KEY
    delete process.env.STRIPE_WEBHOOK_SECRET
    await expect(import('@/lib/env')).rejects.toThrow('Ugyldig miljøkonfiguration')
    vi.unstubAllEnvs()
  })
})
