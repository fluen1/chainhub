'use client'

import posthog from 'posthog-js'
import { useEffect, useState } from 'react'
import { COOKIE_CONSENT_KEY, type CookieConsentChoice, isValidConsent } from '@/lib/cookie-consent'

// ─────────────────────────────────────────────────────────────────────────────
// CookieWithdrawPanel — GDPR art. 7 stk. 3: tilbagetrækning af cookie-samtykke.
// Vises i Settings → Sikkerhed. Synkroniserer med localStorage og PostHog.
// ─────────────────────────────────────────────────────────────────────────────

export function CookieWithdrawPanel() {
  const [consent, setConsent] = useState<CookieConsentChoice | null>(null)

  useEffect(() => {
    // Initialisering fra localStorage sker kun på klienten (SSR-safe).
    const stored = localStorage.getItem(COOKIE_CONSENT_KEY)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConsent(isValidConsent(stored) ? stored : null)
  }, [])

  function handleChoice(choice: CookieConsentChoice) {
    localStorage.setItem(COOKIE_CONSENT_KEY, choice)
    try {
      if (choice === 'granted') posthog.opt_in_capturing()
      else posthog.opt_out_capturing()
    } catch {
      /* PostHog ikke initialiseret — ignorér */
    }
    setConsent(choice)
  }

  const isGranted = consent === 'granted'

  return (
    <div className="rounded-[6px] border border-b-border bg-b-panel px-4 py-3">
      <div className="mb-2.5 flex items-center gap-2">
        <span
          className="text-[12px] font-semibold uppercase text-b-2"
          style={{ letterSpacing: '0.4px' }}
        >
          Analytics-samtykke
        </span>
      </div>

      <p className="mb-3 text-[12px] text-b-2">
        Du kan til enhver tid acceptere eller tilbagekalde dit samtykke til analytics-cookies (GDPR
        art. 7 stk. 3). Nødvendige session-cookies kan ikke frakobles.
      </p>

      <div className="mb-3 flex items-center gap-2">
        <span className="text-[11px] font-medium text-b-2">Status:</span>
        <span
          role="alert"
          aria-live="polite"
          className={`rounded-[3px] px-1.5 py-px text-[10px] font-semibold ${
            isGranted ? 'bg-green-100 text-green-800' : 'bg-b-panel-h text-b-2'
          }`}
        >
          {isGranted ? 'Givet' : 'Ikke givet'}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {isGranted ? (
          <button
            type="button"
            onClick={() => handleChoice('denied')}
            className="inline-flex items-center rounded-[4px] border border-b-border-strong bg-white px-3 py-1.5 text-[12px] font-medium text-b-1 hover:bg-b-panel-h"
          >
            Tilbagekald samtykke
          </button>
        ) : (
          <button
            type="button"
            onClick={() => handleChoice('granted')}
            className="inline-flex items-center rounded-[4px] border border-b-blue-fg bg-b-blue-fg px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[#0860c7]"
          >
            Acceptér analytics
          </button>
        )}
      </div>
    </div>
  )
}
