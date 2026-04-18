'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  updateTaskStatus,
  updateTaskPriority,
  updateTaskAssignee,
  updateTaskDueDate,
} from '@/actions/tasks'
import {
  TASK_STATUS_LABELS,
  PRIORITY_LABELS,
} from '@/lib/labels'

interface EditTaskDialogProps {
  taskId: string
  currentStatus: string
  currentPriority: string
  currentAssigneeId: string | null
  currentDueDate: Date | null
  availableAssignees: Array<{ id: string; name: string }>
}

export function EditTaskDialog({
  taskId,
  currentStatus,
  currentPriority,
  currentAssigneeId,
  currentDueDate,
  availableAssignees,
}: EditTaskDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [status, setStatus] = useState(currentStatus)
  const [priority, setPriority] = useState(currentPriority)
  const [assigneeId, setAssigneeId] = useState(currentAssigneeId ?? '')
  const [dueDate, setDueDate] = useState(
    currentDueDate ? currentDueDate.toISOString().slice(0, 10) : ''
  )

  async function handleSave() {
    setSaving(true)
    const calls: Promise<{ error?: string } | { data: unknown; error?: undefined }>[] = []

    if (status !== currentStatus) {
      calls.push(updateTaskStatus({ taskId, status: status as never }))
    }
    if (priority !== currentPriority) {
      calls.push(updateTaskPriority({ taskId, priority: priority as never }))
    }
    const newAssignee = assigneeId === '' ? null : assigneeId
    if (newAssignee !== currentAssigneeId) {
      calls.push(updateTaskAssignee({ taskId, assignedTo: newAssignee }))
    }
    const oldIso = currentDueDate ? currentDueDate.toISOString().slice(0, 10) : null
    const newIso = dueDate === '' ? null : dueDate
    if (oldIso !== newIso) {
      calls.push(updateTaskDueDate({ taskId, dueDate: newIso }))
    }

    if (calls.length === 0) {
      setOpen(false)
      setSaving(false)
      return
    }

    const results = await Promise.all(calls)
    setSaving(false)

    const firstError = results.find((r) => 'error' in r && r.error)
    if (firstError && 'error' in firstError && firstError.error) {
      toast.error(firstError.error)
      return
    }

    toast.success('Opgave opdateret')
    setOpen(false)
    router.refresh()
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
      >
        <Pencil className="h-3.5 w-3.5" aria-hidden />
        Redigér
      </button>
    )
  }

  return (
    <>
      <button
        disabled
        className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-400"
      >
        <Pencil className="h-3.5 w-3.5" aria-hidden />
        Redigerer…
      </button>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
        <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-lg">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Redigér opgave</h2>
            <button
              onClick={() => setOpen(false)}
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100"
              aria-label="Luk"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Status</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                {Object.entries(TASK_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Prioritet</span>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Ansvarlig</span>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="">Ingen</option>
                {availableAssignees.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Frist</span>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </label>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={() => setOpen(false)}
              className="rounded-md border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Annuller
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Gemmer…' : 'Gem ændringer'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
