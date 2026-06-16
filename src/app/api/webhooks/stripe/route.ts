import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { planFromPrice } from '@/lib/billing/plan-from-price'
import { prisma } from '@/lib/db'
import { env } from '@/lib/env'
import { captureError } from '@/lib/logger'
import { getStripe } from '@/lib/stripe'

// ────────────────────────────────────────────────────────────────────────────
// Hjælper — udtræk kunde-ID uanset om Stripe returnerer string eller objekt
// ────────────────────────────────────────────────────────────────────────────

function resolveCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined
): string | null {
  if (!customer) return null
  return typeof customer === 'string' ? customer : customer.id
}

// ────────────────────────────────────────────────────────────────────────────
// Hjælper — udtræk periode-start/slut fra SubscriptionItem (Stripe API v22+)
// ────────────────────────────────────────────────────────────────────────────

function resolvePeriod(item: Stripe.SubscriptionItem | undefined): {
  periodStart: number
  periodEnd: number
} {
  const now = Math.floor(Date.now() / 1000)
  return {
    periodStart: item?.current_period_start ?? now,
    periodEnd: item?.current_period_end ?? now,
  }
}

export async function POST(req: NextRequest) {
  const stripe = getStripe()
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe ikke konfigureret' }, { status: 500 })
  }

  const webhookSecret = env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Webhook-hemmelighed mangler' }, { status: 500 })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Manglende Stripe-signatur' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    const body = await req.text()
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    captureError(err, { namespace: 'api:webhooks:stripe', extra: { step: 'constructEvent' } })
    return NextResponse.json({ error: 'Ugyldig webhook-signatur' }, { status: 400 })
  }

  // Idempotens (læse-tjek): er eventet allerede behandlet? → 200 tidligt.
  // Bemærk: vi markerer FØRST som behandlet EFTER succesfuld behandling (nederst),
  // så en fejl undervejs ikke permanent springer eventet over ved Stripes retry.
  const alreadyProcessed = await prisma.processedStripeEvent.findUnique({
    where: { event_id: event.id },
  })
  if (alreadyProcessed) {
    return NextResponse.json({ received: true, duplicate: true })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== 'subscription') break

        const customerId = resolveCustomerId(session.customer)
        const subscriptionId =
          typeof session.subscription === 'string' ? session.subscription : session.subscription?.id

        if (!customerId || !subscriptionId) break

        // Hent Stripe-abonnement for at få periode-data og metadata
        const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId)

        // Find organisation: foretruk via eksisterende DB-post, fallback til subscription_data.metadata
        const existingSub = await prisma.subscription.findFirst({
          where: { stripe_customer_id: customerId },
        })

        const orgId =
          existingSub?.organization_id ??
          (stripeSubscription.metadata?.organization_id as string | undefined)

        if (!orgId) break

        const firstItem = stripeSubscription.items.data[0]
        const plan = planFromPrice({
          lookupKey: firstItem?.price.lookup_key,
          priceId: firstItem?.price.id,
        })
        const { periodStart, periodEnd } = resolvePeriod(firstItem)

        await prisma.subscription.upsert({
          where: { organization_id: orgId },
          create: {
            organization_id: orgId,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            plan: plan ?? 'trial',
            status: stripeSubscription.status,
            seat_count: 1,
            current_period_start: new Date(periodStart * 1000),
            current_period_end: new Date(periodEnd * 1000),
            trial_ends_at: stripeSubscription.trial_end
              ? new Date(stripeSubscription.trial_end * 1000)
              : null,
          },
          update: {
            stripe_subscription_id: subscriptionId,
            ...(plan ? { plan } : {}),
            status: stripeSubscription.status,
            current_period_start: new Date(periodStart * 1000),
            current_period_end: new Date(periodEnd * 1000),
            trial_ends_at: stripeSubscription.trial_end
              ? new Date(stripeSubscription.trial_end * 1000)
              : null,
          },
        })

        if (plan) {
          await prisma.organization.update({
            where: { id: orgId },
            data: { plan },
          })
        } else {
          captureError(new Error('Ukendt Stripe-price ved checkout — plan ikke opdateret'), {
            namespace: 'api:webhooks:stripe',
            extra: { step: 'checkout.session.completed', orgId, priceId: firstItem?.price.id },
          })
        }

        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const customerId = resolveCustomerId(sub.customer)
        if (!customerId) break

        const firstItem = sub.items.data[0]
        const { periodStart, periodEnd } = resolvePeriod(firstItem)

        await prisma.subscription.updateMany({
          where: { stripe_customer_id: customerId },
          data: {
            status: sub.status,
            current_period_start: new Date(periodStart * 1000),
            current_period_end: new Date(periodEnd * 1000),
            trial_ends_at: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
          },
        })

        // Opdater plan på organisation hvis vi kan mappe price → plan
        const plan = planFromPrice({
          lookupKey: firstItem?.price.lookup_key,
          priceId: firstItem?.price.id,
        })
        if (plan) {
          const existing = await prisma.subscription.findFirst({
            where: { stripe_customer_id: customerId },
          })
          if (existing) {
            await prisma.organization.update({
              where: { id: existing.organization_id },
              data: { plan },
            })
          }
        }

        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const customerId = resolveCustomerId(sub.customer)
        if (!customerId) break

        const existing = await prisma.subscription.findFirst({
          where: { stripe_customer_id: customerId },
        })

        await prisma.subscription.updateMany({
          where: { stripe_customer_id: customerId },
          data: { status: 'canceled' },
        })

        if (existing) {
          await prisma.organization.update({
            where: { id: existing.organization_id },
            data: { plan: 'canceled' },
          })
        }

        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = resolveCustomerId(invoice.customer)
        if (!customerId) break

        // Ryd past_due → active. Rør IKKE canceled-abonnementer.
        await prisma.subscription.updateMany({
          where: {
            stripe_customer_id: customerId,
            status: { not: 'canceled' },
          },
          data: { status: 'active' },
        })

        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = resolveCustomerId(invoice.customer)
        if (!customerId) break

        await prisma.subscription.updateMany({
          where: { stripe_customer_id: customerId },
          data: { status: 'past_due' },
        })

        break
      }

      default:
        // Ukendte events ignoreres stille
        break
    }
  } catch (err) {
    captureError(err, {
      namespace: 'api:webhooks:stripe',
      extra: { eventType: event.type, eventId: event.id },
    })
    // Eventet markeres BEVIDST IKKE som behandlet her → Stripes retry kører rent igen.
    return NextResponse.json({ error: 'Intern fejl ved event-behandling' }, { status: 500 })
  }

  // Markér som behandlet FØRST efter succesfuld behandling (undgår fail-open state drift).
  // Handlerne er idempotente (upsert/updateMany), så en sjælden dobbelt-levering er harmløs.
  // P2002 = en samtidig levering nåede at indsætte rækken → ignorér.
  try {
    await prisma.processedStripeEvent.create({
      data: { event_id: event.id, event_type: event.type },
    })
  } catch (err) {
    const code = (err as { code?: string } | null)?.code
    if (code !== 'P2002') {
      captureError(err, {
        namespace: 'api:webhooks:stripe',
        extra: { step: 'idempotency-mark', eventId: event.id },
      })
    }
  }

  return NextResponse.json({ received: true })
}
