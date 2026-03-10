import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getAccessibleCompanies } from '@/lib/permissions'
import { Building2, FileText, Briefcase, AlertTriangle } from 'lucide-react'

export default async function DashboardPage() {
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

  const activeContracts = await prisma.contract.count({
    where: {
      organization_id: session.user.organizationId,
      status: 'AKTIV',
      deleted_at: null,
    },
  })

  const activeCases = await prisma.case.count({
    where: {
      organization_id: session.user.organizationId,
      status: { in: ['NY', 'AKTIV'] },
      deleted_at: null,
    },
  })

  const overdueTasks = await prisma.task.count({
    where: {
      organization_id: session.user.organizationId,
      due_date: { lt: new Date() },
      status: { not: 'LUKKET' },
      deleted_at: null,
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Overblik over din portefølje
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Selskaber"
          value={companies.length}
          icon={<Building2 className="h-5 w-5 text-blue-600" />}
        />
        <StatCard
          title="Aktive kontrakter"
          value={activeContracts}
          icon={<FileText className="h-5 w-5 text-green-600" />}
        />
        <StatCard
          title="Aktive sager"
          value={activeCases}
          icon={<Briefcase className="h-5 w-5 text-purple-600" />}
        />
        <StatCard
          title="Forfaldne opgaver"
          value={overdueTasks}
          icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
          warning={overdueTasks > 0}
        />
      </div>

      {/* Company list */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Selskaber</h2>
        {companies.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
            <Building2 className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-semibold text-gray-900">
              Ingen selskaber endnu
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Opret dit første selskab for at komme i gang.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {companies.map((company) => (
              <a
                key={company.id}
                href={`/companies/${company.id}`}
                className="block rounded-lg border bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {company.name}
                    </h3>
                    {company.cvr && (
                      <p className="text-sm text-gray-500">CVR: {company.cvr}</p>
                    )}
                  </div>
                  <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                    {company.status}
                  </span>
                </div>
                <div className="mt-4 flex gap-4 text-sm text-gray-500">
                  <span>{company._count.contracts} kontrakter</span>
                  <span>{company._count.cases} sager</span>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({
  title,
  value,
  icon,
  warning = false,
}: {
  title: string
  value: number
  icon: React.ReactNode
  warning?: boolean
}) {
  return (
    <div className={`rounded-lg border bg-white p-5 shadow-sm ${warning ? 'border-red-200' : ''}`}>
      <div className="flex items-center gap-3">
        {icon}
        <span className="text-sm font-medium text-gray-500">{title}</span>
      </div>
      <p className={`mt-2 text-3xl font-bold ${warning ? 'text-red-600' : 'text-gray-900'}`}>
        {value}
      </p>
    </div>
  )
}
