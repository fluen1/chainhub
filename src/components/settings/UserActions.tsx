'use client'

import { useState } from 'react'
import { updateUserRole, toggleUserActive } from '@/actions/users'
import { toast } from 'sonner'
import { USER_ROLE_LABELS } from '@/lib/labels'
import { cn } from '@/lib/utils'
import type { UserRole } from '@prisma/client'

const ROLES = [
  'GROUP_OWNER',
  'GROUP_ADMIN',
  'GROUP_LEGAL',
  'GROUP_FINANCE',
  'GROUP_READONLY',
  'COMPANY_MANAGER',
  'COMPANY_LEGAL',
  'COMPANY_READONLY',
] as const

interface Company {
  id: string
  name: string
}

interface UserActionsProps {
  userId: string
  currentRole: UserRole
  currentCompanyIds: string[]
  active: boolean
  isSelf: boolean
  companies: Company[]
}

export function UserActions({
  userId,
  currentRole,
  currentCompanyIds,
  active,
  isSelf,
  companies,
}: UserActionsProps) {
  const [editingRole, setEditingRole] = useState(false)
  const [role, setRole] = useState<string>(currentRole)
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>(currentCompanyIds)
  const [loading, setLoading] = useState(false)
  const [toggling, setToggling] = useState(false)

  const isCompanyRole = role.startsWith('COMPANY_')

  function toggleCompany(companyId: string) {
    setSelectedCompanyIds((prev) =>
      prev.includes(companyId)
        ? prev.filter((id) => id !== companyId)
        : [...prev, companyId]
    )
  }

  async function handleSaveRole() {
    setLoading(true)
    const result = await updateUserRole({
      userId,
      role: role as (typeof ROLES)[number],
      companyIds: isCompanyRole ? selectedCompanyIds : [],
    })
    setLoading(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success('Rolle opdateret')
    setEditingRole(false)
  }

  async function handleToggleActive() {
    setToggling(true)
    const result = await toggleUserActive(userId)
    setToggling(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success(active ? 'Bruger deaktiveret' : 'Bruger aktiveret')
  }

  if (editingRole) {
    return (
      <div className="space-y-3">
        <div>
          <select
            value={role}
            onChange={(e) => {
              setRole(e.target.value)
              if (!e.target.value.startsWith('COMPANY_')) {
                setSelectedCompanyIds([])
              }
            }}
            className="block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {USER_ROLE_LABELS[r] ?? r}
              </option>
            ))}
          </select>
        </div>

        {isCompanyRole && companies.length > 0 && (
          <div className="max-h-32 overflow-y-auto rounded-md border border-gray-200 p-1.5">
            {companies.map((company) => (
              <label
                key={company.id}
                className={cn(
                  'flex items-center gap-2 rounded px-2 py-1 text-xs cursor-pointer hover:bg-gray-50',
                  selectedCompanyIds.includes(company.id) && 'bg-blue-50'
                )}
              >
                <input
                  type="checkbox"
                  checked={selectedCompanyIds.includes(company.id)}
                  onChange={() => toggleCompany(company.id)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                {company.name}
              </label>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleSaveRole}
            disabled={loading}
            className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Gemmer...' : 'Gem'}
          </button>
          <button
            onClick={() => {
              setEditingRole(false)
              setRole(currentRole)
              setSelectedCompanyIds(currentCompanyIds)
            }}
            className="rounded-md border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Annullér
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setEditingRole(true)}
        className="rounded-md border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
      >
        Redigér rolle
      </button>
      {!isSelf && (
        <button
          onClick={handleToggleActive}
          disabled={toggling}
          className={cn(
            'rounded-md px-3 py-1 text-xs font-medium disabled:opacity-50',
            active
              ? 'border border-red-300 text-red-700 hover:bg-red-50'
              : 'border border-green-300 text-green-700 hover:bg-green-50'
          )}
        >
          {toggling
            ? 'Ændrer...'
            : active
              ? 'Deaktivér'
              : 'Aktivér'}
        </button>
      )}
    </div>
  )
}
