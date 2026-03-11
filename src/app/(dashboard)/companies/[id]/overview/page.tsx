import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { canAccessCompany } from '@/lib/permissions'
import {
  getCompanyStatusLabel,
  getCompanyStatusStyle,
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
import type { Prisma } from '@prisma/client'

interface CompanyOverviewPageProps {
  params: { id: string }
}

type CompanyWithPersons = Prisma.CompanyGetPayload<{
  include: {
    company_persons: {
      include: {
        person: {
          select: {
            id: true
            first_name: true
            last_name: true
            email: true
            phone: true
          }
        }
      }
    }
    _count: {
      select: {
        contracts: true
        cases: true
      }
    }
  }
}>

export default async function CompanyOverviewPage({ params }: CompanyOverviewPageProps) {
  const session = await auth()
  if (!session) redirect('/login')

  const hasAccess = await canAccessCompany(session.user.id, params.id)
  if (!hasAccess) notFound()

  const company = (await prisma.company.findFirst({
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
        orderBy: { start_date: 'asc' },
        take: 5,
      },
      _count: {
        select: {
          contracts: { where: { deleted_at: null } },
          cases: true,
        },
      },
    },
  })) as CompanyWithPersons | null

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
    prisma.task.count({
      where: {
        organization_id: session.user.organizationId,
        company_id: params.id,
        deleted_at: null,
        status: { not: 'LUKKET' },
      },
    }),
    prisma.task.count({
      where: {
        organization_id: session.user.organizationId,
        company_id: params.id,
        deleted_at: null,
        status: { not: 'LUKKET' },
        due_date: { lt: today },
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

  // Alerts
  const alerts: Array<{ severity: 'RED' | 'AMBER'; message: string; href: string }> = []

  if (overdueTasks > 0) {
    alerts.push({
      severity: 'RED',
      message: `${overdueTasks} forfaldne opgave${overdueTasks !== 1 ? 'r' : ''}`,
      href: `/tasks`,
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

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, i) => (
            <Link
              key={i}
              href={alert.href}
              className={`flex items-center gap-3 rounded-md px-4 py-3 text-sm font-medium transition-colors ${
                alert.severity === 'RED'
                  ? 'bg-red-50 text-red-800 hover:bg-red-100 border border-red-200'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {alert.message}
              <ExternalLink className="h-3 w-3 ml-auto shrink-0 opacity-60" />
            </Link>
          ))}
        </div>
      )}

      {/* To-kolonne layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Venstre: Stamdata resumé + nøglepersoner */}
        <div className="space-y-5">
          {/* Stamdata resumé */}
          <div className="rounded-lg border bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">{company.name}</h2>
                {company.cvr && (
                  <p className="text-sm text-gray-500 mt-0.5">
                    CVR: {company.cvr}
                    {company.company_type && ` · ${company.company_type}`}
                  </p>
                )}
              </div>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getCompanyStatusStyle(company.status ?? '')}`}
              >
                {getCompanyStatusLabel(company.status ?? '')}
              </span>
            </div>

            {(company.address || company.city) && (
              <div className="flex items-start gap-2 text-sm text-gray-600 mb-2">
                <MapPin className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <span>
                  {company.address}
                  {company.address && company.city && ', '}
                  {company.postal_code && `${company.postal_code} `}
                  {company.city}
                </span>
              </div>
            )}

            {company.founded_date && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Calendar className="h-4 w-4 text-gray-400 shrink-0" />
                <span>Stiftet: {formatDate(company.founded_date)}</span>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-gray-100">
              <Link
                href={`/companies/${params.id}/stamdata`}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Rediger stamdata →
              </Link>
            </div>
          </div>

          {/* Nøglepersoner */}
          <div className="rounded-lg border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Nøglepersoner</h3>
              <Link
                href={`/companies/${params.id}/governance`}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Se alle →
              </Link>
            </div>
            {company.company_persons.length === 0 ? (
              <p className="text-sm text-gray-400">
                Ingen tilknyttede personer endnu.{' '}
                <Link
                  href={`/companies/${params.id}/governance`}
                  className="text-blue-600 hover:underline"
                >
                  Tilføj person
                </Link>
              </p>
            ) : (
              <div className="space-y-3">
                {company.company_persons.map((cp) => (
                  <div key={cp.id} className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                        {cp.person.first_name[0]}
                        {cp.person.last_name[0]}
                      </div>
                      <div>
                        <Link
                          href={`/persons/${cp.person.id}`}
                          className="text-sm font-medium text-gray-900 hover:text-blue-600"
                        >
                          {cp.person.first_name} {cp.person.last_name}
                        </Link>
                        <p className="text-xs text-gray-500">{cp.role}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {cp.person.phone && (
                        <a
                          href={`tel:${cp.person.phone}`}
                          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                          title={cp.person.phone}
                        >
                          <Phone className="h-3.5 w-3.5" />
                        </a>
                      )}
                      {cp.person.email && (
                        <a
                          href={`mailto:${cp.person.email}`}
                          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
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
        </div>

        {/* Højre: KPI-kort + quick actions */}
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <Link
              href={`/companies/${params.id}/contracts`}
              className="rounded-lg border bg-white p-4 shadow-sm hover:border-blue-200 hover:bg-blue-50 transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-blue-500" />
                <p className="text-xs text-gray-500">Kontrakter</p>
              </div>
              <p className="text-2xl font-bold text-gray-900">{activeContracts}</p>
              {expiringContracts.length > 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  {expiringContracts.length} udløber snart
                </p>
              )}
            </Link>

            <Link
              href={`/companies/${params.id}/cases`}
              className="rounded-lg border bg-white p-4 shadow-sm hover:border-blue-200 hover:bg-blue-50 transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <Briefcase className="h-4 w-4 text-blue-500" />
                <p className="text-xs text-gray-500">Aktive sager</p>
              </div>
              <p className="text-2xl font-bold text-gray-900">{activeCases}</p>
            </Link>

            <div
              className={`rounded-lg border p-4 shadow-sm ${
                overdueTasks > 0 ? 'bg-red-50 border-red-200' : 'bg-white'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <CheckSquare
                  className={`h-4 w-4 ${overdueTasks > 0 ? 'text-red-500' : 'text-gray-400'}`}
                />
                <p className="text-xs text-gray-500">Opgaver</p>
              </div>
              <p
                className={`text-2xl font-bold ${
                  overdueTasks > 0 ? 'text-red-700' : 'text-gray-900'
                }`}
              >
                {openTasks}
              </p>
              {overdueTasks > 0 && (
                <p className="text-xs text-red-600 mt-1">{overdueTasks} forfaldne</p>
              )}
            </div>

            {latestFinancialMetric ? (
              <Link
                href={`/companies/${params.id}/finance`}
                className="rounded-lg border bg-white p-4 shadow-sm hover:border-blue-200 hover:bg-blue-50 transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-xs text-gray-500">
                    Økonomi ({latestFinancialMetric.period_year})
                  </p>
                </div>
                <p className="text-lg font-bold text-gray-900">
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
                className="rounded-lg border-2 border-dashed border-gray-200 p-4 text-center hover:border-gray-300 transition-colors"
              >
                <p className="text-xs text-gray-400">Økonomi</p>
                <p className="text-sm text-gray-400 mt-1">Tilføj nøgletal</p>
              </Link>
            )}
          </div>

          {/* Quick actions */}
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Hurtighandlinger
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { href: `/contracts/new?companyId=${params.id}`, label: 'Ny kontrakt' },
                { href: `/cases/new?companyId=${params.id}`, label: 'Ny sag' },
                { href: `/tasks/new?companyId=${params.id}`, label: 'Ny opgave' },
                { href: `/companies/${params.id}/governance`, label: 'Tilføj person' },
              ].map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Plus className="h-4 w-4 text-gray-400" />
                  {label}
                </Link>
              ))}
            </div>
          </div>

          {/* Interne noter */}
          {company.notes && (
            <div className="rounded-lg border bg-white p-4 shadow-sm">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
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
