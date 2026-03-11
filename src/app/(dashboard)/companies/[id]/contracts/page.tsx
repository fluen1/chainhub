import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { canAccessCompany, canAccessSensitivity } from '@/lib/permissions'
import { FileText, Plus } from 'lucide-react'
import Link from 'next/link'
import type { SensitivityLevel } from '@prisma/client'

interface Props {
  params: { id: string }
}

const STATUS_LABELS: Record<string, string> = {
  UDKAST: 'Kladde',
  TIL_REVIEW: 'Til review',
  TIL_UNDERSKRIFT: 'Til underskrift',
  AKTIV: 'Aktiv',
  UDLOEBET: 'Udløbet',
  OPSAGT: 'Opsagt',
  FORNYET: 'Fornyet',
  ARKIVERET: 'Arkiveret',
}

const STATUS_STYLES: Record<string, string> = {
  UDKAST: 'bg-gray-100 text-gray-700',
  TIL_REVIEW: 'bg-yellow-50 text-yellow-700',
  TIL_UNDERSKRIFT: 'bg-blue-50 text-blue-700',
  AKTIV: 'bg-green-50 text-green-700',
  UDLOEBET: 'bg-red-50 text-red-700',
  OPSAGT: 'bg-red-100 text-red-800',
}

const SENSITIVITY_LABELS: Record<SensitivityLevel, string> = {
  PUBLIC: 'Offentlig',
  STANDARD: 'Standard',
  INTERN: 'Intern',
  FORTROLIG: 'Fortrolig',
  STRENGT_FORTROLIG: 'Strengt fortrolig',
}

export default async function CompanyContractsPage({ params }: Props) {
  const session = await auth()
  if (!session) redirect('/login')

  const hasAccess = await canAccessCompany(session.user.id, params.id)
  if (!hasAccess) notFound()

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Kontrakter</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {contracts.length} kontrakt{contracts.length !== 1 ? 'er' : ''}
          </p>
        </div>
        <Link
          href={`/contracts/new?companyId=${params.id}`}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Ny kontrakt
        </Link>
      </div>

      {contracts.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-10 text-center">
          <FileText className="mx-auto h-10 w-10 text-gray-400" />
          <h3 className="mt-2 text-sm font-semibold text-gray-900">Ingen kontrakter endnu</h3>
          <p className="mt-1 text-sm text-gray-500">Opret den første kontrakt for dette selskab.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Kontrakt</th>
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
                  <tr
                    key={contract.id}
                    className={
                      isExpired || isUrgent ? 'bg-red-50' : isWarning ? 'bg-yellow-50' : 'hover:bg-gray-50'
                    }
                  >
                    <td className="px-6 py-4">
                      <Link
                        href={`/contracts/${contract.id}`}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800"
                      >
                        {contract.display_name}
                      </Link>
                      <p className="text-xs text-gray-500 mt-0.5">{contract.system_type}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[contract.status] ?? 'bg-gray-100 text-gray-700'}`}>
                        {STATUS_LABELS[contract.status] ?? contract.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                      {SENSITIVITY_LABELS[contract.sensitivity]}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {contract.expiry_date ? (
                        <span className={isExpired || isUrgent ? 'text-red-700 font-medium' : isWarning ? 'text-orange-700' : 'text-gray-500'}>
                          {new Date(contract.expiry_date).toLocaleDateString('da-DK')}
                        </span>
                      ) : (
                        <span className="text-gray-400">Løbende</span>
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
