'use client'

import { useState, useTransition } from 'react'
import type { TimeEntryWithUser } from '@/types/finance'
import { createTimeEntry, updateTimeEntry } from '@/actions/finance'
import { toast } from 'sonner'

interface TimeEntryFormProps {
  caseId: string
  existing?: TimeEntryWithUser
  onSuccess?: () => void
  onCancel?: () => void
}

export function TimeEntryForm({ caseId, existing, onSuccess, onCancel }: TimeEntryFormProps) {
  const [isPending, startTransition] = useTransition()

  const today = new Date().toISOString().split('T')[0]

  const [hours, setHours] = useState<string>(
    existing ? String(Math.floor(existing.minutes / 60)) : '0'
  )
  const [minutes, setMinutes] = useState<string>(
    existing ? String(existing.minutes % 60) : '30'
  )
  const [date, setDate] = useState<string>(
    existing ? new Date(existing.date).toISOString().split('T')[0] : today
  )
  const [description, setDescription] = useState<string>(existing?.description ?? '')
  const [billable, setBillable] = useState<boolean>(existing?.billable ?? true)
  const [hourlyRate, setHourlyRate] = useState<string>(
    existing?.hourlyRate ? String(existing.hourlyRate) : ''
  )

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const h = parseInt(hours, 10) || 0
    const m = parseInt(minutes, 10) || 0
    const totalMinutes = h * 60 + m

    if (totalMinutes < 1) {
      toast.error('Angiv mindst 1 minut')
      return
    }
    if (totalMinutes > 1440) {
      toast.error('Maks. 24 timer (1440 minutter) per registrering')
      return
    }
    if (!date) {
      toast.error('Vælg en dato')
      return
    }

    const parsedRate = hourlyRate ? parseInt(hourlyRate, 10) : undefined

    startTransition(async () => {
      if (existing) {
        const result = await updateTimeEntry({
          timeEntryId: existing.id,
          caseId,
          minutes: totalMinutes,
          date,
          description: description || undefined,
          billable,
          hourlyRate: parsedRate ?? null,
        })
        if (result.error) {
          toast.error(result.error)
          return
        }
        toast.success('Tidsregistrering opdateret')
      } else {
        const result = await createTimeEntry({
          caseId,
          minutes: totalMinutes,
          date,
          description: description || undefined,
          billable,
          hourlyRate: parsedRate,
        })
        if (result.error) {
          toast.error(result.error)
          return
        }
        toast.success('Tid registreret')
      }
      onSuccess?.()
    })
  }

  const isEditing = Boolean(existing)

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Dato */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Dato <span className="text-red-500">*</span>
        </label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          disabled={isPending}
          max={today}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Timer og minutter */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Tid brugt <span className="text-red-500">*</span>
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            min={0}
            max={24}
            disabled={isPending}
            className="w-20 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
          />
          <span className="text-sm text-gray-600">timer</span>
          <input
            type="number"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            min={0}
            max={59}
            disabled={isPending}
            className="w-20 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
          />
          <span className="text-sm text-gray-600">minutter</span>
        </div>
      </div>

      {/* Beskrivelse */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Beskrivelse <span className="text-gray-400 font-normal">(valgfri)</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={isPending}
          rows={2}
          maxLength={500}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          placeholder="Hvad brugte du tiden på?"
        />
      </div>

      {/* Fakturerbar + timepris */}
      <div className="flex items-start gap-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={billable}
            onChange={(e) => setBillable(e.target.checked)}
            disabled={isPending}
            className="h-4 w-4 text-blue-600 rounded"
          />
          <span className="text-sm font-medium text-gray-700">Fakturerbar tid</span>
        </label>

        {billable && (
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Timepris:</label>
            <input
              type="number"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              disabled={isPending}
              min={0}
              max={100000}
              className="w-24 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="1.500"
            />
            <span className="text-sm text-gray-500">kr/t</span>
          </div>
        )}
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
          {isPending ? 'Gemmer...' : isEditing ? 'Gem ændringer' : 'Registrér tid'}
        </button>
      </div>
    </form>
  )
}