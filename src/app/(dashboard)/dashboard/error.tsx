'use client'

import { ErrorBoundaryPage } from '@/components/ui/b/ErrorBoundaryPage'

export default function DashboardError({
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
      page="dashboard"
      title="Dashboard kunne ikke indlæses"
      message="Der opstod en fejl ved hentning af dit overblik. Du kan prøve igen, eller kontakte support hvis problemet fortsætter."
      showDashboardLink={false}
    />
  )
}
