import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { canAccessSensitivity } from '@/lib/permissions'
import { FileText, Plus, AlertTriangle, ExternalLink } from 'lucide-react'
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
    orderBy: [{ expiry_date: 'asc' }, { created_at: 'desc' }],
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

  // Categorize contracts for urgency
  const expired = contracts.filter(
    (c) => c.expiry_date && new Date(c.expiry_date) < today
  )
  const urgent = contracts.filter(
    (c) => c.expiry_date && new Date(c.expiry_date) >= today && new Date(c.expiry_date) <= fourteenDays
  )
  const warning = contracts.filter(
    (c) => c.expiry_date && new Date(c.expiry_date) > fourteenDays && new Date(c.expiry_date) <= ninetyDays
  )
  const needsAttention = expired.length + urgent.length + warning.length

  // Sort: expiring soonest first, then contracts without expiry
  const sorted = [...contracts].sort((a, b) => {
    // Expired/urgent first
    const aExpiry = a.expiry_date ? new Date(a.expiry_date).getTime() : Infinity
    const bExpiry = b.expiry_date ? new Date(b.expiry_date).getTime() : Infinity
    return aExpiry - bExpiry
  })

  // Summary stats
  const uniqueTypes = new Set(contracts.map((c) => c.system_type))

  function getRowAccent(contract: typeof contracts[0]): string {
    if (!contract.expiry_date) return ''
    const d = new Date(contract.expiry_date)
    if (d < today) return 'border-l-[3px] border-l-red-400'
    if (d <= fourteenDays) return 'border-l-[3px] border-l-red-400'
    if (d <= ninetyDays) return 'border-l-[3px] border-l-amber-400'
    return ''
  }

  return (
    <div className="space-y-4">
      {/* Header med summary */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span>{contracts.length} kontrakt{contracts.length !== 1 ? 'er' : ''}</span>
            <span className="text-gray-300">·</span>
            <span>{uniqueTypes.size} type{uniqueTypes.size !== 1 ? 'r' : ''}</span>
            {needsAttention > 0 && (
              <>
                <span className="text-gray-300">·</span>
                <span className="text-red-600 font-medium">
                  {needsAttention} kræver opmærksomhed
                </span>
              </>
            )}
          </div>
        </div>
        <Link
          href={`/contracts/new?companyId=${params.id}`}
          className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
        >
          <Plus className="h-4 w-4" />
          Ny kontrakt
        </Link>
      </div>

      {/* Urgency alerts — kun for kontrakter der udløber inden for 14 dage */}
      {(expired.length > 0 || urgent.length > 0) && (
        <div className="space-y-1.5">
          {[...expired, ...urgent].map((contract) => {
            const d = new Date(contract.expiry_date!)
            const days = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
            const isExpired = days < 0

            return (
              <Link
                key={contract.id}
                href={`/contracts/${contract.id}`}
                className="flex items-center gap-3 rounded-lg bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
              >
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{contract.display_name}</span>
                <span className="text-xs shrink-0">
                  {isExpired
                    ? `${Math.abs(days)} dage forsinket`
                    : `${days} dage tilbage`}
                </span>
                <ExternalLink className="h-3 w-3 shrink-0 opacity-50" />
              </Link>
            )
          })}
        </div>
      )}

      {/* Kontraktliste */}
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
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 tracking-wide hidden lg:table-cell">Type</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 tracking-wide">Status</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 tracking-wide hidden sm:table-cell">Sensitivitet</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-400 tracking-wide">Udløber</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map((contract) => {
                const accent = getRowAccent(contract)
                const isExpired = contract.expiry_date && new Date(contract.expiry_date) < today
                const isUrgent = contract.expiry_date && new Date(contract.expiry_date) <= fourteenDays && !isExpired
                const isWarning = contract.expiry_date && new Date(contract.expiry_date) <= ninetyDays && !isUrgent && !isExpired

                return (
                  <tr
                    key={contract.id}
                    className={`transition-colors hover:bg-gray-50/50 ${accent}`}
                  >
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/contracts/${contract.id}`}
                        className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors"
                      >
                        {contract.display_name}
                      </Link>
                      {/* Type som undertekst på mobil, skjult på desktop (har egen kolonne) */}
                      <p className="text-xs text-gray-400 mt-0.5 lg:hidden">
                        {getContractTypeLabel(contract.system_type)}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-xs text-gray-500 hidden lg:table-cell">
                      {getContractTypeLabel(contract.system_type)}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium leading-none ${getContractStatusStyle(contract.status)}`}>
                        {getContractStatusLabel(contract.status)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-xs text-gray-500 hidden sm:table-cell">
                      {getSensitivityLabel(contract.sensitivity)}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-right text-sm tabular-nums">
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
