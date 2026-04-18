'use client'

import { useState } from 'react'
import { upsertFinancialMetric } from '@/actions/finance'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'

interface AddMetricFormProps {
  companyId: string
}

const METRIC_TYPES = [
  { value: 'OMSAETNING', label: 'Omsætning' },
  { value: 'EBITDA', label: 'EBITDA' },
  { value: 'RESULTAT', label: 'Resultat' },
  { value: 'LIKVIDITET', label: 'Likviditet' },
  { value: 'EGENKAPITAL', label: 'Egenkapital' },
  { value: 'ANDET', label: 'Andet' },
]

type MetricTypeValue = 'OMSAETNING' | 'EBITDA' | 'RESULTAT' | 'LIKVIDITET' | 'EGENKAPITAL' | 'ANDET'
type SourceValue = 'REVIDERET' | 'UREVIDERET' | 'ESTIMAT'

export function AddMetricForm({ companyId }: AddMetricFormProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const result = await upsertFinancialMetric({
      companyId,
      metricType: formData.get('metricType') as MetricTypeValue,
      periodType: 'HELAAR',
      periodYear: Number(formData.get('periodYear')),
      value: Number(formData.get('value')),
      currency: 'DKK',
      source: (formData.get('source') as SourceValue) ?? 'UREVIDERET',
      notes: (formData.get('notes') as string) || undefined,
    })

    setLoading(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success('Nøgletal gemt')
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
      >
        <Plus className="h-4 w-4" />
        Tilføj nøgletal
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Tilføj nøgletal</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="metric-metricType"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Type
                  </label>
                  <select
                    id="metric-metricType"
                    name="metricType"
                    required
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  >
                    {METRIC_TYPES.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="metric-periodYear"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Regnskabsår
                  </label>
                  <input
                    id="metric-periodYear"
                    name="periodYear"
                    type="number"
                    required
                    min="1990"
                    max="2099"
                    defaultValue={new Date().getFullYear()}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="metric-value" className="block text-sm font-medium text-gray-700">
                  Beløb (DKK)
                </label>
                <input
                  id="metric-value"
                  name="value"
                  type="number"
                  required
                  step="1"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  placeholder="fx 5000000"
                />
              </div>

              <div>
                <label htmlFor="metric-source" className="block text-sm font-medium text-gray-700">
                  Kilde
                </label>
                <select
                  id="metric-source"
                  name="source"
                  defaultValue="UREVIDERET"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="REVIDERET">Revideret</option>
                  <option value="UREVIDERET">Urevideret</option>
                  <option value="ESTIMAT">Estimat</option>
                </select>
              </div>

              <div>
                <label htmlFor="metric-notes" className="block text-sm font-medium text-gray-700">
                  Note
                </label>
                <input
                  id="metric-notes"
                  name="notes"
                  type="text"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Annullér
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  {loading ? 'Gemmer...' : 'Gem'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
