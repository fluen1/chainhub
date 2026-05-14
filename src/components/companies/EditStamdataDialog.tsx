'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { BModal, BTextField, BTextareaField, BFieldWrap, BFieldRow } from '@/components/ui/b'
import { updateCompanyStamdata } from '@/actions/companies'

// ────────────────────────────────────────────────────────────────────────────
// EditStamdataDialog — BModal til redigering af selskabets stamdata.
// Wired til updateCompanyStamdata-action.
//
// Felter: name, cvr, address, postal_code, city, region (dropdown),
//         industry_code (valgfrit), website, phone, email, notes.
// ────────────────────────────────────────────────────────────────────────────

const REGIONS = [
  { value: '', label: 'Vælg region' },
  { value: 'Nordjylland', label: 'Nordjylland' },
  { value: 'Midtjylland', label: 'Midtjylland' },
  { value: 'Syddanmark', label: 'Syddanmark' },
  { value: 'Sjælland', label: 'Sjælland' },
  { value: 'Hovedstaden', label: 'Hovedstaden' },
]

const selectBase =
  'rounded-[4px] border border-b-border-strong bg-white px-2.5 py-1.5 text-[13px] text-b-1 focus:border-transparent focus:outline focus:outline-2 focus:outline-b-blue-fg focus:outline-offset-[-1px] disabled:cursor-not-allowed disabled:opacity-60'

export interface StamdataInitial {
  name: string
  cvr: string | null
  address: string | null
  postal_code: string | null
  city: string | null
  region?: string | null
  industry_code?: string | null
  website?: string | null
  phone?: string | null
  email?: string | null
  notes?: string | null
  founded_date?: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  companyId: string
  initial: StamdataInitial
}

export function EditStamdataDialog({ open, onClose, companyId, initial }: Props) {
  const router = useRouter()
  const [submitting, startTransition] = useTransition()

  const [name, setName] = useState(initial.name)
  const [cvr, setCvr] = useState(initial.cvr ?? '')
  const [address, setAddress] = useState(initial.address ?? '')
  const [postalCode, setPostalCode] = useState(initial.postal_code ?? '')
  const [city, setCity] = useState(initial.city ?? '')
  const [region, setRegion] = useState(initial.region ?? '')
  const [industryCode, setIndustryCode] = useState(initial.industry_code ?? '')
  const [website, setWebsite] = useState(initial.website ?? '')
  const [phone, setPhone] = useState(initial.phone ?? '')
  const [email, setEmail] = useState(initial.email ?? '')
  const [notes, setNotes] = useState(initial.notes ?? '')

  // Validering
  const [errors, setErrors] = useState<Record<string, string>>({})

  function validate(): boolean {
    const newErrors: Record<string, string> = {}
    if (!name.trim()) newErrors.name = 'Navn er påkrævet'
    if (cvr && !/^\d{8}$/.test(cvr.replace(/\s/g, ''))) {
      newErrors.cvr = 'CVR skal være præcis 8 cifre'
    }
    if (postalCode && postalCode.length > 10) {
      newErrors.postalCode = 'Postnummer må maks være 10 tegn'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  function handleSubmit() {
    if (!validate()) return

    startTransition(async () => {
      const result = await updateCompanyStamdata(companyId, {
        name: name.trim(),
        cvr: cvr.replace(/\s/g, '') || null,
        address: address || null,
        city: city || null,
        postal_code: postalCode || null,
        founded_date: null, // ikke eksponeret i denne dialog
      })

      if ('error' in result) {
        toast.error(result.error)
        return
      }

      toast.success('Stamdata opdateret')
      router.refresh()
      onClose()
    })
  }

  return (
    <BModal
      open={open}
      onClose={onClose}
      title="Rediger stamdata"
      subtitle={`${initial.name} · CVR ${initial.cvr ?? '—'}`}
      onSubmit={handleSubmit}
      submitLabel="Gem ændringer"
      submitDisabled={!name.trim()}
      submitting={submitting}
      width={520}
      titleId="edit-stamdata-title"
    >
      {/* Navn (påkrævet) */}
      <BTextField
        label="Selskabsnavn"
        value={name}
        onChange={setName}
        placeholder="fx TandlægeGruppen A/S"
        required
        error={errors.name}
        autoFocus
      />

      {/* CVR + Postnummer */}
      <BFieldRow>
        <BTextField
          label="CVR-nummer"
          value={cvr}
          onChange={setCvr}
          placeholder="12345678"
          error={errors.cvr}
          hint="8 cifre — ingen mellemrum"
        />
        <BTextField
          label="Postnummer"
          value={postalCode}
          onChange={setPostalCode}
          placeholder="2100"
          error={errors.postalCode}
        />
      </BFieldRow>

      {/* Adresse + By */}
      <BTextField
        label="Adresse"
        value={address}
        onChange={setAddress}
        placeholder="fx Østerbrogade 1"
      />
      <BFieldRow>
        <BTextField label="By" value={city} onChange={setCity} placeholder="fx København Ø" />

        {/* Region (dropdown) */}
        <BFieldWrap label="Region">
          <select value={region} onChange={(e) => setRegion(e.target.value)} className={selectBase}>
            {REGIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </BFieldWrap>
      </BFieldRow>

      {/* Branchekode (valgfrit) */}
      <BTextField
        label="Branchekode (valgfrit)"
        value={industryCode}
        onChange={setIndustryCode}
        placeholder="fx 86210"
        hint="Virksomhedens produktionsenhedsnummer fra CVR-registret (valgfrit) · 5-cifret DB07-kode"
      />

      {/* Kontaktoplysninger */}
      <BFieldRow>
        <BTextField
          label="Hjemmeside"
          value={website}
          onChange={setWebsite}
          placeholder="https://eksempel.dk"
        />
        <BTextField
          label="Telefon"
          value={phone}
          onChange={setPhone}
          placeholder="+45 12 34 56 78"
        />
      </BFieldRow>

      <BTextField
        label="E-mail"
        value={email}
        onChange={setEmail}
        placeholder="kontakt@eksempel.dk"
        type="email"
      />

      {/* Noter */}
      <BTextareaField
        label="Noter (valgfrit)"
        value={notes}
        onChange={setNotes}
        placeholder="Interne bemærkninger om selskabet…"
        rows={2}
      />
    </BModal>
  )
}
