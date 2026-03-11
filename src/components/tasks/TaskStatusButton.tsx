'use client'

import { useState } from 'react'
import { updateTaskStatus } from '@/actions/tasks'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface TaskStatusButtonProps {
  taskId: string
  currentStatus: string
}

const NEXT_STATUS: Record<string, string> = {
  NY: 'AKTIV',
  AKTIV: 'LUKKET',
  AFVENTER: 'AKTIV',
  LUKKET: 'NY',
}

const NEXT_LABEL: Record<string, string> = {
  NY: 'Start',
  AKTIV: 'Luk',
  AFVENTER: 'Genåbn',
  LUKKET: 'Genåbn',
}

export function TaskStatusButton({ taskId, currentStatus }: TaskStatusButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const nextStatus = NEXT_STATUS[currentStatus]
  const label = NEXT_LABEL[currentStatus] ?? 'Opdatér'

  async function handleClick() {
    if (!nextStatus) return
    setLoading(true)

    const result = await updateTaskStatus({
      taskId,
      status: nextStatus as never,
    })

    setLoading(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    router.refresh()
  }

  if (!nextStatus) return null

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
    >
      {loading ? '...' : label}
    </button>
  )
}
