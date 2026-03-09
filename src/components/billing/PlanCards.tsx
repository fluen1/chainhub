'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { PLAN_FEATURES, PLAN_PRICES } from '@/lib/stripe/index'

interface PlanCardsProps {
  currentPlan: string
  activeUserCount: number
}

const PLANS = [
  {
    id: 'starter' as const,
    name: 'Starter',
    description: 'Til mindre teams og enkeltadvokater',
    maxSeats: 5,
  },
  {
    id: 'business' as const,
    name: 'Business',
    description: 'Til mellemstore advokatfirmaer',
    maxSeats: 25,
    popular: true,
  },
  {
    id: 'enterprise' as const,
    name: 'Enterprise',
    description: 'Til store kæder og koncerner',
    maxSeats: undefined,
  },
]

export function PlanCards({ currentPlan, activeUserCount }: PlanCardsProps) {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)

  const handleUpgrade = async (planId: 'starter' | 'business' | 'enterprise') => {
    setLoadingPlan(planId)

    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: planId,
          seatCount: Math.max(activeUserCount, 1),
        }),
      })

      if (!response.ok) {
        throw new Error('Checkout kunne ikke oprettes')
      }

      const data = (await response.json()) as { url: string }
      window.location.href = data.url
    } catch {
      toast.error(
        'Checkout kunne ikke oprettes — prøv igen eller kontakt support'
      )
    } finally {
      setLoadingPlan(null)
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {PLANS.map((plan) => {
        const isCurrentPlan = currentPlan === plan.id
        const pricePerSeat = PLAN_PRICES[plan.id] ?? 0
        const totalMonthly = pricePerSeat * Math.max(activeUserCount, 1)
        const features = PLAN_FEATURES[plan.id] ?? []
        const isLoading = loadingPlan === plan.id

        return (
          <div
            key={plan.id}
            className={cn(
              'relative bg-white border rounded-xl p-6 flex flex-col',
              plan.popular
                ? 'border-indigo-500 ring-2 ring-indigo-500'
                : 'border-gray-200',
              isCurrentPlan && 'bg-gray-50'
            )}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-indigo-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                  Mest populær
                </span>
              </div>
            )}

            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
              <p className="mt-1 text-sm text-gray-500">{plan.description}</p>

              <div className="mt-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-gray-900">
                    {pricePerSeat.toLocaleString('da-DK')} kr.
                  </span>
                  <span className="text-sm text-gray-500">/ bruger / md.</span>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Ca.{' '}
                  {totalMonthly.toLocaleString('da-DK')} kr./md. for{' '}
                  {Math.max(activeUserCount, 1)}{' '}
                  {Math.max(activeUserCount, 1) === 1 ? 'bruger' : 'brugere'}
                </p>
              </div>

              <ul className="mt-6 space-y-2">
                {features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <svg
                      className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span className="text-sm text-gray-600">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-6">
              {isCurrentPlan ? (
                <div className="w-full text-center py-2 text-sm font-medium text-gray-500 bg-gray-100 rounded-lg">
                  Nuværende plan
                </div>
              ) : (
                <button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={isLoading || loadingPlan !== null}
                  className={cn(
                    'w-full py-2.5 px-4 rounded-lg text-sm font-medium transition-colors',
                    plan.popular
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-400'
                      : 'bg-white text-gray-900 border border-gray-300 hover:bg-gray-50 disabled:opacity-50',
                    'disabled:cursor-not-allowed'
                  )}
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg
                        className="animate-spin w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 12 0 12 12h4z"
                        />
                      </svg>
                      Åbner checkout...
                    </span>
                  ) : (
                    `Opgrader til ${plan.name}`
                  )}
                </button>
              )}
            </div>

            <p className="mt-3 text-center text-xs text-gray-400">
              14 dages gratis prøveperiode — ingen binding
            </p>
          </div>
        )
      })}
    </div>
  )
}