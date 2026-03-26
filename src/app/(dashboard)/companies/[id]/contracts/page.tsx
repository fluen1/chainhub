import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { canAccessSensitivity } from '@/lib/permissions'
import { FileText, Plus } from 'lucide-react'
import Link from 'next/link'
import {
  getContractStatusLabel,
  getContractStatusStyle,
  getSensitivityLabel,
  getContractTypeLabel,
} from '@/lib/labels'

interface Props {
  params: { id: string }
}

export default async function CompanyContractsPage({ params }: Props) {
  const session = await auth()
  if (!session) redirect('/login')

  // Layout already checks canAccessCompany
  const allContracts = await prisma.contract.findMany({
    where: {
      organization_id: session.user.organizationId,
      company_id: params.id,
      deleted_at: null,
    },
    orderBy: [{ status: 'asc' }, { expiry_date: 'asc' }],
  })

  // Filtrer baseret på sensitivity-adgang
  const contracts = await Promise.all(
    allContracts.map(async (contract) => {
      const hasSens = await canAccessSensitivity(session.user.id, contract.sensitivity)
      return hasSens ? contract : null
    })
  ).then((results) => results.filter(Boolean) as typeof allContracts)

  const today = new Date()
  const fourteenDays = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
  const ninetyDays = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">
          {contracts.length} kontrakt{contracts.length !== 1 ? 'er' : ''}
        </p>
        <Link
          href={`/contracts/new?companyId=${params.id}`}
          className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
        >
          <Plus className="h-4 w-4" />
          Ny kontrakt
        </Link>
      </div>

      {contracts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 py-16 text-center">
          <FileText className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm font-medium text-gray-900">Ingen kontrakter endnu</p>
          <p className="mt-1 text-sm text-gray-400">Opret den første kontrakt for dette selskab.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 tracking-wide">Kontrakt</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 tracking-wide">Status</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 tracking-wide hidden sm:table-cell">Sensitivitet</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 tracking-wide">Udløber</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {contracts.map((contract) => {
                const isExpired = contract.expiry_date && new Date(contract.expiry_date) < today
                const isUrgent = contract.expiry_date && new Date(contract.expiry_date) <= fourteenDays && !isExpired
                const isWarning = contract.expiry_date && new Date(contract.expiry_date) <= ninetyDays && !isUrgent && !isExpired

                return (
                  <tr
                    key={contract.id}
                    className={`transition-colors ${
                      isExpired || isUrgent
                        ? 'bg-red-50/50'
                        : isWarning
                          ? 'bg-amber-50/50'
                          : 'hover:bg-gray-50/50'
                    }`}
                  >
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/contracts/${contract.id}`}
                        className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors"
                      >
                        {contract.display_name}
                      </Link>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {getContractTypeLabel(contract.system_type)}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium leading-none ${getContractStatusStyle(contract.status)}`}>
                        {getContractStatusLabel(contract.status)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-xs text-gray-500 hidden sm:table-cell">
                      {getSensitivityLabel(contract.sensitivity)}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-sm tabular-nums">
                      {contract.expiry_date ? (
                        <span className={
                          isExpired || isUrgent
                            ? 'text-red-600 font-medium'
                            : isWarning
                              ? 'text-amber-600'
                              : 'text-gray-500'
                        }>
                          {new Date(contract.expiry_date).toLocaleDateString('da-DK')}
                        </span>
                      ) : (
                        <span className="text-gray-300">Løbende</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
