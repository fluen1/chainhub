'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createVisit } from '@/actions/visits'
import { VISIT_TYPE_LABELS } from '@/lib/labels'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

interface Company {
  id: string
  name: string
}

interface CreateVisitFormProps {
  companies: Company[]
}

export function CreateVisitForm({ companies }: CreateVisitFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedCompany = searchParams.get('company') ?? ''
  const preselectedDate = searchParams.get('visitDate') ?? ''
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const companyId = formData.get('companyId') as string
    const visitDate = formData.get('visitDate') as string
    const visitType = formData.get('visitType') as string
    const notes = formData.get('notes') as string

    if (!companyId) {
      toast.error('Vælg et selskab')
      setLoading(false)
      return
    }

    const result = await createVisit({
      companyId,
      visitDate,
      visitType: visitType as
        | 'KVARTALSBESOEG'
        | 'OPFOELGNING'
        | 'AD_HOC'
        | 'AUDIT'
        | 'ONBOARDING'
        | 'OVERDRAGELSE',
      notes: notes || undefined,
    })

    setLoading(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success('Besøg planlagt')
    router.push('/calendar')
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/calendar" className="rounded-md p-1 hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-500" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Planlæg besøg</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-lg border bg-white p-6 shadow-sm">
        <div className="space-y-4">
          <div>
            <label htmlFor="visit-companyId" className="block text-sm font-medium text-gray-700">
              Selskab *
            </label>
            <select
              id="visit-companyId"
              name="companyId"
              required
              defaultValue={preselectedCompany}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-3 md:py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">Vælg selskab...</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="visit-visitDate" className="block text-sm font-medium text-gray-700">
                Besøgsdato *
              </label>
              <input
                id="visit-visitDate"
                name="visitDate"
                type="date"
                required
                defaultValue={preselectedDate}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-3 md:py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="visit-visitType" className="block text-sm font-medium text-gray-700">
                Besøgstype *
              </label>
              <select
                id="visit-visitType"
                name="visitType"
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-3 md:py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="">Vælg type...</option>
                {Object.entries(VISIT_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="visit-notes" className="block text-sm font-medium text-gray-700">
              Noter
            </label>
            <textarea
              id="visit-notes"
              name="notes"
              rows={4}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-3 md:py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="Eventuelle noter til besøget..."
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Link
            href="/calendar"
            className="rounded-md border border-gray-300 bg-white px-4 py-3 md:py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Annullér
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-blue-600 px-4 py-3 md:py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Opretter...' : 'Planlæg besøg'}
          </button>
        </div>
      </form>
    </div>
  )
}
