'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { addPersonToCompany } from '@/actions/persons'
import { getAccessibleCompanies } from '@/lib/permissions'
import { toast } from 'sonner'

interface Company {
  id: string
  name: string
}

interface AddPersonToCompanyFormProps {
  personId: string
}

const ROLE_SUGGESTIONS = [
  'direktør',
  'bestyrelsesmedlem',
  'bestyrelsesformand',
  'ansat',
  'revisor',
  'advokat',
  'ejer',
  'prokurist',
]

export default function AddPersonToCompanyForm({
  personId,
}: AddPersonToCompanyFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isOpen, setIsOpen] = useState(false)
  const [companies, setCompanies] = useState<Company[]>([])
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false)
  const [form, setForm] = useState({
    companyId: '',
    role: '',
    employmentType: '',
    startDate: '',
    endDate: '',
  })

  useEffect(() => {
    if (isOpen && companies.length === 0) {
      setIsLoadingCompanies(true)
      fetch('/api/companies/accessible')
        .then((r) => r.json())
        .then((data) => setCompanies(data.companies ?? []))
        .catch(() => toast.error('Selskaberne kunne ikke hentes'))
        .finally(() => setIsLoadingCompanies(false))
    }
  }, [isOpen, companies.length])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.companyId) {
      toast.error('Vælg et selskab')
      return
    }
    if (!form.role.trim()) {
      toast.error('Angiv en rolle')
      return
    }

    startTransition(async () => {
      const result = await addPersonToCompany({
        personId,
        companyId: form.companyId,
        role: form.role,
        employmentType:
          (form.employmentType as 'funktionær' | 'ikke-funktionær' | 'vikar' | 'elev') ||
          undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Personen er tilknyttet selskabet')
        setIsOpen(false)
        setForm({
          companyId: '',
          role: '',
          employmentType: '',
          startDate: '',
          endDate: '',
        })
        router.refresh()
      }
    })
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">
          Tilknyt til selskab
        </h2>
      </div>

      {!isOpen ? (
        <div className="p-4">
          <button
            onClick={() => setIsOpen(true)}
            className="w-full rounded-lg border-2 border-dashed border-gray-200 px-4 py-3 text-sm text-gray-500 transition-colors hover:border-blue-300 hover:text-blue-600"
          >
            + Tilknyt person til et selskab
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 p-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Selskab <span className="text-red-500">*</span>
            </label>
            {isLoadingCompanies ? (
              <div className="mt-1 h-9 w-full animate-pulse rounded-lg bg-gray-100" />
            ) : (
              <select
                value={form.companyId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, companyId: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Vælg selskab...</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Rolle <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.role}
              onChange={(e) =>
                setForm((f) => ({ ...f, role: e.target.value }))
              }
              list="role-suggestions"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="fx direktør, bestyrelsesmedlem..."
            />
            <datalist id="role-suggestions">
              {ROLE_SUGGESTIONS.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Ansættelsestype
            </label>
            <select
              value={form.employmentType}
              onChange={(e) =>
                setForm((f) => ({ ...f, employmentType: e.target.value }))
              }
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Ikke angivet</option>
              <option value="funktionær">Funktionær</option>
              <option value="ikke-funktionær">Ikke-funktionær</option>
              <option value="vikar">Vikar</option>
              <option value="elev">Elev</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Startdato
              </label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, startDate: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Slutdato
              </label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, endDate: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isPending ? 'Tilknytter...' : 'Tilknyt til selskab'}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false)
                setForm({
                  companyId: '',
                  role: '',
                  employmentType: '',
                  startDate: '',
                  endDate: '',
                })
              }}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Annuller
            </button>
          </div>
        </form>
      )}
    </div>
  )
}