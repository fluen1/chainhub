/**
 * Stripe webhook-validering og event-håndtering.
 *
 * KRITISK: Webhook URL SKAL have www-prefix:
 *   https://www.chainhub.dk/api/webhooks/stripe
 *   ALDRIG: https://chainhub.dk/api/webhooks/stripe
 *
 * KRITISK: STRIPE_WEBHOOK_SECRET trimmes altid for trailing whitespace/newlines.
 *   Trailing newlines giver stille fejl hvor signaturen aldrig valideres korrekt.
 */

import Stripe from 'stripe'
import { stripe } from './index'
import { prisma } from '@/lib/db'

/**
 * Hent og valider webhook secret — trimmer altid for at undgå trailing newline-fejl.
 */
function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim()
  if (!secret) {
    throw new Error('STRIPE_WEBHOOK_SECRET mangler i environment')
  }
  return secret
}

/**
 * Konstruér og verificér Stripe webhook event fra rå request body og signatur-header.
 * Kaster fejl hvis signaturen er ugyldig.
 */
export async function constructWebhookEvent(
  body: string,
  signature: string
): Promise<Stripe.Event> {
  const secret = getWebhookSecret()
  return stripe.webhooks.constructEvent(body, signature, secret)
}

/**
 * Håndtér indkomne Stripe webhook events.
 * Alle kritiske subscription-events synkroniseres til Subscription-modellen.
 */
export async function handleWebhookEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'customer.subscription.created':
      await handleSubscriptionCreated(event.data.object as Stripe.Subscription)
      break
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
      break
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
      break
    case 'invoice.payment_succeeded':
      await handlePaymentSucceeded(event.data.object as Stripe.Invoice)
      break
    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data.object as Stripe.Invoice)
      break
    default:
      // Ukendte events ignoreres stille
      console.info(`[Stripe Webhook] Ignorerer event: ${event.type}`)
  }
}

// ==================== EVENT HANDLERS ====================

async function handleSubscriptionCreated(
  subscription: Stripe.Subscription
): Promise<void> {
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id

  // Find organisation via stripe_customer_id
  const existingSubscription = await prisma.subscription.findFirst({
    where: { stripeCustomerId: customerId },
  })

  if (!existingSubscription) {
    console.error(
      `[Stripe Webhook] Ingen organisation fundet for customer: ${customerId}`
    )
    return
  }

  const plan = resolvePlanFromSubscription(subscription)
  const seatCount = resolveSeatCount(subscription)
  const status = normalizeSubscriptionStatus(subscription.status)

  await prisma.subscription.update({
    where: { stripeCustomerId: customerId },
    data: {
      stripeSubscriptionId: subscription.id,
      plan,
      seatCount,
      status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      trialEndsAt:
        subscription.trial_end != null
          ? new Date(subscription.trial_end * 1000)
          : null,
      updatedAt: new Date(),
    },
  })

  // Synkronisér plan til organisation
  await prisma.organization.update({
    where: { id: existingSubscription.organizationId },
    data: { plan },
  })
}

async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription
): Promise<void> {
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id

  const existing = await prisma.subscription.findFirst({
    where: { stripeCustomerId: customerId },
  })

  if (!existing) {
    console.error(
      `[Stripe Webhook] Ingen subscription fundet for customer: ${customerId}`
    )
    return
  }

  const plan = resolvePlanFromSubscription(subscription)
  const seatCount = resolveSeatCount(subscription)
  const status = normalizeSubscriptionStatus(subscription.status)

  await prisma.subscription.update({
    where: { stripeCustomerId: customerId },
    data: {
      stripeSubscriptionId: subscription.id,
      plan,
      seatCount,
      status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      trialEndsAt:
        subscription.trial_end != null
          ? new Date(subscription.trial_end * 1000)
          : null,
      updatedAt: new Date(),
    },
  })

  // Synkronisér plan til organisation
  await prisma.organization.update({
    where: { id: existing.organizationId },
    data: { plan },
  })
}

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<void> {
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id

  const existing = await prisma.subscription.findFirst({
    where: { stripeCustomerId: customerId },
  })

  if (!existing) {
    console.error(
      `[Stripe Webhook] Ingen subscription fundet for customer ved sletning: ${customerId}`
    )
    return
  }

  await prisma.subscription.update({
    where: { stripeCustomerId: customerId },
    data: {
      status: 'canceled',
      updatedAt: new Date(),
    },
  })

  // Sæt organisationen til trial (nedgradér)
  await prisma.organization.update({
    where: { id: existing.organizationId },
    data: { plan: 'trial' },
  })
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
  const customerId =
    typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id

  if (!customerId) return

  // Ved vellykket betaling: sæt status til active
  const existing = await prisma.subscription.findFirst({
    where: { stripeCustomerId: customerId },
  })

  if (!existing) return

  if (existing.status !== 'active') {
    await prisma.subscription.update({
      where: { stripeCustomerId: customerId },
      data: {
        status: 'active',
        updatedAt: new Date(),
      },
    })
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const customerId =
    typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id

  if (!customerId) return

  const existing = await prisma.subscription.findFirst({
    where: { stripeCustomerId: customerId },
  })

  if (!existing) return

  await prisma.subscription.update({
    where: { stripeCustomerId: customerId },
    data: {
      status: 'past_due',
      updatedAt: new Date(),
    },
  })
}

// ==================== HELPERS ====================

/**
 * Udled plan-navn fra Stripe subscription items (price ID → plan-navn).
 */
function resolvePlanFromSubscription(subscription: Stripe.Subscription): string {
  const priceId = subscription.items.data[0]?.price?.id ?? ''

  if (priceId === process.env.STRIPE_STARTER_PRICE_ID) return 'starter'
  if (priceId === process.env.STRIPE_BUSINESS_PRICE_ID) return 'business'
  if (priceId === process.env.STRIPE_ENTERPRISE_PRICE_ID) return 'enterprise'

  // Fallback: brug nickname fra Stripe eller 'starter'
  const nickname = subscription.items.data[0]?.price?.nickname?.toLowerCase() ?? ''
  if (nickname.includes('business')) return 'business'
  if (nickname.includes('enterprise')) return 'enterprise'

  return 'starter'
}

/**
 * Udled seat count fra subscription quantity (per-seat model).
 * Quantity = antal seats købt.
 */
function resolveSeatCount(subscription: Stripe.Subscription): number {
  return subscription.items.data[0]?.quantity ?? 1
}

/**
 * Normaliser Stripe subscription status til vores interne værdier.
 */
function normalizeSubscriptionStatus(stripeStatus: string): string {
  const statusMap: Record<string, string> = {
    active: 'active',
    trialing: 'trialing',
    past_due: 'past_due',
    canceled: 'canceled',
    incomplete: 'past_due',
    incomplete_expired: 'canceled',
    unpaid: 'past_due',
    paused: 'past_due',
  }
  return statusMap[stripeStatus] ?? 'past_due'
}