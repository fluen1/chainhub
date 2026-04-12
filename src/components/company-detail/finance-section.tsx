import { SectionCard } from './section-card'
import { cn } from '@/lib/utils'

export interface FinanceData {
  omsaetning: { value_mio: number; yoy_pct: number | null }
  ebitda: { value_k: number; yoy_pct: number | null }
  margin_pct: number
  resultat: { value_k: number; positive: boolean }
  quarterly: Array<{ label: string; fraction: number }>
  statusBadge: { label: string; tone: 'green' | 'amber' | 'red' }
}

export interface FinanceSectionProps {
  data: FinanceData | null
}

function fmtYoY(pct: number | null): { label: string; positive: boolean } | null {
  if (pct === null) return null
  const sign = pct >= 0 ? '+' : ''
  return { label: `${sign}${pct.toFixed(0)}%`, positive: pct >= 0 }
}

function DataRow({
  label,
  value,
  delta,
  danger,
  success,
}: {
  label: string
  value: string
  delta?: { label: string; positive: boolean }
  danger?: boolean
  success?: boolean
}) {
  return (
    <div className="flex items-center justify-between border-b border-slate-50 py-2 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <div>
        <span
          className={cn(
            'text-[13px] font-semibold tabular-nums',
            danger && 'text-red-600',
            success && 'text-green-600',
            !danger && !success && 'text-slate-900'
          )}
        >
          {value}
        </span>
        {delta && (
          <span
            className={cn(
              'ml-1.5 text-[10px] font-semibold',
              delta.positive ? 'text-green-600' : 'text-red-600'
            )}
          >
            {delta.label}
          </span>
        )}
      </div>
    </div>
  )
}

export function FinanceSection({ data }: FinanceSectionProps) {
  if (!data) {
    return (
      <SectionCard title="Økonomi 2025">
        <p className="py-2 text-center text-xs text-slate-400">Ingen økonomi-data registreret for 2025</p>
      </SectionCard>
    )
  }

  return (
    <SectionCard title="Økonomi 2025" badge={data.statusBadge}>
      <DataRow
        label="Omsætning"
        value={`${data.omsaetning.value_mio.toFixed(1)}M kr.`}
        delta={fmtYoY(data.omsaetning.yoy_pct) ?? undefined}
      />
      <DataRow
        label="EBITDA"
        value={`${data.ebitda.value_k.toFixed(0)}K kr.`}
        delta={fmtYoY(data.ebitda.yoy_pct) ?? undefined}
      />
      <DataRow label="EBITDA margin" value={`${data.margin_pct.toFixed(1)}%`} />
      <DataRow
        label="Resultat"
        value={`${data.resultat.value_k.toFixed(0)}K kr.`}
        danger={!data.resultat.positive}
        success={data.resultat.positive}
      />

      <div className="mt-3">
        <div className="mb-1 text-[10px] text-slate-400">Omsætning pr. kvartal</div>
        <div className="flex h-12 items-end gap-[3px]">
          {data.quarterly.map((q, i) => (
            <div
              key={q.label}
              className={cn(
                'min-h-[4px] flex-1 rounded-t',
                i === data.quarterly.length - 1 ? 'bg-blue-600' : 'bg-blue-200'
              )}
              style={{ height: `${Math.max(4, q.fraction * 100)}%` }}
            />
          ))}
        </div>
        <div className="mt-0.5 flex justify-between text-[9px] text-slate-400">
          {data.quarterly.map((q) => (
            <span key={q.label}>{q.label}</span>
          ))}
        </div>
      </div>
    </SectionCard>
  )
}
