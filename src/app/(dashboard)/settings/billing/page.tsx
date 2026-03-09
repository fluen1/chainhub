import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { BillingOverview } from '@/components/billing/BillingOverview'
import { PlanCards } from '@/components/billing/PlanCards'
import { SubscriptionStatus } from '@/components/billing/SubscriptionStatus'

export const metadata = {
  title: 'Fakturering — ChainHub',
}

export default async function BillingPage() {
  const session = await auth()
  if (!session?.user) {
    redirect('/login')
  }

  const [subscription, activeUserCount, organization] = await Promise.all([
    prisma.subscription.findUnique({
      where: { organizationId: session.user.organizationId },
    }),
    prisma.user.count({
      where: {
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    }),
    prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { name: true, plan: true },
    }),
  ])

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Fakturering</h1>
        <p className="mt-1 text-sm text-gray-500">
          Administrer dit abonnement og dine betalingsoplysninger
        </p>
      </div>

      {/* Nuværende abonnementsstatus */}
      <SubscriptionStatus
        subscription={subscription}
        activeUserCount={activeUserCount}
        organizationName={organization?.name ?? ''}
      />

      {/* Plan-oversigt og upgrade */}
      <div>
        <h2 className="text-lg font-medium text-gray-900 mb-4">
          Vælg en plan
        </h2>
        <PlanCards
          currentPlan={subscription?.plan ?? organization?.plan ?? 'trial'}
          activeUserCount={activeUserCount}
        />
      </div>

      {/* Faktureringsdetaljer */}
      {subscription && subscription.status !== 'canceled' && (
        <BillingOverview subscription={subscription} />
      )}
    </div>
  )
}