/**
 * API Route: Opret Stripe Checkout Session
 * Returnerer checkout URL til redirect.
 */

import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { createCheckoutSession } from '@/lib/stripe/checkout'
import { z } from 'zod'

const checkoutSchema = z.object({
  plan: z.enum(['starter', 'business', 'enterprise']),
  seatCount: z.number().int().min(1).max(10000),
})

export async function POST(request: NextRequest): Promise<Response> {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: 'Ikke autoriseret' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Ugyldigt JSON i request body' }, { status: 400 })
  }

  const parsed = checkoutSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: 'Ugyldigt input', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { plan, seatCount } = parsed.data
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  try {
    const result = await createCheckoutSession({
      organizationId: session.user.organizationId,
      plan,
      seatCount,
      userEmail: session.user.email ?? '',
      successUrl: `${appUrl}/settings/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${appUrl}/settings/billing?canceled=true`,
    })

    return Response.json({ url: result.url, sessionId: result.sessionId })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ukendt fejl'
    console.error('[Billing Checkout] Fejl:', message)
    return Response.json(
      { error: 'Checkout kunne ikke oprettes — prøv igen' },
      { status: 500 }
    )
  }
}