/**
 * Afgør om en organisation skal gate-redirectes til /billing.
 * Ren funktion → unit-testbar uden at rendere server-komponenten.
 */
export function shouldGateBilling(input: {
  plan: string
  planExpiresAt: Date | null
  subStatus: string | null
}): boolean {
  const { plan, planExpiresAt, subStatus } = input

  const isExpiredTrial = plan === 'trial' && planExpiresAt != null && planExpiresAt < new Date()
  const isCanceled = plan === 'canceled'
  const isPastDue = plan !== 'canceled' && subStatus === 'past_due'

  return isExpiredTrial || isCanceled || isPastDue
}
