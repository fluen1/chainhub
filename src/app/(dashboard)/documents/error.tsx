'use client'

import { ErrorBoundaryPage } from '@/components/ui/b/ErrorBoundaryPage'

export default function DocumentsError({
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
      page="documents"
      title="Dokumenter kunne ikke indlæses"
      message="Der opstod en fejl ved hentning af dokumenter. Prøv igen om et øjeblik."
    />
  )
}
