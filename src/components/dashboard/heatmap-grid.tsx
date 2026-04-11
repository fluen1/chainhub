import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { HeatmapCompany } from '@/actions/dashboard'

export interface HeatmapGridProps {
  companies: HeatmapCompany[]
}

function shortName(name: string): string {
  return name
    .replace(' ApS', '')
    .replace(' Tandlægehus', '')
    .replace(' Tandklinik', '')
    .replace(' Tandlæge', '')
    .replace(' Tandhus', '')
    .replace(/^Tandlæge /, '')
}

export function HeatmapGrid({ companies }: HeatmapGridProps) {
  const sorted = [...companies]
    .sort((a, b) => {
      const order = { critical: 0, warning: 1, healthy: 2 }
      return order[a.healthStatus] - order[b.healthStatus]
    })
    .slice(0, 15)

  if (sorted.length === 0) {
    return <p className="text-center text-xs text-gray-400 py-4">Ingen selskaber</p>
  }

  return (
    <div className="grid grid-cols-5 gap-1">
      {sorted.map((c) => {
        const cellClass =
          c.healthStatus === 'critical'
            ? 'bg-red-50 border border-red-200 text-red-800'
            : c.healthStatus === 'warning'
              ? 'bg-amber-50 border border-amber-200 text-amber-800'
              : 'bg-green-50 border border-green-200 text-green-800'
        return (
          <Link
            key={c.id}
            href={`/companies/${c.id}`}
            className={cn(
              'rounded p-1 text-center cursor-pointer hover:opacity-80 transition-opacity no-underline',
              cellClass
            )}
          >
            <div className="text-[11px] font-bold leading-tight">
              {c.openCaseCount > 0 ? c.openCaseCount : '·'}
            </div>
            <div className="text-[8px] leading-tight truncate">{shortName(c.name)}</div>
          </Link>
        )
      })}
    </div>
  )
}
