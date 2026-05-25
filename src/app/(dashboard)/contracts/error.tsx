'use client'

import { ErrorBoundaryPage } from '@/components/ui/b/ErrorBoundaryPage'

export default function ContractsError({
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
      page="contracts"
      title="Kontrakter kunne ikke indlæses"
      message="Der opstod en fejl ved hentning af kontrakter. Prøv igen om et øjeblik."
    />
  )
}
