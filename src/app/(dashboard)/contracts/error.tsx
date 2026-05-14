'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import { ErrorBoundaryUI } from '@/components/ui/error-boundary'

export default function ContractsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[contracts] render error:', error)
    Sentry.captureException(error, { tags: { page: 'contracts' } })
  }, [error])

  return (
    <ErrorBoundaryUI
      title="Kontrakter kunne ikke indlæses"
      message="Der opstod en fejl ved hentning af kontrakter. Prøv igen om et øjeblik."
      digest={error.digest}
      reset={reset}
    />
  )
}
