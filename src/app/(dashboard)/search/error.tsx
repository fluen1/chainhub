'use client'

import { ErrorBoundaryPage } from '@/components/ui/b/ErrorBoundaryPage'

export default function SearchError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ErrorBoundaryPage
      error={error}
      reset={reset}
      page="search"
      title="Søgning kunne ikke indlæses"
      message="Der opstod en fejl ved søgning. Prøv igen om et øjeblik."
    />
  )
}
