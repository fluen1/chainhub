'use client'

import { Fragment, useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Search,
  Plus,
  AlertCircle,
  ChevronUp,
  ArrowUp,
  ArrowDown,
  Check,
} from 'lucide-react'
import { toast } from 'sonner'
import { usePrototype } from '@/components/prototype/PrototypeProvider'
import { getTasks, getOverdueTasks } from '@/mock/tasks'
import { cn } from '@/lib/utils'
import type { MockTask } from '@/mock/types'

// ---------------------------------------------------------------
// Filter-tabs
// ---------------------------------------------------------------
type FilterTab = 'alle' | 'mine' | 'forfaldne' | 'afventer'

// ---------------------------------------------------------------
// Prioritets-helpers
// ---------------------------------------------------------------
function priorityColor(priority: MockTask['priority']): string {
  switch (priority) {
    case 'KRITISK': return 'bg-rose-500'
    case 'HOEJ':    return 'bg-amber-400'
    case 'MELLEM':  return 'bg-blue-400'
    case 'LAV':     return 'bg-slate-300'
  }
}

function priorityStyle(priority: MockTask['priority']): string {
  switch (priority) {
    case 'KRITISK': return 'bg-rose-50 text-rose-700'
    case 'HOEJ':    return 'bg-amber-50 text-amber-700'
    case 'MELLEM':  return 'bg-blue-50 text-blue-700'
    case 'LAV':     return 'bg-slate-50 text-slate-600'
  }
}

// ---------------------------------------------------------------
// Time group helpers
// ---------------------------------------------------------------
const TIME_GROUP_LABELS: Record<MockTask['timeGroup'], string> = {
  overdue: 'Forfaldne',
  this_week: 'Denne uge',
  next_week: 'Næste uge',
  later: 'Senere',
  no_date: 'Ingen frist',
}

const TIME_GROUP_DOTS: Record<MockTask['timeGroup'], string> = {
  overdue: 'bg-rose-500',
  this_week: 'bg-amber-400',
  next_week: 'bg-blue-400',
  later: 'bg-slate-300',
  no_date: 'bg-slate-300',
}

const TIME_GROUP_ORDER: MockTask['timeGroup'][] = ['overdue', 'this_week', 'next_week', 'later', 'no_date']

function dueDateLabel(task: MockTask): string {
  const days = task.daysUntilDue
  if (days === null) return '—'
  if (days < 0) return `${Math.abs(days)} dage forfalden`
  if (days === 0) return 'I dag'
  if (days === 1) return 'I morgen'
  return `om ${days} dage`
}

function dueDateColor(task: MockTask): string {
  if (task.daysUntilDue === null) return 'text-slate-400'
  if (task.daysUntilDue < 0) return 'text-rose-600 font-medium'
  if (task.daysUntilDue <= 7) return 'text-amber-700'
  return 'text-slate-500'
}

// ---------------------------------------------------------------
// Sort helpers
// ---------------------------------------------------------------
type SortKey = 'time' | 'priority' | 'company' | 'assignee'

function sortTasks(tasks: MockTask[], key: SortKey, dir: 'asc' | 'desc'): MockTask[] {
  const mult = dir === 'asc' ? 1 : -1
  const priorityRank = { KRITISK: 0, HOEJ: 1, MELLEM: 2, LAV: 3 }
  const timeRank = { overdue: 0, this_week: 1, next_week: 2, later: 3, no_date: 4 }
  return [...tasks].sort((a, b) => {
    let cmp = 0
    switch (key) {
      case 'time':
        cmp = timeRank[a.timeGroup] - timeRank[b.timeGroup]
        if (cmp === 0) cmp = (a.daysUntilDue ?? 99999) - (b.daysUntilDue ?? 99999)
        break
      case 'priority':
        cmp = priorityRank[a.priority] - priorityRank[b.priority]
        break
      case 'company':
        cmp = a.companyName.localeCompare(b.companyName, 'da')
        break
      case 'assignee':
        cmp = a.assignedToName.localeCompare(b.assignedToName, 'da')
        break
    }
    return cmp * mult
  })
}

// ---------------------------------------------------------------
// Hovedkomponent
// ---------------------------------------------------------------
export default function TasksPage() {
  const { activeUser, dataScenario } = usePrototype()
  const router = useRouter()

  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<FilterTab>('alle')
  const [sortKey, setSortKey] = useState<SortKey>('time')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())

  function toggleComplete(taskId: string, e: React.MouseEvent) {
    e.stopPropagation()
    setCompletedIds((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) {
        next.delete(taskId)
        toast.info('Opgave genåbnet')
      } else {
        next.add(taskId)
        toast.success('Opgave afsluttet')
      }
      return next
    })
  }

  useEffect(() => {
    const handler = () => setShowScrollTop(window.scrollY > 400)
    handler()
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  const allTasks = useMemo(() => getTasks(dataScenario), [dataScenario])
  const overdueTasks = useMemo(() => getOverdueTasks(), [])

  // Tab filtering
  const tabFiltered = useMemo<MockTask[]>(() => {
    switch (tab) {
      case 'mine':
        return allTasks.filter((t) => t.assignedTo === activeUser.id)
      case 'forfaldne':
        return allTasks.filter((t) => t.timeGroup === 'overdue')
      case 'afventer':
        return allTasks.filter((t) => t.status === 'AFVENTER')
      default:
        return allTasks
    }
  }, [allTasks, tab, activeUser.id])

  // Search filtering
  const filtered = useMemo(() => {
    if (!search.trim()) return tabFiltered
    const q = search.toLowerCase()
    return tabFiltered.filter(
      (t) => t.title.toLowerCase().includes(q) || t.companyName.toLowerCase().includes(q) || t.assignedToName.toLowerCase().includes(q),
    )
  }, [tabFiltered, search])

  const sorted = useMemo(() => sortTasks(filtered, sortKey, sortDir), [filtered, sortKey, sortDir])

  // Counts
  const counts = useMemo(() => {
    return {
      mine: allTasks.filter((t) => t.assignedTo === activeUser.id && t.status !== 'LUKKET').length,
      alle: allTasks.filter((t) => t.status !== 'LUKKET').length,
      forfaldne: allTasks.filter((t) => t.timeGroup === 'overdue').length,
      afventer: allTasks.filter((t) => t.status === 'AFVENTER').length,
    }
  }, [allTasks, activeUser.id])

  // Urgency items for pinned panel (max 5)
  // KRITISK + HOEJ + overdue prioriteret
  const urgencyItems = useMemo(() => {
    const urgent = allTasks
      .filter((t) => t.status !== 'LUKKET')
      .filter((t) => t.priority === 'KRITISK' || t.timeGroup === 'overdue')
      .sort((a, b) => {
        // Forfaldne først (sorteret efter hvor længe), dernæst kritiske
        if (a.timeGroup === 'overdue' && b.timeGroup !== 'overdue') return -1
        if (b.timeGroup === 'overdue' && a.timeGroup !== 'overdue') return 1
        return (a.daysUntilDue ?? 99999) - (b.daysUntilDue ?? 99999)
      })
    return urgent.slice(0, 5)
  }, [allTasks])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function jumpToTask(id: string) {
    setHighlightId(id)
    requestAnimationFrame(() => {
      const el = document.getElementById(`row-${id}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    setTimeout(() => setHighlightId(null), 2000)
  }

  return (
    <div className="min-h-full bg-slate-50/60 p-8">
      <div className="max-w-[1280px] mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[20px] font-semibold tracking-tight text-slate-900">Opgaver</h1>
            <p className="text-[13px] text-slate-500 mt-1">
              {counts.alle} åbne opgaver
              {counts.forfaldne > 0 && <> · <span className="text-rose-700 font-medium">{counts.forfaldne} forfaldne</span></>}
            </p>
          </div>
          <button
            type="button"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 text-white text-[12px] font-medium hover:bg-slate-800 transition-colors shadow-[0_1px_2px_rgba(15,23,42,0.1)]"
          >
            <Plus className="w-3.5 h-3.5" />
            Opret opgave
          </button>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <div className="flex-1 min-w-[280px] bg-white ring-1 ring-slate-900/[0.06] rounded-lg px-3.5 py-2.5 flex items-center gap-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Søg opgave, selskab, person..."
              className="flex-1 text-[13px] text-slate-700 placeholder:text-slate-400 bg-transparent outline-none"
            />
          </div>

          <TabPill label="Alle" count={counts.alle} active={tab === 'alle'} onClick={() => setTab('alle')} />
          <TabPill label="Mine" count={counts.mine} active={tab === 'mine'} onClick={() => setTab('mine')} />
          <TabPill
            label="Forfaldne"
            count={counts.forfaldne}
            active={tab === 'forfaldne'}
            dot="bg-rose-500"
            onClick={() => setTab('forfaldne')}
          />
          <TabPill
            label="Afventer"
            count={counts.afventer}
            active={tab === 'afventer'}
            dot="bg-amber-400"
            onClick={() => setTab('afventer')}
          />
        </div>

        {/* Pinned urgency panel */}
        {urgencyItems.length > 0 && tab === 'alle' && (
          <div className="bg-white rounded-xl ring-1 ring-slate-900/[0.06] shadow-[0_1px_2px_rgba(15,23,42,0.04)] mb-4 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[12px] font-semibold text-slate-900">Kræver handling</span>
                <span className="text-[11px] text-slate-400">({urgencyItems.length})</span>
              </div>
              {overdueTasks.length > 5 && (
                <button
                  type="button"
                  className="text-[11px] font-medium text-slate-500 hover:text-slate-900"
                  onClick={() => setTab('forfaldne')}
                >
                  Vis alle {overdueTasks.length} →
                </button>
              )}
            </div>
            <div className="divide-y divide-slate-50">
              {urgencyItems.map((task) => (
                <button
                  key={`urgent-${task.id}`}
                  type="button"
                  onClick={() => jumpToTask(task.id)}
                  className="w-full flex items-center gap-3 px-5 py-2.5 hover:bg-slate-50/60 transition-colors text-left"
                >
                  <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', priorityColor(task.priority))} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium text-slate-900 truncate">{task.title}</div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {task.companyName} · {task.assignedToName}
                    </div>
                  </div>
                  <span className={cn('text-[11px] tabular-nums shrink-0', dueDateColor(task))}>
                    {dueDateLabel(task)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* List view */}
        <div className="bg-white rounded-xl ring-1 ring-slate-900/[0.06] shadow-[0_1px_2px_rgba(15,23,42,0.04)] [overflow:clip]">
          <table className="w-full text-[12px] border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-slate-200 bg-white">
                <th className="pl-5 pr-2 py-2.5 w-8"></th>
                <th className="pr-3 py-2.5 w-1.5"></th>
                <Th label="Opgave"    active={sortKey === 'time'}     dir={sortDir} onClick={() => toggleSort('time')} />
                <Th label="Selskab"   active={sortKey === 'company'}  dir={sortDir} onClick={() => toggleSort('company')} />
                <Th label="Tildelt"   active={sortKey === 'assignee'} dir={sortDir} onClick={() => toggleSort('assignee')} />
                <Th label="Frist"     active={sortKey === 'time'}     dir={sortDir} onClick={() => toggleSort('time')} align="right" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((task, idx) => {
                const prevGroup = idx > 0 ? sorted[idx - 1].timeGroup : null
                const showSeparator = sortKey === 'time' && prevGroup !== null && prevGroup !== task.timeGroup
                const isHighlighted = highlightId === task.id
                const isCompleted = completedIds.has(task.id)
                const isOverdue = task.timeGroup === 'overdue' && !isCompleted
                return (
                  <Fragment key={task.id}>
                    {showSeparator && (
                      <tr>
                        <td colSpan={6} className="px-5 py-2 bg-slate-50/60">
                          <div className="flex items-center gap-2 text-[10px] font-medium text-slate-400 uppercase tracking-[0.1em]">
                            <span className={cn('w-1 h-1 rounded-full', TIME_GROUP_DOTS[task.timeGroup])} />
                            {TIME_GROUP_LABELS[task.timeGroup]}
                          </div>
                        </td>
                      </tr>
                    )}
                    <tr
                      id={`row-${task.id}`}
                      className={cn(
                        'border-b border-slate-100 transition-colors group/row cursor-pointer',
                        isHighlighted && 'bg-amber-50',
                        !isHighlighted && isCompleted && 'bg-slate-50/40',
                        !isHighlighted && !isCompleted && isOverdue && 'bg-rose-50/40 hover:bg-rose-50/60',
                        !isHighlighted && !isCompleted && !isOverdue && 'hover:bg-slate-50/60',
                      )}
                      onClick={() => router.push(`/proto/tasks/${task.id}`)}
                      style={{
                        contentVisibility: 'auto',
                        containIntrinsicSize: 'auto 44px',
                      }}
                    >
                      {/* Checkbox */}
                      <td className="pl-5 pr-2 py-3">
                        <button
                          type="button"
                          onClick={(e) => toggleComplete(task.id, e)}
                          className={cn(
                            'w-4 h-4 rounded flex items-center justify-center transition-all',
                            isCompleted
                              ? 'bg-emerald-500 ring-1 ring-emerald-500'
                              : 'bg-white ring-1 ring-slate-300 hover:ring-slate-500',
                          )}
                          aria-label={isCompleted ? 'Genåbn opgave' : 'Marker som afsluttet'}
                        >
                          {isCompleted && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                        </button>
                      </td>
                      {/* Priority bar */}
                      <td className="pr-3 py-3">
                        <span
                          className={cn('block w-1 h-5 rounded-full', priorityColor(task.priority))}
                          title={`Prioritet: ${task.priorityLabel}`}
                        />
                      </td>
                      <td className="pr-4 py-3">
                        <span
                          className={cn(
                            'font-medium',
                            isCompleted ? 'text-slate-400 line-through' : 'text-slate-900 group-hover/row:text-slate-950',
                          )}
                        >
                          {task.title}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/proto/portfolio/${task.companyId}`}
                          onClick={(e) => e.stopPropagation()}
                          className={cn(
                            'no-underline',
                            isCompleted ? 'text-slate-400' : 'text-slate-600 hover:text-slate-900',
                          )}
                        >
                          {task.companyName.replace(' ApS', '')}
                        </Link>
                      </td>
                      <td className={cn('px-4 py-3', isCompleted ? 'text-slate-400' : 'text-slate-600')}>
                        {task.assignedToName}
                      </td>
                      <td
                        className={cn(
                          'pl-4 pr-5 py-3 text-right tabular-nums',
                          isCompleted ? 'text-slate-400' : dueDateColor(task),
                        )}
                      >
                        {dueDateLabel(task)}
                      </td>
                    </tr>
                  </Fragment>
                )
              })}
            </tbody>
          </table>

          {sorted.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-[13px] text-slate-500 font-medium">Ingen opgaver fundet</p>
              <p className="text-[11px] text-slate-400 mt-1">Prøv et andet søgeord eller filter</p>
            </div>
          )}

          {sorted.length > 0 && (
            <div className="px-5 py-3.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
              <span>
                {sorted.length === allTasks.length
                  ? `${sorted.length} opgaver · Slut på listen`
                  : `Viser ${sorted.length} af ${allTasks.length} opgaver`}
              </span>
              <span className="text-[10px] text-slate-300">● ● ●</span>
            </div>
          )}
        </div>
      </div>

      {/* Scroll-to-top */}
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className={cn(
          'fixed bottom-6 right-6 w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-[0_4px_16px_-4px_rgba(15,23,42,0.3)] ring-1 ring-slate-900/10 transition-all duration-200',
          showScrollTop ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-2 pointer-events-none',
        )}
        aria-label="Scroll til toppen"
      >
        <ChevronUp className="w-4 h-4" />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------
// Tab pill
// ---------------------------------------------------------------
function TabPill({
  label,
  count,
  active,
  dot,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  dot?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium transition-colors bg-white ring-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)] shrink-0',
        active ? 'ring-slate-900/20 text-slate-900' : 'ring-slate-900/[0.06] text-slate-600 hover:text-slate-900',
      )}
    >
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full', dot)} />}
      {label}
      <span className={cn('text-[10px] tabular-nums', active ? 'text-slate-500' : 'text-slate-400')}>{count}</span>
    </button>
  )
}

// ---------------------------------------------------------------
// Table header
// ---------------------------------------------------------------
function Th({
  label,
  active,
  dir,
  onClick,
  align = 'left',
}: {
  label: string
  active: boolean
  dir: 'asc' | 'desc'
  onClick: () => void
  align?: 'left' | 'right'
}) {
  return (
    <th
      className={cn(
        'px-4 py-2.5 text-[10px] font-medium text-slate-500 uppercase tracking-[0.08em] cursor-pointer select-none hover:text-slate-900 transition-colors',
        align === 'right' ? 'text-right' : 'text-left',
      )}
      onClick={onClick}
    >
      <span className={cn('inline-flex items-center gap-1', align === 'right' && 'flex-row-reverse')}>
        <span className={cn(active && 'text-slate-900')}>{label}</span>
        {active && (dir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
      </span>
    </th>
  )
}
