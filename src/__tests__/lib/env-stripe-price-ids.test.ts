import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// env.ts evaluerer process.env ved modul-load → vi isolerer moduler pr. test
describe('env — Stripe price-IDs requiredInProd', () => {
  const ORIGINAL = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...ORIGINAL }
  })

  afterEach(() => {
    process.env = { ...ORIGINAL }
    vi.resetModules()
  })

  function setProdBase() {
    // NODE_ENV er readonly i ProcessEnv-typen — cast for at tillade test-isolation
    ;(process.env as Record<string, string>).NODE_ENV = 'production'
    delete process.env.NEXT_PHASE
    process.env.DATABASE_URL = 'postgresql://x'
    process.env.NEXTAUTH_SECRET = 'x'
    process.env.NEXTAUTH_URL = 'https://www.chainhub.dk'
    process.env.DIGEST_CRON_SECRET = 'x'
    process.env.UPSTASH_REDIS_REST_URL = 'https://x'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'x'
    process.env.STRIPE_SECRET_KEY = 'sk_test_x'
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_x'
  }

  it('kaster når STRIPE_BASIS_PRICE_ID mangler i production', async () => {
    setProdBase()
    process.env.STRIPE_PLUS_PRICE_ID = 'price_plus'
    delete process.env.STRIPE_BASIS_PRICE_ID
    await expect(import('@/lib/env')).rejects.toThrow(/STRIPE_BASIS_PRICE_ID/)
  })

  it('kaster når STRIPE_PLUS_PRICE_ID mangler i production', async () => {
    setProdBase()
    process.env.STRIPE_BASIS_PRICE_ID = 'price_basis'
    delete process.env.STRIPE_PLUS_PRICE_ID
    await expect(import('@/lib/env')).rejects.toThrow(/STRIPE_PLUS_PRICE_ID/)
  })

  it('accepterer manglende price-IDs udenfor production', async () => {
    process.env = { ...ORIGINAL }
    ;(process.env as Record<string, string>).NODE_ENV = 'test'
    process.env.DATABASE_URL = 'postgresql://x'
    process.env.NEXTAUTH_SECRET = 'x'
    delete process.env.STRIPE_BASIS_PRICE_ID
    delete process.env.STRIPE_PLUS_PRICE_ID
    await expect(import('@/lib/env')).resolves.toBeDefined()
  })
})
