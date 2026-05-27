'use client'

import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { createTask } from '@/actions/tasks'
import {
  Panel,
  BButton,
  BTextField,
  BTextareaField,
  BSegmentedField,
  BFieldWrap,
  BFieldRow,
} from '@/components/ui/b'
import { safeAction } from '@/lib/safe-action'

// ─────────────────────────────────────────────────────────────────────────────
// CreateTaskForm — B-stil port. Felter: title, description, dueDate, priority,
// caseId, companyId, assignedTo.
// ─────────────────────────────────────────────────────────────────────────────

type Priority = 'LAV' | 'MELLEM' | 'HOEJ' | 'KRITISK'

const PRIORITY_OPTS: Array<{ value: Priority; label: string }> = [
  { value: 'LAV', label: 'Lav' },
  { value: 'MELLEM', label: 'Mellem' },
  { value: 'HOEJ', label: 'Høj' },
  { value: 'KRITISK', label: 'Kritisk' },
]

export function CreateTaskForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedCaseId = searchParams.get('caseId') ?? ''
  const preselectedCompanyId = searchParams.get('companyId') ?? ''
  const preselectedDueDate = searchParams.get('dueDate') ?? ''

  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState(preselectedDueDate)
  const [priority, setPriority] = useState<Priority>('MELLEM')
  const [caseId, setCaseId] = useState(preselectedCaseId)
  const [companyId, setCompanyId] = useState(preselectedCompanyId)
  const [assignedTo, setAssignedTo] = useState('')
  const [titleError, setTitleError] = useState<string | null>(null)

  const [cases, setCases] = useState<{ id: string; title: string }[]>([])
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])
  const [users, setUsers] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    // Hent sager, selskaber og brugere parallelt
    Promise.all([
      fetch('/api/cases-list')
        .then((r) => r.json())
        .catch(() => ({ cases: [] })),
      fetch('/api/companies-list')
        .then((r) => r.json())
        .catch(() => ({ companies: [] })),
      fetch('/api/users-list')
        .then((r) => r.json())
        .catch(() => ({ users: [] })),
    ]).then(([casesData, companiesData, usersData]) => {
      setCases(casesData.cases ?? [])
      setCompanies(companiesData.companies ?? [])
      setUsers(usersData.users ?? [])
    })
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!title.trim()) {
      setTitleError('Titel er påkrævet')
      return
    }
    setTitleError(null)
    setLoading(true)

    const data = await safeAction(
      createTask({
        title: title.trim(),
        description: description || undefined,
        dueDate: dueDate || undefined,
        priority,
        caseId: caseId || undefined,
        companyId: companyId || undefined,
        assignedTo: assignedTo || undefined,
      }),
      'Opgaven kunne ikke oprettes — prøv igen.'
    )

    setLoading(false)

    if (!data) return

    toast.success('Opgave oprettet')
    router.push('/tasks')
  }

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <div className="flex items-center gap-2">
        <Link href="/tasks" className="rounded-[4px] p-1 hover:bg-[#f6f8fa]">
          <ArrowLeft className="h-4 w-4 text-b-2" />
        </Link>
        <span className="text-[16px] font-semibold text-b-1">Ny opgave</span>
      </div>

      <Panel>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 px-4 py-4">
          <BTextField
            label="Titel"
            value={title}
            onChange={(v) => {
              setTitle(v)
              if (v.trim()) setTitleError(null)
            }}
            required
            placeholder="fx Gennemgå lejekontrakt inden fornyelse"
            error={titleError}
            autoFocus
            disabled={loading}
          />

          <BTextareaField
            label="Beskrivelse"
            value={description}
            onChange={setDescription}
            placeholder="Tilføj kontekst om opgaven..."
            rows={3}
            disabled={loading}
          />

          <BFieldRow>
            <BTextField
              label="Deadline"
              value={dueDate}
              onChange={setDueDate}
              type="date"
              disabled={loading}
            />
            <BSegmentedField
              label="Prioritet"
              options={PRIORITY_OPTS}
              value={priority}
              onChange={setPriority}
              wrap
            />
          </BFieldRow>

          <BFieldRow>
            <BFieldWrap label="Tilknyt til selskab">
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                disabled={loading}
                className="rounded-[4px] border border-b-border-strong bg-white px-2.5 py-1.5 text-[13px] text-b-1 focus:border-transparent focus:outline focus:outline-2 focus:outline-b-blue-fg focus:outline-offset-[-1px] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">Intet selskab</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </BFieldWrap>

            <BFieldWrap label="Ansvarlig">
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                disabled={loading}
                className="rounded-[4px] border border-b-border-strong bg-white px-2.5 py-1.5 text-[13px] text-b-1 focus:border-transparent focus:outline focus:outline-2 focus:outline-b-blue-fg focus:outline-offset-[-1px] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">Ikke tildelt</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </BFieldWrap>
          </BFieldRow>

          <BFieldWrap label="Tilknyt til sag">
            <select
              value={caseId}
              onChange={(e) => setCaseId(e.target.value)}
              disabled={loading}
              className="rounded-[4px] border border-b-border-strong bg-white px-2.5 py-1.5 text-[13px] text-b-1 focus:border-transparent focus:outline focus:outline-2 focus:outline-b-blue-fg focus:outline-offset-[-1px] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">Ingen sag</option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </BFieldWrap>

          <div className="flex items-center justify-end gap-2 border-t border-b-border pt-3">
            <Link href="/tasks">
              <BButton>Annuller</BButton>
            </Link>
            <BButton type="submit" primary disabled={loading || !title.trim()}>
              {loading ? 'Opretter...' : 'Opret opgave'}
            </BButton>
          </div>
        </form>
      </Panel>
    </div>
  )
}
