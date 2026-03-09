/**
 * Stripe Webhook Endpoint
 *
 * KRITISK: Webhook URL SKAL konfigureres med www-prefix i Stripe Dashboard:
 *   KORREKT:  https://www.chainhub.dk/api/webhooks/stripe
 *   FORKERT:  https://chainhub.dk/api/webhooks/stripe
 *
 * Brug ALDRIG request.json() — Stripe signaturen kræver rå request body.
 * STRIPE_WEBHOOK_SECRET trimmes altid for trailing newlines (giver stille fejl).
 *
 * Håndterede events:
 *   - customer.subscription.created
 *   - customer.subscription.updated
 *   - customer.subscription.deleted
 *   - invoice.payment_succeeded
 *   - invoice.payment_failed
 */

import { NextRequest } from 'next/server'
import { constructWebhookEvent, handleWebhookEvent } from '@/lib/stripe/webhook'

export const runtime = 'nodejs'

// Stripe kræver rå request body — ALDRIG brug request.json()
export async function POST(request: NextRequest): Promise<Response> {
  let body: string

  try {
    body = await request.text()
  } catch {
    return Response.json(
      { error: 'Kunne ikke læse request body' },
      { status: 400 }
    )
  }

  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return Response.json(
      { error: 'Manglende stripe-signature header' },
      { status: 400 }
    )
  }

  // Konstruér og verificér event — validerer STRIPE_WEBHOOK_SECRET med trim()
  let event
  try {
    event = await constructWebhookEvent(body, signature)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ukendt fejl'
    console.error(`[Stripe Webhook] Signatur-validering fejlede: ${message}`)
    return Response.json(
      { error: `Webhook signatur ugyldig: ${message}` },
      { status: 400 }
    )
  }

  // Håndtér event asynkront
  try {
    await handleWebhookEvent(event)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ukendt fejl'
    console.error(`[Stripe Webhook] Fejl ved håndtering af ${event.type}: ${message}`)
    // Returnér 200 til Stripe for at undgå gentagede forsøg ved interne fejl
    // Stripe vil ellers prøve igen, hvilket kan føre til duplikerede opdateringer
    return Response.json(
      { received: true, warning: 'Event modtaget men håndtering fejlede' },
      { status: 200 }
    )
  }

  return Response.json({ received: true }, { status: 200 })
}