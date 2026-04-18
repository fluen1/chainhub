'use client'

import { AlertTriangle, RefreshCw } from 'lucide-react'
import Link from 'next/link'

interface ErrorBoundaryUIProps {
  title?: string
  message?: string
  digest?: string
  reset: () => void
  showDashboardLink?: boolean
}

/**
 * Præsentations-komponent til Next.js error.tsx boundaries.
 * Logging og Sentry-kald sker i hver error.tsx (client component),
 * ikke her — denne fil er ren UI.
 */
export function ErrorBoundaryUI({
  title = 'Noget gik galt',
  message = 'Vi kunne ikke indlæse denne side. Du kan prøve igen, eller gå tilbage til dashboardet.',
  digest,
  reset,
  showDashboardLink = true,
}: ErrorBoundaryUIProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
          <AlertTriangle className="h-6 w-6 text-red-600" aria-hidden />
        </div>
        <h1 className="mb-2 text-lg font-bold text-slate-900">{title}</h1>
        <p className="mb-6 text-sm text-slate-600">{message}</p>

        {digest && (
          <div className="mb-4 rounded-md bg-slate-50 px-3 py-2 text-left">
            <div className="text-[10px] uppercase tracking-wide text-slate-400">Reference</div>
            <div className="font-mono text-xs text-slate-600">{digest}</div>
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Prøv igen
          </button>
          {showDashboardLink && (
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 no-underline transition-colors"
            >
              Gå til dashboard
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
