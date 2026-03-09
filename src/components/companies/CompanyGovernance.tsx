'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, UserCircle } from 'lucide-react'
import { toast } from 'sonner'
import { deleteCompanyPerson } from '@/actions/companies'
import { formatDate } from '@/lib/utils'

interface Person {
  id: string
  firstName: string
  lastName: string
  email: string | null
}

interface CompanyPersonItem {
  id: string
  role: string
  employmentType: string | null
  startDate: string | Date | null
  endDate: string | Date | null
  anciennityStart: string | Date | null
  contractId: string | null
  person: Person
}

interface CompanyGovernanceProps {
  companyId: string
  companyPersons: CompanyPersonItem[]
}

const ROLE_LABELS: Record<string, string> = {
  direktør: 'Direktør',
  bestyrelsesformand: 'Bestyrelsesformand',
  bestyrelsesmedlem: 'Bestyrelsesmedlem',
  suppleant: 'Suppleant',
}

const GOVERNANCE_ROLES = ['direktør', 'bestyrelsesformand', 'bestyrelsesmedlem', 'suppleant']

interface PersonRoleCardProps {
  companyPerson: CompanyPersonItem
  roleLabel: string
  onEdit: () => void
  onDelete: () => void
  isDeleting: boolean
}

function PersonRoleCard({ companyPerson: cp, roleLabel, onEdit, onDelete, isDeleting }: PersonRoleCardProps) {
  const fullName = `${cp.person.firstName} ${cp.person.lastName}`
  const startDateStr = cp.startDate
    ? cp.startDate instanceof Date
      ? cp.startDate.toISOString().split('T')[0]
      : cp.startDate
    : null

  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100">
          <UserCircle className="h-5 w-5 text-gray-500" />
        </div>
        <div>
          <p className="font-medium text-gray-900">{fullName}</p>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>{roleLabel}</span>
            {startDateStr && (
              <>
                <span>·</span>
                <span>Fra {formatDate(startDateStr)}</span>
              </>
            )}
          </div>
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
          className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600 disabled:opacity-50"
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
      <UserCircle className="mb-3 h-10 w-10 text-gray-400" />
      <h3 className="mb-1 text-sm font-semibold text-gray-900">Ingen governance endnu</h3>
      <p className="mb-4 text-xs text-gray-500">Tilføj direktører og bestyrelsesmedlemmer</p>
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

export function CompanyGovernance({ companyId, companyPersons }: CompanyGovernanceProps) {
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingPerson, setEditingPerson] = useState<CompanyPersonItem | null>(null)
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

  const governancePersons = companyPersons.filter((cp) =>
    GOVERNANCE_ROLES.includes(cp.role.toLowerCase())
  )

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

      {governancePersons.length === 0 ? (
        <GovernanceEmpty onAdd={() => setShowAddDialog(true)} />
      ) : (
        <div className="space-y-2">
          {governancePersons.map((cp) => (
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
    </div>
  )
}