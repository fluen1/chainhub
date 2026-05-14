'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import { ErrorBoundaryUI } from '@/components/ui/error-boundary'

export default function SearchError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[search] render error:', error)
    Sentry.captureException(error, { tags: { page: 'search' } })
  }, [error])

  return (
    <ErrorBoundaryUI
      title="Søgning kunne ikke indlæses"
      message="Der opstod en fejl ved søgning. Prøv igen om et øjeblik."
      digest={error.digest}
      reset={reset}
    />
  )
}
