'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import { ErrorBoundaryUI } from '@/components/ui/error-boundary'

export default function PersonsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[persons] render error:', error)
    Sentry.captureException(error, { tags: { page: 'persons' } })
  }, [error])

  return (
    <ErrorBoundaryUI
      title="Persondatabasen kunne ikke indlæses"
      message="Der opstod en fejl ved hentning af personer. Prøv igen om et øjeblik."
      digest={error.digest}
      reset={reset}
    />
  )
}
