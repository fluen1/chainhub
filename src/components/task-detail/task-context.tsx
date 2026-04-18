import Link from 'next/link'
import { Building2, Briefcase, FileText, User as UserIcon } from 'lucide-react'
import { SectionCard } from '@/components/company-detail/section-card'

interface TaskContextProps {
  relatedCompany: { id: string; name: string } | null
  relatedCase: { id: string; title: string } | null
  relatedContract: { id: string; display_name: string } | null
  assignee: { id: string; name: string } | null
}

function ContextRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof Building2
  label: string
  value: string | null
  href?: string
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <Icon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
        {value === null ? (
          <div className="text-sm text-slate-400">—</div>
        ) : href ? (
          <Link
            href={href}
            className="text-sm font-medium text-blue-600 hover:text-blue-800 no-underline truncate block"
          >
            {value}
          </Link>
        ) : (
          <div className="text-sm font-medium text-slate-900 truncate">{value}</div>
        )}
      </div>
    </div>
  )
}

export function TaskContext({
  relatedCompany,
  relatedCase,
  relatedContract,
  assignee,
}: TaskContextProps) {
  return (
    <SectionCard title="Kontekst">
      <div className="divide-y divide-slate-100">
        <ContextRow
          icon={Building2}
          label="Selskab"
          value={relatedCompany?.name ?? null}
          href={relatedCompany ? `/companies/${relatedCompany.id}` : undefined}
        />
        <ContextRow
          icon={Briefcase}
          label="Sag"
          value={relatedCase?.title ?? null}
          href={relatedCase ? `/cases/${relatedCase.id}` : undefined}
        />
        <ContextRow
          icon={FileText}
          label="Kontrakt"
          value={relatedContract?.display_name ?? null}
          href={relatedContract ? `/contracts/${relatedContract.id}` : undefined}
        />
        <ContextRow
          icon={UserIcon}
          label="Ansvarlig"
          value={assignee?.name ?? null}
        />
      </div>
    </SectionCard>
  )
}
