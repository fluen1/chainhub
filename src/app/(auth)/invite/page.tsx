'use client'

import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useRef, useState, Suspense } from 'react'
import { acceptInvite } from '@/actions/users'

// ────────────────────────────────────────────────────────────────────────────
// /invite — accept invite-token og opret konto.
// Token læses fra ?token= i URL. B-stil matcher login-siden.
// ────────────────────────────────────────────────────────────────────────────

function InviteForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  const canSubmit = name.trim().length >= 2 && password.length >= 8 && !loading

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!canSubmit) return
    setError(null)
    setLoading(true)

    const result = await acceptInvite({ token, name: name.trim(), password })

    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    // Auto-login med de netop oprettede credentials
    const signInResult = await signIn('credentials', {
      email: result.data!.email,
      password,
      redirect: false,
    })

    setLoading(false)

    if (signInResult?.error) {
      // Konto oprettet men login fejlede — send til login med besked
      router.push('/login?message=konto_oprettet')
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  if (!token) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-b-canvas px-4">
        <div className="w-full max-w-[360px] rounded-[6px] border border-b-border bg-b-panel p-6 text-center shadow-[0_4px_16px_rgba(15,23,42,0.07)]">
          <p className="text-[13px] text-b-red-fg">
            Ugyldigt invite-link. Kontakt din administrator.
          </p>
        </div>
      </div>
    )
  }

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
              Acceptér invitation
            </div>
          </div>

          {/* Form */}
          <form className="flex flex-col gap-3.5 px-6 py-5" onSubmit={handleSubmit}>
            <p className="text-[12px] text-b-2 leading-snug">
              Du er inviteret til ChainHub. Opret din konto ved at udfylde felterne nedenfor.
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
                htmlFor="name"
                className="text-[11px] font-semibold uppercase text-b-2"
                style={{ letterSpacing: '0.4px' }}
              >
                Fuldt navn
              </label>
              <input
                id="name"
                ref={nameRef}
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setError(null)
                }}
                placeholder="Dit fulde navn"
                autoComplete="name"
                required
                disabled={loading}
                className={`rounded-[4px] border bg-white px-2.5 py-2 text-[13px] text-b-1 placeholder:text-b-3 focus:outline-none focus:ring-[3px] disabled:opacity-60 ${
                  error
                    ? 'border-b-red-fg focus:ring-[#cf222e1a]'
                    : 'border-b-border-strong focus:border-b-blue-fg focus:ring-[#0969da1a]'
                }`}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="password"
                className="text-[11px] font-semibold uppercase text-b-2"
                style={{ letterSpacing: '0.4px' }}
              >
                Adgangskode
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setError(null)
                  }}
                  placeholder="Mindst 8 tegn"
                  autoComplete="new-password"
                  required
                  minLength={8}
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
              {password.length > 0 && password.length < 8 && (
                <p className="text-[11px] text-b-red-fg">Mindst 8 tegn kræves</p>
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
                  Opretter konto...
                </>
              ) : (
                'Opret konto og log ind'
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-b-border bg-b-panel-h px-6 py-3 text-[11px] text-b-2">
            <span>
              Har du allerede en konto?{' '}
              <a href="/login" className="text-b-blue-fg no-underline hover:underline">
                Log ind
              </a>
            </span>
            <span>ChainHub</span>
          </div>
        </div>

        <div className="text-center text-[11px] text-b-3">
          <a href="/legal/privatliv" className="text-b-2 no-underline hover:text-b-1">
            Privatlivspolitik
          </a>
          <span className="mx-2 text-[#d0d7de]">·</span>
          <a href="/legal/vilkaar" className="text-b-2 no-underline hover:text-b-1">
            Vilkår
          </a>
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

export default function InvitePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-b-canvas">
          <div className="w-full max-w-[360px] animate-pulse rounded-[6px] border border-b-border bg-b-panel p-6">
            <div className="mb-4 h-6 w-1/2 mx-auto rounded bg-b-border" />
            <div className="mb-4 h-3 w-1/3 mx-auto rounded bg-b-border" />
            <div className="space-y-3">
              <div className="h-10 rounded bg-b-border" />
              <div className="h-10 rounded bg-b-border" />
              <div className="h-10 rounded bg-b-border" />
            </div>
          </div>
        </div>
      }
    >
      <InviteForm />
    </Suspense>
  )
}
