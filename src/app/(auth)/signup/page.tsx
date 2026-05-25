'use client'

import { useState, useRef, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { createAccount } from '@/actions/signup'

// ────────────────────────────────────────────────────────────────────────────
// /signup — Step 1: Opret konto (navn, e-mail, adgangskode)
// B-stil, matcher login-siden.
// ────────────────────────────────────────────────────────────────────────────

export default function SignupPage() {
  const router = useRouter()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!name.trim() || !email.trim() || !password.trim()) return
    setError(null)
    setLoading(true)

    const result = await createAccount({ name: name.trim(), email: email.trim(), password })

    if ('error' in result && result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    // Auto-login efter oprettelse
    const signInResult = await signIn('credentials', {
      email: email.trim(),
      password,
      redirect: false,
    })

    setLoading(false)

    if (signInResult?.error) {
      toast.error('Konto oprettet, men login fejlede. Prøv at logge ind manuelt.')
      router.push('/login')
      return
    }

    router.push('/signup/organization')
  }

  const canSubmit =
    name.trim().length >= 2 && email.trim().length > 0 && password.length >= 8 && !loading

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
              Opret konto
            </div>
          </div>

          {/* Form */}
          <form className="flex flex-col gap-3.5 px-6 py-5" onSubmit={handleSubmit}>
            <p className="text-center text-[12px] text-b-2">
              14 dages gratis prøveperiode — intet kreditkort
            </p>

            {error && (
              <div
                role="alert"
                className="rounded-[4px] border border-[#ffc1ba] border-l-[3px] border-l-b-red-fg bg-b-red-bg px-3 py-2 text-[12px] leading-snug text-[#6e1010]"
              >
                {error}
              </div>
            )}

            {/* Fuldt navn */}
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
                className="rounded-[4px] border border-b-border-strong bg-white px-2.5 py-2 text-[13px] text-b-1 placeholder:text-b-3 focus:border-b-blue-fg focus:outline-none focus:ring-[3px] focus:ring-[#0969da1a] disabled:opacity-60"
              />
            </div>

            {/* E-mail */}
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
                disabled={loading}
                className="rounded-[4px] border border-b-border-strong bg-white px-2.5 py-2 text-[13px] text-b-1 placeholder:text-b-3 focus:border-b-blue-fg focus:outline-none focus:ring-[3px] focus:ring-[#0969da1a] disabled:opacity-60"
              />
            </div>

            {/* Adgangskode */}
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
                  disabled={loading}
                  className="w-full rounded-[4px] border border-b-border-strong bg-white py-2 pl-2.5 pr-14 text-[13px] text-b-1 placeholder:text-b-3 focus:border-b-blue-fg focus:outline-none focus:ring-[3px] focus:ring-[#0969da1a] disabled:opacity-60"
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
              <p className="text-[11px] text-b-3">Mindst 8 tegn</p>
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
                'Opret konto'
              )}
            </button>

            <p className="mt-1 text-center text-[12px] text-b-3">
              Har du allerede en konto?{' '}
              <Link href="/login" className="text-b-blue-fg hover:underline">
                Log ind
              </Link>
            </p>
          </form>

          {/* Footer */}
          <div className="flex items-center justify-center border-t border-b-border bg-b-panel-h px-6 py-3 text-[11px] text-b-2">
            <span>Ingen binding. Annuller når som helst.</span>
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
