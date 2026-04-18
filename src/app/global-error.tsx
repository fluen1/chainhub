'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

// Global fallback-boundary. Aktiveres hvis root-layout crasher —
// kan ikke bruge SectionCard eller app-specifik UI pga. root-layout
// er gået nedenunder. Minimal HTML her.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[global] critical error:', error)
    Sentry.captureException(error, { tags: { page: 'global' } })
  }, [error])

  return (
    <html lang="da">
      <body
        style={{
          margin: 0,
          padding: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f8fafc',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial',
        }}
      >
        <div
          style={{
            maxWidth: 480,
            width: '90%',
            padding: '32px',
            backgroundColor: 'white',
            borderRadius: 16,
            textAlign: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}
        >
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
            Kritisk fejl
          </h1>
          <p style={{ fontSize: 14, color: '#475569', marginBottom: 24 }}>
            Applikationen kunne ikke indlæses. Genindlæs siden eller kontakt support.
          </p>
          {error.digest && (
            <div
              style={{
                backgroundColor: '#f8fafc',
                padding: '8px 12px',
                borderRadius: 6,
                marginBottom: 16,
                textAlign: 'left',
                fontFamily: 'ui-monospace, monospace',
                fontSize: 12,
                color: '#64748b',
              }}
            >
              <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase' }}>
                Reference
              </div>
              {error.digest}
            </div>
          )}
          <button
            onClick={reset}
            style={{
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              padding: '10px 24px',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Genindlæs
          </button>
        </div>
      </body>
    </html>
  )
}
