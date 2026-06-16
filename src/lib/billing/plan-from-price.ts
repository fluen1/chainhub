import { env } from '@/lib/env'

export type BillingPlan = 'basis' | 'plus'

const KNOWN_LOOKUP_KEYS: ReadonlySet<string> = new Set<BillingPlan>(['basis', 'plus'])

/**
 * Deterministisk mapping fra en Stripe-prismodel til ChainHubs plan-navn.
 * Prioritet: 1) lookup_key (hvis 'basis'/'plus'), 2) price-ID matchet mod env.
 * Returnerer null hvis intet matcher — så kalderen IKKE skriver en forkert plan.
 */
export function planFromPrice(input: {
  lookupKey?: string | null
  priceId?: string | null
}): BillingPlan | null {
  const { lookupKey, priceId } = input

  if (lookupKey && KNOWN_LOOKUP_KEYS.has(lookupKey)) {
    return lookupKey as BillingPlan
  }

  if (priceId) {
    if (priceId === env.STRIPE_BASIS_PRICE_ID) return 'basis'
    if (priceId === env.STRIPE_PLUS_PRICE_ID) return 'plus'
  }

  return null
}
