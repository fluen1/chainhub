'use client'

interface BillingOverviewProps {
  subscription: {
    id: string
    plan: string
    status: string
    seatCount: number
    currentPeriodStart: Date
    currentPeriodEnd: Date
    trialEndsAt: Date | null
    stripeCustomerId: string
    stripeSubscriptionId: string
  }
}

const PLAN_LABELS: Record<string, string> = {
  trial: 'Prøveperiode',
  starter: 'Starter',
  business: 'Business',
  enterprise: 'Enterprise',
}

export function BillingOverview({ subscription }: BillingOverviewProps) {
  const formatDate = (date: Date) =>
    new Date(date).toLocaleDateString('da-DK', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h2 className="text-lg font-medium text-gray-900 mb-4">
        Faktureringsdetaljer
      </h2>

      <dl className="divide-y divide-gray-100">
        <div className="py-3 flex justify-between text-sm">
          <dt className="font-medium text-gray-500">Plan</dt>
          <dd className="text-gray-900">
            {PLAN_LABELS[subscription.plan] ?? subscription.plan}
          </dd>
        </div>

        <div className="py-3 flex justify-between text-sm">
          <dt className="font-medium text-gray-500">Seats (brugere)</dt>
          <dd className="text-gray-900">{subscription.seatCount}</dd>
        </div>

        <div className="py-3 flex justify-between text-sm">
          <dt className="font-medium text-gray-500">Nuværende periode</dt>
          <dd className="text-gray-900">
            {formatDate(subscription.currentPeriodStart)} –{' '}
            {formatDate(subscription.currentPeriodEnd)}
          </dd>
        </div>

        {subscription.trialEndsAt && (
          <div className="py-3 flex justify-between text-sm">
            <dt className="font-medium text-gray-500">Prøveperiode slutter</dt>
            <dd className="text-gray-900">
              {formatDate(subscription.trialEndsAt)}
            </dd>
          </div>
        )}

        <div className="py-3 flex justify-between text-sm">
          <dt className="font-medium text-gray-500">Fakturering</dt>
          <dd className="text-gray-900">Månedlig — pr. bruger</dd>
        </div>
      </dl>

      <div className="mt-6 p-4 bg-gray-50 rounded-md">
        <p className="text-xs text-gray-500">
          Dine betalingsoplysninger, fakturahistorik og abonnementsændringer
          administreres sikkert via Stripe. Klik på &quot;Administrer abonnement&quot;
          ovenfor for at åbne Billing Portal.
        </p>
      </div>
    </div>
  )
}