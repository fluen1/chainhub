'use client'

import { useState } from 'react'
import { EndOwnershipRoleModal } from '@/components/modals/b'

// ────────────────────────────────────────────────────────────────────────────
// EndRoleLink — tynd klient-wrapper der ejer modal-state for én rolle-række.
// Bruges på /persons/[id] i Roller-panelet på hver række. Samme mønster som
// UploadVersionTrigger på /contracts/[id].
// ────────────────────────────────────────────────────────────────────────────

export function EndRoleLink({
  companyPersonId,
  personName,
  roleLabel,
  selskab,
  startDate,
}: {
  companyPersonId: string
  personName: string
  roleLabel: string
  selskab: string
  startDate: string | null
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen(true)
        }}
        className="text-[10px] text-b-2 hover:text-b-red-fg"
        title="Slut rolle"
      >
        Slut
      </button>
      <EndOwnershipRoleModal
        open={open}
        onClose={() => setOpen(false)}
        mode="role"
        id={companyPersonId}
        personName={personName}
        contextLabel={`${roleLabel} i ${selskab}${startDate ? ` (siden ${startDate})` : ''}`}
      />
    </>
  )
}
