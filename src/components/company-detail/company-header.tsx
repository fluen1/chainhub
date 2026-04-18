import { cn } from '@/lib/utils'
import type { HealthDimensions, StatusBadge } from '@/lib/company-detail/helpers'

export interface CompanyHeaderProps {
  name: string
  cvr: string | null
  city: string | null
  status: string
  foundedYear: number | null
  statusBadge: StatusBadge
  healthDimensions: HealthDimensions
  showHealthDims: boolean
  editStamdataButton: React.ReactNode
  createTaskHref: string
  readOnly: boolean
}

const DIM_DOT: Record<string, string> = {
  red: 'bg-red-500',
  amber: 'bg-amber-500',
  green: 'bg-green-500',
}

const STATUS_BADGE: Record<string, string> = {
  critical: 'bg-red-50 border-red-200 text-red-600',
  warning: 'bg-amber-50 border-amber-200 text-amber-700',
  healthy: 'bg-green-50 border-green-200 text-green-700',
}

export function CompanyHeader({
  name,
  cvr,
  city,
  status,
  foundedYear,
  statusBadge,
  healthDimensions,
  showHealthDims,
  editStamdataButton,
  createTaskHref,
  readOnly,
}: CompanyHeaderProps) {
  const metaParts: string[] = []
  if (cvr) metaParts.push(`CVR ${cvr}`)
  if (city) metaParts.push(city)
  metaParts.push(status)
  if (foundedYear) metaParts.push(`Stiftet ${foundedYear}`)

  return (
    <div className="mb-4 grid grid-cols-[1fr_auto] gap-5 rounded-2xl bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <div>
        <div className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight text-slate-900">
          {name}
          <span
            className={cn(
              'rounded-lg border px-2.5 py-1 text-[11px] font-bold',
              STATUS_BADGE[statusBadge.severity]
            )}
          >
            {statusBadge.label}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap gap-4 text-[13px] text-slate-500">
          {metaParts.map((p, i) => (
            <span key={i}>{p}</span>
          ))}
        </div>

        {showHealthDims && (
          <div className="mt-3.5 flex gap-2">
            {(
              [
                { key: 'kontrakter', label: 'Kontrakter', tone: healthDimensions.kontrakter },
                { key: 'sager', label: 'Sager', tone: healthDimensions.sager },
                { key: 'oekonomi', label: 'Økonomi', tone: healthDimensions.oekonomi },
                { key: 'governance', label: 'Governance', tone: healthDimensions.governance },
              ] as const
            ).map((dim) => (
              <div
                key={dim.key}
                className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600"
              >
                <span className={cn('h-2 w-2 rounded-full', DIM_DOT[dim.tone])} />
                {dim.label}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col items-end gap-2">
        <a
          href={createTaskHref}
          aria-disabled={readOnly}
          className={cn(
            'rounded-lg px-4 py-2 text-xs font-semibold no-underline',
            readOnly
              ? 'cursor-not-allowed bg-slate-100 text-slate-400'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          )}
        >
          Opret opgave
        </a>
        {editStamdataButton}
      </div>
    </div>
  )
}
