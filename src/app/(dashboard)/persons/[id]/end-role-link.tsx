'use client'

import { useState } from 'react'
import { EndOwnershipRoleModal } from '@/components/modals/b'
import { SlutLink } from '@/components/ui/b'

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
      <SlutLink onClick={() => setOpen(true)} title="Slut rolle" />
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
