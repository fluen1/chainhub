import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/env', () => ({
  env: {
    STRIPE_BASIS_PRICE_ID: 'price_basis_123',
    STRIPE_PLUS_PRICE_ID: 'price_plus_456',
  },
}))

import { planFromPrice } from '@/lib/billing/plan-from-price'

describe('planFromPrice', () => {
  it('foretrækker lookup_key når sat', () => {
    expect(planFromPrice({ lookupKey: 'basis', priceId: 'price_plus_456' })).toBe('basis')
    expect(planFromPrice({ lookupKey: 'plus', priceId: 'price_basis_123' })).toBe('plus')
  })

  it('matcher price-ID mod env når lookup_key mangler', () => {
    expect(planFromPrice({ lookupKey: null, priceId: 'price_basis_123' })).toBe('basis')
    expect(planFromPrice({ lookupKey: null, priceId: 'price_plus_456' })).toBe('plus')
  })

  it('returnerer null ved ukendt price uden lookup_key (ingen forkert plan skrives)', () => {
    expect(planFromPrice({ lookupKey: null, priceId: 'price_ukendt' })).toBeNull()
    expect(planFromPrice({ lookupKey: undefined, priceId: undefined })).toBeNull()
  })

  it('ignorerer ukendte lookup_keys og falder tilbage til price-ID', () => {
    expect(planFromPrice({ lookupKey: 'gammel_navn', priceId: 'price_plus_456' })).toBe('plus')
  })
})
