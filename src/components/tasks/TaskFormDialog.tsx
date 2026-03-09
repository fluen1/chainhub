'use client'

import { useState, useTransition } from 'react'
import { TaskStatus, Prioritet } from '@prisma/client'
import { createTask, updateTask } from '@/actions/tasks'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { STATUS_LABELS, PRIORITET_LABELS } from '@/types/task'
import type { TaskWithAssignee } from '@/types/task'

interface User {
  id: string
  name: string
  email: string
  avatarUrl: string | null
}

interface TaskFormDialogProps {
  task?: TaskWithAssignee
  caseId?: string
  companyId?: string
  users: User[]
  onSuccess: () => void
  onCancel: () => void
}

export function TaskFormDialog({
  task,
  caseId,
  companyId,
  users,
  onSuccess,
  onCancel,
}: TaskFormDialogProps) {
  const isEdit = !!task
  const [isPending, startTransition] = useTransition()

  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'NY')
  const [priority, setPriority] = useState<Prioritet>(task?.priority ?? 'MELLEM')
  const [assignedTo, setAssignedTo] = useState<string>(task?.assignedTo ?? 'ingen')
  const [dueDate, setDueDate] = useState<string>(
    task?.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ''
  )
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    if (!title.trim()) newErrors.title = 'Titel er påkrævet'
    if (title.length > 255) newErrors.title = 'Titel må højst være 255 tegn'
    if (description && description.length > 5000)
      newErrors.description = 'Beskrivelse må højst være 5000 tegn'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = () => {
    if (!validate()) return

    startTransition(async () => {
      const dueDateIso = dueDate ? new Date(dueDate).toISOString() : null

      if (isEdit && task) {
        const result = await updateTask({
          taskId: task.id,
          title: title.trim(),
          description: description.trim() || null,
          status,
          priority,
          assignedTo: assignedTo === 'ingen' ? null : assignedTo,
          dueDate: dueDateIso,
        })
        if (result.error) {
          toast.error(result.error)
        } else {
          onSuccess()
        }
      } else {
        const result = await createTask({
          title: title.trim(),
          description: description.trim() || undefined,
          status,
          priority,
          assignedTo: assignedTo === 'ingen' ? null : assignedTo,
          dueDate: dueDateIso,
          caseId: caseId ?? null,
          companyId: companyId ?? null,
        })
        if (result.error) {
          toast.error(result.error)
        } else {
          onSuccess()
        }
      }
    })
  }

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Rediger opgave' : 'Ny opgave'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Titel */}
          <div className="space-y-1.5">
            <Label htmlFor="title">
              Titel <span className="text-red-500">*</span>
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Opgavetitel"
              disabled={isPending}
            />
            {errors.title && (
              <p className="text-xs text-red-600">{errors.title}</p>
            )}
          </div>

          {/* Beskrivelse */}
          <div className="space-y-1.5">
            <Label htmlFor="description">Beskrivelse</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Valgfri beskrivelse af opgaven"
              rows={3}
              disabled={isPending}
            />
            {errors.description && (
              <p className="text-xs text-red-600">{errors.description}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Status */}
            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as TaskStatus)}
                disabled={isPending}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Prioritet */}
            <div className="space-y-1.5">
              <Label htmlFor="priority">Prioritet</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as Prioritet)}
                disabled={isPending}
              >
                <SelectTrigger id="priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITET_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Ansvarlig */}
            <div className="space-y-1.5">
              <Label htmlFor="assignedTo">Ansvarlig</Label>
              <Select
                value={assignedTo}
                onValueChange={setAssignedTo}
                disabled={isPending}
              >
                <SelectTrigger id="assignedTo">
                  <SelectValue placeholder="Vælg bruger" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ingen">Ikke tildelt</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Forfaldsdato */}
            <div className="space-y-1.5">
              <Label htmlFor="dueDate">Forfaldsdato</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={isPending}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isPending}>
            Annuller
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending
              ? isEdit
                ? 'Gemmer...'
                : 'Opretter...'
              : isEdit
              ? 'Gem ændringer'
              : 'Opret opgave'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}