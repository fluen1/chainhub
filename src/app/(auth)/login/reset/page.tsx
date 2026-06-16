'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import { resetPassword } from '@/actions/auth'

// ────────────────────────────────────────────────────────────────────────────
// /login/reset?token=<uuid> — Sæt ny adgangskode via reset-token
// ────────────────────────────────────────────────────────────────────────────

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Mangler token
  if (!token) {
    return (
      <div className="flex min-h-screen flex-col bg-b-canvas text-b-1">
        <div className="flex flex-1 flex-col items-center justify-center gap-5 px-4 py-8">
          <div className="w-full max-w-[360px] overflow-hidden rounded-[6px] border border-b-border bg-b-panel shadow-[0_4px_16px_rgba(15,23,42,0.07)]">
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
            </div>
            <div className="flex flex-col gap-4 px-6 py-5">
              <div
                role="alert"
                className="rounded-[4px] border border-[#ffc1ba] border-l-[3px] border-l-b-red-fg bg-b-red-bg px-3 py-2 text-[12px] leading-snug text-[#6e1010]"
              >
                Ugyldigt nulstillingslink. Anmod om et nyt link nedenfor.
              </div>
              <a
                href="/login/forgot"
                className="flex w-full items-center justify-center rounded-[4px] border-0 bg-b-blue-fg py-2 text-[13px] font-semibold text-white no-underline hover:bg-[#0860c7]"
              >
                Anmod om nyt link
              </a>
            </div>
          </div>
        </div>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (newPassword !== confirmPassword) {
      setError('Adgangskoderne stemmer ikke overens')
      return
    }

    if (newPassword.length < 8) {
      setError('Adgangskoden skal være mindst 8 tegn')
      return
    }

    setLoading(true)
    const result = await resetPassword(token, newPassword)
    setLoading(false)

    if ('error' in result && result.error) {
      setError(result.error)
      return
    }

    setSuccess(true)

    // Redirect til login efter kort delay
    setTimeout(() => {
      router.push('/login?reset=success')
    }, 1500)
  }

  const passwordsMatch = newPassword === confirmPassword
  const canSubmit =
    newPassword.length >= 8 && confirmPassword.length > 0 && passwordsMatch && !loading

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
              Ny adgangskode
            </div>
          </div>

          {success ? (
            /* Success-tilstand */
            <div className="flex flex-col gap-4 px-6 py-5">
              <div
                role="status"
                className="rounded-[4px] border border-[#b6e3b8] border-l-[3px] border-l-[#1a7f37] bg-[#f0fff4] px-3 py-2 text-[12px] leading-snug text-[#0f5323]"
              >
                Din adgangskode er nulstillet. Du omdirigeres til log ind...
              </div>
            </div>
          ) : (
            /* Form */
            <form className="flex flex-col gap-3.5 px-6 py-5" onSubmit={handleSubmit}>
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
                  htmlFor="new-password"
                  className="text-[11px] font-semibold uppercase text-b-2"
                  style={{ letterSpacing: '0.4px' }}
                >
                  Ny adgangskode
                </label>
                <div className="relative">
                  <input
                    id="new-password"
                    type={showPw ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value)
                      setError(null)
                    }}
                    placeholder="Min. 8 tegn"
                    autoComplete="new-password"
                    required
                    autoFocus
                    disabled={loading}
                    className={`w-full rounded-[4px] border bg-white py-2 pl-2.5 pr-14 text-[13px] text-b-1 placeholder:text-b-3 focus:outline-none focus:ring-[3px] disabled:opacity-60 ${
                      error
                        ? 'border-b-red-fg focus:ring-[#cf222e1a]'
                        : 'border-b-border-strong focus:border-b-blue-fg focus:ring-[#0969da1a]'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    tabIndex={-1}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-transparent text-[11px] text-b-3 hover:text-b-1"
                  >
                    {showPw ? 'Skjul' : 'Vis'}
                  </button>
                </div>
                <p className="text-[10px] text-b-3">Mindst 8 tegn</p>
              </div>

              <div className="flex flex-col gap-1">
                <label
                  htmlFor="confirm-password"
                  className="text-[11px] font-semibold uppercase text-b-2"
                  style={{ letterSpacing: '0.4px' }}
                >
                  Bekræft adgangskode
                </label>
                <input
                  id="confirm-password"
                  type={showPw ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value)
                    setError(null)
                  }}
                  placeholder="Gentag adgangskode"
                  autoComplete="new-password"
                  required
                  disabled={loading}
                  className={`rounded-[4px] border bg-white px-2.5 py-2 text-[13px] text-b-1 placeholder:text-b-3 focus:outline-none focus:ring-[3px] disabled:opacity-60 ${
                    confirmPassword.length > 0 && !passwordsMatch
                      ? 'border-b-red-fg focus:ring-[#cf222e1a]'
                      : error
                        ? 'border-b-red-fg focus:ring-[#cf222e1a]'
                        : 'border-b-border-strong focus:border-b-blue-fg focus:ring-[#0969da1a]'
                  }`}
                />
                {confirmPassword.length > 0 && !passwordsMatch && (
                  <p className="text-[10px] text-b-red-fg">Adgangskoderne stemmer ikke overens</p>
                )}
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
                    Gemmer...
                  </>
                ) : (
                  'Gem ny adgangskode'
                )}
              </button>

              <div className="text-center">
                <a
                  href="/login/forgot"
                  className="text-[11px] text-b-blue-fg no-underline hover:underline"
                >
                  Anmod om nyt link
                </a>
              </div>
            </form>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-b-border bg-b-panel-h px-6 py-3 text-[11px] text-b-2">
            <span>Sikkert link · 1 times gyldighed</span>
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

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-b-canvas">
          <div className="w-full max-w-[360px] animate-pulse rounded-[6px] border border-b-border bg-b-panel p-6">
            <div className="mb-4 h-6 w-1/2 mx-auto rounded bg-b-border" />
            <div className="space-y-3">
              <div className="h-10 rounded bg-b-border" />
              <div className="h-10 rounded bg-b-border" />
              <div className="h-10 rounded bg-b-border" />
            </div>
          </div>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  )
}
