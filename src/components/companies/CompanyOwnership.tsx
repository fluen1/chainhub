'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, UserCircle } from 'lucide-react'
import { toast } from 'sonner'
import { deleteOwnership } from '@/actions/companies'
import type { OwnershipWithPerson } from '@/types/company'
import { AddOwnershipDialog } from './AddOwnershipDialog'
import { EditOwnershipDialog } from './EditOwnershipDialog'
import { OwnershipEmpty } from './OwnershipEmpty'

interface CompanyOwnershipProps {
  companyId: string
  ownerships: OwnershipWithPerson[]
}

export function CompanyOwnership({ companyId, ownerships }: CompanyOwnershipProps) {
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingOwnership, setEditingOwnership] = useState<OwnershipWithPerson | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const totalPct = ownerships.reduce((sum, o) => sum + Number(o.ownershipPct), 0)

  const handleDelete = async (ownershipId: string) => {
    if (!confirm('Er du sikker på, at du vil slette dette ejerskab?')) return

    setDeletingId(ownershipId)
    const result = await deleteOwnership({ ownershipId, companyId })
    setDeletingId(null)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Ejerskab slettet')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Ejerskab</h2>
          {ownerships.length > 0 && (
            <p className="text-sm text-gray-500">
              Samlet ejerandel: {totalPct.toFixed(2)}%
            </p>
          )}
        </div>
        <button
          onClick={() => setShowAddDialog(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Tilføj ejer
        </button>
      </div>

      {ownerships.length === 0 ? (
        <OwnershipEmpty onAdd={() => setShowAddDialog(true)} />
      ) : (
        <div className="space-y-2">
          {ownerships.map((ownership) => {
            const ownerName = ownership.ownerPerson
              ? `${ownership.ownerPerson.firstName} ${ownership.ownerPerson.lastName}`
              : 'Ukendt ejer'

            return (
              <div
                key={ownership.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100">
                    <UserCircle className="h-5 w-5 text-gray-500" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{ownerName}</p>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span className="font-semibold text-blue-600">
                        {Number(ownership.ownershipPct).toFixed(2)}%
                      </span>
                      {ownership.shareClass && (
                        <span>· {ownership.shareClass}</span>
                      )}
                      {ownership.effectiveDate && (
                        <span>
                          · Fra{' '}
                          {new Date(ownership.effectiveDate).toLocaleDateString('da-DK')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditingOwnership(ownership)}
                    className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    title="Rediger ejerskab"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(ownership.id)}
                    disabled={deletingId === ownership.id}
                    className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    title="Slet ejerskab"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Ownership bar */}
      {ownerships.length > 0 && (
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
          <div className="mb-2 flex justify-between text-xs text-gray-500">
            <span>Ejerandelsoversigt</span>
            <span>{totalPct.toFixed(2)}% / 100%</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-blue-500 transition-all"
              style={{ width: `${Math.min(totalPct, 100)}%` }}
            />
          </div>
          {totalPct < 100 && (
            <p className="mt-1.5 text-xs text-amber-600">
              {(100 - totalPct).toFixed(2)}% af selskabet er ikke registreret
            </p>
          )}
        </div>
      )}

      {showAddDialog && (
        <AddOwnershipDialog
          companyId={companyId}
          onClose={() => setShowAddDialog(false)}
        />
      )}
      {editingOwnership && (
        <EditOwnershipDialog
          ownership={editingOwnership}
          companyId={companyId}
          onClose={() => setEditingOwnership(null)}
        />
      )}
    </div>
  )
}