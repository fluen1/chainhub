'use client'

import { useState, useTransition } from 'react'
import type { TimeEntryWithUser } from '@/types/finance'
import { deleteTimeEntry } from '@/actions/finance'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface TimeEntryListProps {
  entries: TimeEntryWithUser[]
  caseId: string
  totalMinutes: number
  billableMinutes: number
  nonBillableMinutes: number
  onAddNew?: () => void
  onEdit?: (entry: TimeEntryWithUser) => void
  className?: string
}

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins} min`
  if (mins === 0) return `${hours} t`
  return `${hours} t ${mins} min`
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('da-DK', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date))
}

export function TimeEntryList({
  entries,
  caseId,
  totalMinutes,
  billableMinutes,
  nonBillableMinutes,
  onAddNew,
  onEdit,
  className,
}: TimeEntryListProps) {
  const [isPending, startTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function handleDelete(entry: TimeEntryWithUser) {
    if (!confirm(`Vil du slette tidsregistreringen "${entry.description ?? formatDate(entry.date)}"?`)) {
      return
    }
    setDeletingId(entry.id)
    startTransition(async () => {
      const result = await deleteTimeEntry({ timeEntryId: entry.id, caseId })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Tidsregistrering slettet')
      }
      setDeletingId(null)
    })
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Opsummering */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-blue-50 rounded-lg p-3 text-center">
          <p className="text-xs font-medium text-blue-600 uppercase tracking-wide">Total</p>
          <p className="text-xl font-bold text-blue-900 mt-1">{formatMinutes(totalMinutes)}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-3 text-center">
          <p className="text-xs font-medium text-green-600 uppercase tracking-wide">Fakturerbar</p>
          <p className="text-xl font-bold text-green-900 mt-1">{formatMinutes(billableMinutes)}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Ikke-fakturerbar</p>
          <p className="text-xl font-bold text-gray-700 mt-1">
            {formatMinutes(nonBillableMinutes)}
          </p>
        </div>
      </div>

      {/* Header med tilføj-knap */}
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-900">Registreringer ({entries.length})</h3>
        {onAddNew && (
          <button
            onClick={onAddNew}
            className="text-sm font-medium text-blue-600 hover:text-blue-800"
          >
            + Tilføj tid
          </button>
        )}
      </div>

      {/* Liste */}
      {entries.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          <p className="font-medium">Ingen tidsregistreringer endnu</p>
          <p className="text-sm mt-1">Registrér den første tid for denne sag</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className={cn(
                'flex items-center justify-between rounded-lg border px-4 py-3 transition-opacity',
                deletingId === entry.id ? 'opacity-50' : 'border-gray-200 bg-white'
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">
                    {formatMinutes(entry.minutes)}
                  </span>
                  {entry.billable ? (
                    <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                      Fakturerbar
                    </span>
                  ) : (
                    <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                      Intern
                    </span>
                  )}
                  {entry.hourlyRate && (
                    <span className="text-xs text-gray-500">
                      {new Intl.NumberFormat('da-DK').format(entry.hourlyRate)} kr/t
                    </span>
                  )}
                </div>
                {entry.description && (
                  <p className="text-sm text-gray-600 mt-0.5 truncate">{entry.description}</p>
                )}
                <p className="text-xs text-gray-400 mt-0.5">{formatDate(entry.date)}</p>
              </div>

              <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                {onEdit && (
                  <button
                    onClick={() => onEdit(entry)}
                    disabled={isPending}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Rediger
                  </button>
                )}
                <button
                  onClick={() => handleDelete(entry)}
                  disabled={isPending}
                  className="text-sm text-red-600 hover:text-red-800 font-medium"
                >
                  Slet
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ==================== Skeleton ====================

export function TimeEntryListSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-lg bg-gray-100" />
        ))}
      </div>
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-lg border border-gray-200 bg-white" />
        ))}
      </div>
    </div>
  )
}