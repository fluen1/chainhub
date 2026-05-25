'use client'

import { ErrorBoundaryPage } from '@/components/ui/b/ErrorBoundaryPage'

export default function CasesError({
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
      page="cases"
      title="Sager kunne ikke indlæses"
      message="Der opstod en fejl ved hentning af sager. Prøv igen om et øjeblik."
    />
  )
}
