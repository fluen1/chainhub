'use client'

import { useState } from 'react'
import { createUser } from '@/actions/users'
import { toast } from 'sonner'
import { USER_ROLE_LABELS } from '@/lib/labels'
import { cn } from '@/lib/utils'

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

interface CreateUserFormProps {
  companies: Company[]
}

export function CreateUserForm({ companies }: CreateUserFormProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [role, setRole] = useState<string>('GROUP_READONLY')
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([])

  const isCompanyRole = role.startsWith('COMPANY_')

  function toggleCompany(companyId: string) {
    setSelectedCompanyIds((prev) =>
      prev.includes(companyId)
        ? prev.filter((id) => id !== companyId)
        : [...prev, companyId]
    )
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.currentTarget)

    const result = await createUser({
      email: formData.get('email') as string,
      name: formData.get('name') as string,
      password: formData.get('password') as string,
      role: role as (typeof ROLES)[number],
      companyIds: isCompanyRole ? selectedCompanyIds : [],
    })

    setLoading(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success('Bruger oprettet')
    setOpen(false)
    setRole('GROUP_READONLY')
    setSelectedCompanyIds([])
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Opret bruger
      </button>
    )
  }

  return (
    <div className="rounded-lg border bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Opret ny bruger</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Navn *
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              minLength={2}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Fulde navn"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email *
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="bruger@virksomhed.dk"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Adgangskode *
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Mindst 8 tegn"
            />
          </div>

          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700">
              Rolle *
            </label>
            <select
              id="role"
              value={role}
              onChange={(e) => {
                setRole(e.target.value)
                if (!e.target.value.startsWith('COMPANY_')) {
                  setSelectedCompanyIds([])
                }
              }}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {USER_ROLE_LABELS[r] ?? r}
                </option>
              ))}
            </select>
          </div>
        </div>

        {isCompanyRole && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tildelte selskaber
            </label>
            {companies.length === 0 ? (
              <p className="text-sm text-gray-500">Ingen selskaber fundet</p>
            ) : (
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 max-h-48 overflow-y-auto rounded-md border border-gray-200 p-2">
                {companies.map((company) => (
                  <label
                    key={company.id}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-gray-50',
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
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              setRole('GROUP_READONLY')
              setSelectedCompanyIds([])
            }}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Annullér
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Opretter...' : 'Opret bruger'}
          </button>
        </div>
      </form>
    </div>
  )
}
