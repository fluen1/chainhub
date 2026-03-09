'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, UserCircle } from 'lucide-react'
import { toast } from 'sonner'
import { deleteOwnership } from '@/actions/companies'

interface OwnerPerson {
  id: string
  firstName: string
  lastName: string
}

interface OwnershipItem {
  id: string
  ownershipPct: number | string
  shareClass: string | null
  effectiveDate: string | null
  ownerPersonId: string | null
  ownerCompanyId: string | null
  ownerPerson: OwnerPerson | null
}

interface CompanyOwnershipProps {
  companyId: string
  ownerships: OwnershipItem[]
}

function OwnershipEmpty({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 py-10 text-center">
      <UserCircle className="mb-3 h-10 w-10 text-gray-400" />
      <h3 className="mb-1 text-sm font-semibold text-gray-900">Ingen ejere endnu</h3>
      <p className="mb-4 text-xs text-gray-500">Tilføj ejere til selskabet</p>
      <button
        onClick={onAdd}
        className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        <Plus className="h-4 w-4" />
        Tilføj ejer
      </button>
    </div>
  )
}

export function CompanyOwnership({ companyId, ownerships }: CompanyOwnershipProps) {
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingOwnership, setEditingOwnership] = useState<OwnershipItem | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const totalPct = ownerships.reduce((sum, o) => sum + Number(o.ownershipPct), 0)

  const handleDelete = async (id: string) => {
    if (!confirm('Er du sikker på, at du vil slette dette ejerskab?')) return

    setDeletingId(id)
    const result = await deleteOwnership({ id })
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
                      <span>{Number(ownership.ownershipPct).toFixed(2)}%</span>
                      {ownership.shareClass && (
                        <>
                          <span>·</span>
                          <span>{ownership.shareClass}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditingOwnership(ownership)}
                    className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(ownership.id)}
                    disabled={deletingId === ownership.id}
                    className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}