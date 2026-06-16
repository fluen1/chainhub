'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { addCompanyPerson } from '@/actions/governance'
import { BModal, BTextField, BSegmentedField, BFieldWrap, BFieldRow } from '@/components/ui/b'
import type { PersonOption } from './AddOwnerModal'

// ────────────────────────────────────────────────────────────────────────────
// AddPersonModal — wired til addCompanyPerson.
//
// Roller hentet fra COMPANY_PERSON_ROLE_LABELS (lib/labels.ts).
// Governance-roller udløser advarsel om sensitive data.
// ────────────────────────────────────────────────────────────────────────────

const ROLES: Array<{ value: string; label: string; governance: boolean }> = [
  { value: 'direktoer', label: 'Direktør', governance: true },
  { value: 'bestyrelsesformand', label: 'Bestyrelsesformand', governance: true },
  { value: 'bestyrelsesmedlem', label: 'Bestyrelsesmedlem', governance: true },
  { value: 'tegningsberettiget', label: 'Tegningsberettiget', governance: true },
  { value: 'revisor', label: 'Revisor', governance: false },
  { value: 'ansat', label: 'Ansat', governance: false },
  { value: 'funktionaer', label: 'Funktionær', governance: false },
  { value: 'leder', label: 'Leder', governance: true },
  { value: 'ekstern_advokat', label: 'Ekstern advokat', governance: false },
  { value: 'ekstern_raadgiver', label: 'Ekstern rådgiver', governance: false },
]

const EMPLOYMENT_TYPES: Array<{ value: string; label: string }> = [
  { value: 'funktionaer', label: 'Funktionær' },
  { value: 'ikke-funktionaer', label: 'Ikke-funktionær' },
  { value: 'vikar', label: 'Vikar' },
  { value: 'konsulent', label: 'Konsulent' },
]

const EMPLOYMENT_ROLES = new Set(['ansat', 'funktionaer'])

export interface ExistingCompanyPerson {
  personId: string
  role: string
  name: string
}

export function AddPersonModal({
  open,
  onClose,
  companyId,
  companyName,
  existing,
  persons,
}: {
  open: boolean
  onClose: () => void
  companyId: string
  companyName: string
  existing: ExistingCompanyPerson[]
  persons: PersonOption[]
}) {
  const router = useRouter()
  const [personId, setPersonId] = useState('')
  const [createNew, setCreateNew] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [personEmail, setPersonEmail] = useState('')
  const [role, setRole] = useState<string>('ansat')
  const [employmentType, setEmploymentType] = useState<string>('funktionaer')
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [submitting, startTransition] = useTransition()

  const roleMeta = ROLES.find((r) => r.value === role)
  const showEmploymentType = EMPLOYMENT_ROLES.has(role)
  const isGovernance = roleMeta?.governance ?? false

  // Validation: én aktiv direktør pr. selskab
  const directorConflict = role === 'direktoer' && existing.some((e) => e.role === 'direktoer')
  const directorConflictName = directorConflict
    ? (existing.find((e) => e.role === 'direktoer')?.name ?? 'En anden person')
    : null

  const personFieldValid = createNew
    ? firstName.trim().length > 0 && lastName.trim().length > 0
    : personId.length > 0

  const canSubmit = personFieldValid && !directorConflict && !submitting

  function handleSubmit() {
    if (!canSubmit) return
    startTransition(async () => {
      const result = await addCompanyPerson({
        companyId,
        personId: createNew ? undefined : personId,
        firstName: createNew ? firstName.trim() : undefined,
        lastName: createNew ? lastName.trim() : undefined,
        personEmail: createNew ? personEmail.trim() || undefined : undefined,
        role,
        employmentType: showEmploymentType ? employmentType : undefined,
        startDate: startDate || undefined,
      })
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success(`Person tilføjet · ${roleMeta?.label ?? role}`)
      onClose()
      router.refresh()
    })
  }

  return (
    <BModal
      open={open}
      onClose={onClose}
      title={`Tilføj person · ${companyName}`}
      subtitle={`Eksisterende: ${existing.length} ${existing.length === 1 ? 'person' : 'personer'}`}
      submitLabel="Tilføj person"
      submitDisabled={!canSubmit}
      submitting={submitting}
      onSubmit={handleSubmit}
    >
      {createNew ? (
        <>
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-b-2">Opretter ny person</span>
            <button
              type="button"
              onClick={() => setCreateNew(false)}
              className="text-[11px] text-b-blue-fg hover:underline"
            >
              ← Vælg eksisterende
            </button>
          </div>
          <BFieldRow>
            <BTextField
              label="Fornavn"
              value={firstName}
              onChange={setFirstName}
              required
              autoFocus
            />
            <BTextField label="Efternavn" value={lastName} onChange={setLastName} required />
          </BFieldRow>
          <BTextField
            label="E-mail"
            type="email"
            value={personEmail}
            onChange={setPersonEmail}
            placeholder="valgfri"
          />
        </>
      ) : (
        <>
          <BFieldWrap label="Person" required>
            <select
              value={personId}
              onChange={(e) => setPersonId(e.target.value)}
              className="rounded-[4px] border border-b-border-strong bg-white px-2.5 py-1.5 text-[13px] text-b-1 focus:border-transparent focus:outline focus:outline-2 focus:outline-b-blue-fg focus:outline-offset-[-1px]"
            >
              <option value="">— Vælg person —</option>
              {persons.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.firstName} {p.lastName}
                  {p.email ? ` · ${p.email}` : ''}
                </option>
              ))}
            </select>
          </BFieldWrap>
          <button
            type="button"
            onClick={() => setCreateNew(true)}
            className="self-start text-[11px] text-b-blue-fg hover:underline"
          >
            + Opret ny person i stedet
          </button>
        </>
      )}

      <BSegmentedField
        label="Rolle"
        options={ROLES.map((r) => ({ value: r.value, label: r.label }))}
        value={role}
        onChange={setRole}
        required
        wrap
      />

      {isGovernance && (
        <div className="rounded-[4px] border border-b-amber-fg/30 bg-b-amber-bg px-3 py-2 text-[12px] text-b-amber-fg">
          ⚠ Denne rolle giver adgang til governance-data — auditeres som INTERN sensitivitet.
        </div>
      )}

      {directorConflict && (
        <div className="rounded-[4px] border-l-[3px] border-l-b-red-fg border border-[#ffc1ba] bg-b-red-bg px-3 py-2 text-[12px] text-[#6e1010]">
          {directorConflictName} er allerede registreret som direktør. Slut den eksisterende rolle
          først eller vælg en anden.
        </div>
      )}

      {showEmploymentType && (
        <BSegmentedField
          label="Ansættelses-type"
          options={EMPLOYMENT_TYPES}
          value={employmentType}
          onChange={setEmploymentType}
        />
      )}

      <BTextField label="Start-dato" type="date" value={startDate} onChange={setStartDate} />
    </BModal>
  )
}
