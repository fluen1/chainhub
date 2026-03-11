import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getAccessibleCompanies, canAccessSensitivity } from '@/lib/permissions'
import { FileText, Plus } from 'lucide-react'
import Link from 'next/link'
import {
  getContractStatusLabel,
  getContractStatusStyle,
  getContractTypeLabel,
  getSensitivityLabel,
} from '@/lib/labels'
import { Suspense } from 'react'
import { SearchAndFilter } from '@/components/ui/SearchAndFilter'
import { Pagination } from '@/components/ui/Pagination'
import { parsePaginationParams } from '@/lib/pagination'
import type { ContractStatus } from '@prisma/client'

const PAGE_SIZE = 20

const STATUS_OPTIONS = [
  { value: 'UDKAST', label: 'Kladde' },
  { value: 'TIL_REVIEW', label: 'Til review' },
  { value: 'TIL_UNDERSKRIFT', label: 'Til underskrift' },
  { value: 'AKTIV', label: 'Aktiv' },
  { value: 'UDLOEBET', label: 'Udløbet' },
  { value: 'OPSAGT', label: 'Opsagt' },
  { value: 'ARKIVERET', label: 'Arkiveret' },
]

const EXPIRY_OPTIONS = [
  { value: '14', label: 'Udløber om 14 dage' },
  { value: '30', label: 'Udløber om 30 dage' },
  { value: '90', label: 'Udløber om 90 dage' },
]

interface ContractsPageProps {
  searchParams: {
    q?: string
    status?: string
    expiry?: string
    page?: string
  }
}

export default async function ContractsPage({ searchParams }: ContractsPageProps) {
  const session = await auth()
  if (!session) redirect('/login')

  const { page, skip, take } = parsePaginationParams(searchParams.page, PAGE_SIZE)
  const q = searchParams.q?.trim() ?? ''
  const statusFilter = searchParams.status as ContractStatus | undefined
  const expiryDays = searchParams.expiry ? parseInt(searchParams.expiry) : null

  const companyIds = await getAccessibleCompanies(
    session.user.id,
    session.user.organizationId
  )

  const today = new Date()
  const expiryLimit = expiryDays
    ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000)
    : null

  const where = {
    organization_id: session.user.organizationId,
    ...(companyIds.length > 0 ? { company_id: { in: companyIds } } : { id: 'no-match' }),
    deleted_at: null as null,
    ...(q ? { display_name: { contains: q, mode: 'insensitive' as const } } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(expiryLimit
      ? { expiry_date: { not: null, lte: expiryLimit, gte: today } }
      : {}),
  }

  const [allContracts, totalCountRaw] = await Promise.all([
    companyIds.length > 0
      ? prisma.contract.findMany({
          where,
          include: {
            company: { select: { id: true, name: true } },
          },
          orderBy: { expiry_date: 'asc' },
          skip,
          take,
        })
      : Promise.resolve([]),
    companyIds.length > 0
      ? prisma.contract.count({ where })
      : Promise.resolve(0),
  ])

  const contracts = await Promise.all(
    allContracts.map(async (contract) => {
      const hasAccess = await canAccessSensitivity(session.user.id, contract.sensitivity)
      return hasAccess ? contract : null
    })
  ).then((results) => results.filter(Boolean) as typeof allContracts)

  const fourteenDays = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
  const ninetyDays = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kontrakter</h1>
          <p className="mt-1 text-sm text-gray-500">
            Alle kontrakter på tværs af selskaber
          </p>
        </div>
        <Link
          href="/contracts/new"
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Ny kontrakt
        </Link>
      </div>

      <Suspense fallback={null}>
        <SearchAndFilter
          placeholder="Søg på kontraktnavn..."
          filters={[
            { key: 'status', label: 'Status', options: STATUS_OPTIONS },
            { key: 'expiry', label: 'Udløber', options: EXPIRY_OPTIONS },
          ]}
        />
      </Suspense>

      {contracts.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          {q || statusFilter || expiryDays ? (
            <>
              <h3 className="mt-2 text-sm font-semibold text-gray-900">Ingen kontrakter matcher søgningen</h3>
              <p className="mt-1 text-sm text-gray-500">Prøv at ændre filtrene.</p>
            </>
          ) : (
            <>
              <h3 className="mt-2 text-sm font-semibold text-gray-900">Ingen kontrakter endnu</h3>
              <p className="mt-1 text-sm text-gray-500">Opret din første kontrakt for at komme i gang.</p>
              <Link href="/contracts/new" className="mt-4 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                <Plus className="h-4 w-4" />Opret kontrakt
              </Link>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Kontrakt</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Selskab</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Sensitivitet</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Udløber</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {contracts.map((contract) => {
                  const isExpired = contract.expiry_date && new Date(contract.expiry_date) < today
                  const isUrgent = contract.expiry_date && new Date(contract.expiry_date) <= fourteenDays && !isExpired
                  const isWarning = contract.expiry_date && new Date(contract.expiry_date) <= ninetyDays && !isUrgent && !isExpired

                  return (
                    <tr key={contract.id} className={isExpired || isUrgent ? 'bg-red-50 hover:bg-red-100' : isWarning ? 'bg-yellow-50 hover:bg-yellow-100' : 'hover:bg-gray-50'}>
                      <td className="px-6 py-4">
                        <Link href={`/contracts/${contract.id}`} className="text-sm font-medium text-blue-600 hover:text-blue-800">{contract.display_name}</Link>
                        <p className="text-xs text-gray-500 mt-0.5">{getContractTypeLabel(contract.system_type)}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link href={`/companies/${contract.company.id}`} className="text-sm text-gray-700 hover:text-blue-600">{contract.company.name}</Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getContractStatusStyle(contract.status)}`}>{getContractStatusLabel(contract.status)}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">{getSensitivityLabel(contract.sensitivity)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {contract.expiry_date ? (
                          <span className={isExpired || isUrgent ? 'text-red-700 font-medium' : isWarning ? 'text-orange-700' : 'text-gray-500'}>
                            {new Date(contract.expiry_date).toLocaleDateString('da-DK')}
                          </span>
                        ) : (<span className="text-gray-400">Løbende</span>)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Suspense fallback={null}>
            <Pagination currentPage={page} totalCount={totalCountRaw} pageSize={PAGE_SIZE} />
          </Suspense>
        </>
      )}
    </div>
  )
}
