'use client'

import { useState } from 'react'
import { updateCaseStatus } from '@/actions/cases'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { zodCaseStatus } from '@/lib/zod-enums'

interface CaseStatusFormProps {
  caseId: string
  currentStatus: string
  nextStatuses: string[]
}

const STATUS_LABELS: Record<string, string> = {
  NY: 'Ny',
  AKTIV: 'Aktiv',
  AFVENTER_EKSTERN: 'Afventer ekstern',
  AFVENTER_KLIENT: 'Afventer klient',
  LUKKET: 'Lukket',
  ARKIVERET: 'Arkiveret',
}

export function CaseStatusForm({ caseId, currentStatus, nextStatuses }: CaseStatusFormProps) {
  const router = useRouter()
  const [selectedStatus, setSelectedStatus] = useState(nextStatuses[0] ?? '')
  const [loading, setLoading] = useState(false)

  async function handleUpdate() {
    if (!selectedStatus) return
    const parsedStatus = zodCaseStatus.safeParse(selectedStatus)
    if (!parsedStatus.success) {
      toast.error('Ugyldig status')
      return
    }
    setLoading(true)

    const result = await updateCaseStatus({
      caseId,
      status: parsedStatus.data,
    })

    setLoading(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success(`Status ændret til ${STATUS_LABELS[selectedStatus]}`)
    router.refresh()
  }

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Opdatér status</h3>
      <p className="text-xs text-gray-500 mb-3">
        Nuværende:{' '}
        <span className="font-medium">{STATUS_LABELS[currentStatus] ?? currentStatus}</span>
      </p>

      <div className="space-y-3">
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          {nextStatuses.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status] ?? status}
            </option>
          ))}
        </select>

        <button
          onClick={handleUpdate}
          disabled={loading || !selectedStatus}
          className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Opdaterer...' : 'Opdatér status'}
        </button>
      </div>
    </div>
  )
}
