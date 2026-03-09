'use client'

import { useState, useTransition } from 'react'
import type { DividendWithCompany } from '@/types/finance'
import { createDividend, updateDividend } from '@/actions/finance'
import { toast } from 'sonner'

interface DividendFormProps {
  companyId: string
  existing?: DividendWithCompany
  onSuccess?: () => void
  onCancel?: () => void
}

export function DividendForm({ companyId, existing, onSuccess, onCancel }: DividendFormProps) {
  const [isPending, startTransition] = useTransition()

  const today = new Date().toISOString().split('T')[0]

  const [amount, setAmount] = useState<string>(existing ? String(existing.amount) : '')
  const [currency, setCurrency] = useState<string>(existing?.currency ?? 'DKK')
  const [dividendDate, setDividendDate] = useState<string>(
    existing ? new Date(existing.dividendDate).toISOString().split('T')[0] : today
  )
  const [notes, setNotes] = useState<string>(existing?.notes ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const parsedAmount = parseFloat(amount.replace(',', '.'))
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      toast.error('Indtast et gyldigt positivt beløb')
      return
    }
    if (!dividendDate) {
      toast.error('Vælg en udlodningsdato')
      return
    }

    startTransition(async () => {
      if (existing) {
        const result = await updateDividend({
          dividendId: existing.id,
          companyId,
          amount: parsedAmount,
          dividendDate,
          notes: notes || undefined,
        })
        if (result.error) {
          toast.error(result.error)
          return
        }
        toast.success('Udbytteotering opdateret')
      } else {
        const result = await createDividend({
          companyId,
          amount: parsedAmount,
          currency,
          dividendDate,
          notes: notes || undefined,
        })
        if (result.error) {
          toast.error(result.error)
          return
        }
        toast.success('Udbytteotering gemt')
      }
      onSuccess?.()
    })
  }

  const isEditing = Boolean(existing)

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Beløb + valuta */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Udbyttebeløb <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
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
            disabled={isPending || isEditing}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
          >
            <option value="DKK">DKK</option>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
          </select>
        </div>
      </div>

      {/* Udlodningsdato */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Udlodningsdato <span className="text-red-500">*</span>
        </label>
        <input
          type="date"
          value={dividendDate}
          onChange={(e) => setDividendDate(e.target.value)}
          disabled={isPending}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-400 mt-1">
          Selskab og dato gemmes automatisk ved oprettelse
        </p>
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
          placeholder="Evt. bestyrelsesmøde-reference, generalforsamling o.l."
        />
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
          {isPending ? 'Gemmer...' : isEditing ? 'Gem ændringer' : 'Gem udbytteotering'}
        </button>
      </div>
    </form>
  )
}