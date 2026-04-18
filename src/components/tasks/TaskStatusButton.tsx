'use client'

import { useState } from 'react'
import { updateTaskStatus } from '@/actions/tasks'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { zodTaskStatus } from '@/lib/zod-enums'

interface TaskStatusButtonProps {
  taskId: string
  currentStatus: string
}

interface StatusAction {
  nextStatus: string
  label: string
}

const STATUS_ACTIONS: Record<string, StatusAction[]> = {
  NY: [{ nextStatus: 'AKTIV_TASK', label: 'Start' }],
  AKTIV_TASK: [
    { nextStatus: 'AFVENTER', label: 'Sæt på hold' },
    { nextStatus: 'LUKKET', label: 'Luk' },
  ],
  AFVENTER: [
    { nextStatus: 'AKTIV_TASK', label: 'Genoptag' },
    { nextStatus: 'LUKKET', label: 'Luk' },
  ],
  LUKKET: [],
}

export function TaskStatusButton({ taskId, currentStatus }: TaskStatusButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const actions = STATUS_ACTIONS[currentStatus] ?? []

  async function handleClick(nextStatus: string) {
    const parsedStatus = zodTaskStatus.safeParse(nextStatus)
    if (!parsedStatus.success) {
      toast.error('Ugyldig status')
      return
    }
    setLoading(true)

    const result = await updateTaskStatus({
      taskId,
      status: parsedStatus.data,
    })

    setLoading(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    router.refresh()
  }

  if (actions.length === 0) return null

  return (
    <div className="flex items-center gap-1">
      {actions.map((action) => (
        <button
          key={action.nextStatus}
          onClick={() => handleClick(action.nextStatus)}
          disabled={loading}
          className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? '...' : action.label}
        </button>
      ))}
    </div>
  )
}
