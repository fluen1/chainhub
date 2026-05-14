'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { BModal, BTextField, BFieldWrap, BFieldRow } from '@/components/ui/b'
import { addPersonRole } from '@/actions/persons'
import { COMPANY_PERSON_ROLE_LABELS } from '@/lib/labels'

// ─────────────────────────────────────────────────────────────────────────────
// AddPersonRoleModal — tilknyt person til selskab med rolle.
// Bruger COMPANY_PERSON_ROLE_LABELS fra labels.ts — alle roller, ingen hardcoded subset.
// ─────────────────────────────────────────────────────────────────────────────

interface AccessibleCompany {
  id: string
  name: string
}

interface AddPersonRoleModalProps {
  open: boolean
  onClose: () => void
  personId: string
  personFullName: string
  accessibleCompanies: AccessibleCompany[]
}

// Byg options fra labels.ts — bevar rækkefølge og inkludér alle roller
const ROLE_OPTIONS = Object.entries(COMPANY_PERSON_ROLE_LABELS).map(([value, label]) => ({
  value,
  label,
}))

export function AddPersonRoleModal({
  open,
  onClose,
  personId,
  personFullName,
  accessibleCompanies,
}: AddPersonRoleModalProps) {
  const [companyId, setCompanyId] = useState('')
  const [role, setRole] = useState('')
  const [startDate, setStartDate] = useState('')
  const [note, setNote] = useState('')
  const [submitting, startSubmit] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const isValid = companyId.length > 0 && role.length > 0

  function handleClose() {
    setCompanyId('')
    setRole('')
    setStartDate('')
    setNote('')
    setError(null)
    onClose()
  }

  function handleSubmit() {
    setError(null)
    startSubmit(async () => {
      const result = await addPersonRole({
        personId,
        companyId,
        role,
        startDate: startDate || undefined,
        note: note.trim() || undefined,
      })

      if ('error' in result) {
        const msg = result.error ?? 'Ukendt fejl'
        setError(msg)
        toast.error(msg)
        return
      }

      toast.success('Rolle tilføjet')
      handleClose()
    })
  }

  const selectBase =
    'rounded-[4px] border border-b-border-strong bg-white px-2.5 py-1.5 text-[13px] text-b-1 focus:border-transparent focus:outline focus:outline-2 focus:outline-b-blue-fg focus:outline-offset-[-1px] disabled:cursor-not-allowed disabled:opacity-60'

  return (
    <BModal
      open={open}
      onClose={handleClose}
      title="Tilføj rolle"
      subtitle={personFullName}
      onSubmit={handleSubmit}
      submitLabel="Tilføj rolle"
      submitDisabled={!isValid}
      submitting={submitting}
    >
      {/* Selskab dropdown */}
      <BFieldWrap label="Selskab" required>
        <select
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
          className={selectBase}
          // eslint-disable-next-line jsx-a11y/no-autofocus -- modaler skal fokusere første felt
          autoFocus
        >
          <option value="">— Vælg selskab —</option>
          {accessibleCompanies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </BFieldWrap>

      {/* Rolle dropdown — alle roller fra labels.ts */}
      <BFieldWrap label="Rolle" required>
        <select value={role} onChange={(e) => setRole(e.target.value)} className={selectBase}>
          <option value="">— Vælg rolle —</option>
          {ROLE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </BFieldWrap>

      <BFieldRow>
        {/* Startdato (valgfri) */}
        <BTextField
          label="Startdato (valgfri)"
          value={startDate}
          onChange={setStartDate}
          type="date"
        />

        {/* Note (valgfri) */}
        <BTextField
          label="Note (valgfri)"
          value={note}
          onChange={setNote}
          placeholder="Fx ansvarsfelt..."
        />
      </BFieldRow>

      {error && (
        <p className="rounded-[4px] border border-red-200 bg-red-50 px-2.5 py-1.5 text-[12px] text-red-700">
          {error}
        </p>
      )}
    </BModal>
  )
}
