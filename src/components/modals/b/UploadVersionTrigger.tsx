'use client'

import { useState } from 'react'
import { BButton, BAddButton } from '@/components/ui/b'
import { UploadVersionModal } from './UploadVersionModal'

// ────────────────────────────────────────────────────────────────────────────
// UploadVersionTrigger — tynd klient-wrapper der ejer modal-state.
// Bruges i /contracts/[id] page.tsx på begge "Upload ny version"-knapper
// så side-komponenten kan blive server-rendered.
//
// Variant "primary" → primary header-knap; "add" → dashed BAddButton i panel-footer.
// ────────────────────────────────────────────────────────────────────────────

export interface UploadVersionTriggerProps {
  contractId: string
  contractName: string
  companyId: string
  companyName: string
  currentVersion: number | null
  variant: 'primary' | 'add'
  label?: string
}

export function UploadVersionTrigger({
  contractId,
  contractName,
  companyId,
  companyName,
  currentVersion,
  variant,
  label,
}: UploadVersionTriggerProps) {
  const [open, setOpen] = useState(false)
  const text = label ?? (variant === 'primary' ? 'Upload ny version' : '+ Upload ny version')

  return (
    <>
      {variant === 'primary' ? (
        <BButton primary onClick={() => setOpen(true)}>
          {text}
        </BButton>
      ) : (
        <BAddButton onClick={() => setOpen(true)}>{text}</BAddButton>
      )}
      <UploadVersionModal
        open={open}
        onClose={() => setOpen(false)}
        contractId={contractId}
        contractName={contractName}
        companyId={companyId}
        companyName={companyName}
        currentVersion={currentVersion}
      />
    </>
  )
}
