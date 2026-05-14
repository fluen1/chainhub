'use client'

import { useEffect, useRef, useState } from 'react'
import { BButton } from '@/components/ui/b'

// ────────────────────────────────────────────────────────────────────────────
// AddDataDropdown — primary header-knap med dropdown over "Tilføj X"-handlinger
// på /companies/[id]. Outside-click + Escape lukker menuen. Skjules helt for
// read-only roller (rendered af parent).
// ────────────────────────────────────────────────────────────────────────────

export interface AddDataDropdownProps {
  onAddOwner: () => void
  onAddPerson: () => void
  onAddMetric: () => void
  canAddOwner: boolean
  canAddPerson: boolean
  canAddMetric: boolean
}

export function AddDataDropdown({
  onAddOwner,
  onAddPerson,
  onAddMetric,
  canAddOwner,
  canAddPerson,
  canAddMetric,
}: AddDataDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    function escHandler(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', escHandler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', escHandler)
    }
  }, [])

  if (!canAddOwner && !canAddPerson && !canAddMetric) return null

  return (
    <div ref={ref} className="relative inline-block">
      <BButton primary onClick={() => setOpen((o) => !o)}>
        + Tilføj data ▾
      </BButton>
      {open && (
        <div className="absolute right-0 top-[calc(100%+4px)] z-50 min-w-[180px] overflow-hidden rounded-[4px] border border-b-border-strong bg-white shadow-[0_8px_24px_rgba(15,23,42,0.11)]">
          {canAddOwner && (
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                onAddOwner()
              }}
              className="block w-full whitespace-nowrap px-3 py-2 text-left text-[12px] text-b-1 hover:bg-b-row-hover"
            >
              + Tilføj ejer
            </button>
          )}
          {canAddPerson && (
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                onAddPerson()
              }}
              className="block w-full whitespace-nowrap px-3 py-2 text-left text-[12px] text-b-1 hover:bg-b-row-hover"
            >
              + Tilføj person
            </button>
          )}
          {canAddMetric && (
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                onAddMetric()
              }}
              className="block w-full whitespace-nowrap px-3 py-2 text-left text-[12px] text-b-1 hover:bg-b-row-hover"
            >
              + Tilføj finansiel metric
            </button>
          )}
        </div>
      )}
    </div>
  )
}
