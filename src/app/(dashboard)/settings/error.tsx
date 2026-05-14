'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import { ErrorBoundaryUI } from '@/components/ui/error-boundary'

export default function SettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[settings] render error:', error)
    Sentry.captureException(error, { tags: { page: 'settings' } })
  }, [error])

  return (
    <ErrorBoundaryUI
      title="Indstillinger kunne ikke indlæses"
      message="Der opstod en fejl ved hentning af indstillinger. Prøv igen om et øjeblik."
      digest={error.digest}
      reset={reset}
    />
  )
}
