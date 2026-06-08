'use client'

import { useEffect, useState } from 'react'
import posthog from 'posthog-js'
import Link from 'next/link'
import { BButton } from '@/components/ui/b'
import { COOKIE_CONSENT_KEY, type CookieConsentChoice } from '@/lib/cookie-consent'

export function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(COOKIE_CONSENT_KEY)) setVisible(true)
  }, [])

  function choose(choice: CookieConsentChoice) {
    localStorage.setItem(COOKIE_CONSENT_KEY, choice)
    // posthog kan kaldes selvom det ikke er initialiseret (no-op uden key) — guardet defensivt.
    try {
      if (choice === 'granted') posthog.opt_in_capturing()
      else posthog.opt_out_capturing()
    } catch {
      /* posthog ikke initialiseret (ingen key) — ignorér */
    }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Cookie-samtykke"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-b-border bg-white px-4 py-3 shadow-[0_-4px_16px_rgba(15,23,42,0.08)]"
    >
      <div className="mx-auto flex max-w-5xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[12px] text-b-2">
          Vi bruger nødvendige cookies for at platformen virker, og — kun med dit samtykke —
          analytics til at forbedre ChainHub. Læs vores{' '}
          <Link href="/legal/cookies" className="text-b-blue-fg underline hover:no-underline">
            cookiepolitik
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <BButton onClick={() => choose('denied')} className="text-[12px]">
            Kun nødvendige
          </BButton>
          <BButton primary onClick={() => choose('granted')} className="text-[12px]">
            Acceptér alle
          </BButton>
        </div>
      </div>
    </div>
  )
}
