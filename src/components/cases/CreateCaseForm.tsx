'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createCase } from '@/actions/cases'
import {
  CASE_TYPE_LABELS,
  CASE_SUBTYPE_BY_TYPE,
  type CreateCaseInput,
} from '@/lib/validations/case'
import { zodCaseType, zodCaseSubtype } from '@/lib/zod-enums'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
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
// CreateCaseForm — B-stil port. Felter: title, caseType, caseSubtype,
// sensitivity, companyIds (multi-check), description, notes.
// ─────────────────────────────────────────────────────────────────────────────

type SensitivityValue = 'PUBLIC' | 'STANDARD' | 'INTERN' | 'FORTROLIG' | 'STRENGT_FORTROLIG'

const CASE_TYPES = Object.keys(CASE_TYPE_LABELS)

const SENSITIVITY_OPTIONS: Array<{ value: SensitivityValue; label: string }> = [
  { value: 'STANDARD', label: 'Standard' },
  { value: 'INTERN', label: 'Intern' },
  { value: 'FORTROLIG', label: 'Fortrolig' },
  { value: 'STRENGT_FORTROLIG', label: 'Strengt fortrolig' },
]

export function CreateCaseForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState('')
  const [titleError, setTitleError] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState('')
  const [selectedSubtype, setSelectedSubtype] = useState('')
  const [sensitivity, setSensitivity] = useState<SensitivityValue>('INTERN')
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([])
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    fetch('/api/companies-list')
      .then((r) => r.json())
      .then((data) => setCompanies(data.companies ?? []))
      .catch(() => {})
  }, [])

  function toggleCompany(id: string) {
    setSelectedCompanyIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    )
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!title.trim()) {
      setTitleError('Titel er påkrævet')
      return
    }
    if (selectedCompanyIds.length === 0) {
      toast.error('Vælg mindst ét selskab')
      return
    }
    setTitleError(null)
    setLoading(true)

    const parsedCaseType = zodCaseType.safeParse(selectedType)
    if (!parsedCaseType.success) {
      setLoading(false)
      toast.error('Vælg en gyldig sagstype')
      return
    }
    const parsedSubtype = selectedSubtype ? zodCaseSubtype.safeParse(selectedSubtype) : null
    if (parsedSubtype && !parsedSubtype.success) {
      setLoading(false)
      toast.error('Ugyldig undertype')
      return
    }

    const input: CreateCaseInput = {
      title: title.trim(),
      caseType: parsedCaseType.data,
      caseSubtype: parsedSubtype?.success ? parsedSubtype.data : undefined,
      companyIds: selectedCompanyIds,
      sensitivity,
      description: description || undefined,
      notes: notes || undefined,
    }

    const result = await createCase(input)
    setLoading(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    if (result.data) {
      toast.success('Sag oprettet')
      router.push(`/cases/${result.data.id}`)
    }
  }

  const subtypes = selectedType ? (CASE_SUBTYPE_BY_TYPE[selectedType] ?? []) : []

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <Breadcrumb trail={[{ label: 'Sager', href: '/cases' }]} current="Ny sag" />

      <div className="flex items-center gap-2">
        <Link href="/cases" className="rounded-[4px] p-1 hover:bg-[#f6f8fa]">
          <ArrowLeft className="h-4 w-4 text-b-2" />
        </Link>
        <span className="text-[16px] font-semibold text-b-1">Opret sag</span>
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

            <BTextField
              label="Titel"
              value={title}
              onChange={(v) => {
                setTitle(v)
                if (v.trim()) setTitleError(null)
              }}
              required
              placeholder="fx Virksomhedskøb — Klinik Aarhus 2024"
              error={titleError}
              autoFocus
              disabled={loading}
            />

            <BFieldRow>
              <BFieldWrap label="Sagstype" required>
                <select
                  value={selectedType}
                  onChange={(e) => {
                    setSelectedType(e.target.value)
                    setSelectedSubtype('')
                  }}
                  required
                  disabled={loading}
                  className="rounded-[4px] border border-b-border-strong bg-white px-2.5 py-1.5 text-[13px] text-b-1 focus:border-transparent focus:outline focus:outline-2 focus:outline-b-blue-fg focus:outline-offset-[-1px] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">Vælg type...</option>
                  {CASE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {CASE_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </BFieldWrap>

              <BFieldWrap
                label="Undertype"
                required={selectedType !== '' && selectedType !== 'ANDET'}
              >
                <select
                  value={selectedSubtype}
                  onChange={(e) => setSelectedSubtype(e.target.value)}
                  disabled={!selectedType || selectedType === 'ANDET' || loading}
                  required={selectedType !== '' && selectedType !== 'ANDET'}
                  className="rounded-[4px] border border-b-border-strong bg-white px-2.5 py-1.5 text-[13px] text-b-1 focus:border-transparent focus:outline focus:outline-2 focus:outline-b-blue-fg focus:outline-offset-[-1px] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">
                    {selectedType === 'ANDET' ? 'Ingen undertype' : 'Vælg undertype...'}
                  </option>
                  {subtypes.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </BFieldWrap>
            </BFieldRow>

            <BFieldWrap label="Sensitivitetsniveau">
              <select
                value={sensitivity}
                onChange={(e) => setSensitivity(e.target.value as SensitivityValue)}
                disabled={loading}
                className="rounded-[4px] border border-b-border-strong bg-white px-2.5 py-1.5 text-[13px] text-b-1 focus:border-transparent focus:outline focus:outline-2 focus:outline-b-blue-fg focus:outline-offset-[-1px] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {SENSITIVITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </BFieldWrap>

            <BFieldWrap label="Tilknyttede selskaber" required>
              <div
                role="group"
                aria-label="Tilknyttede selskaber"
                className="max-h-40 overflow-y-auto rounded-[4px] border border-b-border-strong bg-white p-2"
              >
                {companies.length === 0 ? (
                  <p className="py-1 text-[13px] text-b-3">Ingen selskaber tilgængelige</p>
                ) : (
                  companies.map((c) => (
                    <label
                      key={c.id}
                      className="flex cursor-pointer items-center gap-2 rounded-[2px] px-1 py-1 hover:bg-b-row-hover"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCompanyIds.includes(c.id)}
                        onChange={() => toggleCompany(c.id)}
                        disabled={loading}
                        className="rounded"
                      />
                      <span className="text-[13px] text-b-1">{c.name}</span>
                    </label>
                  ))
                )}
              </div>
              {selectedCompanyIds.length === 0 && (
                <div className="text-[11px] text-b-red-fg">Vælg mindst ét selskab</div>
              )}
            </BFieldWrap>
          </div>
        </Panel>

        {/* Beskrivelse */}
        <Panel>
          <div className="flex flex-col gap-3.5 px-4 py-4">
            <p
              className="text-[10px] font-semibold uppercase text-b-2"
              style={{ letterSpacing: '0.4px' }}
            >
              Beskrivelse
            </p>

            <BTextareaField
              label="Beskrivelse"
              value={description}
              onChange={setDescription}
              placeholder="Beskrivelse af sagen..."
              rows={4}
              disabled={loading}
            />

            <BTextareaField
              label="Interne noter"
              value={notes}
              onChange={setNotes}
              rows={2}
              disabled={loading}
            />
          </div>
        </Panel>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          <Link href="/cases">
            <BButton disabled={loading}>Annuller</BButton>
          </Link>
          <BButton
            type="submit"
            primary
            disabled={
              loading ||
              !title.trim() ||
              !selectedType ||
              (selectedType !== 'ANDET' && !selectedSubtype) ||
              selectedCompanyIds.length === 0
            }
          >
            {loading ? 'Opretter...' : 'Opret sag'}
          </BButton>
        </div>
      </form>
    </div>
  )
}
