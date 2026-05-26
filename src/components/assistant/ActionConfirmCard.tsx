'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { confirmAction, rejectAction } from '@/actions/assistant'

interface Props {
  actionId: string
  actionType: string
  actionLabel: string
  payload: Record<string, unknown>
}

type Status = 'pending' | 'confirmed' | 'rejected'

export function ActionConfirmCard({ actionId, actionLabel, payload }: Props) {
  const [status, setStatus] = useState<Status>('pending')
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    setLoading(true)
    const result = await confirmAction(actionId)
    setLoading(false)
    if (result.error) {
      toast.error(result.error)
      return
    }
    setStatus('confirmed')
    toast.success('Handling udført')
  }

  async function handleReject() {
    setLoading(true)
    const result = await rejectAction(actionId)
    setLoading(false)
    if (result.error) {
      toast.error(result.error)
      return
    }
    setStatus('rejected')
  }

  return (
    <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-[13px]">
      <p className="font-medium text-amber-900">{actionLabel}</p>

      {Object.keys(payload).length > 0 && (
        <dl className="mt-1.5 space-y-0.5 text-amber-800">
          {Object.entries(payload).map(([k, v]) => (
            <div key={k} className="flex gap-1">
              <dt className="font-medium">{k}:</dt>
              <dd>{String(v)}</dd>
            </div>
          ))}
        </dl>
      )}

      {status === 'pending' && (
        <div className="mt-2.5 flex gap-2">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="rounded-[4px] bg-green-600 px-2.5 py-1 text-[12px] font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? 'Udfører...' : 'Bekræft'}
          </button>
          <button
            type="button"
            onClick={handleReject}
            disabled={loading}
            className="rounded-[4px] bg-gray-100 px-2.5 py-1 text-[12px] font-medium text-b-1 hover:bg-gray-200 disabled:opacity-50"
          >
            Afvis
          </button>
        </div>
      )}

      {status === 'confirmed' && (
        <div className="mt-2 text-[12px] font-medium text-green-700">✓ Udført</div>
      )}

      {status === 'rejected' && (
        <div className="mt-2 text-[12px] font-medium text-b-2">✗ Afvist</div>
      )}
    </div>
  )
}
