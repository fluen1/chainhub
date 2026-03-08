'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { removePersonFromCompany, updatePersonCompanyRole } from '@/actions/persons'
import { toast } from 'sonner'
import type { CompanyPerson, Company, Contract } from '@prisma/client'

type CompanyPersonEntry = CompanyPerson & {
  company: Company
  contract: Contract | null
}

interface PersonCompanyListProps {
  companyPersons: CompanyPersonEntry[]
  personId: string
}

const formatDate = (date: Date | null | undefined) => {
  if (!date) return null
  return new Date(date).toLocaleDateString('da-DK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function PersonCompanyList({
  companyPersons,
  personId,
}: PersonCompanyListProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{
    role: string
    employmentType: string
    startDate: string
    endDate: string
  }>({ role: '', employmentType: '', startDate: '', endDate: '' })

  const handleRemove = (companyPersonId: string, companyId: string, companyName: string) => {
    if (!confirm(`Er du sikker på, at du vil fjerne tilknytningen til ${companyName}?`)) {
      return
    }

    startTransition(async () => {
      const result = await removePersonFromCompany({ companyPersonId, companyId })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`Tilknytning til ${companyName} er fjernet`)
        router.refresh()
      }
    })
  }

  const handleEditStart = (cp: CompanyPersonEntry) => {
    setEditingId(cp.id)
    setEditForm({
      role: cp.role,
      employmentType: cp.employmentType ?? '',
      startDate: cp.startDate
        ? new Date(cp.startDate).toISOString().split('T')[0]
        : '',
      endDate: cp.endDate
        ? new Date(cp.endDate).toISOString().split('T')[0]
        : '',
    })
  }

  const handleEditSave = (cp: CompanyPersonEntry) => {
    startTransition(async () => {
      const result = await updatePersonCompanyRole({
        companyPersonId: cp.id,
        companyId: cp.companyId,
        role: editForm.role,
        employmentType: editForm.employmentType as 'funktionær' | 'ikke-funktionær' | 'vikar' | 'elev' | null || null,
        startDate: editForm.startDate || null,
        endDate: editForm.endDate || null,
      })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Rollen er opdateret')
        setEditingId(null)
        router.refresh()
      }
    })
  }

  if (companyPersons.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 p-8 text-center">
        <p className="text-sm text-gray-500">
          Personen er endnu ikke tilknyttet nogen selskaber
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">
          Roller i selskaber ({companyPersons.length})
        </h2>
        <p className="mt-0.5 text-xs text-gray-500">
          Samme person kan have forskellige roller på tværs af selskaber
        </p>
      </div>

      <div className="divide-y divide-gray-100">
        {companyPersons.map((cp) => (
          <div key={cp.id} className="p-4">
            {editingId === cp.id ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Link
                    href={`/companies/${cp.companyId}`}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    {cp.company.name}
                  </Link>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500">
                      Rolle
                    </label>
                    <input
                      type="text"
                      value={editForm.role}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, role: e.target.value }))
                      }
                      className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500">
                      Ansættelsestype
                    </label>
                    <select
                      value={editForm.employmentType}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          employmentType: e.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">Ikke angivet</option>
                      <option value="funktionær">Funktionær</option>
                      <option value="ikke-funktionær">Ikke-funktionær</option>
                      <option value="vikar">Vikar</option>
                      <option value="elev">Elev</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500">
                      Startdato
                    </label>
                    <input
                      type="date"
                      value={editForm.startDate}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, startDate: e.target.value }))
                      }
                      className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500">
                      Slutdato
                    </label>
                    <input
                      type="date"
                      value={editForm.endDate}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, endDate: e.target.value }))
                      }
                      className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditSave(cp)}
                    disabled={isPending}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isPending ? 'Gemmer...' : 'Gem'}
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Annuller
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/companies/${cp.companyId}`}
                      className="font-medium text-gray-900 hover:text-blue-600"
                    >
                      {cp.company.name}
                    </Link>
                    {cp.company.cvr && (
                      <span className="text-xs text-gray-400">
                        CVR: {cp.company.cvr}
                      </span>
                    )}
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                      {cp.role}
                    </span>
                    {cp.employmentType && (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                        {cp.employmentType}
                      </span>
                    )}
                    {cp.endDate && new Date(cp.endDate) < new Date() && (
                      <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-600">
                        Tidligere
                      </span>
                    )}
                  </div>

                  <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-gray-500">
                    {cp.startDate && (
                      <span>Startdato: {formatDate(cp.startDate)}</span>
                    )}
                    {cp.endDate && (
                      <span>Slutdato: {formatDate(cp.endDate)}</span>
                    )}
                    {cp.contract && (
                      <Link
                        href={`/contracts/${cp.contract.id}`}
                        className="text-blue-500 hover:underline"
                      >
                        📄 {cp.contract.displayName}
                      </Link>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => handleEditStart(cp)}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Rediger
                  </button>
                  <button
                    onClick={() =>
                      handleRemove(cp.id, cp.companyId, cp.company.name)
                    }
                    disabled={isPending}
                    className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                  >
                    Fjern
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}