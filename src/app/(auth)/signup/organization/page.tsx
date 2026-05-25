'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { updateOrganizationOnboarding } from '@/actions/signup'

// ────────────────────────────────────────────────────────────────────────────
// /signup/organization — Step 2: Organisationsoplysninger (kan springes over)
// ────────────────────────────────────────────────────────────────────────────

const INDUSTRIES = [
  { value: 'tandlaege', label: 'Tandlæge' },
  { value: 'optiker', label: 'Optiker' },
  { value: 'fysioterapi', label: 'Fysioterapi' },
  { value: 'restauration', label: 'Restauration' },
  { value: 'detailhandel', label: 'Detailhandel' },
  { value: 'franchise', label: 'Franchise' },
  { value: 'andet', label: 'Andet' },
]

const LOCATION_OPTIONS = [
  { value: '1-5', label: '1–5 lokationer' },
  { value: '6-25', label: '6–25 lokationer' },
  { value: '26+', label: '26+ lokationer' },
]

export default function SignupOrganizationPage() {
  const router = useRouter()

  const [orgName, setOrgName] = useState('')
  const [industry, setIndustry] = useState('')
  const [estimatedLocations, setEstimatedLocations] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!orgName.trim()) return
    setLoading(true)

    // organizationId hentes fra session på server-siden (§7)
    const result = await updateOrganizationOnboarding({
      name: orgName.trim(),
      ...(industry ? { industry } : {}),
      ...(estimatedLocations ? { estimatedLocations } : {}),
    })

    setLoading(false)

    if ('error' in result && result.error) {
      toast.error(result.error)
      return
    }

    router.push('/dashboard')
  }

  function handleSkip() {
    router.push('/dashboard')
  }

  return (
    <div className="flex min-h-screen flex-col bg-b-canvas text-b-1">
      <div className="flex flex-1 flex-col items-center justify-center gap-5 px-4 py-8">
        <div className="w-full max-w-[400px] overflow-hidden rounded-[6px] border border-b-border bg-b-panel shadow-[0_4px_16px_rgba(15,23,42,0.07)]">
          {/* Header */}
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
              Trin 2 af 2 — Din organisation
            </div>
          </div>

          {/* Form */}
          <form className="flex flex-col gap-3.5 px-6 py-5" onSubmit={handleSubmit}>
            <p className="text-[12px] text-b-2">
              Fortæl os lidt om din organisation, så vi kan tilpasse oplevelsen. Du kan springe over
              og udfylde det senere.
            </p>

            {/* Organisationsnavn */}
            <div className="flex flex-col gap-1">
              <label
                htmlFor="org-name"
                className="text-[11px] font-semibold uppercase text-b-2"
                style={{ letterSpacing: '0.4px' }}
              >
                Organisationsnavn <span className="text-b-red-fg">*</span>
              </label>
              <input
                id="org-name"
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="fx Tandlægegruppen A/S"
                required
                disabled={loading}
                autoFocus
                className="rounded-[4px] border border-b-border-strong bg-white px-2.5 py-2 text-[13px] text-b-1 placeholder:text-b-3 focus:border-b-blue-fg focus:outline-none focus:ring-[3px] focus:ring-[#0969da1a] disabled:opacity-60"
              />
            </div>

            {/* Branche */}
            <div className="flex flex-col gap-1">
              <label
                htmlFor="industry"
                className="text-[11px] font-semibold uppercase text-b-2"
                style={{ letterSpacing: '0.4px' }}
              >
                Branche <span className="text-b-3">(valgfri)</span>
              </label>
              <select
                id="industry"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                disabled={loading}
                className="rounded-[4px] border border-b-border-strong bg-white px-2.5 py-2 text-[13px] text-b-1 focus:border-b-blue-fg focus:outline-none focus:ring-[3px] focus:ring-[#0969da1a] disabled:opacity-60"
              >
                <option value="">Vælg branche...</option>
                {INDUSTRIES.map((ind) => (
                  <option key={ind.value} value={ind.value}>
                    {ind.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Antal lokationer */}
            <div className="flex flex-col gap-1">
              <label
                htmlFor="locations"
                className="text-[11px] font-semibold uppercase text-b-2"
                style={{ letterSpacing: '0.4px' }}
              >
                Antal lokationer <span className="text-b-3">(valgfri)</span>
              </label>
              <select
                id="locations"
                value={estimatedLocations}
                onChange={(e) => setEstimatedLocations(e.target.value)}
                disabled={loading}
                className="rounded-[4px] border border-b-border-strong bg-white px-2.5 py-2 text-[13px] text-b-1 focus:border-b-blue-fg focus:outline-none focus:ring-[3px] focus:ring-[#0969da1a] disabled:opacity-60"
              >
                <option value="">Vælg antal...</option>
                {LOCATION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <button
                type="submit"
                disabled={!orgName.trim() || loading}
                className="flex w-full items-center justify-center gap-2 rounded-[4px] border-0 bg-b-blue-fg py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#0860c7] disabled:cursor-not-allowed disabled:bg-[#a5cef5]"
                style={{ letterSpacing: '-0.01em' }}
              >
                {loading ? (
                  <>
                    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Gemmer...
                  </>
                ) : (
                  'Kom i gang'
                )}
              </button>

              <button
                type="button"
                onClick={handleSkip}
                disabled={loading}
                className="w-full rounded-[4px] border border-b-border bg-transparent py-2 text-[12px] text-b-2 transition-colors hover:bg-b-panel-h hover:text-b-1 disabled:opacity-60"
              >
                Spring over
              </button>
            </div>
          </form>
        </div>

        <div className="text-center text-[11px] text-b-3">
          Du kan altid opdatere oplysningerne under Indstillinger.
        </div>
      </div>
    </div>
  )
}
