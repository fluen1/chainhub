'use client'

import { useState, useTransition, useRef, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { updateContractStatus } from '@/actions/contracts'
import { getContractStatusLabel, CONTRACT_STATUS_LABELS } from '@/lib/labels'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────────────────────
// ContractStatusButton — B-stil dropdown til status-skift på kontrakt-detail.
//
// Erstatter orphaned ContractStatusForm (som ikke var importeret nogen steder).
// Viser nuværende status som badge + chevron. Dropdown-menu med gyldige næste
// statusser. Note-felt ved OPSAGT og UDLOEBET.
// ─────────────────────────────────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<string, string[]> = {
  UDKAST: ['TIL_REVIEW', 'AKTIV'],
  TIL_REVIEW: ['UDKAST', 'TIL_UNDERSKRIFT', 'AKTIV'],
  TIL_UNDERSKRIFT: ['TIL_REVIEW', 'AKTIV'],
  AKTIV: ['UDLOEBET', 'OPSAGT', 'FORNYET'],
  UDLOEBET: ['FORNYET'],
  OPSAGT: [],
  FORNYET: [],
  ARKIVERET: [],
}

interface ContractStatusButtonProps {
  contractId: string
  currentStatus: string
}

export function ContractStatusButton({ contractId, currentStatus }: ContractStatusButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [submitting, startTransition] = useTransition()
  const focusedIndexRef = useRef<number>(-1)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])

  const nextStatuses = VALID_TRANSITIONS[currentStatus] ?? []

  const closeDropdown = useCallback(() => {
    setOpen(false)
    setNote('')
    focusedIndexRef.current = -1
    triggerRef.current?.focus()
  }, [])

  // Luk dropdown ved klik udenfor
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        closeDropdown()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, closeDropdown])

  // Keyboard navigation
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeDropdown()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        const next = Math.min(focusedIndexRef.current + 1, nextStatuses.length - 1)
        focusedIndexRef.current = next
        itemRefs.current[next]?.focus()
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        const next = Math.max(focusedIndexRef.current - 1, 0)
        focusedIndexRef.current = next
        itemRefs.current[next]?.focus()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, closeDropdown, nextStatuses.length])

  function handleStatusChange(newStatus: string) {
    startTransition(async () => {
      const result = await updateContractStatus({
        contractId,
        status: newStatus as never,
        note: note.trim() || undefined,
      })

      if ('error' in result) {
        toast.error(result.error)
        return
      }

      toast.success(`Status ændret til ${getContractStatusLabel(newStatus)}`)
      setOpen(false)
      setNote('')
      router.refresh()
    })
  }

  if (nextStatuses.length === 0) {
    // Terminal status — ingen mulige transitioner
    return (
      <span className="inline-flex items-center rounded-[4px] border border-b-border-strong bg-white px-2.5 py-1 text-[12px] font-medium text-b-3">
        {getContractStatusLabel(currentStatus)}
      </span>
    )
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={submitting}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          'inline-flex items-center gap-1.5 rounded-[4px] border border-b-border-strong bg-white px-2.5 py-1 text-[12px] font-medium text-b-1 hover:bg-[#f6f8fa] disabled:cursor-not-allowed disabled:opacity-50'
        )}
      >
        <span>{submitting ? 'Opdaterer...' : 'Skift status'}</span>
        <svg
          className={cn('h-3 w-3 text-b-2 transition-transform', open && 'rotate-180')}
          fill="none"
          viewBox="0 0 16 16"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6l4 4 4-4" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Vælg ny status"
          className="absolute right-0 top-full z-40 mt-1 w-56 overflow-hidden rounded-[4px] border border-b-border-strong bg-white shadow-[0_4px_16px_rgba(15,23,42,0.12)]"
        >
          <div className="border-b border-b-divider bg-b-panel-h px-2.5 py-1.5">
            <div
              className="text-[10px] font-semibold uppercase text-b-2"
              style={{ letterSpacing: '0.4px' }}
            >
              Nuværende: {CONTRACT_STATUS_LABELS[currentStatus] ?? currentStatus}
            </div>
          </div>

          {nextStatuses.map((status, idx) => {
            const needsNote = status === 'OPSAGT' || status === 'UDLOEBET'
            return (
              <div key={status} role="option" aria-selected={false}>
                {needsNote ? (
                  // OPSAGT/UDLOEBET: note-felt vises altid, Bekræft validerer
                  <div className="px-2.5 py-2">
                    <div className="mb-1.5 text-[12px] font-medium text-b-1">
                      {getContractStatusLabel(status)}
                      <span className="ml-1 text-[11px] text-b-2">· note påkrævet</span>
                    </div>
                    <textarea
                      ref={(el) => {
                        // Giv focus til note-felt som det første aktive element
                        if (el && idx === 0) {
                          itemRefs.current[idx] = null
                        }
                      }}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder={`Begrund ${getContractStatusLabel(status).toLowerCase()}...`}
                      rows={2}
                      className="mb-1.5 w-full resize-none rounded-[4px] border border-b-border-strong bg-white px-2 py-1 text-[12px] text-b-1 placeholder:text-b-3 focus:border-transparent focus:outline focus:outline-2 focus:outline-b-blue-fg focus:outline-offset-[-1px]"
                    />
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => {
                        if (!note.trim()) {
                          toast.error('Note er påkrævet for denne statusændring')
                          return
                        }
                        handleStatusChange(status)
                      }}
                      className="w-full rounded-[4px] bg-b-blue-fg px-2 py-1 text-[12px] font-medium text-white hover:bg-[#0860c7] disabled:opacity-50"
                    >
                      Bekræft: {getContractStatusLabel(status)}
                    </button>
                  </div>
                ) : (
                  <button
                    ref={(el) => {
                      itemRefs.current[idx] = el
                    }}
                    type="button"
                    onClick={() => handleStatusChange(status)}
                    className="w-full px-2.5 py-1.5 text-left text-[13px] text-b-1 hover:bg-b-row-hover focus:bg-b-row-hover focus:outline-none"
                  >
                    {getContractStatusLabel(status)}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
