'use client'

import { useState } from 'react'
import { endCompanyPerson } from '@/actions/governance'
import { toast } from 'sonner'

interface PersonItem {
  id: string
  role: string
  employment_type: string | null
  start_date: Date | null
  end_date?: Date | null
  person: {
    id: string
    first_name: string
    last_name: string
    email: string | null
  }
}

interface CompanyPersonListProps {
  persons: PersonItem[]
  title: string
  showActions: boolean
  roleLabels: Record<string, string>
}

export function CompanyPersonList({ persons, title, showActions, roleLabels }: CompanyPersonListProps) {
  const [endingId, setEndingId] = useState<string | null>(null)
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleEndRole(companyPersonId: string) {
    if (!endDate) {
      toast.error('Angiv en slutdato')
      return
    }
    setLoading(true)

    const result = await endCompanyPerson({ companyPersonId, endDate })
    setLoading(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success('Rolle afregistreret')
    setEndingId(null)
    setEndDate('')
  }

  if (persons.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">{title}</h3>
        <p className="text-sm text-gray-500">Ingen registreret endnu.</p>
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
            <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Navn</th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Rolle</th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Startdato</th>
            {!showActions && (
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Slutdato</th>
            )}
            {showActions && (
              <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">Handlinger</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {persons.map((cp) => (
            <tr key={cp.id} className="hover:bg-gray-50">
              <td className="px-6 py-4">
                <div className="text-sm font-medium text-gray-900">
                  {cp.person.first_name} {cp.person.last_name}
                </div>
                {cp.person.email && (
                  <div className="text-xs text-gray-500">{cp.person.email}</div>
                )}
              </td>
              <td className="px-6 py-4 text-sm text-gray-700">
                {roleLabels[cp.role] ?? cp.role}
                {cp.employment_type && (
                  <span className="ml-1 text-xs text-gray-500">({cp.employment_type})</span>
                )}
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                {cp.start_date
                  ? new Date(cp.start_date).toLocaleDateString('da-DK')
                  : '—'}
              </td>
              {!showActions && cp.end_date && (
                <td className="px-6 py-4 text-sm text-gray-500">
                  {new Date(cp.end_date).toLocaleDateString('da-DK')}
                </td>
              )}
              {showActions && (
                <td className="px-6 py-4 text-right">
                  {endingId === cp.id ? (
                    <div className="flex items-center justify-end gap-2">
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="rounded border border-gray-300 px-2 py-1 text-xs"
                      />
                      <button
                        onClick={() => handleEndRole(cp.id)}
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
                      onClick={() => setEndingId(cp.id)}
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
