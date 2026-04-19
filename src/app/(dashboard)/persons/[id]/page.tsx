import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { canAccessModule } from '@/lib/permissions'
import {
  Mail,
  Phone,
  Building2,
  FileText,
  Briefcase,
  PieChart,
  CalendarDays,
  Clock,
  Shield,
} from 'lucide-react'
import Link from 'next/link'
import {
  getCompanyPersonRoleLabel,
  getContractStatusLabel,
  getContractStatusStyle,
  formatDate,
} from '@/lib/labels'
import { GdprPanel } from './gdpr-panel'
import { EmptyState } from '@/components/ui/empty-state'
import { getPersonAIExtractions } from '@/actions/person-ai'
import { PersonAIExtractionsSection } from '@/components/persons/ai-extractions-section'

export const metadata: Metadata = { title: 'Person' }

interface Props {
  params: { id: string }
}

export default async function PersonDetailPage({ params }: Props) {
  const session = await auth()
  if (!session) redirect('/login')

  const person = await prisma.person.findFirst({
    where: {
      id: params.id,
      organization_id: session.user.organizationId,
      deleted_at: null,
    },
    include: {
      company_persons: {
        include: {
          company: { select: { id: true, name: true, status: true } },
          contract: {
            select: {
              id: true,
              display_name: true,
              status: true,
              system_type: true,
              effective_date: true,
              expiry_date: true,
              notice_period_days: true,
              termination_date: true,
              signed_date: true,
              anciennity_start: true,
            },
          },
        },
        orderBy: { start_date: 'desc' },
      },
      contract_parties: {
        include: {
          contract: {
            select: {
              id: true,
              display_name: true,
              status: true,
              company: { select: { name: true } },
            },
          },
        },
      },
      ownerships: {
        where: { end_date: null },
        include: {
          company: { select: { id: true, name: true } },
        },
      },
      case_persons: {
        include: {
          case: { select: { id: true, title: true, status: true } },
        },
      },
    },
  })

  if (!person) notFound()

  const isAdmin = await canAccessModule(session.user.id, 'settings')

  const aiResult = await getPersonAIExtractions(params.id)
  const aiExtractions = 'data' in aiResult && aiResult.data ? aiResult.data : []

  const activeRoles = person.company_persons.filter((cp) => !cp.end_date)
  const historicRoles = person.company_persons.filter((cp) => cp.end_date)
  const fullName = `${person.first_name} ${person.last_name}`
  const initials = `${person.first_name[0] ?? ''}${person.last_name[0] ?? ''}`.toUpperCase()

  // Saml alle aktive ansættelseskontrakter
  const employmentContracts = activeRoles
    .filter((cp) => cp.contract)
    .map((cp) => ({
      ...cp.contract!,
      companyName: cp.company.name,
      companyId: cp.company.id,
      role: cp.role,
      employmentType: cp.employment_type,
    }))

  return (
    <div className="max-w-4xl">
      {/* Breadcrumb */}
      <nav className="mb-4 text-xs text-gray-500">
        <Link href="/persons" className="text-slate-500 no-underline hover:text-blue-600">
          Personer
        </Link>
        <span className="mx-2">›</span>
        <span className="font-medium text-slate-900">{fullName}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-100 text-lg font-bold text-blue-700">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900">{fullName}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-4 text-sm text-gray-500">
            {person.email && (
              <a
                href={`mailto:${person.email}`}
                className="flex items-center gap-1.5 hover:text-gray-700 no-underline"
              >
                <Mail className="h-4 w-4 text-gray-400" />
                {person.email}
              </a>
            )}
            {person.phone && (
              <a
                href={`tel:${person.phone}`}
                className="flex items-center gap-1.5 hover:text-gray-700 no-underline"
              >
                <Phone className="h-4 w-4 text-gray-400" />
                {person.phone}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Stamdata */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-xs text-gray-500 mb-1">Fornavn</div>
            <div className="text-gray-900 font-medium">{person.first_name}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Efternavn</div>
            <div className="text-gray-900 font-medium">{person.last_name}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Email</div>
            <div className="text-gray-900">{person.email ?? '—'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Telefon</div>
            <div className="text-gray-900 tabular-nums">{person.phone ?? '—'}</div>
          </div>
        </div>
      </div>

      {/* Ansættelseskontrakter — prominent sektion */}
      {employmentContracts.length > 0 && (
        <div className="space-y-3 mb-4">
          {employmentContracts.map((ec) => (
            <div key={ec.id} className="rounded-xl border border-blue-200 bg-blue-50/40 p-5">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <div>
                    <Link
                      href={`/contracts/${ec.id}`}
                      className="text-sm font-semibold text-gray-900 hover:text-blue-700 no-underline"
                    >
                      {ec.display_name}
                    </Link>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {ec.companyName} · {getCompanyPersonRoleLabel(ec.role)}
                      {ec.employmentType && ` · ${ec.employmentType}`}
                    </p>
                  </div>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getContractStatusStyle(ec.status)}`}
                >
                  {getContractStatusLabel(ec.status)}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {ec.effective_date && (
                  <div className="flex items-start gap-2">
                    <CalendarDays className="h-3.5 w-3.5 text-gray-400 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-wide">
                        Ikrafttrædelse
                      </div>
                      <div className="text-xs font-medium text-gray-900">
                        {formatDate(ec.effective_date)}
                      </div>
                    </div>
                  </div>
                )}
                {ec.expiry_date && (
                  <div className="flex items-start gap-2">
                    <Clock className="h-3.5 w-3.5 text-gray-400 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-wide">Udløb</div>
                      <div className="text-xs font-medium text-gray-900">
                        {formatDate(ec.expiry_date)}
                      </div>
                    </div>
                  </div>
                )}
                {ec.notice_period_days != null && (
                  <div className="flex items-start gap-2">
                    <Shield className="h-3.5 w-3.5 text-gray-400 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-wide">
                        Opsigelse
                      </div>
                      <div className="text-xs font-medium text-gray-900">
                        {ec.notice_period_days} dage
                      </div>
                    </div>
                  </div>
                )}
                {ec.signed_date && (
                  <div className="flex items-start gap-2">
                    <CalendarDays className="h-3.5 w-3.5 text-gray-400 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-wide">
                        Underskrevet
                      </div>
                      <div className="text-xs font-medium text-gray-900">
                        {formatDate(ec.signed_date)}
                      </div>
                    </div>
                  </div>
                )}
                {ec.anciennity_start && (
                  <div className="flex items-start gap-2">
                    <CalendarDays className="h-3.5 w-3.5 text-gray-400 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-wide">
                        Anciennitet
                      </div>
                      <div className="text-xs font-medium text-gray-900">
                        {formatDate(ec.anciennity_start)}
                      </div>
                    </div>
                  </div>
                )}
                {ec.termination_date && (
                  <div className="flex items-start gap-2">
                    <Clock className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-[10px] text-red-400 uppercase tracking-wide">Opsagt</div>
                      <div className="text-xs font-medium text-red-700">
                        {formatDate(ec.termination_date)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* AI-udlæste kontrakt-vilkår (fra Claude-ekstraktion af dokumenter) */}
      <PersonAIExtractionsSection extractions={aiExtractions} />

      <div className="grid grid-cols-2 gap-4">
        {/* Aktive tilknytninger */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="h-4 w-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900">
              Aktive tilknytninger ({activeRoles.length})
            </h2>
          </div>
          {activeRoles.length === 0 ? (
            <EmptyState icon={Briefcase} title="Ingen aktive tilknytninger" variant="compact" />
          ) : (
            <ul className="space-y-3">
              {activeRoles.map((cp) => (
                <li key={cp.id} className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={`/companies/${cp.company.id}`}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800 no-underline"
                    >
                      {cp.company.name}
                    </Link>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {getCompanyPersonRoleLabel(cp.role)}
                      {cp.employment_type && ` · ${cp.employment_type}`}
                      {cp.start_date && ` · fra ${formatDate(cp.start_date)}`}
                    </p>
                    {cp.anciennity_start && (
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        Anciennitet fra {formatDate(cp.anciennity_start)}
                      </p>
                    )}
                    {cp.contract && (
                      <Link
                        href={`/contracts/${cp.contract.id}`}
                        className="text-[10px] text-blue-500 hover:text-blue-700 no-underline mt-0.5 block"
                      >
                        → {cp.contract.display_name}
                      </Link>
                    )}
                  </div>
                  <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700 shrink-0">
                    Aktiv
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Ejerskaber */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="h-4 w-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900">
              Ejerskaber ({person.ownerships.length})
            </h2>
          </div>
          {person.ownerships.length === 0 ? (
            <EmptyState icon={PieChart} title="Ingen ejerskaber" variant="compact" />
          ) : (
            <ul className="space-y-3">
              {person.ownerships.map((o) => (
                <li key={o.id}>
                  <Link
                    href={`/companies/${o.company.id}`}
                    className="text-sm font-medium text-blue-600 hover:text-blue-800 no-underline"
                  >
                    {o.company.name}
                  </Link>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {Number(o.ownership_pct)}% ejerandel
                    {o.effective_date && ` · fra ${formatDate(o.effective_date)}`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Kontrakter (som part) */}
        {person.contract_parties.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="h-4 w-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-900">
                Tilknyttede kontrakter ({person.contract_parties.length})
              </h2>
            </div>
            <ul className="space-y-3">
              {person.contract_parties.map((cp) => (
                <li key={cp.id}>
                  <Link
                    href={`/contracts/${cp.contract.id}`}
                    className="text-sm font-medium text-blue-600 hover:text-blue-800 no-underline"
                  >
                    {cp.contract.display_name}
                  </Link>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {cp.role_in_contract && `${cp.role_in_contract} · `}
                    {cp.contract.company?.name ?? ''}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Sager */}
        {person.case_persons.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center gap-2 mb-4">
              <Briefcase className="h-4 w-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-900">
                Tilknyttede sager ({person.case_persons.length})
              </h2>
            </div>
            <ul className="space-y-3">
              {person.case_persons.map((cp) => (
                <li key={`${cp.case_id}-${cp.person_id}`}>
                  <Link
                    href={`/cases/${cp.case.id}`}
                    className="text-sm font-medium text-blue-600 hover:text-blue-800 no-underline"
                  >
                    {cp.case.title}
                  </Link>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {cp.role && `${cp.role} · `}
                    {cp.case.status}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Historiske tilknytninger */}
      {historicRoles.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 mt-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">
            Tidligere tilknytninger ({historicRoles.length})
          </h2>
          <ul className="space-y-2">
            {historicRoles.map((cp) => (
              <li key={cp.id} className="flex items-center justify-between">
                <div>
                  <Link
                    href={`/companies/${cp.company.id}`}
                    className="text-sm text-gray-700 hover:text-blue-600 no-underline"
                  >
                    {cp.company.name}
                  </Link>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {getCompanyPersonRoleLabel(cp.role)}
                    {cp.start_date && ` · ${formatDate(cp.start_date)}`}
                    {cp.end_date && ` → ${formatDate(cp.end_date)}`}
                  </p>
                </div>
                <span className="text-[10px] text-gray-500">Ophørt</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Noter */}
      {person.notes && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 mt-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">Interne noter</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{person.notes}</p>
        </div>
      )}

      {/* GDPR-handlinger — kun admin, placeret nederst (destruktiv) */}
      {isAdmin && (
        <GdprPanel
          personId={person.id}
          personName={`${person.first_name} ${person.last_name}`.trim()}
        />
      )}
    </div>
  )
}
