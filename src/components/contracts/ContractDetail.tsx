'use client'

import { useState } from 'react'
import { updateContractStatus } from '@/actions/contracts'
import { toast } from 'sonner'
import type { ContractWithRelations } from '@/types/contract'
import { ContractStatusBadge } from './ContractStatusBadge'
import { SensitivityBadge } from './SensitivityBadge'
import { CONTRACT_TYPE_LABELS } from '@/lib/contracts/labels'
import { VALID_STATUS_TRANSITIONS } from '@/lib/validations/contract'
import type { ContractStatus } from '@prisma/client'

interface Props {
  contract: ContractWithRelations
}

const STATUS_LABELS: Record<ContractStatus, string> = {
  UDKAST: 'Udkast',
  TIL_REVIEW: 'Send til gennemgang',
  TIL_UNDERSKRIFT: 'Send til underskrift',
  AKTIV: 'Markér som aktiv',
  UDLOEBET: 'Markér som udløbet',
  OPSAGT: 'Markér som opsagt',
  FORNYET: 'Markér som fornyet',
  ARKIVERET: 'Arkivér',
}

export function ContractDetail({ contract }: Props) {
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const nextStatuses = VALID_STATUS_TRANSITIONS[contract.status] ?? []

  async function handleStatusChange(newStatus: ContractStatus) {
    setIsUpdatingStatus(true)
    const result = await updateContractStatus({
      contractId: contract.id,
      newStatus,
    })
    setIsUpdatingStatus(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Status opdateret')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{contract.displayName}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {CONTRACT_TYPE_LABELS[contract.systemType] ?? contract.systemType} ·{' '}
            {contract.company.name}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <ContractStatusBadge status={contract.status} />
          <SensitivityBadge level={contract.sensitivity} />
        </div>
      </div>

      {/* Status flow */}
      {nextStatuses.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Skift status</h2>
          <div className="flex flex-wrap gap-2">
            {nextStatuses.map((nextStatus) => (
              <button
                key={nextStatus}
                onClick={() => handleStatusChange(nextStatus)}
                disabled={isUpdatingStatus}
                className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {STATUS_LABELS[nextStatus]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Detaljer */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Datoer */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Datoer</h2>
          <dl className="space-y-2 text-sm">
            {contract.effectiveDate && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Ikrafttrædelse</dt>
                <dd className="text-gray-900">
                  {new Date(contract.effectiveDate).toLocaleDateString('da-DK')}
                </dd>
              </div>
            )}
            {contract.expiryDate ? (
              <div className="flex justify-between">
                <dt className="text-gray-500">Udløber</dt>
                <dd className="text-gray-900">
                  {new Date(contract.expiryDate).toLocaleDateString('da-DK')}
                </dd>
              </div>
            ) : (
              <div className="flex justify-between">
                <dt className="text-gray-500">Varighed</dt>
                <dd className="text-gray-900">
                  {contract.noticePeriodDays
                    ? `Løbende — ${contract.noticePeriodDays} dages opsigelsesvarsel`
                    : 'Løbende'}
                </dd>
              </div>
            )}
            {contract.signedDate && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Underskrevet</dt>
                <dd className="text-gray-900">
                  {new Date(contract.signedDate).toLocaleDateString('da-DK')}
                </dd>
              </div>
            )}
            {contract.mustRetainUntil &&
              contract.mustRetainUntil < new Date('9999-01-01') && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Opbevar til</dt>
                  <dd className="text-gray-900">
                    {new Date(contract.mustRetainUntil).toLocaleDateString('da-DK')}
                  </dd>
                </div>
              )}
          </dl>
        </div>

        {/* Parter */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-medium text-gray-700 mb-3">
            Parter ({contract.parties.length})
          </h2>
          {contract.parties.length === 0 ? (
            <p className="text-sm text-gray-400">Ingen parter tilknyttet endnu</p>
          ) : (
            <ul className="space-y-2">
              {contract.parties.map((party) => (
                <li key={party.id} className="text-sm">
                  <span className="font-medium text-gray-900">
                    {party.person
                      ? `${party.person.firstName} ${party.person.lastName}`
                      : party.counterpartyName ?? 'Ukendt part'}
                  </span>
                  {party.roleInContract && (
                    <span className="text-gray-500"> · {party.roleInContract}</span>
                  )}
                  {party.isSigner && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700">
                      Underskriver
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Versioner */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-medium text-gray-700 mb-3">
          Versioner ({contract.versions.length})
        </h2>
        {contract.versions.length === 0 ? (
          <p className="text-sm text-gray-400">Ingen filer uploadet endnu</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {contract.versions.map((version) => (
              <li key={version.id} className="py-2 flex items-center justify-between">
                <div className="text-sm">
                  <span className="font-medium text-gray-900">v{version.versionNumber}</span>
                  <span className="ml-2 text-gray-500">{version.fileName}</span>
                  {version.isCurrent && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-green-50 px-1.5 py-0.5 text-xs text-green-700">
                      Aktuel
                    </span>
                  )}
                  <span className="ml-2 text-xs text-gray-400">
                    {version.changeType === 'MATERIEL'
                      ? 'Materiel ændring'
                      : version.changeType === 'ALLONGE'
                        ? 'Allonge'
                        : 'Redaktionel'}
                  </span>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(version.uploadedAt).toLocaleDateString('da-DK')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Bilag */}
      {contract.attachments.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-medium text-gray-700 mb-3">
            Bilag ({contract.attachments.length})
          </h2>
          <ul className="divide-y divide-gray-100">
            {contract.attachments.map((attachment) => (
              <li key={attachment.id} className="py-2 text-sm">
                <span className="font-medium text-gray-900">{attachment.fileName}</span>
                {attachment.description && (
                  <span className="ml-2 text-gray-500">{attachment.description}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Relationer */}
      {(contract.relationsFrom.length > 0 || contract.relationsTo.length > 0) && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Relationer</h2>
          <ul className="space-y-1 text-sm">
            {contract.relationsFrom.map((rel) => (
              <li key={rel.id} className="flex items-center gap-2">
                <span className="text-gray-500">Denne kontrakt</span>
                <span className="font-medium text-indigo-600">
                  {rel.relationType.toLowerCase()}
                </span>
                <span className="text-gray-900">{rel.toContract.displayName}</span>
              </li>
            ))}
            {contract.relationsTo.map((rel) => (
              <li key={rel.id} className="flex items-center gap-2">
                <span className="text-gray-900">{rel.fromContract.displayName}</span>
                <span className="font-medium text-indigo-600">
                  {rel.relationType.toLowerCase()}
                </span>
                <span className="text-gray-500">denne kontrakt</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Notat */}
      {contract.notes && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-medium text-gray-700 mb-2">Notat</h2>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{contract.notes}</p>
        </div>
      )}
    </div>
  )
}