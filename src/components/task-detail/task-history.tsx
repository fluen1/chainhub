import { History as HistoryIcon, ArrowRight } from 'lucide-react'
import { SectionCard } from '@/components/company-detail/section-card'
import type { FormattedHistoryEntry } from '@/lib/task-detail/helpers'

interface TaskHistoryProps {
  entries: FormattedHistoryEntry[]
}

function formatRelative(date: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'lige nu'
  if (diffMin < 60) return `${diffMin} min siden`
  const diffHrs = Math.floor(diffMin / 60)
  if (diffHrs < 24) return `${diffHrs} t siden`
  const diffDays = Math.floor(diffHrs / 24)
  if (diffDays < 7) return `${diffDays} d siden`
  return date.toLocaleDateString('da-DK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function TaskHistory({ entries }: TaskHistoryProps) {
  return (
    <SectionCard title="Historik">
      {entries.length === 0 ? (
        <div className="py-6 text-center">
          <HistoryIcon className="mx-auto mb-2 h-6 w-6 text-slate-300" aria-hidden />
          <p className="text-xs text-slate-400">Ingen ændringer registreret endnu</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {entries.map((e) => (
            <li key={e.id} className="flex gap-3 text-sm">
              <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-400" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 text-slate-700">
                  <span className="font-medium">{e.fieldLabel}</span>
                  <span className="text-slate-400">ændret</span>
                  <span className="inline-flex items-center gap-1">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">
                      {e.oldLabel}
                    </span>
                    <ArrowRight className="h-3 w-3 text-slate-400" aria-hidden />
                    <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                      {e.newLabel}
                    </span>
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-slate-400">
                  {e.changedByName} · {formatRelative(e.changedAt)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}
