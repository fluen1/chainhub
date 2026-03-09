'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, UserCircle } from 'lucide-react'
import { toast } from 'sonner'
import { deleteCompanyPerson } from '@/actions/companies'
import type { CompanyPersonWithPerson } from '@/types/company'
import { AddPersonRoleDialog } from './AddPersonRoleDialog'
import { EditPersonRoleDialog } from './EditPersonRoleDialog'
import { formatDate } from '@/lib/utils'

interface CompanyGovernanceProps {
  companyId: string
  companyPersons: CompanyPersonWithPerson[]
}

const ROLE_LABELS: Record<string, string> = {
  direktør: 'Direktør',
  bestyrelsesformand: 'Bestyrelsesformand',
  bestyrelsesmedlem: 'Bestyrelsesmedlem',
  suppleant: 'Suppleant',
}

const GOVERNANCE_ROLES = ['direktør', 'bestyrelsesformand', 'bestyrelsesmedlem', 'suppleant']

export function CompanyGovernance({ companyId, companyPersons }: CompanyGovernanceProps) {
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingPerson, setEditingPerson] = useState<CompanyPersonWithPerson | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    if (!confirm('Er du sikker på, at du vil fjerne denne person fra governance?')) return

    setDeletingId(id)
    const result = await deleteCompanyPerson({ id })
    setDeletingId(null)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Person fjernet fra governance')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">Governance</h2>
        <button
          onClick={() => setShowAddDialog(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Tilføj person
        </button>
      </div>

      {companyPersons.length === 0 ? (
        <GovernanceEmpty onAdd={() => setShowAddDialog(true)} />
      ) : (
        <div className="space-y-2">
          {companyPersons.map((cp) => (
            <PersonRoleCard
              key={cp.id}
              companyPerson={cp}
              roleLabel={ROLE_LABELS[cp.role] ?? cp.role}
              onEdit={() => setEditingPerson(cp)}
              onDelete={() => handleDelete(cp.id)}
              isDeleting={deletingId === cp.id}
            />
          ))}
        </div>
      )}

      {showAddDialog && (
        <AddPersonRoleDialog
          companyId={companyId}
          allowedRoles={GOVERNANCE_ROLES}
          title="Tilføj til governance"
          onClose={() => setShowAddDialog(false)}
        />
      )}
      {editingPerson && (
        <EditPersonRoleDialog
          companyPerson={editingPerson}
          companyId={companyId}
          allowedRoles={GOVERNANCE_ROLES}
          onClose={() => setEditingPerson(null)}
        />
      )}
    </div>
  )
}

interface PersonRoleCardProps {
  companyPerson: CompanyPersonWithPerson
  roleLabel: string
  onEdit: () => void
  onDelete: () => void
  isDeleting: boolean
}

function PersonRoleCard({
  companyPerson: cp,
  roleLabel,
  onEdit,
  onDelete,
  isDeleting,
}: PersonRoleCardProps) {
  const fullName = `${cp.person.firstName} ${cp.person.lastName}`
  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100">
          <UserCircle className="h-5 w-5 text-gray-500" />
        </div>
        <div>
          <p className="font-medium text-gray-900">{fullName}</p>
          <p className="text-sm text-gray-500">{roleLabel}</p>
          {(cp as any).startDate && (
            <p className="text-xs text-gray-400">
              Fra {formatDate((cp as any).startDate)}
              {(cp as any).endDate && ` til ${formatDate((cp as any).endDate)}`}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onEdit}
          className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          onClick={onDelete}
          disabled={isDeleting}
          className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function GovernanceEmpty({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 py-10 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
        <UserCircle className="h-6 w-6 text-gray-400" />
      </div>
      <h3 className="mb-1 text-sm font-semibold text-gray-900">Ingen governance</h3>
      <p className="mb-4 text-sm text-gray-500">Tilføj direktører og bestyrelsesmedlemmer.</p>
      <button
        onClick={onAdd}
        className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        <Plus className="h-4 w-4" />
        Tilføj person
      </button>
    </div>
  )
}