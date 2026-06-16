'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createContract } from '@/actions/contracts'
import {
  CONTRACT_TYPE_LABELS,
  CONTRACT_SYSTEM_TYPES,
  SENSITIVITY_MINIMUM,
  type ContractSystemTypeKey,
  type SensitivityLevelValue,
} from '@/lib/validations/contract'
import { zodContractSystemType } from '@/lib/zod-enums'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { getSensitivityLabel } from '@/lib/labels'
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
// CreateContractForm — B-stil port. Felter: companyId, systemType, displayName,
// sensitivity, effectiveDate, expiryDate, noticePeriodDays, advisering, notes.
// ─────────────────────────────────────────────────────────────────────────────

const SENSITIVITY_OPTIONS: { value: SensitivityLevelValue; label: string }[] = [
  { value: 'PUBLIC', label: 'Offentlig' },
  { value: 'STANDARD', label: 'Standard' },
  { value: 'INTERN', label: 'Intern' },
  { value: 'FORTROLIG', label: 'Fortrolig' },
  { value: 'STRENGT_FORTROLIG', label: 'Strengt fortrolig' },
]

const SENSITIVITY_ORDER: SensitivityLevelValue[] = [
  'PUBLIC',
  'STANDARD',
  'INTERN',
  'FORTROLIG',
  'STRENGT_FORTROLIG',
]

export function CreateContractForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedCompanyId = searchParams.get('companyId') ?? ''

  const [loading, setLoading] = useState(false)
  const [selectedType, setSelectedType] = useState<ContractSystemTypeKey | ''>('')
  const minSensitivity: SensitivityLevelValue =
    selectedType && SENSITIVITY_MINIMUM[selectedType as ContractSystemTypeKey]
      ? (SENSITIVITY_MINIMUM[selectedType as ContractSystemTypeKey] as SensitivityLevelValue)
      : 'STANDARD'
  const [companyId, setCompanyId] = useState(preselectedCompanyId)
  const [displayName, setDisplayName] = useState('')
  const [effectiveDate, setEffectiveDate] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [noticePeriodDays, setNoticePeriodDays] = useState('')
  const [notes, setNotes] = useState('')
  const [reminder90, setReminder90] = useState(true)
  const [reminder30, setReminder30] = useState(true)
  const [reminder7, setReminder7] = useState(true)
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [displayNameError, setDisplayNameError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/companies-list')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data: { companies?: { id: string; name: string }[] }) =>
        setCompanies(data.companies ?? [])
      )
      .catch(() =>
        setLoadError('Kunne ikke hente selskaber. Genindlæs siden eller kontakt support.')
      )
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!displayName.trim()) {
      setDisplayNameError('Kontraktens navn er påkrævet')
      return
    }
    setDisplayNameError(null)
    setLoading(true)

    const parsedSystemType = zodContractSystemType.safeParse(selectedType)
    if (!parsedSystemType.success) {
      setLoading(false)
      toast.error('Vælg en gyldig kontrakttype')
      return
    }

    const formData = new FormData(e.currentTarget)
    const sensitivity = formData.get('sensitivity') as SensitivityLevelValue

    const result = await createContract({
      companyId,
      systemType: parsedSystemType.data,
      displayName: displayName.trim(),
      sensitivity,
      effectiveDate: effectiveDate || undefined,
      expiryDate: expiryDate || undefined,
      noticePeriodDays: noticePeriodDays ? Number(noticePeriodDays) : undefined,
      notes: notes || undefined,
      reminder90Days: reminder90,
      reminder30Days: reminder30,
      reminder7Days: reminder7,
    })

    setLoading(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    if (result.data) {
      toast.success('Kontrakt oprettet')
      router.push(`/contracts/${result.data.id}`)
    }
  }

  const availableSensitivityOptions = SENSITIVITY_OPTIONS.filter(
    (opt) => SENSITIVITY_ORDER.indexOf(opt.value) >= SENSITIVITY_ORDER.indexOf(minSensitivity)
  )

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <Breadcrumb trail={[{ label: 'Kontrakter', href: '/contracts' }]} current="Ny kontrakt" />

      <div className="flex items-center gap-2">
        <Link href="/contracts" className="rounded-[4px] p-1 hover:bg-[#f6f8fa]">
          <ArrowLeft className="h-4 w-4 text-b-2" />
        </Link>
        <span className="text-[16px] font-semibold text-b-1">Opret kontrakt</span>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {/* Grunddata */}
        <Panel>
          <div className="flex flex-col gap-3.5 px-4 py-4">
            <p
              className="text-[10px] font-semibold uppercase text-b-2"
              style={{ letterSpacing: '0.4px' }}
            >
              Grunddata
            </p>

            {loadError ? (
              <div
                role="alert"
                className="rounded-[4px] border border-b-red-fg bg-red-50 px-3 py-2 text-[13px] text-b-red-fg"
              >
                {loadError}
              </div>
            ) : companies.length === 0 ? (
              <div className="rounded-[4px] border border-b-border bg-b-panel-h px-3 py-2 text-[13px] text-b-2">
                Du har ingen selskaber endnu. Opret et selskab først →{' '}
                <Link href="/companies/new" className="text-b-blue-fg underline hover:no-underline">
                  Opret selskab
                </Link>
              </div>
            ) : (
              <BFieldWrap label="Tilknyttet selskab" required>
                <select
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  required
                  disabled={loading}
                  className="rounded-[4px] border border-b-border-strong bg-white px-2.5 py-1.5 text-[13px] text-b-1 focus:border-transparent focus:outline focus:outline-2 focus:outline-b-blue-fg focus:outline-offset-[-1px] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">Vælg selskab...</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </BFieldWrap>
            )}

            <BFieldRow>
              <BFieldWrap
                label="Kontrakttype"
                required
                hint={
                  selectedType
                    ? `Min. fortrolighed: ${getSensitivityLabel(SENSITIVITY_MINIMUM[selectedType as ContractSystemTypeKey] ?? 'STANDARD')}${SENSITIVITY_MINIMUM[selectedType as ContractSystemTypeKey] === 'STRENGT_FORTROLIG' ? ' — kræver strengeste fortrolighedsniveau.' : '.'}`
                    : undefined
                }
              >
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value as ContractSystemTypeKey)}
                  required
                  disabled={loading}
                  className="rounded-[4px] border border-b-border-strong bg-white px-2.5 py-1.5 text-[13px] text-b-1 focus:border-transparent focus:outline focus:outline-2 focus:outline-b-blue-fg focus:outline-offset-[-1px] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">Vælg type...</option>
                  {CONTRACT_SYSTEM_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {CONTRACT_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </BFieldWrap>

              <BFieldWrap label="Sensitivitetsniveau" required>
                <select
                  name="sensitivity"
                  required
                  defaultValue={minSensitivity}
                  key={minSensitivity}
                  disabled={loading}
                  className="rounded-[4px] border border-b-border-strong bg-white px-2.5 py-1.5 text-[13px] text-b-1 focus:border-transparent focus:outline focus:outline-2 focus:outline-b-blue-fg focus:outline-offset-[-1px] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {availableSensitivityOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </BFieldWrap>
            </BFieldRow>

            <BTextField
              label="Kontraktens navn"
              value={displayName}
              onChange={(v) => {
                setDisplayName(v)
                if (v.trim()) setDisplayNameError(null)
              }}
              required
              placeholder="fx Ejeraftale Tandlæge Østerbro ApS 2024"
              hint="Dit eget navn til kontrakten — vises i oversigten"
              error={displayNameError}
              disabled={loading}
            />
          </div>
        </Panel>

        {/* Datoer og vilkår */}
        <Panel>
          <div className="flex flex-col gap-3.5 px-4 py-4">
            <p
              className="text-[10px] font-semibold uppercase text-b-2"
              style={{ letterSpacing: '0.4px' }}
            >
              Datoer og vilkår
            </p>

            <BFieldRow>
              <BTextField
                label="Startdato"
                value={effectiveDate}
                onChange={setEffectiveDate}
                type="date"
                disabled={loading}
              />
              <BTextField
                label="Udløbsdato"
                value={expiryDate}
                onChange={setExpiryDate}
                type="date"
                hint="Blank = løbende"
                disabled={loading}
              />
            </BFieldRow>

            <BTextField
              label="Opsigelsesvarsel (dage)"
              value={noticePeriodDays}
              onChange={setNoticePeriodDays}
              type="number"
              placeholder="30"
              hint="Løbende kontrakter"
              disabled={loading}
            />
          </div>
        </Panel>

        {/* Advisering */}
        <Panel>
          <div className="flex flex-col gap-2 px-4 py-4">
            <p
              className="text-[10px] font-semibold uppercase text-b-2"
              style={{ letterSpacing: '0.4px' }}
            >
              Advisering
            </p>
            <p className="text-[12px] text-b-2">Hvornår skal du adviseres om udløb?</p>
            <div className="flex flex-col gap-1.5">
              {(
                [
                  {
                    key: 'r90',
                    label: '90 dage før udløb',
                    value: reminder90,
                    setter: setReminder90,
                  },
                  {
                    key: 'r30',
                    label: '30 dage før udløb',
                    value: reminder30,
                    setter: setReminder30,
                  },
                  { key: 'r7', label: '7 dage før udløb', value: reminder7, setter: setReminder7 },
                ] as const
              ).map(({ key, label, value, setter }) => (
                <label key={key} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => setter(e.target.checked)}
                    disabled={loading}
                    className="rounded"
                  />
                  <span className="text-[13px] text-b-1">{label}</span>
                </label>
              ))}
            </div>
          </div>
        </Panel>

        {/* Noter */}
        <Panel>
          <div className="px-4 py-4">
            <BTextareaField
              label="Interne noter"
              value={notes}
              onChange={setNotes}
              placeholder="Interne noter..."
              rows={3}
              disabled={loading}
            />
          </div>
        </Panel>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          <Link href="/contracts">
            <BButton disabled={loading}>Annuller</BButton>
          </Link>
          <BButton
            type="submit"
            primary
            disabled={loading || !displayName.trim() || !!loadError || companies.length === 0}
          >
            {loading ? 'Opretter...' : 'Opret kontrakt'}
          </BButton>
        </div>
      </form>
    </div>
  )
}
