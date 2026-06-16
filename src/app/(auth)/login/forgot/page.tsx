'use client'

import { useState } from 'react'
import { requestPasswordReset } from '@/actions/auth'

// ────────────────────────────────────────────────────────────────────────────
// /login/forgot — Anmod om password reset via email
// Returnerer altid success-besked (sikkerhed: ingen email-leakage)
// ────────────────────────────────────────────────────────────────────────────

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!email.trim()) return
    setError(null)
    setLoading(true)

    const result = await requestPasswordReset(email.trim())

    setLoading(false)

    if ('error' in result && result.error) {
      setError(result.error)
      return
    }

    setSubmitted(true)
  }

  const canSubmit = email.trim().length > 0 && !loading

  return (
    <div className="flex min-h-screen flex-col bg-b-canvas text-b-1">
      <div className="flex flex-1 flex-col items-center justify-center gap-5 px-4 py-8">
        <div className="w-full max-w-[360px] overflow-hidden rounded-[6px] border border-b-border bg-b-panel shadow-[0_4px_16px_rgba(15,23,42,0.07)]">
          {/* Logo-område */}
          <div className="border-b border-b-border bg-b-panel-h px-6 pb-4 pt-6 text-center">
            <div className="flex items-center justify-center gap-2 text-[22px] font-semibold text-b-1">
              <svg viewBox="0 0 14 14" width={20} height={20} aria-hidden className="shrink-0">
                <rect
                  x="1"
                  y="1"
                  width="12"
                  height="12"
                  rx="1.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
                <rect x="4.5" y="4.5" width="5" height="5" rx="0.5" fill="currentColor" />
              </svg>
              <span style={{ letterSpacing: '-0.02em' }}>ChainHub</span>
            </div>
            <div
              className="mt-0.5 text-[11px] uppercase text-b-2"
              style={{ letterSpacing: '0.5px' }}
            >
              Glemt adgangskode
            </div>
          </div>

          {submitted ? (
            /* Success-tilstand */
            <div className="flex flex-col gap-4 px-6 py-5">
              <div
                role="status"
                className="rounded-[4px] border border-[#b6e3b8] border-l-[3px] border-l-[#1a7f37] bg-[#f0fff4] px-3 py-2 text-[12px] leading-snug text-[#0f5323]"
              >
                Hvis en konto med denne e-mail findes, har vi sendt et nulstillingslink. Tjek din
                indbakke (og evt. spam-mappe).
              </div>
              <a
                href="/login"
                className="flex w-full items-center justify-center rounded-[4px] border border-b-border-strong bg-white py-2 text-[13px] font-medium text-b-1 hover:bg-[#f6f8fa] no-underline"
              >
                Tilbage til log ind
              </a>
            </div>
          ) : (
            /* Form */
            <form className="flex flex-col gap-3.5 px-6 py-5" onSubmit={handleSubmit}>
              <p className="text-[12px] leading-relaxed text-b-2">
                Indtast din e-mail-adresse, så sender vi dig et link til at nulstille din
                adgangskode.
              </p>

              {error && (
                <div
                  role="alert"
                  className="rounded-[4px] border border-[#ffc1ba] border-l-[3px] border-l-b-red-fg bg-b-red-bg px-3 py-2 text-[12px] leading-snug text-[#6e1010]"
                >
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label
                  htmlFor="email"
                  className="text-[11px] font-semibold uppercase text-b-2"
                  style={{ letterSpacing: '0.4px' }}
                >
                  E-mail
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setError(null)
                  }}
                  placeholder="din@email.dk"
                  autoComplete="email"
                  required
                  autoFocus
                  disabled={loading}
                  className={`rounded-[4px] border bg-white px-2.5 py-2 text-[13px] text-b-1 placeholder:text-b-3 focus:outline-none focus:ring-[3px] disabled:opacity-60 ${
                    error
                      ? 'border-b-red-fg focus:ring-[#cf222e1a]'
                      : 'border-b-border-strong focus:border-b-blue-fg focus:ring-[#0969da1a]'
                  }`}
                />
              </div>

              <button
                type="submit"
                disabled={!canSubmit}
                className="flex w-full items-center justify-center gap-2 rounded-[4px] border-0 bg-b-blue-fg py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#0860c7] disabled:cursor-not-allowed disabled:bg-[#a5cef5]"
                style={{ letterSpacing: '-0.01em' }}
              >
                {loading ? (
                  <>
                    <span
                      className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white"
                      style={{ animation: 'spin 0.7s linear infinite' }}
                    />
                    Sender...
                  </>
                ) : (
                  'Send nulstillingslink'
                )}
              </button>

              <div className="text-center">
                <a
                  href="/login"
                  className="text-[11px] text-b-blue-fg no-underline hover:underline"
                >
                  Tilbage til log ind
                </a>
              </div>
            </form>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-b-border bg-b-panel-h px-6 py-3 text-[11px] text-b-2">
            <span>Linket udløber efter 1 time</span>
            <span>ChainHub</span>
          </div>
        </div>
      </div>
      <style jsx global>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  )
}
