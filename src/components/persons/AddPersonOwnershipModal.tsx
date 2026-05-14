'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { BModal, BTextField, BFieldWrap, BFieldRow } from '@/components/ui/b'
import { addPersonOwnership } from '@/actions/persons'

// ─────────────────────────────────────────────────────────────────────────────
// AddPersonOwnershipModal — registrér ejerskab (% andel) for person i selskab.
// STRENGT_FORTROLIG — vises kun hvis brugeren har den rette adgang.
// ─────────────────────────────────────────────────────────────────────────────

interface AccessibleCompany {
  id: string
  name: string
}

interface AddPersonOwnershipModalProps {
  open: boolean
  onClose: () => void
  personId: string
  personFullName: string
  accessibleCompanies: AccessibleCompany[]
}

export function AddPersonOwnershipModal({
  open,
  onClose,
  personId,
  personFullName,
  accessibleCompanies,
}: AddPersonOwnershipModalProps) {
  const [companyId, setCompanyId] = useState('')
  const [sharePercent, setSharePercent] = useState('')
  const [acquiredDate, setAcquiredDate] = useState('')
  const [note, setNote] = useState('')
  const [submitting, startSubmit] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const parsedPercent = parseFloat(sharePercent)
  const isValid =
    companyId.length > 0 &&
    sharePercent.length > 0 &&
    !isNaN(parsedPercent) &&
    parsedPercent > 0 &&
    parsedPercent <= 100

  function handleClose() {
    setCompanyId('')
    setSharePercent('')
    setAcquiredDate('')
    setNote('')
    setError(null)
    onClose()
  }

  function handleSubmit() {
    setError(null)
    startSubmit(async () => {
      const result = await addPersonOwnership({
        personId,
        companyId,
        sharePercent: parsedPercent,
        acquiredDate: acquiredDate || undefined,
        note: note.trim() || undefined,
      })

      if ('error' in result) {
        const msg = result.error ?? 'Ukendt fejl'
        setError(msg)
        toast.error(msg)
        return
      }

      toast.success('Ejerskab registreret')
      handleClose()
    })
  }

  const selectBase =
    'rounded-[4px] border border-b-border-strong bg-white px-2.5 py-1.5 text-[13px] text-b-1 focus:border-transparent focus:outline focus:outline-2 focus:outline-b-blue-fg focus:outline-offset-[-1px] disabled:cursor-not-allowed disabled:opacity-60'

  return (
    <BModal
      open={open}
      onClose={handleClose}
      title="Registrér ejerskab"
      subtitle={personFullName}
      onSubmit={handleSubmit}
      submitLabel="Registrér ejerskab"
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

      {/* Andel + erhvervet-dato i 2-kol */}
      <BFieldRow>
        <BTextField
          label="Andel (%)"
          value={sharePercent}
          onChange={setSharePercent}
          placeholder="fx 33.33"
          type="number"
          required
          hint="Mellem 0.01 og 100"
          error={
            sharePercent.length > 0 &&
            (isNaN(parsedPercent) || parsedPercent <= 0 || parsedPercent > 100)
              ? 'Ugyldig andel — skal være mellem 0.01 og 100'
              : null
          }
        />
        <BTextField
          label="Erhvervet (valgfri)"
          value={acquiredDate}
          onChange={setAcquiredDate}
          type="date"
        />
      </BFieldRow>

      <BTextField
        label="Note (valgfri)"
        value={note}
        onChange={setNote}
        placeholder="Fx ejeraftale-reference..."
      />

      {error && (
        <p className="rounded-[4px] border border-red-200 bg-red-50 px-2.5 py-1.5 text-[12px] text-red-700">
          {error}
        </p>
      )}
    </BModal>
  )
}
