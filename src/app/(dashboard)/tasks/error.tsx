'use client'

import { ErrorBoundaryPage } from '@/components/ui/b/ErrorBoundaryPage'

export default function TasksError({
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
      page="tasks"
      title="Opgaver kunne ikke indlæses"
      message="Der opstod en fejl ved hentning af opgaver. Prøv igen, eller kontakt support."
    />
  )
}
