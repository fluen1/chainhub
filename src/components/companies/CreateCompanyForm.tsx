'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createCompany } from '@/actions/companies'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { COMPANY_TYPE_OPTIONS } from '@/lib/labels'
import {
  Panel,
  BButton,
  BTextField,
  BTextareaField,
  BFieldRow,
  BFieldWrap,
  Breadcrumb,
} from '@/components/ui/b'

// ─────────────────────────────────────────────────────────────────────────────
// CreateCompanyForm — B-stil port. Felter: name, cvr, companyType, address,
// city, postalCode, foundedDate, notes.
// ─────────────────────────────────────────────────────────────────────────────

export function CreateCompanyForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const [name, setName] = useState('')
  const [cvr, setCvr] = useState('')
  const [companyType, setCompanyType] = useState('')
  const [foundedDate, setFoundedDate] = useState('')
  const [address, setAddress] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [city, setCity] = useState('')
  const [notes, setNotes] = useState('')

  const [nameError, setNameError] = useState<string | null>(null)
  const [cvrError, setCvrError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!name.trim()) {
      setNameError('Selskabsnavn er påkrævet')
      return
    }
    setNameError(null)

    if (cvr && !/^\d{8}$/.test(cvr)) {
      setCvrError('CVR skal være 8 cifre')
      return
    }
    setCvrError(null)
    setLoading(true)

    try {
      const result = await createCompany({
        name: name.trim(),
        cvr: cvr || undefined,
        companyType: companyType || undefined,
        address: address || undefined,
        city: city || undefined,
        postalCode: postalCode || undefined,
        foundedDate: foundedDate || undefined,
        notes: notes || undefined,
      })

      if (result.error) {
        toast.error(result.error)
        return
      }

      if (result.data) {
        toast.success('Selskab oprettet')
        router.push(`/companies/${result.data.id}`)
      }
    } catch {
      toast.error('Noget gik galt — prøv igen')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <Breadcrumb trail={[{ label: 'Selskaber', href: '/companies' }]} current="Nyt selskab" />

      <div className="flex items-center gap-2">
        <Link href="/companies" className="rounded-[4px] p-1 hover:bg-[#f6f8fa]">
          <ArrowLeft className="h-4 w-4 text-b-2" />
        </Link>
        <span className="text-[16px] font-semibold text-b-1">Opret selskab</span>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {/* Selskabsinformation */}
        <Panel>
          <div className="flex flex-col gap-3.5 px-4 py-4">
            <p
              className="text-[10px] font-semibold uppercase text-b-2"
              style={{ letterSpacing: '0.4px' }}
            >
              Selskabsinformation
            </p>

            <BTextField
              label="Selskabsnavn"
              value={name}
              onChange={(v) => {
                setName(v)
                if (v.trim()) setNameError(null)
              }}
              required
              placeholder="Tandlæge Østerbro ApS"
              error={nameError}
              autoFocus
              disabled={loading}
            />

            <BFieldRow>
              <BTextField
                label="CVR-nummer"
                value={cvr}
                onChange={(v) => {
                  setCvr(v)
                  if (v && !/^\d{8}$/.test(v)) {
                    setCvrError('CVR skal være 8 cifre')
                  } else {
                    setCvrError(null)
                  }
                }}
                placeholder="12345678"
                hint="8 cifre"
                error={cvrError}
                disabled={loading}
              />
              <BFieldWrap label="Selskabsform">
                <select
                  value={companyType}
                  onChange={(e) => setCompanyType(e.target.value)}
                  disabled={loading}
                  className="rounded-[4px] border border-b-border-strong bg-white px-2.5 py-1.5 text-[13px] text-b-1 focus:border-transparent focus:outline focus:outline-2 focus:outline-b-blue-fg focus:outline-offset-[-1px] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">Vælg...</option>
                  {COMPANY_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </BFieldWrap>
            </BFieldRow>

            <BTextField
              label="Stiftelsesdato"
              value={foundedDate}
              onChange={setFoundedDate}
              type="date"
              disabled={loading}
            />
          </div>
        </Panel>

        {/* Adresse */}
        <Panel>
          <div className="flex flex-col gap-3.5 px-4 py-4">
            <p
              className="text-[10px] font-semibold uppercase text-b-2"
              style={{ letterSpacing: '0.4px' }}
            >
              Adresse
            </p>

            <BTextField
              label="Vejnavn og nummer"
              value={address}
              onChange={setAddress}
              placeholder="Østerbrogade 123"
              disabled={loading}
            />

            <BFieldRow>
              <BTextField
                label="Postnummer"
                value={postalCode}
                onChange={setPostalCode}
                placeholder="2100"
                disabled={loading}
              />
              <BTextField
                label="By"
                value={city}
                onChange={setCity}
                placeholder="København Ø"
                disabled={loading}
              />
            </BFieldRow>
          </div>
        </Panel>

        {/* Noter */}
        <Panel>
          <div className="px-4 py-4">
            <BTextareaField
              label="Interne noter"
              value={notes}
              onChange={setNotes}
              placeholder="Valgfrie noter om selskabet..."
              rows={2}
              disabled={loading}
            />
          </div>
        </Panel>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          <Link href="/companies">
            <BButton disabled={loading}>Annuller</BButton>
          </Link>
          <BButton type="submit" primary disabled={loading || !name.trim() || !!cvrError}>
            {loading ? 'Opretter...' : 'Opret selskab'}
          </BButton>
        </div>
      </form>
    </div>
  )
}
