import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getAccessibleCompanies } from '@/lib/permissions'
import { Briefcase, Plus } from 'lucide-react'
import Link from 'next/link'

const STATUS_LABELS: Record<string, string> = {
  NY: 'Ny',
  AKTIV: 'Aktiv',
  AFVENTER_EKSTERN: 'Afventer ekstern',
  AFVENTER_KLIENT: 'Afventer klient',
  LUKKET: 'Lukket',
  ARKIVERET: 'Arkiveret',
}

const STATUS_STYLES: Record<string, string> = {
  NY: 'bg-blue-50 text-blue-700',
  AKTIV: 'bg-green-50 text-green-700',
  AFVENTER_EKSTERN: 'bg-yellow-50 text-yellow-700',
  AFVENTER_KLIENT: 'bg-orange-50 text-orange-700',
  LUKKET: 'bg-gray-100 text-gray-600',
  ARKIVERET: 'bg-gray-50 text-gray-400',
}

const TYPE_LABELS: Record<string, string> = {
  TRANSAKTION: 'Transaktion',
  TVIST: 'Tvist',
  COMPLIANCE: 'Compliance',
  KONTRAKT: 'Kontrakt',
  GOVERNANCE: 'Governance',
  ANDET: 'Andet',
}

export default async function CasesPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const companyIds = await getAccessibleCompanies(
    session.user.id,
    session.user.organizationId
  )

  // Hent sager via CaseCompany-tabellen
  const caseCompanyLinks = companyIds.length > 0
    ? await prisma.caseCompany.findMany({
        where: {
          organization_id: session.user.organizationId,
          company_id: { in: companyIds },
        },
        select: { case_id: true },
        distinct: ['case_id'],
      })
    : []

  const caseIds = caseCompanyLinks.map((cc) => cc.case_id)

  const cases = caseIds.length > 0
    ? await prisma.case.findMany({
        where: {
          id: { in: caseIds },
          organization_id: session.user.organizationId,
          deleted_at: null,
        },
        include: {
          case_companies: {
            include: {
              company: { select: { id: true, name: true } },
            },
          },
          _count: {
            select: {
              tasks: { where: { deleted_at: null, status: { not: 'LUKKET' } } },
            },
          },
        },
        orderBy: { created_at: 'desc' },
      })
    : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sager</h1>
          <p className="mt-1 text-sm text-gray-500">Alle sager på tværs af selskaber</p>
        </div>
        <Link
          href="/cases/new"
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Ny sag
        </Link>
      </div>

      {cases.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <Briefcase className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-semibold text-gray-900">Ingen sager endnu</h3>
          <p className="mt-1 text-sm text-gray-500">Opret din første sag for at komme i gang.</p>
          <Link
            href="/cases/new"
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Opret sag
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Sag</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Selskab(er)</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Åbne opgaver</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {cases.map((caseItem) => (
                <tr key={caseItem.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <Link
                      href={`/cases/${caseItem.id}`}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800"
                    >
                      {caseItem.title}
                    </Link>
                    {caseItem.description && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {caseItem.description.split('\n')[0]}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {TYPE_LABELS[caseItem.case_type] ?? caseItem.case_type}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {caseItem.case_companies.slice(0, 3).map((cc) => (
                        <Link
                          key={cc.company.id}
                          href={`/companies/${cc.company.id}`}
                          className="text-xs text-gray-600 hover:text-blue-600"
                        >
                          {cc.company.name}
                        </Link>
                      ))}
                      {caseItem.case_companies.length > 3 && (
                        <span className="text-xs text-gray-400">
                          +{caseItem.case_companies.length - 3} mere
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[caseItem.status] ?? 'bg-gray-100 text-gray-700'}`}>
                      {STATUS_LABELS[caseItem.status] ?? caseItem.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {caseItem._count.tasks > 0 ? (
                      <span className="inline-flex items-center rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-700">
                        {caseItem._count.tasks}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
