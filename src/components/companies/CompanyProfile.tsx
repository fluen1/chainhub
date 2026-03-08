'use client'

import { useState } from 'react'
import { Building2, Edit2, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CompanyWithRelations } from '@/types/company'
import { CompanyStamdata } from './CompanyStamdata'
import { CompanyOwnership } from './CompanyOwnership'
import { CompanyGovernance } from './CompanyGovernance'
import { CompanyEmployees } from './CompanyEmployees'
import { CompanyActivityLog } from './CompanyActivityLog'
import { EditCompanyDialog } from './EditCompanyDialog'
import { DeleteCompanyDialog } from './DeleteCompanyDialog'

interface CompanyProfileProps {
  company: CompanyWithRelations
}

type Tab = 'stamdata' | 'ejerskab' | 'governance' | 'ansatte' | 'aktivitet'

const TABS: { id: Tab; label: string }[] = [
  { id: 'stamdata', label: 'Stamdata' },
  { id: 'ejerskab', label: 'Ejerskab' },
  { id: 'governance', label: 'Governance' },
  { id: 'ansatte', label: 'Ansatte' },
  { id: 'aktivitet', label: 'Aktivitetslog' },
]

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

export function CompanyProfile({ company }: CompanyProfileProps) {
  const [activeTab, setActiveTab] = useState<Tab>('stamdata')
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const statusLabel = STATUS_LABELS[company.status] ?? company.status
  const statusColor = STATUS_COLORS[company.status] ?? 'bg-gray-100 text-gray-600'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
            <Building2 className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold text-gray-900">{company.name}</h1>
              <span
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-xs font-medium',
                  statusColor
                )}
              >
                {statusLabel}
              </span>
            </div>
            {company.cvr && (
              <p className="mt-0.5 text-sm text-gray-500">CVR {company.cvr}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEditDialog(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Edit2 className="h-4 w-4" />
            Rediger
          </button>
          <button
            onClick={() => setShowDeleteDialog(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
            Slet
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'border-b-2 pb-3 text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'stamdata' && <CompanyStamdata company={company} />}
        {activeTab === 'ejerskab' && (
          <CompanyOwnership
            companyId={company.id}
            ownerships={company.ownerships}
          />
        )}
        {activeTab === 'governance' && (
          <CompanyGovernance
            companyId={company.id}
            companyPersons={company.companyPersons.filter((cp) =>
              ['direktør', 'bestyrelsesformand', 'bestyrelsesmedlem', 'suppleant'].includes(
                cp.role
              )
            )}
          />
        )}
        {activeTab === 'ansatte' && (
          <CompanyEmployees
            companyId={company.id}
            companyPersons={company.companyPersons.filter((cp) =>
              ['ansat', 'revisor', 'advokat'].includes(cp.role)
            )}
          />
        )}
        {activeTab === 'aktivitet' && (
          <CompanyActivityLog companyId={company.id} />
        )}
      </div>

      {/* Dialogs */}
      {showEditDialog && (
        <EditCompanyDialog
          company={company}
          onClose={() => setShowEditDialog(false)}
        />
      )}
      {showDeleteDialog && (
        <DeleteCompanyDialog
          company={company}
          onClose={() => setShowDeleteDialog(false)}
        />
      )}
    </div>
  )
}