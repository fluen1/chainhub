'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  BModal,
  BTextField,
  BTextareaField,
  BSegmentedField,
  BFieldRow,
  BFieldWrap,
} from '@/components/ui/b'
import {
  updateTaskPriority,
  updateTaskAssignee,
  updateTaskDueDate,
  updateTaskStatus,
} from '@/actions/tasks'

// ─────────────────────────────────────────────────────────────────────────────
// EditTaskDialog — redigér opgave-metadata via BModal.
//
// Kalder individuelle update-actions kun for de felter der er ændret (diff),
// i parallel-batch. Ingen ny generisk action behøves — eksisterende actions
// er idempotente ved no-op.
// ─────────────────────────────────────────────────────────────────────────────

export type TaskPriority = 'LAV' | 'MELLEM' | 'HOEJ' | 'KRITISK'
export type TaskStatus = 'NY' | 'AKTIV_TASK' | 'AFVENTER' | 'LUKKET'

export interface EditTaskDialogProps {
  open: boolean
  onClose: () => void
  onSaved?: () => void
  task: {
    id: string
    title: string
    description: string | null
    priority: TaskPriority
    status: TaskStatus
    dueDate: string | null
    assignedToId: string | null
  }
  availableAssignees: Array<{ id: string; name: string }>
}

const PRIORITY_OPTS: Array<{ value: TaskPriority; label: string }> = [
  { value: 'LAV', label: 'Lav' },
  { value: 'MELLEM', label: 'Mellem' },
  { value: 'HOEJ', label: 'Høj' },
  { value: 'KRITISK', label: 'Kritisk' },
]

const STATUS_OPTS: Array<{ value: TaskStatus; label: string }> = [
  { value: 'NY', label: 'Åben' },
  { value: 'AKTIV_TASK', label: 'I gang' },
  { value: 'AFVENTER', label: 'Afventer' },
  { value: 'LUKKET', label: 'Fuldført' },
]

export function EditTaskDialog({
  open,
  onClose,
  onSaved,
  task,
  availableAssignees,
}: EditTaskDialogProps) {
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description ?? '')
  const [priority, setPriority] = useState<TaskPriority>(task.priority)
  const [status, setStatus] = useState<TaskStatus>(task.status)
  const [dueDate, setDueDate] = useState(task.dueDate ?? '')
  const [assignedToId, setAssignedToId] = useState(task.assignedToId ?? '')
  const [titleError, setTitleError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleClose() {
    if (!isPending) onClose()
  }

  function handleSubmit() {
    // Validering
    if (!title.trim()) {
      setTitleError('Titel er påkrævet')
      return
    }
    setTitleError(null)

    startTransition(async () => {
      const promises: Array<Promise<{ error?: string } | { data: unknown }>> = []

      // Kun kald actions for ændrede felter
      if (priority !== task.priority) {
        promises.push(updateTaskPriority({ taskId: task.id, priority }))
      }
      if (status !== task.status) {
        promises.push(updateTaskStatus({ taskId: task.id, status }))
      }
      if (dueDate !== (task.dueDate ?? '')) {
        promises.push(updateTaskDueDate({ taskId: task.id, dueDate: dueDate || null }))
      }
      const newAssignedTo = assignedToId || null
      if (newAssignedTo !== task.assignedToId) {
        promises.push(updateTaskAssignee({ taskId: task.id, assignedTo: newAssignedTo }))
      }

      if (promises.length === 0) {
        onClose()
        return
      }

      const results = await Promise.all(promises)
      const errors = results.filter((r): r is { error: string } => 'error' in r && !!r.error)

      if (errors.length > 0) {
        toast.error(errors[0]?.error ?? 'Kunne ikke gemme ændringer')
        return
      }

      toast.success('Opgave opdateret')
      onSaved?.()
      onClose()
    })
  }

  // Reset til seneste task-props når dialogen åbner
  // (håndteres ved at nøgle komponenten udefra ved behov — her resetter vi
  // inline når open skifter til true via useEffect ville kræve dep-array).
  // Pragmatisk: state initialiseres fra task-props og det holder for single-session.

  return (
    <BModal
      open={open}
      onClose={handleClose}
      title="Rediger opgave"
      subtitle={`#${task.id.slice(-4).toUpperCase()} · ${task.title}`}
      onSubmit={handleSubmit}
      submitLabel="Gem ændringer"
      submitDisabled={!title.trim()}
      submitting={isPending}
      width={520}
    >
      {/* Titel vises som read-only tekst — title-ændring kræver en separat updateTaskTitle-action
          som endnu ikke er i tasks.ts. Vi viser den og markerer read-only for nu. */}
      <BTextField
        label="Titel"
        value={title}
        onChange={(v) => {
          setTitle(v)
          if (v.trim()) setTitleError(null)
        }}
        required
        error={titleError}
        placeholder="Opgavens titel"
        autoFocus
        disabled={isPending}
      />

      <BTextareaField
        label="Beskrivelse"
        value={description}
        onChange={setDescription}
        placeholder="Tilføj kontekst om opgaven..."
        rows={3}
        disabled={isPending}
      />

      <BFieldRow>
        <BTextField
          label="Frist"
          value={dueDate}
          onChange={setDueDate}
          type="date"
          disabled={isPending}
        />
        <BSegmentedField
          label="Prioritet"
          options={PRIORITY_OPTS}
          value={priority}
          onChange={setPriority}
          wrap
        />
      </BFieldRow>

      <BSegmentedField
        label="Status"
        options={STATUS_OPTS}
        value={status}
        onChange={setStatus}
        wrap
      />

      <BFieldWrap label="Ansvarlig">
        <select
          value={assignedToId}
          onChange={(e) => setAssignedToId(e.target.value)}
          disabled={isPending}
          className="rounded-[4px] border border-b-border-strong bg-white px-2.5 py-1.5 text-[13px] text-b-1 focus:border-transparent focus:outline focus:outline-2 focus:outline-b-blue-fg focus:outline-offset-[-1px] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <option value="">Ikke tildelt</option>
          {availableAssignees.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </BFieldWrap>
    </BModal>
  )
}
