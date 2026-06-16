import { describe, it, expect } from 'vitest'
import { shouldGateBilling } from '@/lib/billing/access-gate'

const FUTURE = new Date(Date.now() + 86_400_000)
const PAST = new Date(Date.now() - 86_400_000)

describe('shouldGateBilling', () => {
  it('gater udløbet trial', () => {
    expect(shouldGateBilling({ plan: 'trial', planExpiresAt: PAST, subStatus: null })).toBe(true)
  })

  it('gater ikke aktiv trial', () => {
    expect(shouldGateBilling({ plan: 'trial', planExpiresAt: FUTURE, subStatus: null })).toBe(false)
  })

  it('gater canceled plan', () => {
    expect(shouldGateBilling({ plan: 'canceled', planExpiresAt: null, subStatus: null })).toBe(true)
  })

  it('gater past_due subscription på aktiv plan', () => {
    expect(shouldGateBilling({ plan: 'basis', planExpiresAt: null, subStatus: 'past_due' })).toBe(
      true
    )
  })

  it('gater ikke aktiv betalende plan', () => {
    expect(shouldGateBilling({ plan: 'plus', planExpiresAt: null, subStatus: 'active' })).toBe(
      false
    )
  })

  it('gater ikke past_due hvis plan allerede canceled (undgå dobbelt-redirect-semantik)', () => {
    // canceled fanges allerede af canceled-grenen → forbliver true, men via plan ikke status
    expect(
      shouldGateBilling({ plan: 'canceled', planExpiresAt: null, subStatus: 'past_due' })
    ).toBe(true)
  })
})
