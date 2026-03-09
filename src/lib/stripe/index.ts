import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY mangler i environment')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia',
  typescript: true,
})

// Pris-IDs pr. plan — hentes fra env
export const STRIPE_PRICE_IDS = {
  starter: process.env.STRIPE_STARTER_PRICE_ID ?? '',
  business: process.env.STRIPE_BUSINESS_PRICE_ID ?? '',
  enterprise: process.env.STRIPE_ENTERPRISE_PRICE_ID ?? '',
} as const

export type PlanType = keyof typeof STRIPE_PRICE_IDS

// Trial-periode: 14 dage
export const TRIAL_PERIOD_DAYS = 14

// Plan-navne til UI
export const PLAN_NAMES: Record<string, string> = {
  trial: 'Prøveperiode',
  starter: 'Starter',
  business: 'Business',
  enterprise: 'Enterprise',
}

// Plan-beskrivelser til billing-side
export const PLAN_FEATURES: Record<string, string[]> = {
  starter: [
    'Op til 5 brugere',
    'Ubegrænsede kontrakter',
    'Grundlæggende dokumenthåndtering',
    'E-mail support',
  ],
  business: [
    'Op til 25 brugere',
    'Ubegrænsede kontrakter',
    'Avanceret dokumenthåndtering',
    'Prioriteret support',
    'Finansielle nøgletal',
    'Tidsregistrering',
  ],
  enterprise: [
    'Ubegrænsede brugere',
    'Alle Business-funktioner',
    'Dedikeret account manager',
    'SLA-garanti',
    'Custom integrationer',
    'On-premise mulighed',
  ],
}

// Plan-priser til UI (DKK pr. bruger pr. måned)
export const PLAN_PRICES: Record<string, number> = {
  starter: 149,
  business: 249,
  enterprise: 449,
}