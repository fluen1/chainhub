'use client'

import type { CompanyWithRelations } from '@/types/company'
import { formatDate } from '@/lib/utils'

interface CompanyStamdataProps {
  company: CompanyWithRelations
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-sm font-medium text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900">{value ?? '—'}</dd>
    </div>
  )
}

const STATUS_LABELS: Record<string, string> = {
  aktiv: 'Aktiv',
  inaktiv: 'Inaktiv',
  under_stiftelse: 'Under stiftelse',
  opløst: 'Opløst',
}

export function CompanyStamdata({ company }: CompanyStamdataProps) {
  const address = [company.address, company.postalCode, company.city]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-4 text-base font-semibold text-gray-900">Stamdata</h2>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          <Field label="Selskabsnavn" value={company.name} />
          <Field label="CVR-nummer" value={company.cvr} />
          <Field label="Selskabstype" value={company.companyType} />
          <Field label="Status" value={STATUS_LABELS[company.status] ?? company.status} />
          <Field label="Adresse" value={address || null} />
          <Field
            label="Stiftelsesdato"
            value={company.foundedDate ? formatDate(company.foundedDate) : null}
          />
        </dl>
      </div>

      {company.notes && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-gray-500">Noter</h3>
          <p className="whitespace-pre-wrap text-sm text-gray-900">{company.notes}</p>
        </div>
      )}

      <div className="border-t border-gray-100 pt-4">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-gray-400">Oprettet</dt>
            <dd className="text-xs text-gray-500">{formatDate(company.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400">Sidst opdateret</dt>
            <dd className="text-xs text-gray-500">{formatDate(company.updatedAt)}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}