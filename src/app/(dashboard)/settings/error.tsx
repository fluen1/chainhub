'use client'

import { ErrorBoundaryPage } from '@/components/ui/b/ErrorBoundaryPage'

export default function SettingsError({
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
      page="settings"
      title="Indstillinger kunne ikke indlæses"
      message="Der opstod en fejl ved hentning af indstillinger. Prøv igen om et øjeblik."
    />
  )
}
