'use client'

import { useState } from 'react'
import { updateVisit } from '@/actions/visits'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { VISIT_STATUS_LABELS } from '@/lib/labels'

interface VisitStatusFormProps {
  visitId: string
  currentStatus: string
}

export function VisitStatusForm({ visitId, currentStatus }: VisitStatusFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const nextStatuses = currentStatus === 'PLANLAGT' ? ['GENNEMFOERT', 'AFLYST'] : []

  if (nextStatuses.length === 0) return null

  async function handleUpdate(newStatus: string) {
    setLoading(true)

    const result = await updateVisit({
      visitId,
      status: newStatus as 'PLANLAGT' | 'GENNEMFOERT' | 'AFLYST',
    })

    setLoading(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success(`Status ændret til ${VISIT_STATUS_LABELS[newStatus] ?? newStatus}`)
    router.refresh()
  }

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Opdatér status</h3>
      <p className="text-xs text-gray-500 mb-3">
        Nuværende:{' '}
        <span className="font-medium">{VISIT_STATUS_LABELS[currentStatus] ?? currentStatus}</span>
      </p>
      <div className="space-y-2">
        {nextStatuses.map((status) => (
          <button
            key={status}
            onClick={() => handleUpdate(status)}
            disabled={loading}
            className={`w-full rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50 ${
              status === 'GENNEMFOERT'
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {loading ? 'Opdaterer...' : VISIT_STATUS_LABELS[status]}
          </button>
        ))}
      </div>
    </div>
  )
}
