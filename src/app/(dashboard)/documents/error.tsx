'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import { ErrorBoundaryUI } from '@/components/ui/error-boundary'

export default function DocumentsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[documents] render error:', error)
    Sentry.captureException(error, { tags: { page: 'documents' } })
  }, [error])

  return (
    <ErrorBoundaryUI
      title="Dokumenter kunne ikke indlæses"
      message="Der opstod en fejl ved hentning af dokumenter. Prøv igen om et øjeblik."
      digest={error.digest}
      reset={reset}
    />
  )
}
