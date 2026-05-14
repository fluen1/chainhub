'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import { ErrorBoundaryUI } from '@/components/ui/error-boundary'

export default function CasesError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[cases] render error:', error)
    Sentry.captureException(error, { tags: { page: 'cases' } })
  }, [error])

  return (
    <ErrorBoundaryUI
      title="Sager kunne ikke indlæses"
      message="Der opstod en fejl ved hentning af sager. Prøv igen om et øjeblik."
      digest={error.digest}
      reset={reset}
    />
  )
}
