'use client'

import { ErrorBoundaryPage } from '@/components/ui/b/ErrorBoundaryPage'

export default function CalendarError({
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
      page="calendar"
      title="Kalender kunne ikke indlæses"
      message="Der opstod en fejl ved hentning af kalender. Prøv igen om et øjeblik."
    />
  )
}
