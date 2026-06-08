import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getBillingPageData } from '@/actions/billing'
import { env } from '@/lib/env'
import { BillingClient } from './billing-client'

export const metadata: Metadata = { title: 'Abonnement — ChainHub' }

// Pris-ID'er læses server-side for at undgå eksponering via NEXT_PUBLIC_
const STARTER_PRICE_ID = env.STRIPE_STARTER_PRICE_ID ?? ''
const PROFESSIONAL_PRICE_ID = env.STRIPE_PROFESSIONAL_PRICE_ID ?? ''

// ────────────────────────────────────────────────────────────────────────────
// /billing — abonnementsstyring
// ────────────────────────────────────────────────────────────────────────────

interface BillingPageProps {
  searchParams: Promise<{ success?: string; canceled?: string }>
}

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const params = await searchParams
  const result = await getBillingPageData()

  if (result.error) redirect('/dashboard')
  if (!result.data) redirect('/dashboard')

  const { plan, trialDaysLeft, hasSubscription, planExpiresAt } = result.data

  return (
    <div className="mx-auto max-w-3xl px-3 py-4">
      <BillingClient
        plan={plan}
        trialDaysLeft={trialDaysLeft}
        hasSubscription={hasSubscription}
        planExpiresAt={planExpiresAt}
        starterPriceId={STARTER_PRICE_ID}
        professionalPriceId={PROFESSIONAL_PRICE_ID}
        checkoutSuccess={params.success === '1'}
        checkoutCanceled={params.canceled === '1'}
      />
    </div>
  )
}
