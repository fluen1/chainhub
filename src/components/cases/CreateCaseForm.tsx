'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createCase } from '@/actions/cases'
import {
  CASE_TYPE_LABELS,
  CASE_SUBTYPE_BY_TYPE,
  type CreateCaseInput,
} from '@/lib/validations/case'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

type SensitivityValue = 'PUBLIC' | 'STANDARD' | 'INTERN' | 'FORTROLIG' | 'STRENGT_FORTROLIG'

const CASE_TYPES = Object.keys(CASE_TYPE_LABELS)

export function CreateCaseForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [selectedType, setSelectedType] = useState('')
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([])
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    fetch('/api/companies-list')
      .then((r) => r.json())
      .then((data) => setCompanies(data.companies ?? []))
      .catch(() => {})
  }, [])

  function toggleCompany(id: string) {
    setSelectedCompanyIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    )
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (selectedCompanyIds.length === 0) {
      toast.error('Vælg mindst ét selskab')
      return
    }
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const input: CreateCaseInput = {
      title: formData.get('title') as string,
      caseType: formData.get('caseType') as string,
      caseSubtype: (formData.get('caseSubtype') as string) || undefined,
      companyIds: selectedCompanyIds,
      sensitivity: formData.get('sensitivity') as SensitivityValue,
      description: formData.get('description') as string,
      notes: formData.get('notes') as string,
    }

    const result = await createCase(input)
    setLoading(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    if (result.data) {
      toast.success('Sag oprettet')
      router.push(`/cases/${result.data.id}`)
    }
  }

  const subtypes = selectedType ? (CASE_SUBTYPE_BY_TYPE[selectedType] ?? []) : []

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/cases" className="rounded-md p-1 hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-500" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Opret sag</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-lg border bg-white p-6 shadow-sm">
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-900">Grunddata</h2>

          <div>
            <label htmlFor="case-title" className="block text-sm font-medium text-gray-700">
              Titel *
            </label>
            <input
              id="case-title"
              name="title"
              type="text"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="fx Virksomhedskøb — Klinik Aarhus 2024"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="case-caseType" className="block text-sm font-medium text-gray-700">
                Sagstype *
              </label>
              <select
                id="case-caseType"
                name="caseType"
                required
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="">Vælg type...</option>
                {CASE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {CASE_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="case-caseSubtype" className="block text-sm font-medium text-gray-700">
                Undertype
                {selectedType && selectedType !== 'ANDET' && (
                  <span className="ml-1 text-red-500">*</span>
                )}
              </label>
              <select
                id="case-caseSubtype"
                name="caseSubtype"
                disabled={!selectedType || selectedType === 'ANDET'}
                required={selectedType !== '' && selectedType !== 'ANDET'}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-50"
              >
                <option value="">
                  {selectedType === 'ANDET' ? 'Ingen undertype' : 'Vælg undertype...'}
                </option>
                {subtypes.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="case-sensitivity" className="block text-sm font-medium text-gray-700">
              Sensitivitetsniveau
            </label>
            <select
              id="case-sensitivity"
              name="sensitivity"
              defaultValue="INTERN"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="STANDARD">Standard</option>
              <option value="INTERN">Intern</option>
              <option value="FORTROLIG">Fortrolig</option>
              <option value="STRENGT_FORTROLIG">Strengt fortrolig</option>
            </select>
          </div>

          <div>
            <span id="case-companies-label" className="block text-sm font-medium text-gray-700">
              Tilknyttede selskaber *
            </span>
            <div
              role="group"
              aria-labelledby="case-companies-label"
              className="mt-2 space-y-2 max-h-48 overflow-y-auto rounded-md border border-gray-200 p-3"
            >
              {companies.length === 0 ? (
                <p className="text-sm text-gray-400">Ingen selskaber tilgængelige</p>
              ) : (
                companies.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedCompanyIds.includes(c.id)}
                      onChange={() => toggleCompany(c.id)}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-700">{c.name}</span>
                  </label>
                ))
              )}
            </div>
            {selectedCompanyIds.length === 0 && (
              <p className="mt-1 text-xs text-red-500">Vælg mindst ét selskab</p>
            )}
          </div>
        </div>

        <div className="space-y-4 border-t pt-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-900">
            Beskrivelse
          </h2>
          <div>
            <label htmlFor="case-description" className="block text-sm font-medium text-gray-700">
              Beskrivelse
            </label>
            <textarea
              id="case-description"
              name="description"
              rows={4}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="Beskrivelse af sagen..."
            />
          </div>
          <div>
            <label htmlFor="case-notes" className="block text-sm font-medium text-gray-700">
              Interne noter
            </label>
            <textarea
              id="case-notes"
              name="notes"
              rows={2}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Link
            href="/cases"
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Annullér
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Opretter...' : 'Opret sag'}
          </button>
        </div>
      </form>
    </div>
  )
}
