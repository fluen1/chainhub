'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

// ────────────────────────────────────────────────────────────────────────────
// FilterRow primitiver — bruges på alle list-pages (contracts, cases, tasks,
// persons, companies, documents).
//
// Mønstret (én linje):
//   [Søg-input] [Selskab ▾] [Type ▾] [Status ▾] [Nulstil ×]
//   [filter-sep] [Flat | Grupperet | Kanban] [filter-spacer] [Eksportér ▾]
// ────────────────────────────────────────────────────────────────────────────

export function FilterRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 gap-y-1.5 overflow-visible">{children}</div>
  )
}

export function FilterSearch({
  value,
  onChange,
  placeholder,
  ariaLabel,
  width = 200,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  ariaLabel?: string
  width?: number
}) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? 'Søg...'}
      // Placeholder er ikke et pålideligt accessible name → eksplicit aria-label
      // (falder tilbage på placeholder-teksten, der typisk er sigende, fx "Søg selskaber...").
      aria-label={ariaLabel ?? placeholder ?? 'Søg'}
      style={{ width }}
      className="shrink-0 rounded-[4px] border border-b-border-strong bg-white px-2.5 py-1 text-[12px] text-b-1 placeholder:text-b-3 focus:border-b-blue-fg focus:outline-none focus:ring-2 focus:ring-b-blue-bg"
    />
  )
}

export function FilterSep() {
  return <span aria-hidden className="mx-0.5 h-5 w-px shrink-0 bg-b-border" />
}

export function FilterSpacer() {
  return <span className="flex-1" />
}

export function FilterButton({
  active,
  onClick,
  className,
  children,
}: {
  active?: boolean
  onClick?: () => void
  className?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'shrink-0 whitespace-nowrap rounded-[4px] border px-2.5 py-1 text-[12px] font-medium font-[inherit] transition-colors',
        active
          ? 'border-b-blue-fg bg-b-blue-bg text-b-blue-fg'
          : 'border-b-border-strong bg-white text-b-2 hover:bg-[#f6f8fa] hover:text-b-1',
        className
      )}
    >
      {children}
    </button>
  )
}

// FilterDropdown — knap der åbner en lille menu med options + outside-click close.
//
// "Alle" behandles som "ingen filter aktiv" — knappen viser label, ikke værdien.
export function FilterDropdown({
  label,
  options,
  value,
  onChange,
  divider,
}: {
  label: string
  options: string[]
  value: string
  onChange: (v: string) => void
  divider?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const hasValue = Boolean(value) && value !== 'Alle'

  return (
    <div ref={ref} className="relative shrink-0">
      <FilterButton active={hasValue} onClick={() => setOpen((o) => !o)}>
        {hasValue ? value : label} ▾
      </FilterButton>
      {open && (
        <div className="absolute left-0 top-[calc(100%+3px)] z-50 min-w-[160px] overflow-hidden rounded-[4px] border border-b-border-strong bg-white shadow-[0_8px_24px_rgba(15,23,42,0.11)]">
          {divider && (
            <div
              className="border-b border-b-divider bg-b-panel-h px-3 py-1 text-[10px] font-semibold uppercase text-b-3"
              style={{ letterSpacing: '0.5px' }}
            >
              {divider}
            </div>
          )}
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                onChange(opt)
                setOpen(false)
              }}
              className={cn(
                'block w-full whitespace-nowrap px-3 py-1.5 text-left text-[12px]',
                value === opt
                  ? 'bg-b-blue-bg font-medium text-b-blue-fg'
                  : 'text-b-1 hover:bg-b-row-hover'
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ResetButton — vises kun når mindst ét filter er aktivt. Rød tekst.
export function FilterReset({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 rounded-[4px] border border-[#ffc1ba] bg-white px-2.5 py-1 text-[12px] font-medium text-b-red-fg hover:bg-[#fff6f5]"
    >
      Nulstil ×
    </button>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// SegmentedToggle — view-mode switcher (Flat / Grupperet / Kanban).
// Den valgte option har mørk baggrund (#1f2328 + white text).
// ────────────────────────────────────────────────────────────────────────────

export function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="inline-flex shrink-0 overflow-hidden rounded-[4px] border border-b-border-strong">
      {options.map((opt, i) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'whitespace-nowrap px-2.5 py-1 text-[12px]',
            i > 0 && 'border-l border-b-border-strong',
            value === opt.value ? 'bg-b-1 text-white' : 'bg-white text-b-2 hover:bg-[#f6f8fa]'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
