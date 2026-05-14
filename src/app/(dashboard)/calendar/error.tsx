'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import { ErrorBoundaryUI } from '@/components/ui/error-boundary'

export default function CalendarError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[calendar] render error:', error)
    Sentry.captureException(error, { tags: { page: 'calendar' } })
  }, [error])

  return (
    <ErrorBoundaryUI
      title="Kalender kunne ikke indlæses"
      message="Der opstod en fejl ved hentning af kalender. Prøv igen om et øjeblik."
      digest={error.digest}
      reset={reset}
    />
  )
}
