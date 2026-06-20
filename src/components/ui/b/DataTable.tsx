'use client'

import { cn } from '@/lib/utils'

// ────────────────────────────────────────────────────────────────────────────
// DataTable — dense B-stil tabel-primitiver.
// Bevidst tynde wrappers — pages bygger selv kolonner og rækker, vi giver
// kun konsistent styling for thead/th, tr/td, sort-indicator og container.
// ────────────────────────────────────────────────────────────────────────────

export function TableWrap({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn('overflow-x-auto rounded-[4px] border border-b-border bg-b-panel', className)}
    >
      {children}
    </div>
  )
}

// Th — klikbar header med sort-indikator.
//
// Brug:
//   <Th col="udlob" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>
//     Udløb
//   </Th>
export function Th<TKey extends string>({
  col,
  sortCol,
  sortDir,
  onSort,
  alignRight,
  children,
  width,
  sticky,
}: {
  col?: TKey
  sortCol?: TKey | null
  sortDir?: 'asc' | 'desc'
  onSort?: (col: TKey) => void
  alignRight?: boolean
  children: React.ReactNode
  width?: string | number
  /** Gør kolonnen klæbende i venstre kant under horisontal scroll (primær-kolonne). */
  sticky?: boolean
}) {
  const sorted = col && sortCol === col
  const clickable = col != null && onSort != null
  const styleObj: React.CSSProperties = { letterSpacing: '0.5px' }
  if (width != null) styleObj.width = typeof width === 'number' ? `${width}px` : width
  const arrow = sorted ? (
    <span className="ml-1" aria-hidden="true">
      {sortDir === 'asc' ? '↑' : '↓'}
    </span>
  ) : null
  return (
    <th
      aria-sort={
        clickable && col
          ? sorted
            ? sortDir === 'asc'
              ? 'ascending'
              : 'descending'
            : 'none'
          : undefined
      }
      className={cn(
        'truncate border-b border-b-border bg-b-panel-h px-3 py-1.5 text-[10px] font-semibold uppercase',
        sorted ? 'text-b-1' : 'text-b-2',
        sticky && 'sticky left-0 z-20',
        alignRight ? 'text-right' : 'text-left'
      )}
      style={styleObj}
    >
      {clickable && col ? (
        // Rigtig <button> → sortering er tab-bar og aktiveres med Enter/Space
        // (tidligere kun klikbar med mus → utilgængelig for tastatur/skærmlæser).
        <button
          type="button"
          onClick={() => onSort(col)}
          className={cn(
            'inline-flex items-center font-[inherit] uppercase tracking-[inherit] select-none hover:text-b-1 focus-visible:underline focus-visible:outline-none',
            alignRight && 'flex-row-reverse'
          )}
        >
          {children}
          {arrow}
        </button>
      ) : (
        <>
          {children}
          {arrow}
        </>
      )}
    </th>
  )
}

export function Tr({
  children,
  onClick,
  href,
  ariaLabel,
  className,
}: {
  children: React.ReactNode
  onClick?: () => void
  href?: string
  /** Skærmlæser-navn for en klikbar række, fx "Optik Østerbro ApS – åbn". */
  ariaLabel?: string
  className?: string
}) {
  // Klikbare rækker var tidligere KUN mus (onClick på <tr> uden tabIndex/keydown)
  // → kerneworkflowet "åbn et selskab/kontrakt/sag" var utilgængeligt for tastatur
  // og skærmlæser. Nu er rækken fokuserbar og aktiveres med Enter/Space.
  const interactive = onClick != null
  return (
    <tr
      onClick={onClick}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? ariaLabel : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick?.()
              }
            }
          : undefined
      }
      className={cn(
        'border-b border-b-divider last:border-b-0 hover:bg-b-row-hover',
        (onClick || href) && 'cursor-pointer',
        interactive &&
          'focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-b-blue-fg',
        className
      )}
    >
      {children}
    </tr>
  )
}

export function Td({
  children,
  alignRight,
  secondary,
  className,
  width,
  sticky,
}: {
  children: React.ReactNode
  alignRight?: boolean
  secondary?: boolean
  className?: string
  width?: string | number
  /** Klæbende venstre-kolonne under horisontal scroll. Matcher rækkens baggrund
   *  så indhold scroller pænt under (primær-identifikator forsvinder aldrig). */
  sticky?: boolean
}) {
  const styleObj: React.CSSProperties = {}
  if (width != null) styleObj.width = typeof width === 'number' ? `${width}px` : width
  return (
    <td
      style={styleObj}
      className={cn(
        'b-tnum truncate px-3 py-1.5 align-middle text-[13px]',
        secondary ? 'text-b-2' : 'text-b-1',
        sticky && 'sticky left-0 z-10 bg-b-panel',
        alignRight ? 'text-right' : 'text-left',
        className
      )}
    >
      {children}
    </td>
  )
}

// TableInner — <table> med min-bredde så celler ikke squishes på mobil.
// Brug i stedet for rå <table> inde i <TableWrap>.
export function TableInner({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <table className={cn('min-w-[600px] w-full border-collapse', className)}>{children}</table>
}

// EmptyState — vises i stedet for tabel når filtre giver 0 resultater.
export function TableEmpty({ children }: { children: React.ReactNode }) {
  return <div className="px-3 py-8 text-center text-[13px] text-b-3">{children}</div>
}

// Lille AI ⚡ badge til type-celle (vises på rækker hvor AI har læst dokumentet).
export function AIBadge() {
  return (
    <span
      className="rounded-[2px] bg-[#f3e8ff] px-1 py-px text-[9px] font-bold leading-tight text-b-ai-accent"
      title="AI-extracted"
    >
      ⚡
    </span>
  )
}
