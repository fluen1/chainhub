'use client'

import { useState, useTransition } from 'react'
import { MetricType, PeriodType, MetricSource } from '@prisma/client'
import { METRIC_TYPE_LABELS, PERIOD_TYPE_LABELS, METRIC_SOURCE_LABELS } from '@/types/finance'
import { createFinancialMetric, updateFinancialMetric } from '@/actions/finance'
import { toast } from 'sonner'

interface FinancialMetricFormProps {
  companyId: string
  /** Sættes ved redigering */
  metricId?: string
  defaultValues?: {
    metricType?: MetricType
    periodType?: PeriodType
    periodYear?: number
    value?: number
    currency?: string
    source?: MetricSource
    notes?: string
  }
  onSuccess?: () => void
  onCancel?: () => void
}

export function FinancialMetricForm({
  companyId,
  metricId,
  defaultValues,
  onSuccess,
  onCancel,
}: FinancialMetricFormProps) {
  const [isPending, startTransition] = useTransition()

  const [metricType, setMetricType] = useState<MetricType>(
    defaultValues?.metricType ?? MetricType.OMSAETNING
  )
  const [periodType, setPeriodType] = useState<PeriodType>(
    defaultValues?.periodType ?? PeriodType.HELAAR
  )
  const [periodYear, setPeriodYear] = useState<string>(
    String(defaultValues?.periodYear ?? new Date().getFullYear())
  )
  const [value, setValue] = useState<string>(String(defaultValues?.value ?? ''))
  const [currency, setCurrency] = useState<string>(defaultValues?.currency ?? 'DKK')
  const [source, setSource] = useState<MetricSource>(
    defaultValues?.source ?? MetricSource.UREVIDERET
  )
  const [notes, setNotes] = useState<string>(defaultValues?.notes ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const parsedValue = parseFloat(value.replace(',', '.'))
    const parsedYear = parseInt(periodYear, 10)

    if (isNaN(parsedValue)) {
      toast.error('Indtast en gyldig talværdi')
      return
    }
    if (isNaN(parsedYear) || parsedYear < 2000 || parsedYear > 2100) {
      toast.error('Indtast et gyldigt årstal (2000–2100)')
      return
    }

    startTransition(async () => {
      if (metricId) {
        // Opdatér
        const result = await updateFinancialMetric({
          metricId,
          companyId,
          value: parsedValue,
          source,
          notes: notes || undefined,
        })
        if (result.error) {
          toast.error(result.error)
          return
        }
        toast.success('Nøgletallet blev opdateret')
      } else {
        // Opret
        const result = await createFinancialMetric({
          companyId,
          metricType,
          periodType,
          periodYear: parsedYear,
          value: parsedValue,
          currency,
          source,
          notes: notes || undefined,
        })
        if (result.error) {
          toast.error(result.error)
          return
        }
        toast.success('Nøgletallet blev gemt')
      }
      onSuccess?.()
    })
  }

  const isEditing = Boolean(metricId)

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Nøgletalstype */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Type <span className="text-red-500">*</span>
        </label>
        <select
          value={metricType}
          onChange={(e) => setMetricType(e.target.value as MetricType)}
          disabled={isEditing || isPending}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
        >
          {Object.values(MetricType).map((type) => (
            <option key={type} value={type}>
              {METRIC_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </div>

      {/* Periodevalg */}
      {!isEditing && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Periodetyoe <span className="text-red-500">*</span>
            </label>
            <select
              value={periodType}
              onChange={(e) => setPeriodType(e.target.value as PeriodType)}
              disabled={isPending}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Object.values(PeriodType).map((type) => (
                <option key={type} value={type}>
                  {PERIOD_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              År <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={periodYear}
              onChange={(e) => setPeriodYear(e.target.value)}
              min={2000}
              max={2100}
              disabled={isPending}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="2024"
            />
          </div>
        </div>
      )}

      {/* Beløb + valuta */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Beløb <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={isPending}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="0"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Valuta</label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            disabled={isPending}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="DKK">DKK</option>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
            <option value="GBP">GBP</option>
            <option value="SEK">SEK</option>
            <option value="NOK">NOK</option>
          </select>
        </div>
      </div>

      {/* Kilde */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Kilde <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-3">
          {Object.values(MetricSource).map((s) => (
            <label key={s} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="source"
                value={s}
                checked={source === s}
                onChange={() => setSource(s)}
                disabled={isPending}
                className="text-blue-600"
              />
              <span className="text-sm">{METRIC_SOURCE_LABELS[s]}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Noter */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Noter <span className="text-gray-400 font-normal">(valgfri)</span>
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={isPending}
          rows={3}
          maxLength={2000}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          placeholder="Evt. kommentarer til dette nøgletal..."
        />
        <p className="text-xs text-gray-400 mt-1">{notes.length}/2000 tegn</p>
      </div>

      {/* Handlinger */}
      <div className="flex justify-end gap-3 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Annuller
          </button>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? 'Gemmer...' : isEditing ? 'Gem ændringer' : 'Tilføj nøgletal'}
        </button>
      </div>
    </form>
  )
}