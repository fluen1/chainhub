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
      className={cn('overflow-hidden rounded-[4px] border border-b-border bg-b-panel', className)}
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
}: {
  col?: TKey
  sortCol?: TKey | null
  sortDir?: 'asc' | 'desc'
  onSort?: (col: TKey) => void
  alignRight?: boolean
  children: React.ReactNode
  width?: string | number
}) {
  const sorted = col && sortCol === col
  const clickable = col != null && onSort != null
  const styleObj: React.CSSProperties = { letterSpacing: '0.5px' }
  if (width != null) styleObj.width = typeof width === 'number' ? `${width}px` : width
  return (
    <th
      onClick={clickable && col ? () => onSort(col) : undefined}
      className={cn(
        'truncate border-b border-b-border bg-b-panel-h px-3 py-1.5 text-[10px] font-semibold uppercase',
        sorted ? 'text-b-1' : 'text-b-2',
        clickable && 'cursor-pointer select-none hover:text-b-1',
        alignRight ? 'text-right' : 'text-left'
      )}
      style={styleObj}
    >
      {children}
      {sorted && <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>}
    </th>
  )
}

export function Tr({
  children,
  onClick,
  href,
  className,
}: {
  children: React.ReactNode
  onClick?: () => void
  href?: string
  className?: string
}) {
  // Bemærk: href håndteres ikke direkte i tr (Next har problemer med nested
  // anchors i tabel-rækker). Pages der vil have row-as-link bør wrappe sin
  // egen <Link>. onClick + cursor-pointer giver klikbarhed.
  return (
    <tr
      onClick={onClick}
      className={cn(
        'border-b border-b-divider last:border-b-0 hover:bg-b-row-hover',
        (onClick || href) && 'cursor-pointer',
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
}: {
  children: React.ReactNode
  alignRight?: boolean
  secondary?: boolean
  className?: string
  width?: string | number
}) {
  const styleObj: React.CSSProperties = {}
  if (width != null) styleObj.width = typeof width === 'number' ? `${width}px` : width
  return (
    <td
      style={styleObj}
      className={cn(
        'b-tnum truncate px-3 py-1.5 align-middle text-[13px]',
        secondary ? 'text-b-2' : 'text-b-1',
        alignRight ? 'text-right' : 'text-left',
        className
      )}
    >
      {children}
    </td>
  )
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
