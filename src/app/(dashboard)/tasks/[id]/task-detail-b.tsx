'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Breadcrumb,
  PageHeader,
  MetaSep,
  BButton,
  BAddButton,
  Strip,
  type StripCellData,
  AlertBar,
  Panel,
  PanelHeader,
  PanelFooter,
  Badge,
  type BadgeTone,
  BottomBar,
} from '@/components/ui/b'
import { updateTaskStatus } from '@/actions/tasks'
import { createComment } from '@/actions/comments'
import {
  EditTaskDialog,
  type TaskPriority,
  type TaskStatus,
} from '@/components/tasks/EditTaskDialog'
import { getCaseStatusLabel, getContractStatusLabel } from '@/lib/labels'

// ────────────────────────────────────────────────────────────────────────────
// /tasks/[id] — klient-komponent. B-stil port af Opgave detail.html.
//
// Bemærk: Schema har ingen subtask-tabel, så "Tjekliste"-panelet fra designet
// er udeladt. Kommer i V2 hvis schemaet udvides.
// ────────────────────────────────────────────────────────────────────────────

export interface TaskDetailViewData {
  id: string
  nr: string
  title: string
  description: string | null
  status: string
  statusLabel: string
  priority: string
  priorityLabel: string
  frist: string
  fristShort: string
  fristDays: number | null
  isUrgent: boolean
  createdAt: string
  assigneeName: string
  assigneeId: string | null
  dueDateIso: string | null
  relatedCompany: { id: string; name: string } | null
  relatedCase: { id: string; title: string; status: string } | null
  relatedContract: { id: string; display_name: string; status: string } | null
  history: Array<{
    id: string
    fieldLabel: string
    oldLabel: string
    newLabel: string
    changedByName: string
    changedAt: string
  }>
  comments: Array<{
    id: string
    content: string
    authorName: string
    createdAt: string
  }>
  availableAssignees: Array<{ id: string; name: string }>
}

// Status-options (matcher TaskStatus enum). AKTIV bruges som "I gang" i UI.
const STATUS_OPTS: Array<{ value: 'NY' | 'AKTIV_TASK' | 'AFVENTER' | 'LUKKET'; label: string }> = [
  { value: 'NY', label: 'Åben' },
  { value: 'AKTIV_TASK', label: 'I gang' },
  { value: 'AFVENTER', label: 'Afventer' },
  { value: 'LUKKET', label: 'Fuldført' },
]

function statusTone(status: string): BadgeTone {
  switch (status) {
    case 'NY':
      return 'gray'
    case 'AKTIV_TASK':
      return 'blue'
    case 'AFVENTER':
      return 'amber'
    case 'LUKKET':
      return 'green'
    default:
      return 'gray'
  }
}

function prioTone(priority: string): BadgeTone {
  switch (priority) {
    case 'KRITISK':
      return 'red'
    case 'HOEJ':
      return 'amber'
    case 'MELLEM':
      return 'blue'
    default:
      return 'gray'
  }
}

function fristTone(days: number | null): BadgeTone {
  if (days == null) return 'gray'
  if (days < 0) return 'red'
  if (days <= 1) return 'red'
  if (days <= 7) return 'amber'
  return 'gray'
}

function formatRelativeShort(iso: string): string {
  const d = new Date(iso)
  const months = [
    'jan',
    'feb',
    'mar',
    'apr',
    'maj',
    'jun',
    'jul',
    'aug',
    'sep',
    'okt',
    'nov',
    'dec',
  ]
  return `${d.getDate()}. ${months[d.getMonth()]} ${d.toLocaleTimeString('da-DK', {
    hour: '2-digit',
    minute: '2-digit',
  })}`
}

export function TaskDetailB({ data }: { data: TaskDetailViewData }) {
  const router = useRouter()
  const [status, setStatus] = useState(data.status)
  const [comment, setComment] = useState('')
  const [isPending, startTransition] = useTransition()
  const [editOpen, setEditOpen] = useState(false)

  const isDone = status === 'LUKKET'

  function changeStatus(newStatus: 'NY' | 'AKTIV_TASK' | 'AFVENTER' | 'LUKKET') {
    if (newStatus === status) return
    const prev = status
    setStatus(newStatus) // optimistic
    startTransition(async () => {
      const res = await updateTaskStatus({ taskId: data.id, status: newStatus })
      if ('error' in res) {
        setStatus(prev)
        toast.error(res.error)
      } else {
        toast.success(
          `Status ændret til ${STATUS_OPTS.find((s) => s.value === newStatus)?.label ?? newStatus}`
        )
      }
    })
  }

  function toggleDone() {
    changeStatus(isDone ? 'NY' : 'LUKKET')
  }

  function submitComment() {
    if (!comment.trim()) return
    const content = comment.trim()
    setComment('')
    startTransition(async () => {
      const res = await createComment({ taskId: data.id, content })
      if ('error' in res) {
        toast.error(res.error)
        setComment(content)
      } else {
        toast.success('Kommentar tilføjet')
        router.refresh()
      }
    })
  }

  // Merge history + comments til én aktivitets-feed sorteret efter tid (nyeste først)
  const activity = [
    ...data.comments.map((c) => ({
      key: `c-${c.id}`,
      who: c.authorName,
      type: 'Kommentar',
      tone: 'blue' as BadgeTone,
      detail: c.content,
      isQuote: true,
      ts: new Date(c.createdAt).getTime(),
    })),
    ...data.history.map((h) => ({
      key: `h-${h.id}`,
      who: h.changedByName,
      type: h.fieldLabel,
      tone: h.fieldLabel === 'Status' ? ('amber' as BadgeTone) : ('gray' as BadgeTone),
      detail: `${h.oldLabel} → ${h.newLabel}`,
      isQuote: false,
      ts: new Date(h.changedAt).getTime(),
    })),
  ].sort((a, b) => b.ts - a.ts)

  const stripCells: StripCellData[] = [
    {
      num: (
        <span className="text-[12px]">
          {STATUS_OPTS.find((s) => s.value === status)?.label ?? status}
        </span>
      ),
      label: 'Status',
      color: isDone ? 'green' : status === 'AFVENTER' ? 'amber' : 'default',
    },
    {
      num: <span className="text-[12px]">{data.priorityLabel}</span>,
      label: 'Prioritet',
      color: data.priority === 'KRITISK' ? 'red' : data.priority === 'HOEJ' ? 'amber' : 'default',
    },
    {
      num: data.fristShort,
      label: data.frist === 'Ingen frist' ? 'Frist' : `Frist · ${data.frist}`,
      color: data.isUrgent ? 'red' : 'default',
    },
    { num: <span className="text-[12px]">{data.assigneeName}</span>, label: 'Ansvarlig' },
    { num: <span className="text-[12px]">{data.nr}</span>, label: 'Opgave-ID' },
  ]

  const breadcrumbTrail = [{ label: 'Opgaver', href: '/tasks' }]
  if (data.relatedCompany) {
    breadcrumbTrail.push({
      label: data.relatedCompany.name,
      href: `/companies/${data.relatedCompany.id}`,
    })
  }

  return (
    <>
      <Breadcrumb trail={breadcrumbTrail} current={data.title} />

      {data.isUrgent && !isDone && (
        <AlertBar tone="red">
          <strong>
            Frist om {data.fristDays} {data.fristDays === 1 ? 'dag' : 'dage'}
          </strong>{' '}
          · opgaven kræver opmærksomhed
        </AlertBar>
      )}

      <PageHeader
        title={<span className={isDone ? 'text-b-3 line-through' : ''}>{data.title}</span>}
        meta={
          <>
            <StatusPill value={status} onChange={changeStatus} pending={isPending} />
            <MetaSep />
            <Badge tone={prioTone(data.priority)}>{data.priorityLabel} prioritet</Badge>
            <MetaSep />
            <span>
              Frist{' '}
              {data.frist === 'Ingen frist' ? (
                <span className="text-b-3">—</span>
              ) : (
                <Badge tone={fristTone(data.fristDays)}>{data.frist}</Badge>
              )}
            </span>
            <MetaSep />
            <span>{data.assigneeName}</span>
            <MetaSep />
            <span className="text-b-3">{data.nr}</span>
          </>
        }
        actions={
          <>
            <BButton onClick={() => setEditOpen(true)}>Rediger</BButton>
            <BButton primary={!isDone} onClick={toggleDone}>
              {isDone ? 'Genåbn' : 'Markér fuldført'}
            </BButton>
          </>
        }
      />

      <Strip cells={stripCells} />

      {/* 2-col: Venstre (beskrivelse + aktivitet) · Højre (detaljer + tilknytninger) */}
      <div className="grid gap-3 md:grid-cols-[1.6fr_1fr] lg:items-start">
        <div className="flex flex-col gap-3">
          {/* Beskrivelse */}
          <Panel>
            <PanelHeader
              title="Beskrivelse"
              actions={<BAddButton onClick={() => setEditOpen(true)}>Rediger</BAddButton>}
            />
            <div className="px-3 py-2.5 text-[13px] leading-relaxed text-b-1">
              {data.description ? (
                <pre className="whitespace-pre-wrap break-words font-sans">{data.description}</pre>
              ) : (
                <span className="text-b-3">Ingen beskrivelse — tilføj kontekst om opgaven.</span>
              )}
            </div>
          </Panel>

          {/* Aktivitet */}
          <Panel>
            <PanelHeader title="Aktivitet" meta={`${activity.length} events`} />
            {activity.length === 0 ? (
              <div className="px-3 py-3 text-center text-[12px] text-b-3">
                Ingen aktivitet endnu
              </div>
            ) : (
              activity.map((a, i) => (
                <div
                  key={a.key}
                  className={`px-3 py-1.5 text-[12px] ${
                    i < activity.length - 1 ? 'border-b border-b-divider' : ''
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span>
                      <span className="font-medium text-b-1">{a.who}</span>{' '}
                      <Badge tone={a.tone} className="text-[10px]">
                        {a.type}
                      </Badge>
                    </span>
                    <span className="b-tnum text-[11px] text-b-3">
                      {formatRelativeShort(new Date(a.ts).toISOString())}
                    </span>
                  </div>
                  <div
                    className={`mt-1 text-b-2 ${a.isQuote ? 'border-l-2 border-b-border pl-2 italic' : ''}`}
                  >
                    {a.detail}
                  </div>
                </div>
              ))
            )}
            <PanelFooter className="!p-0">
              <div className="border-t border-b-border bg-b-panel p-2">
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submitComment()
                  }}
                  rows={2}
                  placeholder="Tilføj kommentar..."
                  className="w-full resize-none rounded-[4px] border border-b-border-strong bg-white px-2.5 py-1.5 text-[12px] text-b-1 placeholder:text-b-3 focus:border-b-blue-fg focus:outline-none focus:ring-2 focus:ring-b-blue-bg"
                />
                <div className="mt-1.5 flex items-center justify-end">
                  <BButton primary onClick={submitComment}>
                    Gem
                  </BButton>
                </div>
              </div>
            </PanelFooter>
          </Panel>
        </div>

        <div className="flex flex-col gap-3">
          {/* Detaljer */}
          <Panel>
            <PanelHeader title="Detaljer" />
            <div className="px-3 py-2.5">
              {data.relatedCompany && (
                <DetailRow label="Selskab" value={data.relatedCompany.name} />
              )}
              <DetailRow label="Ansvarlig" value={data.assigneeName} />
              <DetailRow
                label="Frist"
                value={
                  data.frist === 'Ingen frist' ? (
                    <span className="text-b-3">Ingen frist</span>
                  ) : (
                    <Badge tone={fristTone(data.fristDays)}>{data.frist}</Badge>
                  )
                }
              />
              <DetailRow
                label="Prioritet"
                value={<Badge tone={prioTone(data.priority)}>{data.priorityLabel}</Badge>}
              />
              <DetailRow
                label="Status"
                value={
                  <Badge tone={statusTone(status)}>
                    {STATUS_OPTS.find((s) => s.value === status)?.label ?? status}
                  </Badge>
                }
              />
              <DetailRow label="Oprettet" value={data.createdAt} />
              <DetailRow
                label="Opgave-ID"
                value={<span className="b-tnum text-b-2">{data.nr}</span>}
              />
            </div>
            <PanelFooter>
              <div className="flex items-center justify-between">
                <span />
                <BAddButton onClick={() => setEditOpen(true)}>Rediger</BAddButton>
              </div>
            </PanelFooter>
          </Panel>

          {/* Tilknytninger */}
          <Panel>
            <PanelHeader
              title="Tilknytninger"
              meta={`${(data.relatedCase ? 1 : 0) + (data.relatedContract ? 1 : 0)} elementer`}
            />
            {!data.relatedCase && !data.relatedContract ? (
              <div className="px-3 py-3 text-center text-[12px] text-b-3">Ingen tilknytninger</div>
            ) : (
              <>
                {data.relatedCase && (
                  <LinkRow
                    href={`/cases/${data.relatedCase.id}`}
                    title={data.relatedCase.title}
                    sub={`Sag · ${getCaseStatusLabel(data.relatedCase.status)}`}
                    badge={getCaseStatusLabel(data.relatedCase.status)}
                    badgeTone={data.relatedCase.status === 'LUKKET' ? 'gray' : 'blue'}
                    isLast={!data.relatedContract}
                  />
                )}
                {data.relatedContract && (
                  <LinkRow
                    href={`/contracts/${data.relatedContract.id}`}
                    title={data.relatedContract.display_name}
                    sub={`Kontrakt · ${getContractStatusLabel(data.relatedContract.status)}`}
                    badge={getContractStatusLabel(data.relatedContract.status)}
                    badgeTone={data.relatedContract.status === 'AKTIV' ? 'green' : 'gray'}
                    isLast={true}
                  />
                )}
              </>
            )}
            <PanelFooter>
              <div className="flex items-center justify-between">
                <span />
                <BAddButton onClick={() => setEditOpen(true)}>Rediger tilknytninger</BAddButton>
              </div>
            </PanelFooter>
          </Panel>
        </div>
      </div>

      <BottomBar
        left={
          <>
            {data.nr}
            {data.relatedCompany && ` · ${data.relatedCompany.name}`} · Oprettet {data.createdAt}
          </>
        }
      />

      <EditTaskDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={() => router.refresh()}
        task={{
          id: data.id,
          title: data.title,
          description: data.description,
          priority: data.priority as TaskPriority,
          status: status as TaskStatus,
          dueDate: data.dueDateIso,
          assignedToId: data.assigneeId,
        }}
        availableAssignees={data.availableAssignees}
      />
    </>
  )
}

// ────────────────────────────────────────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[100px_1fr] items-center gap-3 border-b border-b-divider py-1.5 last:border-b-0">
      <span
        className="text-[10px] font-semibold uppercase text-b-2"
        style={{ letterSpacing: '0.3px' }}
      >
        {label}
      </span>
      <span className="text-[13px] text-b-1">{value}</span>
    </div>
  )
}

function LinkRow({
  href,
  title,
  sub,
  badge,
  badgeTone,
  isLast,
}: {
  href: string
  title: string
  sub: string
  badge: string
  badgeTone: BadgeTone
  isLast: boolean
}) {
  return (
    <Link
      href={href}
      className={`grid grid-cols-[1fr_auto_14px] items-center gap-2 px-3 py-1.5 text-[13px] no-underline hover:bg-b-row-hover ${
        isLast ? '' : 'border-b border-b-divider'
      }`}
    >
      <div className="min-w-0">
        <div className="truncate text-b-1">{title}</div>
        <div className="mt-px text-[11px] text-b-2">{sub}</div>
      </div>
      <Badge tone={badgeTone}>{badge}</Badge>
      <span className="text-b-3">›</span>
    </Link>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// StatusPill — inline dropdown der ændrer task status.
// ────────────────────────────────────────────────────────────────────────────

function StatusPill({
  value,
  onChange,
  pending,
}: {
  value: string
  onChange: (v: 'NY' | 'AKTIV_TASK' | 'AFVENTER' | 'LUKKET') => void
  pending: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function h(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const current = STATUS_OPTS.find((s) => s.value === value)
  const dotColor: Record<string, string> = {
    NY: 'bg-b-border-strong',
    AKTIV_TASK: 'bg-b-blue-fg',
    AFVENTER: 'bg-b-amber-fg',
    LUKKET: 'bg-b-green-fg',
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-[4px] border border-b-border-strong bg-white px-2 py-0.5 text-[11px] text-b-1 hover:bg-[#f6f8fa] disabled:opacity-60"
      >
        <span className={`h-1.5 w-1.5 rounded-full ${dotColor[value] ?? 'bg-b-border-strong'}`} />
        {current?.label ?? value} ▾
      </button>
      {open && (
        <div className="absolute left-0 top-[calc(100%+3px)] z-50 min-w-[140px] overflow-hidden rounded-[4px] border border-b-border-strong bg-white shadow-[0_8px_24px_rgba(15,23,42,0.11)]">
          {STATUS_OPTS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value)
                setOpen(false)
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-b-1 hover:bg-b-row-hover"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${dotColor[opt.value] ?? 'bg-b-border-strong'}`}
              />
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
