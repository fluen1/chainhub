/**
 * API Route: Opret Stripe Billing Portal Session
 * Returnerer portal URL til self-service abonnementsstyring.
 */

import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { createBillingPortalSession } from '@/lib/stripe/checkout'

export async function POST(request: NextRequest): Promise<Response> {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: 'Ikke autoriseret' }, { status: 401 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const returnUrl = `${appUrl}/settings/billing`

  try {
    const portalUrl = await createBillingPortalSession(
      session.user.organizationId,
      returnUrl
    )
    return Response.json({ url: portalUrl })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ukendt fejl'
    console.error('[Billing Portal] Fejl:', message)
    return Response.json(
      { error: 'Billing Portal kunne ikke åbnes — prøv igen' },
      { status: 500 }
    )
  }
}