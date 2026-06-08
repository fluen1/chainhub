export type PricingTier = {
  id: 'basis' | 'plus' | 'enterprise'
  name: string
  price: string
  priceNote: string
  tagline: string
  features: string[]
  cta: string
}

export const ONBOARDING_FEE = {
  perDocument: 1, // kr. pr. dokument ved initial import
  cap: 2500, // kr. — maks
  label: 'Onboarding (data-migrations-setup): 1 kr./dokument ved initial import, maks. 2.500 kr.',
} as const

export const PRICING_TIERS: PricingTier[] = [
  {
    id: 'basis',
    name: 'Basis',
    price: '3.500 kr.',
    priceNote: 'pr. måned',
    tagline: 'Kerne-CRM til kæden — uden AI.',
    features: [
      'Selskaber, ejerskab og koncernstruktur',
      'Kontrakter, sager og opgaver',
      'Brugere, roller og adgangsstyring',
      'Eksport og GDPR-værktøjer',
    ],
    cta: 'Book demo',
  },
  {
    id: 'plus',
    name: 'Plus',
    price: '9.500 kr.',
    priceNote: 'pr. måned · 50 AI-ekstraktioner inkl.',
    tagline: 'Alt i Basis + AI-ekstraktion og -indsigter.',
    features: [
      'Alt i Basis',
      'AI-ekstraktion af kontraktdata',
      'AI-indsigter og påmindelser',
      '50 ekstraktioner inkl., derefter 75 kr./ekstra',
    ],
    cta: 'Book demo',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Forhandles',
    priceNote: 'fra 32.000 kr./md · fair-use 500 ekstraktioner/md',
    tagline: 'Alt i Plus + portfolio-AI, RAG og SLA.',
    features: [
      'Alt i Plus',
      'Portfolio-AI på tværs af hele kæden',
      'RAG-baseret dokumentsøgning',
      'SLA og dedikeret onboarding',
    ],
    cta: 'Kontakt salg',
  },
]
