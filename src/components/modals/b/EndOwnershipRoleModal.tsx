'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { BModal, BTextField, BTextareaField, BSegmentedField } from '@/components/ui/b'
import { endOwnership } from '@/actions/ownership'
import { endCompanyPerson } from '@/actions/governance'

// ────────────────────────────────────────────────────────────────────────────
// EndOwnershipRoleModal — parameteriseret modal til både ejerskab og rolle.
// Wired til hhv. endOwnership (mode='ownership') og endCompanyPerson (mode='role').
//
// Confirm-step: bruger skal skrive "SLUT" for at aktivere submit-knappen
// (destructive action). Kompakt 380px width.
// ────────────────────────────────────────────────────────────────────────────

type Mode = 'ownership' | 'role'

const REASONS: Array<{ value: string; label: string }> = [
  { value: 'salg', label: 'Salg' },
  { value: 'tilbagetrækning', label: 'Tilbagetrækning' },
  { value: 'død', label: 'Død' },
  { value: 'konkurs', label: 'Konkurs' },
  { value: 'andet', label: 'Andet' },
]

export function EndOwnershipRoleModal({
  open,
  onClose,
  mode,
  id,
  personName,
  contextLabel,
}: {
  open: boolean
  onClose: () => void
  mode: Mode
  /** ownershipId hvis mode='ownership', companyPersonId hvis mode='role'. */
  id: string
  personName: string
  /** Sub-context, fx "49% ejer i Tandlæge Østerbro" eller "CEO i Tandlæge Østerbro". */
  contextLabel: string
}) {
  const router = useRouter()
  const today = new Date().toISOString().slice(0, 10)
  const [endDate, setEndDate] = useState(today)
  const [reason, setReason] = useState('tilbagetrækning')
  const [reasonOther, setReasonOther] = useState('')
  const [note, setNote] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [submitting, startTransition] = useTransition()

  const isOwnership = mode === 'ownership'
  const confirmOk = confirmText === 'SLUT'
  const reasonOk = reason !== 'andet' || reasonOther.trim().length > 0
  const dateOk = !!endDate
  const canSubmit = confirmOk && reasonOk && dateOk && !submitting

  function handleSubmit() {
    if (!canSubmit) return
    startTransition(async () => {
      const result = isOwnership
        ? await endOwnership({ ownershipId: id, endDate })
        : await endCompanyPerson({ companyPersonId: id, endDate })

      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success(
        isOwnership ? `Ejerskab afregistreret · ${personName}` : `Rolle afsluttet · ${personName}`
      )
      setConfirmText('')
      setNote('')
      onClose()
      router.refresh()
    })
  }

  return (
    <BModal
      open={open}
      onClose={onClose}
      width={380}
      title={isOwnership ? `Slut ejerskab · ${personName}` : `Slut rolle · ${personName}`}
      subtitle={contextLabel}
      submitLabel={isOwnership ? 'Slut ejerskab' : 'Slut rolle'}
      submitDisabled={!canSubmit}
      submitting={submitting}
      destructive
      onSubmit={handleSubmit}
    >
      <BTextField
        label="Slut-dato"
        type="date"
        value={endDate}
        onChange={setEndDate}
        required
        hint={`Max: i dag (${today})`}
      />

      <BSegmentedField
        label="Årsag"
        options={REASONS}
        value={reason}
        onChange={setReason}
        required
        wrap
      />

      {reason === 'andet' && (
        <BTextField
          label="Beskriv årsag"
          value={reasonOther}
          onChange={setReasonOther}
          required
          placeholder="Fx interne omstruktureringer"
        />
      )}

      <BTextareaField
        label="Note (valgfri)"
        value={note}
        onChange={setNote}
        placeholder={
          isOwnership ? 'Fx referencer til salgsdokumenter' : 'Fx overdragelse til ny rolle'
        }
      />

      {/* Confirm-step: SLUT-input */}
      <div className="rounded-[4px] border-l-[3px] border-l-b-red-fg border border-[#ffc1ba] bg-b-red-bg px-3 py-2.5">
        <div className="mb-1.5 text-[12px] font-medium text-[#6e1010]">
          Destruktiv handling — bekræft ved at skrive <code className="b-kbd">SLUT</code>
        </div>
        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="Skriv SLUT for at bekræfte"
          className={`w-full rounded-[4px] border bg-white px-2.5 py-1.5 text-[13px] focus:outline focus:outline-2 focus:outline-offset-[-1px] ${
            confirmOk
              ? 'border-b-green-fg focus:outline-b-green-fg'
              : 'border-b-border-strong focus:outline-b-red-fg'
          }`}
        />
        {confirmText.length > 0 && !confirmOk && (
          <div className="mt-1 text-[11px] text-b-red-fg">
            Skriv præcis &ldquo;SLUT&rdquo; (store bogstaver)
          </div>
        )}
      </div>
    </BModal>
  )
}
