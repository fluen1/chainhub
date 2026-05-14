import { cn } from '@/lib/utils'

// Strip — KPI/facts-rækken øverst på dashboards og detail-sider.
// N=5 eller 6 celler, equal width, 1px gap (selve "border" trick — bg er
// border-farven, hver celle er hvid).

type StripColor = 'default' | 'red' | 'amber' | 'green' | 'blue'

const numColor: Record<StripColor, string> = {
  default: 'text-b-1',
  red: 'text-b-red-fg',
  amber: 'text-b-amber-fg',
  green: 'text-b-green-fg',
  blue: 'text-b-blue-fg',
}

export interface StripCellData {
  num: React.ReactNode
  label: React.ReactNode
  color?: StripColor
}

export function Strip({ cells, className }: { cells: StripCellData[]; className?: string }) {
  const cols = cells.length
  return (
    <div
      className={cn(
        'grid gap-px overflow-hidden rounded-[4px] border border-b-border bg-b-border',
        className
      )}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {cells.map((c, i) => (
        <div key={i} className="min-w-0 bg-b-panel px-3 py-2.5">
          <div
            className={cn(
              'b-tnum truncate text-[18px] font-semibold leading-none',
              numColor[c.color ?? 'default']
            )}
            title={
              typeof c.num === 'string' || typeof c.num === 'number' ? String(c.num) : undefined
            }
          >
            {c.num}
          </div>
          <div
            className="mt-1 truncate text-[11px] text-b-2"
            title={typeof c.label === 'string' ? c.label : undefined}
          >
            {c.label}
          </div>
        </div>
      ))}
    </div>
  )
}
