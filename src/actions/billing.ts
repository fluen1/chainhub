'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getStripe } from '@/lib/stripe'
import { captureError } from '@/lib/logger'
import type { ActionResult } from '@/types/actions'

const BASE_URL = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'

// ────────────────────────────────────────────────────────────────────────────
// createCheckoutSession — opret Stripe Checkout-session til abonnement
// ────────────────────────────────────────────────────────────────────────────

export async function createCheckoutSession(
  priceId: string
): Promise<ActionResult<{ url: string }>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

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
    const checkoutParams: Parameters<typeof stripe.checkout.sessions.create>[0] = {
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${BASE_URL}/settings/billing?success=1`,
      cancel_url: `${BASE_URL}/settings/billing?canceled=1`,
      subscription_data: {},
    }

    // Anvend trial_end hvis org har en eksisterende plan_expires_at
    if (org.plan_expires_at && org.plan_expires_at > new Date()) {
      checkoutParams.subscription_data = {
        trial_end: Math.floor(org.plan_expires_at.getTime() / 1000),
      }
    }

    const checkoutSession = await stripe.checkout.sessions.create(checkoutParams)

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

  const stripe = getStripe()
  if (!stripe) return { error: 'Betaling er ikke konfigureret' }

  try {
    const subscription = await prisma.subscription.findFirst({
      where: { organization_id: session.user.organizationId },
    })

    if (!subscription?.stripe_customer_id) {
      return { error: 'Intet aktivt abonnement fundet' }
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${BASE_URL}/settings/billing`,
    })

    return { data: { url: portalSession.url } }
  } catch (err) {
    captureError(err, { namespace: 'actions:billing:createPortalSession' })
    return { error: 'Kunne ikke åbne betalingsportal. Prøv igen.' }
  }
}
