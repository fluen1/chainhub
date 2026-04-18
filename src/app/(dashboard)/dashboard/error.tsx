'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import { ErrorBoundaryUI } from '@/components/ui/error-boundary'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log til console i dev + send til Sentry i produktion (hvis DSN er sat)
    // eslint-disable-next-line no-console
    console.error('[dashboard] render error:', error)
    Sentry.captureException(error, { tags: { page: 'dashboard' } })
  }, [error])

  return (
    <ErrorBoundaryUI
      title="Dashboard kunne ikke indlæses"
      message="Der opstod en fejl ved hentning af dit overblik. Du kan prøve igen, eller kontakte support hvis problemet fortsætter."
      digest={error.digest}
      reset={reset}
      showDashboardLink={false}
    />
  )
}
