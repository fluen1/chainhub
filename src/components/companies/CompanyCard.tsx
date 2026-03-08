'use client'

import Link from 'next/link'
import { Building2, FileText, Briefcase, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CompanyWithCounts } from '@/types/company'

interface CompanyCardProps {
  company: CompanyWithCounts
}

const STATUS_LABELS: Record<string, string> = {
  aktiv: 'Aktiv',
  inaktiv: 'Inaktiv',
  under_stiftelse: 'Under stiftelse',
  opløst: 'Opløst',
}

const STATUS_COLORS: Record<string, string> = {
  aktiv: 'bg-green-100 text-green-700',
  inaktiv: 'bg-gray-100 text-gray-600',
  under_stiftelse: 'bg-yellow-100 text-yellow-700',
  opløst: 'bg-red-100 text-red-700',
}

export function CompanyCard({ company }: CompanyCardProps) {
  const statusLabel = STATUS_LABELS[company.status] ?? company.status
  const statusColor = STATUS_COLORS[company.status] ?? 'bg-gray-100 text-gray-600'

  return (
    <Link
      href={`/companies/${company.id}`}
      className="block rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
            <Building2 className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 leading-tight">{company.name}</h3>
            {company.cvr && (
              <p className="text-xs text-gray-500">CVR {company.cvr}</p>
            )}
          </div>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
            statusColor
          )}
        >
          {statusLabel}
        </span>
      </div>

      {(company.city || company.companyType) && (
        <p className="mt-3 text-sm text-gray-500">
          {[company.companyType, company.city].filter(Boolean).join(' · ')}
        </p>
      )}

      <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <FileText className="h-3.5 w-3.5" />
          {company._count.contracts} kontrakter
        </span>
        <span className="flex items-center gap-1">
          <Briefcase className="h-3.5 w-3.5" />
          {company._count.caseCompanies} sager
        </span>
        <span className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          {company._count.companyPersons} personer
        </span>
      </div>
    </Link>
  )
}