'use client'

import { useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface TrialBannerProps {
  trialEndsAt: Date
  plan: string
}

export function TrialBanner({ trialEndsAt, plan }: TrialBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed || plan !== 'trial') return null

  const daysLeft = Math.max(
    0,
    Math.ceil(
      (new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )
  )

  const isUrgent = daysLeft <= 3

  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 py-3 text-sm',
        isUrgent
          ? 'bg-red-600 text-white'
          : 'bg-indigo-600 text-white'
      )}
    >
      <div className="flex items-center gap-2">
        <svg
          className="w-4 h-4 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>
          {daysLeft > 0 ? (
            <>
              Din gratis prøveperiode udløber om{' '}
              <strong>
                {daysLeft} {daysLeft === 1 ? 'dag' : 'dage'}
              </strong>
              . Opgrader for at beholde adgang til alle funktioner.
            </>
          ) : (
            <>
              Din prøveperiode er udløbet. Opgrader nu for at gendanne adgang.
            </>
          )}
        </span>
      </div>

      <div className="flex items-center gap-3 ml-4">
        <Link
          href="/settings/billing"
          className={cn(
            'flex-shrink-0 px-3 py-1 rounded text-xs font-semibold transition-colors',
            isUrgent
              ? 'bg-white text-red-600 hover:bg-red-50'
              : 'bg-white text-indigo-600 hover:bg-indigo-50'
          )}
        >
          Vælg plan
        </Link>
        <button
          onClick={() => setDismissed(true)}
          className="flex-shrink-0 text-white/70 hover:text-white transition-colors"
          aria-label="Luk besked"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  )
}