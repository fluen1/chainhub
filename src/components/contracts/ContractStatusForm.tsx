'use client'

import { useState } from 'react'
import { updateContractStatus } from '@/actions/contracts'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { zodContractStatus } from '@/lib/zod-enums'

interface ContractStatusFormProps {
  contractId: string
  currentStatus: string
  nextStatuses: string[]
}

const STATUS_LABELS: Record<string, string> = {
  UDKAST: 'Kladde',
  TIL_REVIEW: 'Til review',
  TIL_UNDERSKRIFT: 'Til underskrift',
  AKTIV: 'Aktiv',
  UDLOEBET: 'Udløbet',
  OPSAGT: 'Opsagt',
  FORNYET: 'Fornyet',
  ARKIVERET: 'Arkiveret',
}

export function ContractStatusForm({
  contractId,
  currentStatus,
  nextStatuses,
}: ContractStatusFormProps) {
  const router = useRouter()
  const [selectedStatus, setSelectedStatus] = useState(nextStatuses[0] ?? '')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleUpdate() {
    if (!selectedStatus) return
    const parsedStatus = zodContractStatus.safeParse(selectedStatus)
    if (!parsedStatus.success) {
      toast.error('Ugyldig status')
      return
    }
    setLoading(true)

    const result = await updateContractStatus({
      contractId,
      status: parsedStatus.data,
      note: note || undefined,
    })

    setLoading(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success(`Status ændret til ${STATUS_LABELS[selectedStatus]}`)
    router.refresh()
    setNote('')
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

        {(selectedStatus === 'OPSAGT' || selectedStatus === 'UDLOEBET') && (
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (valgfrit)..."
            rows={2}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        )}

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
