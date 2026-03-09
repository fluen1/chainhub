/**
 * Billing guard helpers.
 * Bruges til at tjekke om en organisation har en aktiv subscription.
 */

import { prisma } from '@/lib/db'

export interface SubscriptionState {
  isActive: boolean
  isTrialing: boolean
  isPastDue: boolean
  isCanceled: boolean
  plan: string
  trialEndsAt: Date | null
  seatCount: number
}

/**
 * Hent subscription state for en organisation.
 * Returnerer default trial-state hvis ingen subscription findes.
 */
export async function getSubscriptionState(
  organizationId: string
): Promise<SubscriptionState> {
  const subscription = await prisma.subscription.findUnique({
    where: { organizationId },
    select: {
      status: true,
      plan: true,
      trialEndsAt: true,
      seatCount: true,
    },
  })

  if (!subscription) {
    return {
      isActive: false,
      isTrialing: true,
      isPastDue: false,
      isCanceled: false,
      plan: 'trial',
      trialEndsAt: null,
      seatCount: 1,
    }
  }

  return {
    isActive: subscription.status === 'active',
    isTrialing: subscription.status === 'trialing',
    isPastDue: subscription.status === 'past_due',
    isCanceled: subscription.status === 'canceled',
    plan: subscription.plan,
    trialEndsAt: subscription.trialEndsAt,
    seatCount: subscription.seatCount,
  }
}

/**
 * Tjek om en organisation har adgang (aktiv eller trialing).
 * Bruges til feature-gates.
 */
export async function hasActiveAccess(organizationId: string): Promise<boolean> {
  const state = await getSubscriptionState(organizationId)

  // Trial er aktiv adgang
  if (state.isTrialing) {
    // Tjek om trial faktisk er udløbet
    if (state.trialEndsAt != null && state.trialEndsAt < new Date()) {
      return false
    }
    return true
  }

  return state.isActive
}

/**
 * Tjek om en organisation kan tilføje flere brugere (seat limit).
 */
export async function canAddMoreUsers(organizationId: string): Promise<boolean> {
  const [state, currentUserCount] = await Promise.all([
    getSubscriptionState(organizationId),
    prisma.user.count({
      where: { organizationId, deletedAt: null },
    }),
  ])

  // Trial og enterprise: ingen hård grænse
  if (state.plan === 'trial' || state.plan === 'enterprise') {
    return true
  }

  return currentUserCount < state.seatCount
}