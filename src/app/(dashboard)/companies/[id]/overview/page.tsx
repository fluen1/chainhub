import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import {
  formatDate,
} from '@/lib/labels'
import {
  FileText,
  Briefcase,
  CheckSquare,
  AlertTriangle,
  MapPin,
  Phone,
  Mail,
  ExternalLink,
  Plus,
  Calendar,
} from 'lucide-react'
import Link from 'next/link'

interface CompanyOverviewPageProps {
  params: { id: string }
}

export default async function CompanyOverviewPage({ params }: CompanyOverviewPageProps) {
  const session = await auth()
  if (!session) redirect('/login')

  // Layout already checks canAccessCompany — no need to repeat here
  const company = await prisma.company.findFirst({
    where: {
      id: params.id,
      organization_id: session.user.organizationId,
      deleted_at: null,
    },
    include: {
      company_persons: {
        where: { end_date: null },
        include: {
          person: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
              phone: true,
            },
          },
        },
        take: 10,
      },
    },
  })

  if (!company) notFound()

  const today = new Date()
  const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  // Parallel queries for KPI-data
  const [
    activeContracts,
    expiringContracts,
    activeCases,
    openTasks,
    overdueTasks,
    latestFinancialMetric,
  ] = await Promise.all([
    prisma.contract.count({
      where: {
        organization_id: session.user.organizationId,
        company_id: params.id,
        deleted_at: null,
        status: 'AKTIV',
      },
    }),
    prisma.contract.findMany({
      where: {
        organization_id: session.user.organizationId,
        company_id: params.id,
        deleted_at: null,
        status: 'AKTIV',
        expiry_date: { lte: thirtyDays, gte: today },
      },
      orderBy: { expiry_date: 'asc' },
      take: 3,
      select: { id: true, display_name: true, expiry_date: true },
    }),
    // Aktive sager via case_companies junction
    prisma.caseCompany.count({
      where: {
        organization_id: session.user.organizationId,
        company_id: params.id,
        case: {
          deleted_at: null,
          status: { in: ['NY', 'AKTIV', 'AFVENTER_EKSTERN', 'AFVENTER_KLIENT'] },
        },
      },
    }),
    // Open tasks via case→caseCompany (tasks are linked via cases, not directly to companies)
    prisma.task.count({
      where: {
        organization_id: session.user.organizationId,
        deleted_at: null,
        status: { not: 'LUKKET' },
        case: {
          case_companies: {
            some: { company_id: params.id },
          },
        },
      },
    }),
    prisma.task.count({
      where: {
        organization_id: session.user.organizationId,
        deleted_at: null,
        status: { not: 'LUKKET' },
        due_date: { lt: today },
        case: {
          case_companies: {
            some: { company_id: params.id },
          },
        },
      },
    }),
    prisma.financialMetric.findFirst({
      where: {
        organization_id: session.user.organizationId,
        company_id: params.id,
      },
      orderBy: { period_year: 'desc' },
    }),
  ])

  // Sort company_persons by governance role priority
  const rolePriority = ['Direktør', 'Bestyrelsesformand', 'Bestyrelsesmedlem', 'Tegningsberettiget', 'Revisor']
  const sortedPersons = [...company.company_persons].sort((a, b) => {
    const ai = rolePriority.indexOf(a.role)
    const bi = rolePriority.indexOf(b.role)
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
  }).slice(0, 5)

  // Alerts
  const alerts: Array<{ severity: 'RED' | 'AMBER'; message: string; href: string }> = []

  if (overdueTasks > 0) {
    alerts.push({
      severity: 'RED',
      message: `${overdueTasks} forfaldne opgave${overdueTasks !== 1 ? 'r' : ''}`,
      href: `/tasks?company=${params.id}`,
    })
  }

  for (const contract of expiringContracts) {
    if (contract.expiry_date) {
      const days = Math.ceil(
        (contract.expiry_date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      )
      alerts.push({
        severity: days <= 14 ? 'RED' : 'AMBER',
        message: `${contract.display_name} udløber om ${days} dag${days !== 1 ? 'e' : ''}`,
        href: `/contracts/${contract.id}`,
      })
    }
  }

  // Address as a compact string
  const addressParts = [company.address, company.postal_code, company.city].filter(Boolean)
  const addressStr = company.address
    ? `${company.address}, ${company.postal_code ?? ''} ${company.city ?? ''}`.trim()
    : null

  return (
    <div className="space-y-5">
      {/* 1. Alerts — vigtigst, kræver handling */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, i) => (
            <Link
              key={i}
              href={alert.href}
              className={`flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                alert.severity === 'RED'
                  ? 'bg-red-50 text-red-700 hover:bg-red-100'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
              }`}
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {alert.message}
              <ExternalLink className="h-3 w-3 ml-auto shrink-0 opacity-50" />
            </Link>
          ))}
        </div>
      )}

      {/* 2. Adresse — kompakt info-linje under alerts */}
      {(addressStr || company.founded_date) && (
        <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
          {addressStr && (
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-gray-400" />
              {addressStr}
            </span>
          )}
          {company.founded_date && (
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-gray-400" />
              Stiftet {formatDate(company.founded_date)}
            </span>
          )}
        </div>
      )}

      {/* 3. KPI-kort — fuld bredde, 4 i én række. Det vigtigste overblik. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Link
          href={`/companies/${params.id}/contracts`}
          className="rounded-lg border border-gray-200 bg-white p-4 transition-all hover:shadow-md hover:-translate-y-px"
        >
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-gray-400" />
            <p className="text-xs text-gray-500">Kontrakter</p>
          </div>
          <p className="text-2xl font-semibold text-gray-900">{activeContracts}</p>
          {expiringContracts.length > 0 && (
            <p className="text-xs text-amber-600 mt-1">
              {expiringContracts.length} udløber snart
            </p>
          )}
        </Link>

        <Link
          href={`/companies/${params.id}/cases`}
          className="rounded-lg border border-gray-200 bg-white p-4 transition-all hover:shadow-md hover:-translate-y-px"
        >
          <div className="flex items-center gap-2 mb-2">
            <Briefcase className="h-4 w-4 text-gray-400" />
            <p className="text-xs text-gray-500">Aktive sager</p>
          </div>
          <p className="text-2xl font-semibold text-gray-900">{activeCases}</p>
        </Link>

        <Link
          href={`/tasks?company=${params.id}`}
          className={`rounded-lg border p-4 transition-all hover:shadow-md hover:-translate-y-px ${
            overdueTasks > 0
              ? 'border-l-[3px] border-l-red-400 border-gray-200 bg-white'
              : 'border-gray-200 bg-white'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <CheckSquare
              className={`h-4 w-4 ${overdueTasks > 0 ? 'text-red-500' : 'text-gray-400'}`}
            />
            <p className="text-xs text-gray-500">Opgaver</p>
          </div>
          <p className="text-2xl font-semibold text-gray-900">{openTasks}</p>
          {overdueTasks > 0 && (
            <p className="text-xs text-red-600 mt-1 font-medium">{overdueTasks} forfaldne</p>
          )}
        </Link>

        {latestFinancialMetric ? (
          <Link
            href={`/companies/${params.id}/finance`}
            className="rounded-lg border border-gray-200 bg-white p-4 transition-all hover:shadow-md hover:-translate-y-px"
          >
            <p className="text-xs text-gray-500 mb-2">
              Økonomi ({latestFinancialMetric.period_year})
            </p>
            <p className="text-lg font-semibold text-gray-900">
              {new Intl.NumberFormat('da-DK', {
                style: 'currency',
                currency: 'DKK',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              }).format(Number(latestFinancialMetric.value))}
            </p>
          </Link>
        ) : (
          <Link
            href={`/companies/${params.id}/finance`}
            className="rounded-lg border border-dashed border-gray-200 p-4 text-center transition-colors hover:border-gray-300"
          >
            <p className="text-xs text-gray-400">Økonomi</p>
            <p className="text-sm text-gray-400 mt-1">Tilføj nøgletal</p>
          </Link>
        )}
      </div>

      {/* 4. To-kolonne: Nøglepersoner + Hurtighandlinger */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Nøglepersoner */}
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-medium text-gray-400 tracking-wide">Nøglepersoner</h3>
            <Link
              href={`/companies/${params.id}/governance`}
              className="text-xs text-gray-500 hover:text-gray-900 transition-colors"
            >
              Se alle →
            </Link>
          </div>
          {sortedPersons.length === 0 ? (
            <p className="text-sm text-gray-400">
              Ingen tilknyttede personer.{' '}
              <Link
                href={`/companies/${params.id}/governance`}
                className="text-gray-600 hover:text-gray-900 underline"
              >
                Tilføj
              </Link>
            </p>
          ) : (
            <div className="space-y-3">
              {sortedPersons.map((cp) => (
                <div key={cp.id} className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600">
                      {cp.person.first_name[0]}
                      {cp.person.last_name[0]}
                    </div>
                    <div>
                      <Link
                        href={`/persons/${cp.person.id}`}
                        className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors"
                      >
                        {cp.person.first_name} {cp.person.last_name}
                      </Link>
                      <p className="text-xs text-gray-400">{cp.role}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {cp.person.phone && (
                      <a
                        href={`tel:${cp.person.phone}`}
                        className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                        title={cp.person.phone}
                      >
                        <Phone className="h-3.5 w-3.5" />
                      </a>
                    )}
                    {cp.person.email && (
                      <a
                        href={`mailto:${cp.person.email}`}
                        className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                        title={cp.person.email}
                      >
                        <Mail className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Hurtighandlinger + noter */}
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="text-xs font-medium text-gray-400 tracking-wide mb-3">
              Hurtighandlinger
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { href: `/contracts/new?companyId=${params.id}`, label: 'Ny kontrakt' },
                { href: `/cases/new?companyId=${params.id}`, label: 'Ny sag' },
                { href: `/tasks/new?companyId=${params.id}`, label: 'Ny opgave' },
                { href: `/companies/${params.id}/stamdata`, label: 'Rediger stamdata' },
              ].map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900"
                >
                  <Plus className="h-4 w-4 text-gray-400" />
                  {label}
                </Link>
              ))}
            </div>
          </div>

          {company.notes && (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="text-xs font-medium text-gray-400 tracking-wide mb-2">
                Interne noter
              </h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{company.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
