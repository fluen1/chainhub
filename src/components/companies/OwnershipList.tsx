'use client'

import { useState } from 'react'
import { endOwnership } from '@/actions/ownership'
import { toast } from 'sonner'
import { formatDate } from '@/lib/labels'
import type { Decimal } from '@prisma/client/runtime/library'

interface OwnershipItem {
  id: string
  ownership_pct: Decimal | number | string
  effective_date: Date | null
  end_date?: Date | null
  owner_person: {
    id: string
    first_name: string
    last_name: string
    email: string | null
  } | null
}

interface OwnershipListProps {
  ownerships: OwnershipItem[]
  title: string
  showActions: boolean
}

export function OwnershipList({ ownerships, title, showActions }: OwnershipListProps) {
  const [endingId, setEndingId] = useState<string | null>(null)
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleEndOwnership(ownershipId: string) {
    if (!endDate) {
      toast.error('Angiv en slutdato')
      return
    }
    setLoading(true)

    const result = await endOwnership({ ownershipId, endDate })
    setLoading(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success('Ejerskab afregistreret')
    setEndingId(null)
    setEndDate('')
  }

  if (ownerships.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">{title}</h3>
        <p className="text-sm text-gray-500">Ingen ejere registreret endnu.</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      </div>
      <table className="min-w-full divide-y divide-gray-200">
        <thead>
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
              Ejer
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
              Ejerandel
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
              Dato
            </th>
            {!showActions && (
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Ophørte
              </th>
            )}
            {showActions && (
              <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">
                Handlinger
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {ownerships.map((o) => (
            <tr key={o.id} className="hover:bg-gray-50">
              <td className="px-6 py-4">
                <div className="text-sm font-medium text-gray-900">
                  {o.owner_person
                    ? `${o.owner_person.first_name} ${o.owner_person.last_name}`
                    : 'Selskab'}
                </div>
                {o.owner_person?.email && (
                  <div className="text-xs text-gray-500">{o.owner_person.email}</div>
                )}
              </td>
              <td className="px-6 py-4 text-sm text-gray-900 font-semibold">
                {Number(o.ownership_pct).toFixed(2)}%
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                {o.effective_date ? formatDate(o.effective_date) : '—'}
              </td>
              {!showActions && o.end_date && (
                <td className="px-6 py-4 text-sm text-gray-500">{formatDate(o.end_date)}</td>
              )}
              {showActions && (
                <td className="px-6 py-4 text-right">
                  {endingId === o.id ? (
                    <div className="flex items-center justify-end gap-2">
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="rounded border border-gray-300 px-2 py-1 text-xs"
                      />
                      <button
                        onClick={() => handleEndOwnership(o.id)}
                        disabled={loading}
                        className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        Bekræft
                      </button>
                      <button
                        onClick={() => setEndingId(null)}
                        className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                      >
                        Annullér
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setEndingId(o.id)}
                      className="text-xs text-red-600 hover:text-red-800"
                    >
                      Afregistrér
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
