import { SectionCard } from './section-card'

export interface OwnershipData {
  kaedegruppePct: number
  localPartner: { name: string; pct: number } | null
  ejeraftaleStatus: { label: string; danger: boolean } | null
  holdingCompanyName: string | null
}

export interface OwnershipSectionProps {
  data: OwnershipData | null
}

function DataRow({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-50 py-2 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span
        className={`text-[13px] font-semibold tabular-nums ${
          danger ? 'text-red-600' : 'text-slate-900'
        }`}
      >
        {value}
      </span>
    </div>
  )
}

export function OwnershipSection({ data }: OwnershipSectionProps) {
  if (!data) {
    return (
      <SectionCard title="Ejerskab">
        <p className="py-2 text-center text-xs text-slate-400">Ingen ejerskabsdata registreret</p>
      </SectionCard>
    )
  }

  const partnerTotal = 100 - data.kaedegruppePct

  return (
    <SectionCard title="Ejerskab">
      <DataRow label="Kaedegruppe-andel" value={`${data.kaedegruppePct}%`} />
      <DataRow
        label="Lokal partner"
        value={
          data.localPartner ? `${data.localPartner.name} (${data.localPartner.pct}%)` : 'Ingen'
        }
      />
      <DataRow
        label="Ejeraftale"
        value={data.ejeraftaleStatus?.label ?? 'Ingen'}
        danger={data.ejeraftaleStatus?.danger}
      />
      <DataRow label="Holdingselskab" value={data.holdingCompanyName ?? 'Ingen'} />

      <div className="mt-3">
        <div className="flex h-2 overflow-hidden rounded">
          <div className="bg-blue-600" style={{ width: `${data.kaedegruppePct}%` }} />
          <div className="bg-slate-200" style={{ width: `${partnerTotal}%` }} />
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-slate-400">
          <span>Kaedegruppe {data.kaedegruppePct}%</span>
          <span>Partnere {partnerTotal}%</span>
        </div>
      </div>
    </SectionCard>
  )
}
