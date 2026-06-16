'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { closeCase } from '@/actions/cases'
import { BModal, BTextareaField } from '@/components/ui/b'

// ────────────────────────────────────────────────────────────────────────────
// CloseCaseDialog — bekræft lukning af sag med valgfri note.
// ────────────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
  caseId: string
  caseTitle: string
}

export function CloseCaseDialog({ open, onClose, caseId, caseTitle }: Props) {
  const router = useRouter()
  const [notes, setNotes] = useState('')
  const [submitting, startTransition] = useTransition()

  function handleSubmit() {
    startTransition(async () => {
      const result = await closeCase(caseId, notes.trim() || undefined)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success('Sag lukket')
      setNotes('')
      onClose()
      router.refresh()
    })
  }

  return (
    <BModal
      open={open}
      onClose={onClose}
      title="Luk sag"
      subtitle={`Bekræft at sagen "${caseTitle}" skal lukkes. Denne handling kan fortrydes ved at genåbne sagen.`}
      submitLabel="Luk sag"
      submitDisabled={submitting}
      submitting={submitting}
      onSubmit={handleSubmit}
    >
      <BTextareaField
        label="Note (valgfri)"
        value={notes}
        onChange={setNotes}
        placeholder="Beskriv baggrund for lukning, næste trin el.lign."
        rows={3}
        hint="Maks 500 tegn"
      />
      {notes.length > 500 && (
        <p className="text-[12px] text-b-red-fg">
          Noten er for lang — maks 500 tegn ({notes.length}/500).
        </p>
      )}
    </BModal>
  )
}
