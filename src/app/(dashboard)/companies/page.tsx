import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getAccessibleCompanies } from '@/lib/permissions'
import { Building2, Plus } from 'lucide-react'
import Link from 'next/link'

export default async function CompaniesPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const companyIds = await getAccessibleCompanies(
    session.user.id,
    session.user.organizationId
  )

  const companies = await prisma.company.findMany({
    where: {
      organization_id: session.user.organizationId,
      id: { in: companyIds },
      deleted_at: null,
    },
    include: {
      _count: {
        select: {
          contracts: { where: { deleted_at: null } },
          cases: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Selskaber</h1>
          <p className="mt-1 text-sm text-gray-500">
            Administrer dine selskaber og klinikker
          </p>
        </div>
        <Link
          href="/companies/new"
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Nyt selskab
        </Link>
      </div>

      {companies.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <Building2 className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-semibold text-gray-900">
            Ingen selskaber endnu
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Opret dit første selskab for at komme i gang.
          </p>
          <Link
            href="/companies/new"
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Opret selskab
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Navn</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">CVR</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Kontrakter</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Sager</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {companies.map((company) => (
                <tr key={company.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-6 py-4">
                    <Link href={`/companies/${company.id}`} className="font-medium text-blue-600 hover:text-blue-800">
                      {company.name}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{company.cvr || '—'}</td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                      {company.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{company._count.contracts}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{company._count.cases}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
