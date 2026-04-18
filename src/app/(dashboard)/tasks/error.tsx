'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import { ErrorBoundaryUI } from '@/components/ui/error-boundary'

export default function TasksError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[tasks] render error:', error)
    Sentry.captureException(error, { tags: { page: 'tasks' } })
  }, [error])

  return (
    <ErrorBoundaryUI
      title="Opgaver kunne ikke indlæses"
      message="Der opstod en fejl ved hentning af opgaver. Prøv igen, eller kontakt support."
      digest={error.digest}
      reset={reset}
    />
  )
}
