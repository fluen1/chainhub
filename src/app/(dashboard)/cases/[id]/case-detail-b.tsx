'use client'

import { useState, useTransition } from 'react'
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
  AIInsightCard,
  PlusBadge,
  BottomBar,
} from '@/components/ui/b'
import { updateTaskStatus } from '@/actions/tasks'
import { createCaseComment, deleteComment } from '@/actions/comments'
import { escalateCase } from '@/actions/cases'
import { CloseCaseDialog } from '@/components/cases/CloseCaseDialog'
import { EditCaseDialog, type EditCaseInitial } from '@/components/cases/EditCaseDialog'

// ────────────────────────────────────────────────────────────────────────────
// /cases/[id] — klient-komponent.
// Layout matcher docs/design/handoff/project/Sag detail.html.
// ────────────────────────────────────────────────────────────────────────────

export interface CaseDetailData {
  id: string
  nr: string
  title: string
  type: string
  rawType: string
  status: string
  rawStatus: string
  sensitivity: string
  rawSensitivity: string
  description: string
  subtype: string | null
  selskab: string
  selskabId: string | null
  ansvarlig: string
  frist: string
  fristShort: string
  fristDays: number | null
  isUrgent: boolean
  createdAt: string
  createdAtShort: string
  updatedAt: string
  closedAt: string | null
  dueDate: string | null
}

export interface CaseTaskData {
  id: string
  title: string
  assignee: string
  due: string
  dueDays: number | null
  done: boolean
  urgent: boolean
}

export interface CaseLinkData {
  key: string
  type: string
  title: string
  sub: string
  badge: string
  badgeTone: BadgeTone
  href: string
}

export interface CaseDocData {
  id: string
  ext: string
  navn: string
  aiStatus: string | null
  date: string
}

export interface CaseActivityData {
  key: string
  who: string
  type: string
  typeTone: BadgeTone
  detail: string
  time: string
}

export interface CaseCommentData {
  id: string
  content: string
  authorId: string
  authorName: string
  createdAt: string
}

function statusTone(rawStatus: string): BadgeTone {
  switch (rawStatus) {
    case 'NY':
    case 'AKTIV':
      return 'blue'
    case 'AFVENTER_EKSTERN':
    case 'AFVENTER_KLIENT':
      return 'amber'
    case 'LUKKET':
      return 'green'
    default:
      return 'gray'
  }
}

function fristTone(days: number | null): BadgeTone {
  if (days == null) return 'gray'
  if (days < 0) return 'red'
  if (days <= 3) return 'red'
  if (days <= 14) return 'amber'
  return 'gray'
}

export function CaseDetailB({
  data,
  tasks: initialTasks,
  links,
  docs,
  activity,
  comments: initialComments,
  currentUserId,
}: {
  data: CaseDetailData
  tasks: CaseTaskData[]
  links: CaseLinkData[]
  docs: CaseDocData[]
  activity: CaseActivityData[]
  comments: CaseCommentData[]
  currentUserId: string
}) {
  const router = useRouter()
  const [tasks, setTasks] = useState(initialTasks)
  const [comments, setComments] = useState(initialComments)
  const [comment, setComment] = useState('')
  const [closeOpen, setCloseOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [, startTransition] = useTransition()
  const [commentPending, startCommentTransition] = useTransition()
  const [escalatePending, startEscalateTransition] = useTransition()
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null)

  function toggleTask(taskId: string, currentDone: boolean) {
    // Optimistic
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, done: !currentDone } : t)))
    startTransition(async () => {
      const res = await updateTaskStatus({
        taskId,
        status: currentDone ? 'NY' : 'LUKKET',
      })
      if ('error' in res) {
        // Rollback
        setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, done: currentDone } : t)))
        toast.error(res.error)
      } else {
        toast.success(currentDone ? 'Opgave genåbnet' : 'Opgave fuldført')
      }
    })
  }

  function submitComment() {
    if (!comment.trim()) return
    const content = comment.trim()
    setComment('')
    startCommentTransition(async () => {
      const res = await createCaseComment({ caseId: data.id, content })
      if ('error' in res) {
        toast.error(res.error)
        setComment(content)
      } else {
        toast.success('Kommentar gemt')
        router.refresh()
      }
    })
  }

  function handleDeleteComment(commentId: string) {
    setDeletingCommentId(commentId)
    // Optimistic remove
    const prev = comments
    setComments((c) => c.filter((x) => x.id !== commentId))
    startTransition(async () => {
      const res = await deleteComment(commentId)
      if ('error' in res) {
        toast.error(res.error)
        setComments(prev)
      }
      setDeletingCommentId(null)
    })
  }

  function handleEscalate() {
    startEscalateTransition(async () => {
      const res = await escalateCase(data.id)
      if ('error' in res) {
        toast.error(res.error)
      } else {
        toast.success('Sag eskaleret')
        router.refresh()
      }
    })
  }

  const editInitial: EditCaseInitial = {
    id: data.id,
    title: data.title,
    description: data.description,
    caseType: data.rawType,
    caseSubtype: data.subtype,
    sensitivity: data.rawSensitivity,
    dueDate: data.dueDate,
  }

  const openTasks = tasks.filter((t) => !t.done).length
  const totalTasks = tasks.length
  const aiDocs = docs.filter((d) => d.aiStatus === 'completed').length

  const stripCells: StripCellData[] = [
    {
      num: <span className="text-[12px]">{data.status}</span>,
      label: 'Status',
      color: data.rawStatus === 'LUKKET' ? 'green' : 'default',
    },
    { num: <span className="text-[12px]">{data.type}</span>, label: 'Type' },
    {
      num: data.fristShort,
      label: data.frist === 'Ingen frist' ? 'Frist' : `Frist · ${data.frist}`,
      color: data.isUrgent
        ? 'red'
        : data.fristDays != null && data.fristDays < 0
          ? 'red'
          : 'default',
    },
    {
      num: <span className="text-[12px]">{data.sensitivity}</span>,
      label: 'Sensitivitet',
    },
    { num: <span className="text-[12px]">{data.ansvarlig}</span>, label: 'Ansvarlig' },
    { num: data.createdAtShort, label: 'Oprettet' },
  ]

  return (
    <>
      <CloseCaseDialog
        open={closeOpen}
        onClose={() => setCloseOpen(false)}
        caseId={data.id}
        caseTitle={data.title}
      />
      <EditCaseDialog open={editOpen} onClose={() => setEditOpen(false)} initial={editInitial} />
      <Breadcrumb
        trail={[{ label: 'Sager', href: '/cases' }]}
        current={`${data.nr} ${data.title} · ${data.selskab}`}
      />

      {data.isUrgent && (
        <AlertBar
          tone="red"
          actions={
            <>
              <BButton href="/tasks">Se opgaver</BButton>
              <BButton primary onClick={handleEscalate} disabled={escalatePending}>
                {escalatePending ? 'Eskalerer...' : 'Eskalér'}
              </BButton>
            </>
          }
        >
          <strong>
            Frist om {data.fristDays} {data.fristDays === 1 ? 'dag' : 'dage'}
          </strong>{' '}
          · sagen kræver opmærksomhed
        </AlertBar>
      )}

      <PageHeader
        title={
          <span className="flex items-baseline gap-2">
            <span className="font-medium text-b-2">{data.nr}</span>
            <span>—</span>
            <span>{data.title}</span>
          </span>
        }
        statusBadge={
          <span className="flex items-center gap-1.5">
            <Badge tone={statusTone(data.rawStatus)} className="text-[11px]">
              {data.status}
            </Badge>
          </span>
        }
        meta={
          <>
            {data.selskab}
            <MetaSep />
            Oprettet {data.createdAt}
            <MetaSep />
            Ansvarlig: {data.ansvarlig}
            {data.frist !== 'Ingen frist' && (
              <>
                <MetaSep />
                Frist: {data.frist}
              </>
            )}
          </>
        }
        actions={
          <>
            <BButton onClick={() => setEditOpen(true)}>Rediger</BButton>
            {data.rawStatus !== 'LUKKET' ? (
              <BButton primary onClick={() => setCloseOpen(true)}>
                Luk sag
              </BButton>
            ) : (
              <BButton disabled>Luk sag</BButton>
            )}
          </>
        }
      />

      <Strip cells={stripCells} />

      {/* 3-col: Detaljer + Tilknytninger + AI Analyse */}
      <div className="grid gap-3 lg:grid-cols-3 lg:items-start">
        {/* Detaljer */}
        <Panel>
          <PanelHeader title="Detaljer" />
          <div className="px-3 py-2.5">
            {data.description && (
              <div className="mb-2 grid grid-cols-[120px_1fr] gap-3 border-b border-b-divider pb-2">
                <span
                  className="text-[10px] font-semibold uppercase text-b-2"
                  style={{ letterSpacing: '0.3px' }}
                >
                  Beskrivelse
                </span>
                <span className="text-[12px] leading-snug text-b-2">{data.description}</span>
              </div>
            )}
            <DetailRow label="Type" value={<Badge tone="gray">{data.type}</Badge>} />
            <DetailRow label="Selskab" value={data.selskab} />
            <DetailRow label="Sensitivitet" value={data.sensitivity} />
            {data.subtype && <DetailRow label="Underkategori" value={data.subtype} />}
            <DetailRow label="Ansvarlig" value={data.ansvarlig} />
            <DetailRow label="Frist" value={data.frist} />
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
          <PanelHeader title="Tilknytninger" meta={`${links.length} elementer`} />
          {links.length === 0 ? (
            <div className="px-3 py-3 text-center text-[12px] text-b-3">Ingen tilknytninger</div>
          ) : (
            links.map((l, i) => (
              <Link
                key={l.key}
                href={l.href}
                className={`grid cursor-pointer grid-cols-[1fr_auto_14px] items-center gap-2 px-3 py-1.5 text-[13px] no-underline hover:bg-b-row-hover ${
                  i < links.length - 1 ? 'border-b border-b-divider' : ''
                }`}
              >
                <div className="min-w-0">
                  <div className="truncate text-b-1">{l.title}</div>
                  <div className="mt-px text-[11px] text-b-2">
                    {l.type} · {l.sub}
                  </div>
                </div>
                <Badge tone={l.badgeTone}>{l.badge}</Badge>
                <span className="text-b-3">›</span>
              </Link>
            ))
          )}
          <PanelFooter>
            <div className="flex items-center justify-between">
              <span />
              <BAddButton onClick={() => setEditOpen(true)}>+ Tilknyt</BAddButton>
            </div>
          </PanelFooter>
        </Panel>

        {/* AI Analyse (Plus) */}
        <Panel>
          <PanelHeader
            title={
              <span className="flex items-center gap-1.5">
                AI Analyse <PlusBadge />
              </span>
            }
            meta="Beregnet på case-data"
          />
          <div className="p-2">
            <AIInsightCard
              label="⚡ Sagsrisiko"
              confidence={
                data.rawStatus === 'LUKKET'
                  ? 'Sagen er lukket'
                  : data.isUrgent
                    ? 'Høj risiko'
                    : 'Mellem risiko'
              }
              cite={`Baseret på ${links.length} tilknytninger og ${tasks.length} opgaver.`}
            >
              {data.rawStatus === 'LUKKET' ? (
                <>Sagen er afsluttet. Ingen yderligere handling påkrævet.</>
              ) : data.isUrgent ? (
                <>
                  Fristdato er tæt på. <strong>Prioritér</strong> denne sag og overvej eskalering
                  hvis svar fra modparten udebliver.
                </>
              ) : (
                <>
                  Sag har {openTasks} {openTasks === 1 ? 'åben opgave' : 'åbne opgaver'}. Hold
                  momentum med løbende status-opdateringer.
                </>
              )}
            </AIInsightCard>
          </div>
        </Panel>
      </div>

      {/* Opgaver */}
      <Panel>
        <PanelHeader
          title={
            <span className="flex items-center gap-2">
              Opgaver
              <span className="rounded-[8px] bg-b-border px-1.5 py-px text-[10px] font-medium text-b-gray-fg">
                {totalTasks}
              </span>
            </span>
          }
          meta={
            totalTasks > 0
              ? `${openTasks} ${openTasks === 1 ? 'åben' : 'åbne'} af ${totalTasks}`
              : 'Ingen opgaver'
          }
        />
        {tasks.length === 0 ? (
          <div className="px-3 py-3 text-center text-[12px] text-b-3">
            Ingen opgaver tilknyttet denne sag
          </div>
        ) : (
          tasks.map((t, i) => (
            <div
              key={t.id}
              className={`grid grid-cols-[16px_1fr_auto_auto] items-center gap-2.5 px-3 py-1.5 ${
                i < tasks.length - 1 ? 'border-b border-b-divider' : ''
              }`}
            >
              <button
                type="button"
                onClick={() => toggleTask(t.id, t.done)}
                aria-label={t.done ? 'Genåbn opgave' : 'Markér fuldført'}
                className={`flex h-3.5 w-3.5 items-center justify-center rounded-[3px] border ${
                  t.done
                    ? 'border-b-green-fg bg-b-green-fg'
                    : 'border-b-border-strong bg-white hover:border-b-blue-fg'
                }`}
              >
                {t.done && <span className="text-[9px] font-bold leading-none text-white">✓</span>}
              </button>
              <Link
                href={`/tasks/${t.id}`}
                className={`truncate text-[13px] no-underline ${
                  t.done ? 'text-b-3 line-through' : 'text-b-1 hover:underline'
                }`}
              >
                {t.title}
              </Link>
              <span className="text-[12px] text-b-2">{t.assignee}</span>
              {t.due !== '—' ? (
                <Badge tone={t.urgent ? 'red' : fristTone(t.dueDays)}>{t.due}</Badge>
              ) : (
                <span className="text-b-border-strong">—</span>
              )}
            </div>
          ))
        )}
        <PanelFooter>
          <div className="flex items-center justify-between">
            <span>
              {tasks.filter((t) => t.done).length} af {totalTasks} fuldført
            </span>
            <BAddButton href={`/tasks/new?case=${data.id}`}>+ Tilføj opgave</BAddButton>
          </div>
        </PanelFooter>
      </Panel>

      {/* 2-col: Aktivitet + Dokumenter */}
      <div className="grid gap-3 lg:grid-cols-2 lg:items-start">
        {/* Aktivitet + Kommentarer */}
        <Panel>
          <PanelHeader
            title="Aktivitet"
            meta={`${activity.length} events · ${comments.length} kommentarer`}
          />
          {activity.length === 0 ? (
            <div className="px-3 py-3 text-center text-[12px] text-b-3">Ingen aktivitet</div>
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
                    <Badge tone={a.typeTone} className="text-[10px]">
                      {a.type}
                    </Badge>
                  </span>
                  <span className="b-tnum text-[11px] text-b-3">{a.time}</span>
                </div>
                <div className="mt-1 text-b-2">{a.detail}</div>
              </div>
            ))
          )}

          {/* Kommentarer */}
          {comments.length > 0 && (
            <>
              <div className="border-t border-b-divider bg-b-panel-h px-3 py-1">
                <span
                  className="text-[10px] font-semibold uppercase text-b-2"
                  style={{ letterSpacing: '0.4px' }}
                >
                  Kommentarer
                </span>
              </div>
              {comments.map((c, i) => (
                <div
                  key={c.id}
                  className={`px-3 py-2 text-[12px] ${
                    i < comments.length - 1 ? 'border-b border-b-divider' : ''
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium text-b-1">{c.authorName}</span>
                    <div className="flex items-center gap-2">
                      <span className="b-tnum text-[11px] text-b-3">{c.createdAt}</span>
                      {c.authorId === currentUserId && (
                        <button
                          type="button"
                          onClick={() => handleDeleteComment(c.id)}
                          disabled={deletingCommentId === c.id}
                          aria-label="Slet kommentar"
                          className="text-[11px] text-b-3 hover:text-b-red-fg disabled:opacity-50"
                        >
                          Slet
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-0.5 text-b-2">{c.content}</div>
                </div>
              ))}
            </>
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
                placeholder="Tilføj kommentar til sagen..."
                className="w-full resize-none rounded-[4px] border border-b-border-strong bg-white px-2.5 py-1.5 text-[12px] text-b-1 placeholder:text-b-3 focus:border-b-blue-fg focus:outline-none focus:ring-2 focus:ring-b-blue-bg"
              />
              <div className="mt-1.5 flex items-center justify-end">
                <BButton primary onClick={submitComment} disabled={commentPending}>
                  {commentPending ? 'Gemmer...' : 'Gem kommentar'}
                </BButton>
              </div>
            </div>
          </PanelFooter>
        </Panel>

        {/* Dokumenter */}
        <Panel>
          <PanelHeader
            title={
              <span className="flex items-center gap-2">
                Dokumenter
                <span className="rounded-[8px] bg-b-border px-1.5 py-px text-[10px] font-medium text-b-gray-fg">
                  {docs.length}
                </span>
              </span>
            }
            meta={`${aiDocs} AI-extracted`}
          />
          {docs.length === 0 ? (
            <div className="px-3 py-3 text-center text-[12px] text-b-3">
              Ingen dokumenter — upload det første
            </div>
          ) : (
            docs.map((d, i) => (
              <Link
                key={d.id}
                href={`/documents/review/${d.id}`}
                className={`grid cursor-pointer grid-cols-[40px_1fr_auto_70px_14px] items-center gap-2 px-3 py-1.5 text-[12px] no-underline hover:bg-b-row-hover ${
                  i < docs.length - 1 ? 'border-b border-b-divider' : ''
                }`}
              >
                <Badge tone="gray">{d.ext}</Badge>
                <span className="truncate font-medium text-b-1">{d.navn}</span>
                <Badge
                  tone={
                    d.aiStatus === 'completed'
                      ? 'green'
                      : d.aiStatus === 'pending'
                        ? 'amber'
                        : 'gray'
                  }
                  className="text-[10px]"
                >
                  {d.aiStatus === 'completed'
                    ? 'AI ✓'
                    : d.aiStatus === 'pending'
                      ? 'Afventer'
                      : 'Manuel'}
                </Badge>
                <span className="text-b-2">{d.date}</span>
                <span className="text-b-3">›</span>
              </Link>
            ))
          )}
          <PanelFooter>
            <div className="flex items-center justify-between">
              <span />
              <BAddButton href={`/documents?case=${data.id}`}>+ Upload</BAddButton>
            </div>
          </PanelFooter>
        </Panel>
      </div>

      <BottomBar
        left={
          <>
            Sag {data.nr} · {data.selskab} · Sidst opdateret {data.updatedAt}
          </>
        }
      />
    </>
  )
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] items-center gap-3 border-b border-b-divider py-1.5 last:border-b-0">
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
