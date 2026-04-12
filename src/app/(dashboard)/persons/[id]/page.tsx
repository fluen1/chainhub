import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { Mail, Phone, Building2, FileText, Briefcase, PieChart } from 'lucide-react'
import Link from 'next/link'
import { getCompanyPersonRoleLabel } from '@/lib/labels'

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
          contract: { select: { id: true, display_name: true, status: true } },
        },
        orderBy: { start_date: 'desc' },
      },
      contract_parties: {
        include: {
          contract: {
            select: { id: true, display_name: true, status: true, company: { select: { name: true } } },
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

  const activeRoles = person.company_persons.filter((cp) => !cp.end_date)
  const historicRoles = person.company_persons.filter((cp) => cp.end_date)
  const fullName = `${person.first_name} ${person.last_name}`
  const initials = `${person.first_name[0] ?? ''}${person.last_name[0] ?? ''}`.toUpperCase()

  return (
    <div className="max-w-4xl">
      {/* Breadcrumb */}
      <nav className="mb-4 text-xs text-gray-400">
        <Link href="/persons" className="text-slate-500 no-underline hover:text-blue-600">Personer</Link>
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
              <a href={`mailto:${person.email}`} className="flex items-center gap-1.5 hover:text-gray-700 no-underline">
                <Mail className="h-4 w-4 text-gray-400" />
                {person.email}
              </a>
            )}
            {person.phone && (
              <a href={`tel:${person.phone}`} className="flex items-center gap-1.5 hover:text-gray-700 no-underline">
                <Phone className="h-4 w-4 text-gray-400" />
                {person.phone}
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Aktive tilknytninger */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="h-4 w-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900">Aktive tilknytninger ({activeRoles.length})</h2>
          </div>
          {activeRoles.length === 0 ? (
            <p className="text-sm text-gray-400 py-2">Ingen aktive tilknytninger</p>
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
                      {cp.start_date && ` · fra ${new Date(cp.start_date).toLocaleDateString('da-DK')}`}
                    </p>
                    {cp.anciennity_start && (
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        Anciennitet fra {new Date(cp.anciennity_start).toLocaleDateString('da-DK')}
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
            <h2 className="text-sm font-semibold text-gray-900">Ejerskaber ({person.ownerships.length})</h2>
          </div>
          {person.ownerships.length === 0 ? (
            <p className="text-sm text-gray-400 py-2">Ingen ejerskaber</p>
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
                    {o.effective_date && ` · fra ${new Date(o.effective_date).toLocaleDateString('da-DK')}`}
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
              <h2 className="text-sm font-semibold text-gray-900">Tilknyttede kontrakter ({person.contract_parties.length})</h2>
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
                    {cp.role_in_contract && `${cp.role_in_contract} · `}{cp.contract.company?.name ?? ''}
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
              <h2 className="text-sm font-semibold text-gray-900">Tilknyttede sager ({person.case_persons.length})</h2>
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
                    {cp.role && `${cp.role} · `}{cp.case.status}
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
                  <p className="text-xs text-gray-400 mt-0.5">
                    {getCompanyPersonRoleLabel(cp.role)}
                    {cp.start_date && ` · ${new Date(cp.start_date).toLocaleDateString('da-DK')}`}
                    {cp.end_date && ` → ${new Date(cp.end_date).toLocaleDateString('da-DK')}`}
                  </p>
                </div>
                <span className="text-[10px] text-gray-400">Ophørt</span>
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
    </div>
  )
}
