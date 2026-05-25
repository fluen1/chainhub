'use client'

import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, Suspense } from 'react'
import Link from 'next/link'

// ────────────────────────────────────────────────────────────────────────────
// /login — B-stil port. Behold eksisterende NextAuth credentials-flow.
// Layout matcher docs/design/handoff/project/Login.html.
//
// SSO-knappen (Microsoft) er placeholder — NextAuth-Microsoft-provider er
// ikke konfigureret endnu. Glemt-adgangskode-link er ligeledes statisk.
// ────────────────────────────────────────────────────────────────────────────

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    emailRef.current?.focus()
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!email.trim() || !password.trim()) return
    setError(null)
    setLoading(true)

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    setLoading(false)

    if (result?.error) {
      setError('Forkert e-mail eller adgangskode. Tjek dine oplysninger og prøv igen.')
      return
    }

    router.push(callbackUrl)
    router.refresh()
  }

  const canSubmit = email.trim().length > 0 && password.trim().length > 0 && !loading

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
              Kædestyring
            </div>
          </div>

          {/* Form */}
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
                htmlFor="email"
                className="text-[11px] font-semibold uppercase text-b-2"
                style={{ letterSpacing: '0.4px' }}
              >
                E-mail
              </label>
              <input
                id="email"
                ref={emailRef}
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setError(null)
                }}
                placeholder="din@email.dk"
                autoComplete="email"
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
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
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
            </div>

            <div className="flex justify-end">
              <a
                href="/login/forgot"
                className="text-[11px] text-b-blue-fg no-underline hover:underline"
              >
                Glemt adgangskode?
              </a>
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="flex w-full items-center justify-center gap-2 rounded-[4px] border-0 bg-b-blue-fg py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#0860c7] disabled:cursor-not-allowed disabled:bg-[#a5cef5]"
              style={{ letterSpacing: '-0.01em' }}
            >
              {loading ? (
                <>
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Logger ind...
                </>
              ) : (
                'Log ind'
              )}
            </button>

            <div className="flex items-center gap-2.5">
              <div className="h-px flex-1 bg-b-border" />
              <span className="whitespace-nowrap text-[11px] text-b-3">eller</span>
              <div className="h-px flex-1 bg-b-border" />
            </div>

            <button
              type="button"
              disabled
              title="SSO er endnu ikke konfigureret"
              className="flex w-full items-center justify-center gap-2 rounded-[4px] border border-b-border-strong bg-white py-2 text-[12px] font-medium text-b-1 hover:bg-[#f6f8fa] hover:border-[#c1c5cc] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="flex h-4 w-4 items-center justify-center rounded-[2px] bg-[#e8eaee] text-[9px] font-bold text-b-gray-fg">
                MS
              </span>
              Log ind med Microsoft
            </button>

            <p className="mt-4 text-center text-sm text-b-3">
              Ingen konto endnu?{' '}
              <Link href="/signup" className="text-b-accent hover:underline">
                Opret gratis konto
              </Link>
            </p>
          </form>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-b-border bg-b-panel-h px-6 py-3 text-[11px] text-b-2">
            <span className="flex items-center gap-1">
              <span className="b-kbd">↵</span>
              log ind
            </span>
            <span>ChainHub</span>
          </div>
        </div>

        <div className="text-center text-[11px] text-b-3">
          <a href="/privacy" className="text-b-2 no-underline hover:text-b-1">
            Privatlivspolitik
          </a>
          <span className="mx-2 text-[#d0d7de]">·</span>
          <a href="/terms" className="text-b-2 no-underline hover:text-b-1">
            Vilkår
          </a>
          <span className="mx-2 text-[#d0d7de]">·</span>
          <a href="mailto:support@chainhub.dk" className="text-b-2 no-underline hover:text-b-1">
            Support
          </a>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
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
      <LoginForm />
    </Suspense>
  )
}
