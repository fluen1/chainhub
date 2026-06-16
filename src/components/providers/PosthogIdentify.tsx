'use client'

import { useSession } from 'next-auth/react'
import posthog from 'posthog-js'
import { useEffect } from 'react'

/**
 * Identificerer den indloggede bruger i Posthog.
 * Kør kun ét enkelt identify-kald pr. session — posthog-js deduplicerer internt.
 * Sender kun user ID, email og organization_id — ingen PII udover det.
 */
export function PosthogIdentify() {
  const { data: session } = useSession()

  const userId = session?.user?.id
  const email = session?.user?.email
  const organizationId = session?.user?.organizationId

  useEffect(() => {
    if (!userId) return

    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
    if (!key) return

    posthog.identify(userId, {
      email,
      organization_id: organizationId,
    })
  }, [userId, email, organizationId])

  return null
}
