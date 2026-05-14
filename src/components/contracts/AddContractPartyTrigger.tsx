'use client'

import { useState } from 'react'
import { BAddButton } from '@/components/ui/b'
import { AddContractPartyModal, type PersonOption } from './AddContractPartyModal'

// ─────────────────────────────────────────────────────────────────────────────
// AddContractPartyTrigger — tynd klient-wrapper der ejer AddContractPartyModal-state.
// Bruges i /contracts/[id] page.tsx for at holde side-komponenten server-rendered.
// ─────────────────────────────────────────────────────────────────────────────

export interface AddContractPartyTriggerProps {
  contractId: string
  contractName: string
  persons: PersonOption[]
}

export function AddContractPartyTrigger({
  contractId,
  contractName,
  persons,
}: AddContractPartyTriggerProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <BAddButton onClick={() => setOpen(true)}>+ Tilføj part</BAddButton>
      <AddContractPartyModal
        open={open}
        onClose={() => setOpen(false)}
        contractId={contractId}
        contractName={contractName}
        persons={persons}
      />
    </>
  )
}
