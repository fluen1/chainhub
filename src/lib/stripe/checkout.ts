/**
 * Stripe Checkout helpers — opret Checkout Session til per-seat subscription.
 *
 * Per-seat model:
 *   - Pris pr. bruger pr. måned (quantity = antal aktive brugere)
 *   - Trial: 14 dage gratis
 *   - Efter trial: kræv betalingsmetode
 */

import { stripe, TRIAL_PERIOD_DAYS, STRIPE_PRICE_IDS, type PlanType } from './index'
import { prisma } from '@/lib/db'

interface CreateCheckoutSessionParams {
  organizationId: string
  plan: PlanType
  seatCount: number
  userEmail: string
  successUrl: string
  cancelUrl: string
}

interface CreateCheckoutSessionResult {
  url: string
  sessionId: string
}

/**
 * Opret eller find Stripe Customer for en organisation.
 */
export async function getOrCreateStripeCustomer(
  organizationId: string,
  email: string,
  organizationName: string
): Promise<string> {
  // Check om vi allerede har en customer
  const existing = await prisma.subscription.findUnique({
    where: { organizationId },
    select: { stripeCustomerId: true },
  })

  if (existing?.stripeCustomerId) {
    return existing.stripeCustomerId
  }

  // Opret ny Stripe customer
  const customer = await stripe.customers.create({
    email,
    name: organizationName,
    metadata: {
      organizationId,
    },
  })

  return customer.id
}

/**
 * Opret Stripe Checkout Session til per-seat subscription med 14 dages trial.
 */
export async function createCheckoutSession(
  params: CreateCheckoutSessionParams
): Promise<CreateCheckoutSessionResult> {
  const { organizationId, plan, seatCount, userEmail, successUrl, cancelUrl } =
    params

  const priceId = STRIPE_PRICE_IDS[plan]
  if (!priceId) {
    throw new Error(`Ugyldig plan eller manglende pris-ID for plan: ${plan}`)
  }

  // Find organisation
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true },
  })

  if (!organization) {
    throw new Error(`Organisation ikke fundet: ${organizationId}`)
  }

  // Hent eller opret Stripe Customer
  const stripeCustomerId = await getOrCreateStripeCustomer(
    organizationId,
    userEmail,
    organization.name
  )

  // Opret Checkout Session
  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: seatCount,
      },
    ],
    subscription_data: {
      trial_period_days: TRIAL_PERIOD_DAYS,
      metadata: {
        organizationId,
        plan,
      },
    },
    metadata: {
      organizationId,
      plan,
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
    customer_update: {
      address: 'auto',
    },
  })

  if (!session.url) {
    throw new Error('Stripe Checkout Session returnerede ingen URL')
  }

  return {
    url: session.url,
    sessionId: session.id,
  }
}

/**
 * Opret Stripe Billing Portal Session — til selvbetjening af abonnement.
 */
export async function createBillingPortalSession(
  organizationId: string,
  returnUrl: string
): Promise<string> {
  const subscription = await prisma.subscription.findUnique({
    where: { organizationId },
    select: { stripeCustomerId: true },
  })

  if (!subscription?.stripeCustomerId) {
    throw new Error('Ingen Stripe customer fundet for organisation')
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: returnUrl,
  })

  return session.url
}

/**
 * Synkronisér seat count til Stripe — kaldes når aktive brugere ændres.
 * Opdaterer subscription quantity til antal aktive brugere.
 */
export async function syncSeatCount(organizationId: string): Promise<void> {
  const [subscription, activeUserCount] = await Promise.all([
    prisma.subscription.findUnique({
      where: { organizationId },
      select: { stripeSubscriptionId: true, seatCount: true },
    }),
    prisma.user.count({
      where: {
        organizationId,
        deletedAt: null,
      },
    }),
  ])

  if (!subscription?.stripeSubscriptionId) {
    // Ingen aktiv Stripe subscription — intet at synkronisere
    return
  }

  // Kun opdatér hvis seat count faktisk har ændret sig
  if (subscription.seatCount === activeUserCount) {
    return
  }

  // Hent eksisterende Stripe subscription for at finde subscription item ID
  const stripeSubscription = await stripe.subscriptions.retrieve(
    subscription.stripeSubscriptionId
  )

  const subscriptionItemId = stripeSubscription.items.data[0]?.id
  if (!subscriptionItemId) {
    throw new Error('Ingen subscription item fundet i Stripe')
  }

  // Opdatér quantity i Stripe
  await stripe.subscriptionItems.update(subscriptionItemId, {
    quantity: Math.max(activeUserCount, 1), // Minimum 1 seat
  })

  // Opdatér lokalt
  await prisma.subscription.update({
    where: { organizationId },
    data: {
      seatCount: Math.max(activeUserCount, 1),
      updatedAt: new Date(),
    },
  })
}