import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getStripe } from '@/lib/stripe'
import { captureError } from '@/lib/logger'
import type Stripe from 'stripe'

// Next.js skal læse raw body — slå body-parsing fra
export const config = { api: { bodyParser: false } }

export async function POST(req: NextRequest) {
  const stripe = getStripe()
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe ikke konfigureret' }, { status: 500 })
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
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

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== 'subscription') break

        const customerId =
          typeof session.customer === 'string' ? session.customer : session.customer?.id
        const subscriptionId =
          typeof session.subscription === 'string' ? session.subscription : session.subscription?.id

        if (!customerId || !subscriptionId) break

        // Hent Stripe-abonnement for at få periode-data
        const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId)

        // Find organisation via Stripe-kunde-ID
        const existingSub = await prisma.subscription.findFirst({
          where: { stripe_customer_id: customerId },
        })

        const orgId =
          existingSub?.organization_id ??
          (stripeSubscription.metadata?.organization_id as string | undefined)

        if (!orgId) break

        const plan = stripeSubscription.items.data[0]?.price.lookup_key ?? 'standard'

        // I Stripe 22 ligger current_period_start/end på SubscriptionItem, ikke Subscription
        const firstItem = stripeSubscription.items.data[0]
        const periodStart = firstItem?.current_period_start ?? Math.floor(Date.now() / 1000)
        const periodEnd = firstItem?.current_period_end ?? Math.floor(Date.now() / 1000)

        await prisma.subscription.upsert({
          where: { organization_id: orgId },
          create: {
            organization_id: orgId,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            plan,
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
            plan,
            status: stripeSubscription.status,
            current_period_start: new Date(periodStart * 1000),
            current_period_end: new Date(periodEnd * 1000),
            trial_ends_at: stripeSubscription.trial_end
              ? new Date(stripeSubscription.trial_end * 1000)
              : null,
          },
        })

        await prisma.organization.update({
          where: { id: orgId },
          data: { plan },
        })

        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id

        // I Stripe 22 ligger current_period_start/end på SubscriptionItem, ikke Subscription
        const firstItem = sub.items.data[0]
        const periodStart = firstItem?.current_period_start ?? Math.floor(Date.now() / 1000)
        const periodEnd = firstItem?.current_period_end ?? Math.floor(Date.now() / 1000)

        await prisma.subscription.updateMany({
          where: { stripe_customer_id: customerId },
          data: {
            status: sub.status,
            current_period_start: new Date(periodStart * 1000),
            current_period_end: new Date(periodEnd * 1000),
            trial_ends_at: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
          },
        })

        // Opdater plan på organisation hvis lookup_key er tilgængeligt
        const plan = sub.items.data[0]?.price.lookup_key
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
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id

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

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId =
          typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id

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
    return NextResponse.json({ error: 'Intern fejl ved event-behandling' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
