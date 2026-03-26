import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getAccessibleCompanies } from '@/lib/permissions'
import {
  Building2,
  FileText,
  Briefcase,
  CheckSquare,
  AlertTriangle,
  Rocket,
} from 'lucide-react'
import Link from 'next/link'
import { getCompanyStatusLabel, getCompanyStatusStyle, getVisitTypeLabel, getCompanyPersonRoleLabel } from '@/lib/labels'
import { cn } from '@/lib/utils'
import type { Prisma } from '@prisma/client'

interface UrgencyItem {
  id: string
  type: 'FORFALDEN_OPGAVE' | 'KONTRAKT_UDLOEBER' | 'SAG_AFVENTER'
  title: string
  subtitle: string
  href: string
  daysLabel: string
  severity: 'RED' | 'AMBER'
}

type CompanyWithRelations = Prisma.CompanyGetPayload<{
  include: {
    _count: {
      select: {
        contracts: true
        cases: true
      }
    }
    company_persons: {
      include: {
        person: {
          select: {
            first_name: true
            last_name: true
          }
        }
      }
    }
  }
}>

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const companyIds = await getAccessibleCompanies(
    session.user.id,
    session.user.organizationId
  )

  const today = new Date()
  const fourteenDays = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
  const ninetyDays = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)

  const [
    overdueTasks,
    urgentContracts,
    waitingCases,
    companies,
    expiringContractsCount,
    activeCasesCount,
    totalTasksCount,
    totalCompanyCount,
    overdueTasksTotal,
    overdueTasksByCompany,
    upcomingVisits,
  ] = await Promise.all([
    // Forfaldne opgaver
    prisma.task.findMany({
      where: {
        organization_id: session.user.organizationId,
        deleted_at: null,
        status: { not: 'LUKKET' },
        due_date: { lt: today },
      },
      orderBy: { due_date: 'asc' },
      take: 5,
      include: {
        case: { select: { id: true, title: true } },
      },
    }),

    // Kontrakter der udløber inden 14 dage
    companyIds.length > 0
      ? prisma.contract.findMany({
          where: {
            organization_id: session.user.organizationId,
            company_id: { in: companyIds },
            deleted_at: null,
            status: 'AKTIV',
            expiry_date: { lte: fourteenDays, gte: today },
          },
          orderBy: { expiry_date: 'asc' },
          take: 5,
          include: { company: { select: { id: true, name: true } } },
        })
      : Promise.resolve([]),

    // Sager der afventer handling
    prisma.case.findMany({
      where: {
        organization_id: session.user.organizationId,
        deleted_at: null,
        status: { in: ['AFVENTER_EKSTERN', 'AFVENTER_KLIENT'] },
      },
      orderBy: { updated_at: 'asc' },
      take: 3,
      select: { id: true, title: true, status: true },
    }),

    // Selskabs-grid data
    companyIds.length > 0
      ? prisma.company.findMany({
          where: {
            organization_id: session.user.organizationId,
            id: { in: companyIds },
            deleted_at: null,
          },
          include: {
            _count: {
              select: {
                contracts: { where: { deleted_at: null, status: 'AKTIV' } },
                cases: { where: { case: { deleted_at: null } } },
              },
            },
            company_persons: {
              where: { end_date: null },
              include: {
                person: { select: { first_name: true, last_name: true } },
              },
              take: 2,
            },
          },
          orderBy: { name: 'asc' },
          take: 9,
        }) as Promise<CompanyWithRelations[]>
      : Promise.resolve([] as CompanyWithRelations[]),

    // KPI: udløbende kontrakter (90 dage)
    companyIds.length > 0
      ? prisma.contract.count({
          where: {
            organization_id: session.user.organizationId,
            company_id: { in: companyIds },
            deleted_at: null,
            status: 'AKTIV',
            expiry_date: { not: null, lte: ninetyDays, gte: today },
          },
        })
      : Promise.resolve(0),

    // KPI: aktive sager
    prisma.case.count({
      where: {
        organization_id: session.user.organizationId,
        deleted_at: null,
        status: { in: ['NY', 'AKTIV', 'AFVENTER_EKSTERN', 'AFVENTER_KLIENT'] },
      },
    }),

    // KPI: åbne opgaver
    prisma.task.count({
      where: {
        organization_id: session.user.organizationId,
        deleted_at: null,
        status: { not: 'LUKKET' },
      },
    }),

    // Har org nogen data? (til onboarding panel)
    prisma.company.count({
      where: { organization_id: session.user.organizationId, deleted_at: null },
    }),

    // KPI: total antal forfaldne opgaver (ikke capped)
    prisma.task.count({
      where: {
        organization_id: session.user.organizationId,
        deleted_at: null,
        status: { not: 'LUKKET' },
        due_date: { lt: today },
      },
    }),

    // Forfaldne opgaver per selskab
    prisma.task.groupBy({
      by: ['company_id'],
      where: {
        organization_id: session.user.organizationId,
        deleted_at: null,
        status: { not: 'LUKKET' },
        due_date: { lt: today },
        company_id: { in: companyIds.length > 0 ? companyIds : ['no-match'] },
      },
      _count: true,
    }),

    // Kommende besøg (næste 5)
    prisma.visit.findMany({
      where: {
        organization_id: session.user.organizationId,
        deleted_at: null,
        status: 'PLANLAGT',
        visit_date: { gte: today },
      },
      include: { company: { select: { id: true, name: true } } },
      orderBy: { visit_date: 'asc' },
      take: 5,
    }),
  ])

  // Byg overdue-map per selskab
  const overdueByCompany: Record<string, number> = {}
  for (const t of overdueTasksByCompany) {
    if (t.company_id) overdueByCompany[t.company_id] = t._count
  }

  // Byg urgency items
  const urgencyItems: UrgencyItem[] = []

  for (const task of overdueTasks) {
    const days = Math.ceil(
      (today.getTime() - (task.due_date?.getTime() ?? 0)) / (1000 * 60 * 60 * 24)
    )
    urgencyItems.push({
      id: `task-${task.id}`,
      type: 'FORFALDEN_OPGAVE',
      title: task.title,
      subtitle: task.case ? `Sag: ${task.case.title}` : '',
      href: `/tasks?status=AKTIV_TASK`,
      daysLabel: `${days} dag${days !== 1 ? 'e' : ''} forfalden`,
      severity: 'RED',
    })
  }

  for (const contract of urgentContracts) {
    if (contract.expiry_date) {
      const days = Math.ceil(
        (contract.expiry_date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      )
      urgencyItems.push({
        id: `contract-${contract.id}`,
        type: 'KONTRAKT_UDLOEBER',
        title: contract.display_name,
        subtitle: contract.company.name,
        href: `/contracts/${contract.id}`,
        daysLabel: `${days} dag${days !== 1 ? 'e' : ''} tilbage`,
        severity: 'RED',
      })
    }
  }

  for (const c of waitingCases) {
    urgencyItems.push({
      id: `case-${c.id}`,
      type: 'SAG_AFVENTER',
      title: c.title,
      subtitle:
        c.status === 'AFVENTER_KLIENT' ? 'Afventer klient-input' : 'Afventer ekstern part',
      href: `/cases/${c.id}`,
      daysLabel: 'Afventer',
      severity: 'AMBER',
    })
  }

  const sortedUrgency = urgencyItems
    .sort((a, b) => {
      if (a.severity === 'RED' && b.severity === 'AMBER') return -1
      if (a.severity === 'AMBER' && b.severity === 'RED') return 1
      return 0
    })
    .slice(0, 10)

  const showOnboarding = totalCompanyCount === 0

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Godmorgen' : hour < 18 ? 'God eftermiddag' : 'God aften'

  return (
    <div className="space-y-8">
      {/* Overskrift */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
          {greeting}, {session.user.name?.split(' ')[0] ?? 'der'}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {sortedUrgency.length > 0
            ? new Date().toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' })
            : 'Alt ser godt ud i din portefølje'}
        </p>
      </div>

      {/* ONBOARDING PANEL */}
      {showOnboarding && (
        <div className="rounded-lg border-2 border-dashed border-blue-200 bg-blue-50 p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-blue-100 p-2 shrink-0">
              <Rocket className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold text-blue-900">
                Kom godt i gang med ChainHub
              </h2>
              <p className="mt-1 text-sm text-blue-700">
                Få det fulde overblik over din kæde i tre enkle trin.
              </p>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  { step: 1, label: 'Opret dit første selskab', href: '/companies/new', active: true },
                  { step: 2, label: 'Tilføj din første kontrakt', href: '/contracts/new', active: false },
                  { step: 3, label: 'Invitér en kollega', href: '/settings/users', active: false },
                ].map(({ step, label, href, active }) => (
                  <Link
                    key={step}
                    href={href}
                    className={`flex items-center gap-3 rounded-md border px-4 py-3 text-sm font-medium transition-colors ${
                      active
                        ? 'border-blue-300 bg-white text-blue-700 hover:bg-blue-50'
                        : 'border-blue-200 bg-white/60 text-blue-500 hover:bg-blue-50'
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        active ? 'bg-blue-600 text-white' : 'bg-blue-200 text-blue-700'
                      }`}
                    >
                      {step}
                    </span>
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* URGENCY PANEL */}
      {sortedUrgency.length > 0 && (
        <div className="rounded-lg border border-red-100 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 bg-red-50 border-b border-red-100">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <h2 className="text-sm font-semibold text-red-900">
              Du har {sortedUrgency.length} ting der kræver handling
            </h2>
          </div>
          <ul className="divide-y divide-gray-100">
            {sortedUrgency.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors group"
                >
                  {item.type === 'FORFALDEN_OPGAVE' && (
                    <CheckSquare className={`h-4 w-4 shrink-0 ${item.severity === 'RED' ? 'text-red-500' : 'text-amber-500'}`} />
                  )}
                  {item.type === 'KONTRAKT_UDLOEBER' && (
                    <FileText className={`h-4 w-4 shrink-0 ${item.severity === 'RED' ? 'text-red-500' : 'text-amber-500'}`} />
                  )}
                  {item.type === 'SAG_AFVENTER' && (
                    <Briefcase className={`h-4 w-4 shrink-0 ${item.severity === 'RED' ? 'text-red-500' : 'text-amber-500'}`} />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 line-clamp-2 group-hover:text-blue-700">
                      {item.title}
                    </p>
                    {item.subtitle && (
                      <p className="text-xs text-gray-500 truncate">{item.subtitle}</p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      item.severity === 'RED'
                        ? 'bg-red-50 text-red-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {item.daysLabel}
                  </span>
                  <svg
                    className="h-4 w-4 text-gray-300 group-hover:text-blue-400 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* KOMMENDE BESØG */}
      {upcomingVisits.length > 0 && (
        <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b">
            <h2 className="text-sm font-semibold text-gray-900">Kommende besøg</h2>
            <Link href="/visits" className="text-xs text-blue-600 hover:text-blue-800">Se alle →</Link>
          </div>
          <ul className="divide-y divide-gray-100">
            {upcomingVisits.map((visit) => (
              <li key={visit.id}>
                <Link href={`/visits/${visit.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{visit.company.name}</p>
                    <p className="text-xs text-gray-500">{getVisitTypeLabel(visit.visit_type)}</p>
                  </div>
                  <span className="text-sm text-gray-500">
                    {new Date(visit.visit_date).toLocaleDateString('da-DK')}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* KPI-KORT */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Link href="/companies" className="rounded-lg border bg-white p-5 shadow-sm hover:border-blue-300 hover:shadow-md transition-all cursor-pointer relative group">
          <svg className="absolute top-3 right-3 h-4 w-4 text-gray-300 group-hover:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-blue-50 p-2">
              <Building2 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Selskaber</p>
              <p className="text-2xl font-bold text-gray-900">{totalCompanyCount}</p>
            </div>
          </div>
        </Link>

        <Link href="/contracts?expiry=90" className="rounded-lg border bg-white p-5 shadow-sm hover:border-blue-300 hover:shadow-md transition-all cursor-pointer relative group">
          <svg className="absolute top-3 right-3 h-4 w-4 text-gray-300 group-hover:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <div className="flex items-center gap-3">
            <div className={`rounded-md p-2 ${expiringContractsCount > 0 ? 'bg-orange-50' : 'bg-gray-50'}`}>
              <FileText className={`h-5 w-5 ${expiringContractsCount > 0 ? 'text-orange-600' : 'text-gray-400'}`} />
            </div>
            <div>
              <p className="text-xs text-gray-500">Kontrakter der udløber</p>
              <p className={`text-2xl font-bold ${expiringContractsCount > 0 ? 'text-orange-600' : 'text-gray-900'}`}>
                {expiringContractsCount}
              </p>
            </div>
          </div>
        </Link>

        <Link href="/cases?status=AKTIV" className="rounded-lg border bg-white p-5 shadow-sm hover:border-blue-300 hover:shadow-md transition-all cursor-pointer relative group">
          <svg className="absolute top-3 right-3 h-4 w-4 text-gray-300 group-hover:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-blue-50 p-2">
              <Briefcase className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Aktive sager</p>
              <p className="text-2xl font-bold text-gray-900">{activeCasesCount}</p>
            </div>
          </div>
        </Link>

        <Link href="/tasks" className="rounded-lg border bg-white p-5 shadow-sm hover:border-blue-300 hover:shadow-md transition-all cursor-pointer relative group">
          <svg className="absolute top-3 right-3 h-4 w-4 text-gray-300 group-hover:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <div className="flex items-center gap-3">
            <div className={`rounded-md p-2 ${overdueTasksTotal > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
              {overdueTasksTotal > 0
                ? <AlertTriangle className="h-5 w-5 text-red-600" />
                : <CheckSquare className="h-5 w-5 text-gray-400" />}
            </div>
            <div>
              <p className="text-xs text-gray-500">Åbne opgaver</p>
              <p className={`text-2xl font-bold ${overdueTasksTotal > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                {totalTasksCount}
              </p>
              {overdueTasksTotal > 0 && (
                <p className="text-xs text-red-500">{overdueTasksTotal} forfaldne</p>
              )}
            </div>
          </div>
        </Link>
      </div>

      {/* SELSKABSGRID */}
      {companies.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <Building2 className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-semibold text-gray-900">Ingen selskaber endnu</h3>
          <p className="mt-1 text-sm text-gray-500">
            Opret dit første selskab for at komme i gang.
          </p>
          <Link
            href="/companies/new"
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Opret selskab
          </Link>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">Selskaber</h2>
            {companyIds.length > companies.length && (
              <Link href="/companies" className="text-sm text-blue-600 hover:text-blue-800">
                Se alle {companyIds.length} selskaber →
              </Link>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {companies.map((company) => (
              <Link
                key={company.id}
                href={`/companies/${company.id}`}
                className={cn(
                  "group rounded-lg border bg-white p-5 shadow-sm hover:border-blue-300 hover:shadow-md transition-all",
                  overdueByCompany[company.id] > 0 && "border-l-4 border-l-red-400",
                )}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 leading-snug line-clamp-2">
                      {company.name}
                    </h3>
                    {company.cvr && (
                      <p className="text-xs text-gray-400 mt-0.5">CVR: {company.cvr}</p>
                    )}
                  </div>
                  <span
                    className={`ml-2 flex-shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getCompanyStatusStyle(company.status ?? '')}`}
                  >
                    {getCompanyStatusLabel(company.status ?? '')}
                  </span>
                </div>

                {company.company_persons.length > 0 && (
                  <div className="mb-3 space-y-0.5">
                    {company.company_persons.filter((cp) => cp.role === 'direktoer').length > 0
                      ? company.company_persons
                          .filter((cp) => cp.role === 'direktoer')
                          .slice(0, 1)
                          .map((cp) => (
                            <p key={cp.id} className="text-xs text-gray-500 truncate">
                              {cp.person.first_name} {cp.person.last_name}
                            </p>
                          ))
                      : company.company_persons.slice(0, 1).map((cp) => (
                          <p key={cp.id} className="text-xs text-gray-500 truncate">
                            <span className="text-gray-400">{getCompanyPersonRoleLabel(cp.role)}:</span>{' '}
                            {cp.person.first_name} {cp.person.last_name}
                          </p>
                        ))
                    }
                  </div>
                )}

                <div className="flex items-center gap-1.5 flex-wrap text-xs">
                  <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 font-medium">
                    {company._count.contracts} kontrakt{company._count.contracts !== 1 ? 'er' : ''}
                  </span>
                  {company._count.cases > 0 && (
                    <span className="inline-flex items-center rounded-full bg-orange-50 text-orange-700 px-2 py-0.5 font-medium">
                      {company._count.cases} sag{company._count.cases !== 1 ? 'er' : ''}
                    </span>
                  )}
                  {overdueByCompany[company.id] > 0 && (
                    <span className="inline-flex items-center rounded-full bg-red-50 text-red-700 px-2 py-0.5 font-medium">
                      {overdueByCompany[company.id]} forfaldne
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
          {companyIds.length > companies.length && (
            <div className="mt-4 text-center">
              <Link href="/companies" className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                Se alle {companyIds.length} selskaber →
              </Link>
            </div>
          )}
        </div>
      )}

    </div>
  )
}
