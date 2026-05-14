'use client'

import { useEffect, useId, useRef } from 'react'
import { cn } from '@/lib/utils'

// ────────────────────────────────────────────────────────────────────────────
// BModal — B-stil modal-primitiv.
//
// Mønster (fra docs/design/handoff/project/uploads/mockup-add-owner-modal-b.html):
//   • 480px bred, top-mounted (padding-top: 100px)
//   • Backdrop: rgba(15,23,42,0.4) + backdrop-filter: blur(2px)
//   • Header: bg-fbfbfc · title + sub-context · × close
//   • Body: 16-18px padding · fields gap 14px
//   • Footer: bg-fbfbfc · kbd-hints venstre · Annuller/Submit højre
//   • Keyboard: Esc lukker · ⌘+Enter submitter (caller wires onSubmit)
//   • Focus-trap + focus-restore (samme mønster som AccessibleDialog)
// ────────────────────────────────────────────────────────────────────────────

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export interface BModalProps {
  open: boolean
  onClose: () => void
  title: React.ReactNode
  /** Sub-context-linje under titel — viser fx eksisterende state. */
  subtitle?: React.ReactNode
  /** Submit-handler bindes til ⌘+Enter. Skal returnere true hvis submit skete (modal lukkes ikke automatisk). */
  onSubmit?: () => void
  children: React.ReactNode
  /** Annuller-knap label (default "Annuller"). */
  cancelLabel?: string
  /** Submit-knap label. */
  submitLabel: string
  /** Disabler submit-knappen — fx hvis required-fields ikke er udfyldte. */
  submitDisabled?: boolean
  /** Submit-knap er rød (destructive) i stedet for blå. */
  destructive?: boolean
  /** Indikerer at submit kører — disabler knapper og viser "Gemmer..." */
  submitting?: boolean
  /** Bredde i px — default 480. Brug 380 til kompakte confirm-modaler. */
  width?: number
  /** ID til title (a11y). Auto-genereres via useId hvis ikke angivet. */
  titleId?: string
}

export function BModal({
  open,
  onClose,
  title,
  subtitle,
  onSubmit,
  children,
  cancelLabel = 'Annuller',
  submitLabel,
  submitDisabled,
  destructive,
  submitting,
  width = 480,
  titleId: titleIdProp,
}: BModalProps) {
  const generatedId = useId()
  const titleId = titleIdProp ?? generatedId
  const dialogRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  // Escape lukker + ⌘+Enter submitter
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        if (!submitDisabled && !submitting) onSubmit?.()
      }
    }
    document.addEventListener('keydown', handler)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose, onSubmit, submitDisabled, submitting])

  // Focus-trap + focus-restore
  useEffect(() => {
    if (!open) return
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
  }, [open])

  if (!open) return null

  function handleBackdropMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    // Luk kun ved direkte klik på backdrop, ikke ved bobling fra modal-indhold
    if (e.target === e.currentTarget && !submitting) onClose()
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!submitDisabled && !submitting) onSubmit?.()
  }

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events -- Escape håndteres via document keydown; backdrop er dekorativt
    <div
      className="fixed inset-0 z-50 flex items-start justify-center"
      style={{
        backgroundColor: 'rgba(15,23,42,0.4)',
        backdropFilter: 'blur(2px)',
        paddingTop: '100px',
      }}
      onMouseDown={handleBackdropMouseDown}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full overflow-hidden rounded-[6px] border border-b-border-strong bg-white shadow-[0_16px_48px_rgba(15,23,42,0.25)] max-w-[calc(100vw-16px)] sm:max-w-none"
        style={{ width }}
      >
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b border-b-border bg-b-panel-h px-4 py-3">
            <div className="min-w-0">
              <h2 id={titleId} className="text-[14px] font-semibold text-b-1 m-0">
                {title}
              </h2>
              {subtitle && <div className="mt-0.5 text-[12px] text-b-2">{subtitle}</div>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Luk dialog"
              disabled={submitting}
              className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] text-[16px] text-b-2 hover:bg-b-row-hover hover:text-b-1 disabled:opacity-50"
            >
              ×
            </button>
          </div>

          {/* Body */}
          <div className="flex flex-col gap-3.5 px-4 py-4">{children}</div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 border-t border-b-border bg-b-panel-h px-4 py-3">
            <div className="flex items-center gap-1.5 text-[11px] text-b-2">
              <span className="b-kbd">Esc</span>
              <span>luk</span>
              <span className="mx-1">·</span>
              <span className="b-kbd">⌘</span>
              <span className="b-kbd">↵</span>
              <span>{destructive ? 'bekræft' : 'gem'}</span>
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="rounded-[4px] border border-b-border-strong bg-white px-3 py-1.5 text-[12px] font-medium text-b-1 hover:bg-[#f6f8fa] disabled:opacity-50"
              >
                {cancelLabel}
              </button>
              <button
                type="submit"
                disabled={submitDisabled || submitting}
                className={cn(
                  'rounded-[4px] border px-3 py-1.5 text-[12px] font-medium text-white disabled:cursor-not-allowed',
                  destructive
                    ? 'border-b-red-fg bg-b-red-fg hover:bg-[#a4111f] disabled:bg-[#e8a4ab] disabled:border-[#e8a4ab]'
                    : 'border-b-blue-fg bg-b-blue-fg hover:bg-[#0860c7] disabled:bg-[#a5cef5] disabled:border-[#a5cef5]'
                )}
              >
                {submitting ? 'Gemmer...' : submitLabel}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
