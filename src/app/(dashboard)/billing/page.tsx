import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { BillingClient } from './billing-client'

// ────────────────────────────────────────────────────────────────────────────
// /billing — abonnementsstyring
// ────────────────────────────────────────────────────────────────────────────

export default async function BillingPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    include: { subscriptions: true },
  })

  if (!org) redirect('/dashboard')

  // Beregn dage tilbage af prøveperiode
  let trialDaysLeft: number | null = null
  if (org.plan === 'trial' && org.plan_expires_at) {
    const now = new Date()
    const diff = org.plan_expires_at.getTime() - now.getTime()
    trialDaysLeft = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  }

  const hasSubscription = org.subscriptions.length > 0

  // Fornyelsesdato fra aktiv subscription
  const activeSubscription = org.subscriptions[0]
  const planExpiresAt = activeSubscription?.current_period_end
    ? activeSubscription.current_period_end.toLocaleDateString('da-DK', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null

  return (
    <div className="mx-auto max-w-3xl px-3 py-4">
      <BillingClient
        plan={org.plan}
        trialDaysLeft={trialDaysLeft}
        hasSubscription={hasSubscription}
        planExpiresAt={planExpiresAt}
      />
    </div>
  )
}
