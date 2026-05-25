'use client'

import { ErrorBoundaryPage } from '@/components/ui/b/ErrorBoundaryPage'

export default function CompaniesError({
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
      page="companies"
      title="Porteføljen kunne ikke indlæses"
      message="Der opstod en fejl ved hentning af dine selskaber. Prøv igen, eller kontakt support."
    />
  )
}
