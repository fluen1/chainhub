'use client'

import { ErrorBoundaryPage } from '@/components/ui/b/ErrorBoundaryPage'

export default function PersonsError({
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
      page="persons"
      title="Persondatabasen kunne ikke indlæses"
      message="Der opstod en fejl ved hentning af personer. Prøv igen om et øjeblik."
    />
  )
}
