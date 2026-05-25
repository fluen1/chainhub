'use server'

import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getStripe } from '@/lib/stripe'
import { captureError } from '@/lib/logger'
import { env } from '@/lib/env'
import { canAccessModule } from '@/lib/permissions'
import type { ActionResult } from '@/types/actions'

const BASE_URL = env.NEXTAUTH_URL ?? 'http://localhost:3000'

const checkoutSchema = z.object({
  priceId: z.string().min(1, 'Ugyldig pris-ID'),
})

// ────────────────────────────────────────────────────────────────────────────
// getBillingPageData — hent faktureringsdata til billing-siden
// ────────────────────────────────────────────────────────────────────────────

export interface BillingPageData {
  plan: string
  trialDaysLeft: number | null
  hasSubscription: boolean
  planExpiresAt: string | null
}

export async function getBillingPageData(): Promise<ActionResult<BillingPageData>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const hasAccess = await canAccessModule(session.user.id, 'billing', session.user.organizationId)
  if (!hasAccess) return { error: 'Du har ikke adgang til fakturering' }

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: {
      id: true,
      name: true,
      plan: true,
      plan_expires_at: true,
      subscriptions: true,
    },
  })

  if (!org) return { error: 'Organisation ikke fundet' }

  let trialDaysLeft: number | null = null
  if (org.plan === 'trial' && org.plan_expires_at) {
    const now = new Date()
    const diff = org.plan_expires_at.getTime() - now.getTime()
    trialDaysLeft = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  }

  // Kun aktive (ikke-annullerede) abonnementer tæller
  const hasSubscription = org.subscriptions.some((s) => s.status !== 'canceled')

  // Fornyelsesdato fra første aktive subscription
  const activeSubscription = org.subscriptions.find((s) => s.status !== 'canceled')
  const planExpiresAt = activeSubscription?.current_period_end
    ? activeSubscription.current_period_end.toLocaleDateString('da-DK', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null

  return { data: { plan: org.plan, trialDaysLeft, hasSubscription, planExpiresAt } }
}

// ────────────────────────────────────────────────────────────────────────────
// createCheckoutSession — opret Stripe Checkout-session til abonnement
// ────────────────────────────────────────────────────────────────────────────

export async function createCheckoutSession(
  priceId: string
): Promise<ActionResult<{ url: string }>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const hasAccess = await canAccessModule(session.user.id, 'billing', session.user.organizationId)
  if (!hasAccess) return { error: 'Du har ikke adgang til fakturering' }

  const parsed = checkoutSchema.safeParse({ priceId })
  if (!parsed.success) return { error: 'Ugyldig pris-ID' }

  const stripe = getStripe()
  if (!stripe) return { error: 'Betaling er ikke konfigureret' }

  try {
    const org = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      include: { subscriptions: true },
    })

    if (!org) return { error: 'Organisation ikke fundet' }

    // Genbrug eksisterende Stripe-kunde hvis mulig
    const existingCustomerId = org.subscriptions[0]?.stripe_customer_id

    let customerId: string
    if (existingCustomerId) {
      customerId = existingCustomerId
    } else {
      const customer = await stripe.customers.create({
        name: org.name,
        metadata: { organization_id: org.id },
      })
      customerId = customer.id
    }

    // Bygger checkout-session params
    const trialEnd =
      org.plan_expires_at && org.plan_expires_at > new Date()
        ? Math.floor(org.plan_expires_at.getTime() / 1000)
        : undefined

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${BASE_URL}/billing?success=1`,
      cancel_url: `${BASE_URL}/billing?canceled=1`,
      subscription_data: {
        metadata: { organization_id: org.id },
        ...(trialEnd ? { trial_end: trialEnd } : {}),
      },
    })

    if (!checkoutSession.url) return { error: 'Checkout-session oprettet uden URL' }

    return { data: { url: checkoutSession.url } }
  } catch (err) {
    captureError(err, { namespace: 'actions:billing:createCheckoutSession' })
    return { error: 'Kunne ikke oprette betalingssession. Prøv igen.' }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// createPortalSession — åbn Stripe Customer Portal til abonnementsstyring
// ────────────────────────────────────────────────────────────────────────────

export async function createPortalSession(): Promise<ActionResult<{ url: string }>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const hasAccess = await canAccessModule(session.user.id, 'billing', session.user.organizationId)
  if (!hasAccess) return { error: 'Du har ikke adgang til fakturering' }

  const stripe = getStripe()
  if (!stripe) return { error: 'Betaling er ikke konfigureret' }

  try {
    const subscription = await prisma.subscription.findFirst({
      where: {
        organization_id: session.user.organizationId,
        status: { not: 'canceled' },
      },
    })

    if (!subscription?.stripe_customer_id) {
      return { error: 'Intet aktivt abonnement fundet' }
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${BASE_URL}/billing`,
    })

    return { data: { url: portalSession.url } }
  } catch (err) {
    captureError(err, { namespace: 'actions:billing:createPortalSession' })
    return { error: 'Kunne ikke åbne betalingsportal. Prøv igen.' }
  }
}
