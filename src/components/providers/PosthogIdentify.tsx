'use client'

import posthog from 'posthog-js'
import { useSession } from 'next-auth/react'
import { useEffect } from 'react'

/**
 * Identificerer den indloggede bruger i Posthog.
 * Kør kun ét enkelt identify-kald pr. session — posthog-js deduplicerer internt.
 * Sender kun user ID, email og organization_id — ingen PII udover det.
 */
export function PosthogIdentify() {
  const { data: session } = useSession()

  useEffect(() => {
    if (!session?.user) return

    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
    if (!key) return

    posthog.identify(session.user.id, {
      email: session.user.email,
      organization_id: session.user.organizationId,
    })
  }, [session?.user?.id])

  return null
}
