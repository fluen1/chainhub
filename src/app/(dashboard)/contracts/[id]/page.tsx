import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { canAccessSensitivity } from '@/lib/permissions'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { ContractStatusForm } from '@/components/contracts/ContractStatusForm'
import { UploadVersionForm } from '@/components/contracts/UploadVersionForm'
import { FileUpload } from '@/components/documents/FileUpload'
import { DocumentList } from '@/components/documents/DocumentList'
import {
  CONTRACT_TYPE_LABELS,
  type ContractSystemTypeKey,
} from '@/lib/validations/contract'
import {
  CHANGE_TYPE_LABELS,
  CHANGE_TYPE_STYLES,
  getContractStatusLabel,
  getContractStatusStyle,
  getSensitivityLabel,
} from '@/lib/labels'

interface Props {
  params: { id: string }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Gyldige næste statuser
const NEXT_STATUSES: Record<string, string[]> = {
  UDKAST: ['TIL_REVIEW', 'AKTIV'],
  TIL_REVIEW: ['UDKAST', 'TIL_UNDERSKRIFT', 'AKTIV'],
  TIL_UNDERSKRIFT: ['TIL_REVIEW', 'AKTIV'],
  AKTIV: ['UDLOEBET', 'OPSAGT', 'FORNYET'],
  UDLOEBET: ['FORNYET'],
}

export default async function ContractDetailPage({ params }: Props) {
  const session = await auth()
  if (!session) redirect('/login')

  const contract = await prisma.contract.findFirst({
    where: {
      id: params.id,
      organization_id: session.user.organizationId,
      deleted_at: null,
    },
    include: {
      company: { select: { id: true, name: true } },
      parties: {
        include: {
          person: { select: { id: true, first_name: true, last_name: true, email: true } },
        },
      },
      versions: {
        orderBy: { version_number: 'desc' },
      },
    },
  })

  if (!contract) notFound()

  // Sensitivity-tjek
  const hasAccess = await canAccessSensitivity(session.user.id, contract.sensitivity)
  if (!hasAccess) {
    return (
      <div className="rounded-lg border bg-white p-12 text-center">
        <p className="text-sm text-gray-500">
          Du har ikke adgang til at se denne kontrakt.
        </p>
        <Link href="/contracts" className="mt-3 text-sm text-blue-600 hover:text-blue-800">
          ← Tilbage til kontrakter
        </Link>
      </div>
    )
  }

  // Audit log — STRENGT_FORTROLIG og FORTROLIG adgange logges
  if (contract.sensitivity === 'STRENGT_FORTROLIG' || contract.sensitivity === 'FORTROLIG') {
    await prisma.auditLog.create({
      data: {
        organization_id: session.user.organizationId,
        user_id: session.user.id,
        action: 'VIEW',
        resource_type: 'contract',
        resource_id: contract.id,
        sensitivity: contract.sensitivity,
      },
    })

    // Opdater last_viewed
    await prisma.contract.update({
      where: { id: contract.id },
      data: {
        last_viewed_at: new Date(),
        last_viewed_by: session.user.id,
      },
    })
  }

  // Hent dokumenter knyttet til kontraktens selskab
  const rawDocuments = await prisma.document.findMany({
    where: {
      organization_id: session.user.organizationId,
      company_id: contract.company.id,
      deleted_at: null,
    },
    orderBy: { uploaded_at: 'desc' },
    take: 50,
  })

  const contractDocuments = rawDocuments.map((doc) => ({
    id: doc.id,
    title: doc.title,
    file_name: doc.file_name,
    file_url: doc.file_url,
    file_size_bytes: doc.file_size_bytes,
    file_type: doc.file_type,
    uploaded_at: doc.uploaded_at.toISOString(),
  }))

  const nextStatuses = NEXT_STATUSES[contract.status] ?? []
  const displayTypeName = CONTRACT_TYPE_LABELS[contract.system_type as ContractSystemTypeKey] ?? contract.system_type

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/contracts" className="mt-1 rounded-md p-1 hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-500" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">{contract.display_name}</h1>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getContractStatusStyle(contract.status)}`}>
              {getContractStatusLabel(contract.status)}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-gray-500">
            {displayTypeName} ·{' '}
            <Link href={`/companies/${contract.company.id}`} className="hover:text-blue-600">
              {contract.company.name}
            </Link>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Hoved-panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Stamdata */}
          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Kontraktdetaljer</h2>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Sensitivitet</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {getSensitivityLabel(contract.sensitivity)}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Startdato</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {contract.effective_date
                    ? new Date(contract.effective_date).toLocaleDateString('da-DK')
                    : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Udløbsdato</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {contract.expiry_date ? (
                    new Date(contract.expiry_date).toLocaleDateString('da-DK')
                  ) : (
                    <span className="text-gray-400">Løbende</span>
                  )}
                </dd>
              </div>
              {contract.notice_period_days && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Opsigelsesvarsel</dt>
                  <dd className="mt-1 text-sm text-gray-900">{contract.notice_period_days} dage</dd>
                </div>
              )}
              <div>
                <dt className="text-sm font-medium text-gray-500">Advisering</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {[
                    contract.reminder_90_days && '90 dage',
                    contract.reminder_30_days && '30 dage',
                    contract.reminder_7_days && '7 dage',
                  ]
                    .filter(Boolean)
                    .join(', ') || 'Ingen'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Oprettet</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {new Date(contract.created_at).toLocaleDateString('da-DK')}
                </dd>
              </div>
            </dl>

            {contract.notes && (
              <div className="mt-4 pt-4 border-t">
                <dt className="text-sm font-medium text-gray-500">Noter</dt>
                <dd className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{contract.notes}</dd>
              </div>
            )}
          </div>

          {/* Parter */}
          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900 mb-4">
              Parter ({contract.parties.length})
            </h2>
            {contract.parties.length === 0 ? (
              <p className="text-sm text-gray-500">Ingen parter tilknyttet endnu.</p>
            ) : (
              <ul className="divide-y divide-gray-200">
                {contract.parties.map((party) => (
                  <li key={party.id} className="py-3 flex items-center justify-between">
                    <div>
                      {party.person ? (
                        <Link
                          href={`/persons/${party.person.id}`}
                          className="text-sm font-medium text-blue-600 hover:text-blue-800"
                        >
                          {party.person.first_name} {party.person.last_name}
                        </Link>
                      ) : (
                        <span className="text-sm font-medium text-gray-900">
                          {party.counterparty_name ?? 'Ekstern part'}
                        </span>
                      )}
                      {party.role_in_contract && (
                        <p className="text-xs text-gray-500">{party.role_in_contract}</p>
                      )}
                    </div>
                    {party.is_signer && (
                      <span className="text-xs bg-blue-50 text-blue-700 rounded-full px-2 py-0.5">
                        Underskriver
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Versionshistorik */}
          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900 mb-4">
              Versioner ({contract.versions.length})
            </h2>

            {contract.versions.length === 0 ? (
              <p className="text-sm text-gray-500">Ingen versioner uploadet endnu.</p>
            ) : (
              <ul className="divide-y divide-gray-200">
                {contract.versions.map((v) => (
                  <li key={v.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-gray-900">
                          Version {v.version_number}
                        </p>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CHANGE_TYPE_STYLES[v.change_type] ?? 'bg-gray-100 text-gray-700'}`}
                        >
                          {CHANGE_TYPE_LABELS[v.change_type] ?? v.change_type}
                        </span>
                        {v.is_current && (
                          <span className="inline-flex items-center rounded-full bg-green-50 text-green-700 px-2 py-0.5 text-xs font-medium">
                            Aktuel
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                        <a
                          href={v.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 hover:underline truncate"
                        >
                          {v.file_name}
                        </a>
                        <span>·</span>
                        <span>{formatFileSize(v.file_size_bytes)}</span>
                        <span>·</span>
                        <span>{new Date(v.uploaded_at).toLocaleDateString('da-DK')}</span>
                      </div>
                      {v.change_note && (
                        <p className="mt-1 text-xs text-gray-600">{v.change_note}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <UploadVersionForm
              contractId={contract.id}
              companyId={contract.company.id}
            />
          </div>

          {/* Dokumenter */}
          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Dokumenter</h2>
            <FileUpload companyId={contract.company.id} className="mb-4" />
            {contractDocuments.length === 0 ? (
              <p className="text-sm text-gray-500">Ingen dokumenter tilknyttet endnu.</p>
            ) : (
              <DocumentList documents={contractDocuments} />
            )}
          </div>
        </div>

        {/* Side-panel */}
        <div className="space-y-6">
          {/* Status-opdatering */}
          {nextStatuses.length > 0 && (
            <ContractStatusForm
              contractId={contract.id}
              currentStatus={contract.status}
              nextStatuses={nextStatuses}
            />
          )}

          {/* Handlinger */}
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Handlinger</h3>
            <div className="space-y-2">
              <Link
                href={`/companies/${contract.company.id}/contracts`}
                className="block text-sm text-blue-600 hover:text-blue-800"
              >
                → Se alle kontrakter for {contract.company.name}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
