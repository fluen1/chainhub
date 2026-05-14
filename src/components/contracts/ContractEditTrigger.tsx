'use client'

import { useState } from 'react'
import { BButton } from '@/components/ui/b'
import { EditContractDialog } from './EditContractDialog'

// ─────────────────────────────────────────────────────────────────────────────
// ContractEditTrigger — tynd klient-wrapper der ejer EditContractDialog-state.
// Bruges i /contracts/[id] page.tsx for at holde side-komponenten server-rendered.
// ─────────────────────────────────────────────────────────────────────────────

export interface ContractEditTriggerProps {
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

export function ContractEditTrigger({ contract }: ContractEditTriggerProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <BButton onClick={() => setOpen(true)}>Rediger</BButton>
      <EditContractDialog open={open} onClose={() => setOpen(false)} contract={contract} />
    </>
  )
}
