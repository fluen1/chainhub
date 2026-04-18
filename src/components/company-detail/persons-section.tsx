import { SectionCard } from './section-card'

export interface PersonRow {
  id: string
  initials: string
  name: string
  role: string
}

export interface PersonsSectionProps {
  persons: PersonRow[]
  totalCount: number
  companyId: string
}

export function PersonsSection({ persons, totalCount, companyId }: PersonsSectionProps) {
  return (
    <SectionCard
      title="Noeglepersoner"
      footerLinkHref={totalCount > 3 ? `/persons?company=${companyId}` : undefined}
      footerLinkLabel={totalCount > 3 ? `Vis alle ${totalCount} medarbejdere →` : undefined}
    >
      {persons.length === 0 ? (
        <p className="py-2 text-center text-xs text-slate-400">Ingen noeglepersoner registreret</p>
      ) : (
        persons.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-2.5 border-b border-slate-50 py-2 last:border-0"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[12px] font-bold text-slate-600">
              {p.initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-slate-900">{p.name}</div>
              <div className="text-[11px] text-slate-400">{p.role}</div>
            </div>
          </div>
        ))
      )}
    </SectionCard>
  )
}
