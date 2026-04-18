'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import { ErrorBoundaryUI } from '@/components/ui/error-boundary'

export default function CompaniesError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[companies] render error:', error)
    Sentry.captureException(error, { tags: { page: 'companies' } })
  }, [error])

  return (
    <ErrorBoundaryUI
      title="Porteføljen kunne ikke indlæses"
      message="Der opstod en fejl ved hentning af dine selskaber. Prøv igen, eller kontakt support."
      digest={error.digest}
      reset={reset}
    />
  )
}
