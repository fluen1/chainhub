'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { syncSeatCount } from '@/lib/stripe/checkout'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'

type ActionResult<T> = { data: T; error?: never } | { error: string; data?: never }

// ==================== QUERIES ====================

/**
 * Hent nuværende subscription for den autentificerede organisations organisation.
 */
export async function getSubscription() {
  const session = await auth()
  if (!session?.user) {
    return { error: 'Ikke autoriseret' }
  }

  const subscription = await prisma.subscription.findUnique({
    where: { organizationId: session.user.organizationId },
  })

  return { data: subscription }
}

/**
 * Hent antal aktive brugere i organisationen (bruges til seat count).
 */
export async function getActiveSeatCount(): Promise<ActionResult<number>> {
  const session = await auth()
  if (!session?.user) {
    return { error: 'Ikke autoriseret' }
  }

  const count = await prisma.user.count({
    where: {
      organizationId: session.user.organizationId,
      deletedAt: null,
    },
  })

  return { data: count }
}

// ==================== MUTATIONS ====================

/**
 * Opret Checkout Session URL via server action.
 * Returnerer checkout URL til client-side redirect.
 */
const createCheckoutSchema = z.object({
  plan: z.enum(['starter', 'business', 'enterprise']),
  seatCount: z.number().int().min(1),
})

export async function createCheckoutUrl(
  input: z.infer<typeof createCheckoutSchema>
): Promise<ActionResult<{ url: string }>> {
  const session = await auth()
  if (!session?.user) {
    return { error: 'Ikke autoriseret' }
  }

  const parsed = createCheckoutSchema.safeParse(input)
  if (!parsed.success) {
    return { error: 'Ugyldigt input' }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  try {
    // Kald vores API route (server action kan ikke redirecte til Stripe)
    const response = await fetch(`${appUrl}/api/billing/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
    })

    if (!response.ok) {
      throw new Error('Checkout API fejlede')
    }

    const result = (await response.json()) as { url: string }
    return { data: { url: result.url } }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ukendt fejl'
    console.error('[billing.ts] createCheckoutUrl fejl:', message)
    return { error: 'Checkout kunne ikke oprettes — prøv igen' }
  }
}

/**
 * Synkronisér seat count med antal aktive brugere i organisationen.
 * Kaldes efter brugeroprettelse eller -sletning.
 */
export async function syncOrganizationSeatCount(): Promise<ActionResult<{ seatCount: number }>> {
  const session = await auth()
  if (!session?.user) {
    return { error: 'Ikke autoriseret' }
  }

  try {
    await syncSeatCount(session.user.organizationId)

    const updated = await prisma.subscription.findUnique({
      where: { organizationId: session.user.organizationId },
      select: { seatCount: true },
    })

    revalidatePath('/settings/billing')
    return { data: { seatCount: updated?.seatCount ?? 1 } }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ukendt fejl'
    console.error('[billing.ts] syncOrganizationSeatCount fejl:', message)
    return { error: 'Seat count kunne ikke synkroniseres — prøv igen' }
  }
}

/**
 * Initialiser en trial subscription for en ny organisation.
 * Kaldes ved organisation-oprettelse.
 */
export async function initializeTrialSubscription(
  organizationId: string,
  stripeCustomerId: string
): Promise<ActionResult<{ subscriptionId: string }>> {
  const trialEndsAt = new Date()
  trialEndsAt.setDate(trialEndsAt.getDate() + 14)

  try {
    const subscription = await prisma.subscription.create({
      data: {
        organizationId,
        stripeCustomerId,
        stripeSubscriptionId: `trial_${organizationId}`,
        plan: 'trial',
        seatCount: 1,
        status: 'trialing',
        currentPeriodStart: new Date(),
        currentPeriodEnd: trialEndsAt,
        trialEndsAt,
      },
    })

    return { data: { subscriptionId: subscription.id } }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ukendt fejl'
    console.error('[billing.ts] initializeTrialSubscription fejl:', message)
    return { error: 'Trial kunne ikke initialiseres' }
  }
}