'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { updateContract } from '@/actions/contracts'
import { BModal, BTextField, BTextareaField, BFieldWrap, BFieldRow } from '@/components/ui/b'
import { SENSITIVITY_LABELS, CONTRACT_TYPE_LABELS } from '@/lib/labels'

// ─────────────────────────────────────────────────────────────────────────────
// EditContractDialog — BModal til redigering af kontrakt-metadata.
// Erstatter href-links der pegede på /contracts/[id]/edit (404).
//
// Brug:
//   <EditContractDialog
//     open={open}
//     onClose={() => setOpen(false)}
//     contract={{ id, displayName, systemType, sensitivity, expiryDate, effectiveDate, notes }}
//   />
// ─────────────────────────────────────────────────────────────────────────────

interface EditContractDialogProps {
  open: boolean
  onClose: () => void
  contract: {
    id: string
    displayName: string
    systemType: string
    sensitivity: string
    expiryDate: Date | null
    effectiveDate: Date | null
    notes: string | null
  }
}

const SENSITIVITY_OPTIONS = Object.entries(SENSITIVITY_LABELS).map(([value, label]) => ({
  value,
  label,
}))

const CONTRACT_TYPE_OPTIONS = Object.entries(CONTRACT_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}))

function toDateInputValue(d: Date | null): string {
  if (!d) return ''
  return new Date(d).toISOString().slice(0, 10)
}

export function EditContractDialog({ open, onClose, contract }: EditContractDialogProps) {
  const [displayName, setDisplayName] = useState(contract.displayName)
  const [systemType, setSystemType] = useState(contract.systemType)
  const [sensitivity, setSensitivity] = useState(contract.sensitivity)
  const [expiryDate, setExpiryDate] = useState(toDateInputValue(contract.expiryDate))
  const [effectiveDate, setEffectiveDate] = useState(toDateInputValue(contract.effectiveDate))
  const [notes, setNotes] = useState(contract.notes ?? '')
  const [submitting, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const isValid = displayName.trim().length > 0

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      const result = await updateContract({
        contractId: contract.id,
        displayName: displayName.trim(),
        systemType: systemType as never,
        sensitivity: sensitivity as never,
        expiryDate: expiryDate || '',
        effectiveDate: effectiveDate || '',
        notes: notes.trim() || undefined,
      })

      if ('error' in result && result.error) {
        setError(result.error)
        toast.error(result.error)
        return
      }

      toast.success('Kontrakt opdateret')
      onClose()
    })
  }

  const selectCls =
    'rounded-[4px] border border-b-border-strong bg-white px-2.5 py-1.5 text-[13px] text-b-1 focus:border-transparent focus:outline focus:outline-2 focus:outline-b-blue-fg focus:outline-offset-[-1px]'

  return (
    <BModal
      open={open}
      onClose={onClose}
      title="Rediger kontrakt"
      subtitle={contract.displayName}
      onSubmit={handleSubmit}
      submitLabel="Gem ændringer"
      submitDisabled={!isValid}
      submitting={submitting}
      width={520}
    >
      <BTextField
        label="Kontraktnavn"
        value={displayName}
        onChange={setDisplayName}
        placeholder="Fx Lejekontrakt Østerbro 2024"
        required
        autoFocus
      />

      <BFieldRow>
        <BFieldWrap label="Kontrakttype" required>
          <select
            value={systemType}
            onChange={(e) => setSystemType(e.target.value)}
            className={selectCls}
          >
            {CONTRACT_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </BFieldWrap>

        <BFieldWrap label="Sensitivitet" required>
          <select
            value={sensitivity}
            onChange={(e) => setSensitivity(e.target.value)}
            className={selectCls}
          >
            {SENSITIVITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </BFieldWrap>
      </BFieldRow>

      <BFieldRow>
        <BTextField
          label="Effektiv fra"
          type="date"
          value={effectiveDate}
          onChange={setEffectiveDate}
        />
        <BTextField label="Udløbsdato" type="date" value={expiryDate} onChange={setExpiryDate} />
      </BFieldRow>

      <BTextareaField
        label="Noter"
        value={notes}
        onChange={setNotes}
        placeholder="Interne noter om kontrakten..."
        rows={3}
      />

      {error && (
        <p className="rounded-[4px] border border-red-200 bg-red-50 px-2.5 py-1.5 text-[12px] text-red-700">
          {error}
        </p>
      )}
    </BModal>
  )
}
