'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface SubscriptionStatusProps {
  subscription: {
    id: string
    plan: string
    status: string
    seatCount: number
    currentPeriodEnd: Date
    trialEndsAt: Date | null
  } | null
  activeUserCount: number
  organizationName: string
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Aktiv',
  trialing: 'Prøveperiode',
  past_due: 'Betaling forsinket',
  canceled: 'Annulleret',
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  trialing: 'bg-blue-100 text-blue-800',
  past_due: 'bg-red-100 text-red-800',
  canceled: 'bg-gray-100 text-gray-800',
}

const PLAN_LABELS: Record<string, string> = {
  trial: 'Prøveperiode',
  starter: 'Starter',
  business: 'Business',
  enterprise: 'Enterprise',
}

export function SubscriptionStatus({
  subscription,
  activeUserCount,
  organizationName,
}: SubscriptionStatusProps) {
  const [isLoadingPortal, setIsLoadingPortal] = useState(false)

  const handleOpenPortal = async () => {
    setIsLoadingPortal(true)
    try {
      const response = await fetch('/api/billing/portal', {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Portal kunne ikke åbnes')
      }

      const data = (await response.json()) as { url: string }
      window.location.href = data.url
    } catch {
      toast.error('Billing Portal kunne ikke åbnes — prøv igen eller kontakt support')
    } finally {
      setIsLoadingPortal(false)
    }
  }

  if (!subscription) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <svg
            className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div>
            <h3 className="font-medium text-amber-900">Intet aktivt abonnement</h3>
            <p className="mt-1 text-sm text-amber-700">
              Vælg en plan nedenfor for at komme i gang.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const trialDaysLeft =
    subscription.trialEndsAt != null
      ? Math.max(
          0,
          Math.ceil(
            (new Date(subscription.trialEndsAt).getTime() - Date.now()) /
              (1000 * 60 * 60 * 24)
          )
        )
      : null

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-medium text-gray-900">
              {PLAN_LABELS[subscription.plan] ?? subscription.plan}
            </h2>
            <span
              className={cn(
                'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                STATUS_COLORS[subscription.status] ?? 'bg-gray-100 text-gray-800'
              )}
            >
              {STATUS_LABELS[subscription.status] ?? subscription.status}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">{organizationName}</p>
        </div>

        {subscription.status !== 'canceled' && (
          <button
            onClick={handleOpenPortal}
            disabled={isLoadingPortal}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoadingPortal ? 'Åbner...' : 'Administrer abonnement'}
          </button>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gray-50 rounded-md p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Brugere
          </p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            {activeUserCount}
          </p>
          <p className="text-xs text-gray-500">af {subscription.seatCount} seats</p>
        </div>

        <div className="bg-gray-50 rounded-md p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Fornyelsesdato
          </p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {new Date(subscription.currentPeriodEnd).toLocaleDateString('da-DK', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>

        {trialDaysLeft !== null && (
          <div
            className={cn(
              'rounded-md p-4',
              trialDaysLeft > 3
                ? 'bg-blue-50'
                : trialDaysLeft > 0
                ? 'bg-amber-50'
                : 'bg-red-50'
            )}
          >
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Prøveperiode
            </p>
            <p
              className={cn(
                'mt-1 text-2xl font-semibold',
                trialDaysLeft > 3
                  ? 'text-blue-900'
                  : trialDaysLeft > 0
                  ? 'text-amber-900'
                  : 'text-red-900'
              )}
            >
              {trialDaysLeft} dage
            </p>
            <p className="text-xs text-gray-500">tilbage af prøveperioden</p>
          </div>
        )}

        {subscription.status === 'past_due' && (
          <div className="bg-red-50 rounded-md p-4 sm:col-span-3">
            <p className="text-sm font-medium text-red-800">
              ⚠️ Din betaling er forsinket — opdatér dine betalingsoplysninger for at
              fortsætte adgangen til ChainHub.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}