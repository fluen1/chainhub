'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { ContractWithCounts } from '@/types/contract'
import { CONTRACT_TYPE_LABELS } from '@/lib/contracts/labels'
import { ContractStatusBadge } from './ContractStatusBadge'
import { SensitivityBadge } from './SensitivityBadge'

interface Props {
  contracts: ContractWithCounts[]
  total: number
}

export function ContractList({ contracts, total }: Props) {
  if (contracts.length === 0) {
    return <ContractListEmpty />
  }

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">
        Viser {contracts.length} af {total} kontrakter
      </p>
      <div className="space-y-2">
        {contracts.map((contract) => (
          <ContractListItem key={contract.id} contract={contract} />
        ))}
      </div>
    </div>
  )
}

function ContractListItem({ contract }: { contract: ContractWithCounts }) {
  return (
    <Link
      href={`/contracts/${contract.id}`}
      className="block rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium text-gray-900 truncate">{contract.displayName}</h3>
            <span className="text-xs text-gray-400">
              {CONTRACT_TYPE_LABELS[contract.systemType] ?? contract.systemType}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{contract.company.name}</p>
          {contract.expiryDate && (
            <p className="text-xs text-gray-400 mt-1">
              Udløber: {new Date(contract.expiryDate).toLocaleDateString('da-DK')}
            </p>
          )}
          {!contract.expiryDate && contract.noticePeriodDays && (
            <p className="text-xs text-gray-400 mt-1">
              Løbende — opsigelsesvarsel {contract.noticePeriodDays} dage
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <ContractStatusBadge status={contract.status} />
          <SensitivityBadge level={contract.sensitivity} />
        </div>
      </div>
      <div className="mt-2 flex items-center gap-4 text-xs text-gray-400">
        <span>{contract._count.parties} parter</span>
        <span>{contract._count.versions} versioner</span>
        <span>{contract._count.attachments} bilag</span>
      </div>
    </Link>
  )
}

export function ContractListEmpty() {
  return (
    <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 py-16 text-center">
      <p className="text-gray-500 font-medium">Ingen kontrakter endnu</p>
      <p className="text-sm text-gray-400 mt-1">
        Opret din første kontrakt for at komme i gang
      </p>
    </div>
  )
}