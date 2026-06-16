'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'
import { ErrorBoundaryUI } from '@/components/ui/error-boundary'

interface ErrorBoundaryPageProps {
  error: Error & { digest?: string }
  reset: () => void
  page: string
  title?: string
  message?: string
  showDashboardLink?: boolean
}

/**
 * Fælles wrapper til Next.js error.tsx boundaries.
 * Logger til console, sender til Sentry og renderer ErrorBoundaryUI.
 * Brug i hver error.tsx: <ErrorBoundaryPage error={error} reset={reset} page="dashboard" title="..." message="..." />
 */
export function ErrorBoundaryPage({
  error,
  reset,
  page,
  title,
  message,
  showDashboardLink,
}: ErrorBoundaryPageProps) {
  useEffect(() => {
    console.error(`[${page}] render error:`, error)
    Sentry.captureException(error, { tags: { page } })
  }, [error, page])

  return (
    <ErrorBoundaryUI
      title={title}
      message={message}
      digest={error.digest}
      reset={reset}
      showDashboardLink={showDashboardLink}
    />
  )
}
