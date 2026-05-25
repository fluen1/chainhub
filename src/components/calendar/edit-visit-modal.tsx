'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { updateVisit, deleteVisit } from '@/actions/visits'

// ────────────────────────────────────────────────────────────────────────────
// EditVisitModal — redigér et besøg direkte fra kalenderen.
// Åbner in-place (ingen sidenavigation), fokus-trap + Escape-luk.
//
// Mønster: EditVisitModal er en tynd wrapper der:
//  1. Renderer null hvis !open || !visit
//  2. Mountes EditVisitForm med key={visit.id} → form-state nulstilles ved skift
// ────────────────────────────────────────────────────────────────────────────

export interface EditVisitData {
  id: string
  title: string
  date: string
  status?: string
  notes?: string | null
  summary?: string | null
}

interface EditVisitModalProps {
  open: boolean
  onClose: () => void
  visit: EditVisitData | null
}

type VisitStatus = 'PLANLAGT' | 'GENNEMFOERT' | 'AFLYST'

const STATUS_LABELS: Record<VisitStatus, string> = {
  PLANLAGT: 'Planlagt',
  GENNEMFOERT: 'Gennemført',
  AFLYST: 'Aflyst',
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function EditVisitModal({ open, onClose, visit }: EditVisitModalProps) {
  if (!open || !visit) return null

  return <EditVisitForm key={visit.id} visit={visit} onClose={onClose} />
}

// ────────────────────────────────────────────────────────────────────────────
// EditVisitForm — modalen med formularfelter.
// Mountes med key={visit.id} → state initialiseres én gang pr. besøg.
// ────────────────────────────────────────────────────────────────────────────

function EditVisitForm({ visit, onClose }: { visit: EditVisitData; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  // Initialisér state fra visit-prop (én gang ved mount, via key)
  const [status, setStatus] = useState<VisitStatus>((visit.status as VisitStatus) ?? 'PLANLAGT')
  const [notes, setNotes] = useState(visit.notes ?? '')
  const [summary, setSummary] = useState(visit.summary ?? '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Escape-luk
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Focus-trap + fokus-restore
  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null

    const first = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)[0]
    first?.focus()

    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !dialogRef.current) return
      const focusables = dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      if (focusables.length === 0) return
      const firstEl = focusables[0]!
      const lastEl = focusables[focusables.length - 1]!
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault()
        lastEl.focus()
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault()
        firstEl.focus()
      }
    }
    document.addEventListener('keydown', trap)
    return () => {
      document.removeEventListener('keydown', trap)
      previouslyFocused.current?.focus()
    }
  }, [])

  async function handleSave() {
    setSaving(true)
    const result = await updateVisit({
      visitId: visit.id,
      status,
      notes: notes || undefined,
      summary: summary || undefined,
    })
    setSaving(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Besøg opdateret')
      onClose()
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm('Er du sikker på, at du vil slette dette besøg?')
    if (!confirmed) return
    setDeleting(true)
    const result = await deleteVisit(visit.id)
    setDeleting(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Besøg slettet')
      onClose()
    }
  }

  const handleBackdropMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={handleBackdropMouseDown}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Redigér besøg"
        className="w-full max-w-md rounded-[6px] border border-b-border bg-white shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-b-divider px-4 py-3">
          <div>
            <div className="text-[13px] font-semibold text-b-1">{visit.title}</div>
            <div className="text-[11px] text-b-2">{visit.date}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[4px] p-1 text-b-3 hover:bg-b-gray-bg hover:text-b-1"
            aria-label="Luk"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M1 1l12 12M13 1L1 13"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Formular */}
        <div className="space-y-3 px-4 py-4">
          {/* Status */}
          <div>
            <label htmlFor="ev-status" className="mb-1 block text-[11px] font-medium text-b-2">
              Status
            </label>
            <select
              id="ev-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as VisitStatus)}
              className="w-full rounded-[4px] border border-b-border bg-white px-2 py-1.5 text-[12px] text-b-1 focus:border-b-blue-fg focus:outline-none"
            >
              {(Object.keys(STATUS_LABELS) as VisitStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>

          {/* Noter */}
          <div>
            <label htmlFor="ev-notes" className="mb-1 block text-[11px] font-medium text-b-2">
              Noter
            </label>
            <textarea
              id="ev-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Interne noter til besøget..."
              className="w-full resize-none rounded-[4px] border border-b-border bg-white px-2 py-1.5 text-[12px] text-b-1 placeholder:text-b-3 focus:border-b-blue-fg focus:outline-none"
            />
          </div>

          {/* Opsummering */}
          <div>
            <label htmlFor="ev-summary" className="mb-1 block text-[11px] font-medium text-b-2">
              Opsummering
            </label>
            <textarea
              id="ev-summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
              placeholder="Kort opsummering af besøget..."
              className="w-full resize-none rounded-[4px] border border-b-border bg-white px-2 py-1.5 text-[12px] text-b-1 placeholder:text-b-3 focus:border-b-blue-fg focus:outline-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-b-divider px-4 py-3">
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting || saving}
            className="rounded-[4px] px-3 py-1.5 text-[12px] font-medium text-b-red-fg hover:bg-b-red-bg disabled:opacity-50"
          >
            {deleting ? 'Sletter...' : 'Slet besøg'}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving || deleting}
              className="rounded-[4px] border border-b-border px-3 py-1.5 text-[12px] font-medium text-b-1 hover:bg-b-gray-bg disabled:opacity-50"
            >
              Annuller
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || deleting}
              className="rounded-[4px] bg-b-blue-fg px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'Gemmer...' : 'Gem ændringer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
