'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { usePrototype } from '@/components/prototype/PrototypeProvider'
import { InsightCard } from '@/components/prototype/InsightCard'
import { CollapsibleSection } from '@/components/ui/CollapsibleSection'
import { getTasks, getOverdueTasks } from '@/mock/tasks'
import { getInsights } from '@/mock/insights'
import { cn } from '@/lib/utils'
import type { MockTask } from '@/mock/types'

type FilterTab = 'mine' | 'alle' | 'forfaldne' | 'afventer'

function priorityBadgeClass(priority: MockTask['priority']): string {
  switch (priority) {
    case 'KRITISK': return 'bg-red-100 text-red-700'
    case 'HOEJ': return 'bg-orange-100 text-orange-700'
    case 'MELLEM': return 'bg-blue-100 text-blue-700'
    case 'LAV': return 'bg-gray-100 text-gray-600'
    default: return 'bg-gray-100 text-gray-600'
  }
}

function borderColorForGroup(group: MockTask['timeGroup']): string {
  switch (group) {
    case 'overdue': return 'border-l-red-500'
    case 'this_week': return 'border-l-amber-500'
    default: return 'border-l-gray-200'
  }
}

function dueDateLabel(task: MockTask): string {
  const days = task.daysUntilDue
  if (days === null) return 'Ingen forfaldsdato'
  if (days < 0) return `${Math.abs(days)} dage forfalden`
  if (days === 0) return 'Forfalder i dag'
  if (days === 1) return 'Forfalder i morgen'
  return `om ${days} dage`
}

function dueDateColor(task: MockTask): string {
  if (task.daysUntilDue === null) return 'text-gray-400'
  if (task.daysUntilDue < 0) return 'text-red-600 font-medium'
  if (task.daysUntilDue <= 7) return 'text-amber-600'
  return 'text-gray-500'
}

interface TaskItemProps {
  task: MockTask
}

function TaskItem({ task }: TaskItemProps) {
  const router = useRouter()

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(`/proto/tasks/${task.id}`)}
      onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/proto/tasks/${task.id}`) }}
      className={cn(
        'flex items-start gap-4 px-5 py-3 border-l-4 hover:bg-gray-50 transition-colors border-b last:border-b-0 cursor-pointer',
        borderColorForGroup(task.timeGroup),
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-900 truncate">{task.title}</span>
          <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0', priorityBadgeClass(task.priority))}>
            {task.priorityLabel}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <Link
            href={`/proto/portfolio/${task.companyId}`}
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
          >
            {task.companyName}
          </Link>
          <span className="text-gray-300">·</span>
          <span className="text-xs text-gray-500">{task.assignedToName}</span>
          <span className="text-gray-300">·</span>
          <span className={cn('text-xs', dueDateColor(task))}>
            {dueDateLabel(task)}
          </span>
        </div>
      </div>
    </div>
  )
}

interface TimeGroupConfig {
  key: MockTask['timeGroup']
  label: string
  defaultOpen: boolean
  headerClass?: string
}

const TIME_GROUPS: TimeGroupConfig[] = [
  { key: 'overdue', label: 'Forfaldne', defaultOpen: true, headerClass: 'text-red-700' },
  { key: 'this_week', label: 'Denne uge', defaultOpen: true },
  { key: 'next_week', label: 'Næste uge', defaultOpen: true },
  { key: 'later', label: 'Senere', defaultOpen: false },
  { key: 'no_date', label: 'Ingen forfaldsdato', defaultOpen: false },
]

export default function TasksPage() {
  const { activeUser, dataScenario } = usePrototype()
  const [activeTab, setActiveTab] = useState<FilterTab>('alle')
  const [search, setSearch] = useState('')

  const allTasks = getTasks(dataScenario)
  const overdueTasks = getOverdueTasks()
  const insights = getInsights('tasks', activeUser.role, dataScenario)

  // Tab-filtrering
  const tabFiltered = useMemo<MockTask[]>(() => {
    switch (activeTab) {
      case 'mine':
        return allTasks.filter((t) => t.assignedTo === activeUser.id)
      case 'forfaldne':
        return allTasks.filter((t) => t.timeGroup === 'overdue')
      case 'afventer':
        return allTasks.filter((t) => t.status === 'AFVENTER')
      default:
        return allTasks
    }
  }, [allTasks, activeTab, activeUser.id])

  // Søgning
  const filtered = useMemo<MockTask[]>(() => {
    if (!search.trim()) return tabFiltered
    const q = search.toLowerCase()
    return tabFiltered.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.companyName.toLowerCase().includes(q)
    )
  }, [tabFiltered, search])

  const openCount = filtered.filter((t) => t.status !== 'LUKKET').length
  const overdueCount = filtered.filter((t) => t.timeGroup === 'overdue').length

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'mine', label: 'Mine' },
    { key: 'alle', label: 'Alle' },
    { key: 'forfaldne', label: 'Forfaldne' },
    { key: 'afventer', label: 'Afventer' },
  ]

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Overskrift */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Opgaver</h1>
        <p className="mt-1 text-sm text-gray-500">
          {openCount} åbne opgaver · {overdueCount} forfaldne
        </p>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="space-y-2">
          {insights.map((ins) => (
            <InsightCard key={ins.id} insight={ins} />
          ))}
        </div>
      )}

      {/* Filter + søgning */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        {/* Faner */}
        <div className="flex gap-1 flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-md font-medium transition-colors',
                activeTab === tab.key
                  ? 'bg-gray-900 text-white'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50',
              )}
            >
              {tab.label}
              {tab.key === 'forfaldne' && overdueTasks.length > 0 && (
                <span className="ml-1.5 inline-flex items-center rounded-full bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
                  {overdueTasks.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Søgning */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Søg på titel eller selskab..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-gray-400"
          />
        </div>
      </div>

      {/* Tidsgrupperinger */}
      {filtered.length === 0 ? (
        <div className="text-sm text-gray-500 text-center py-12 bg-white rounded-lg border">
          Ingen opgaver
        </div>
      ) : (
        <div className="space-y-4">
          {TIME_GROUPS.map((groupConfig) => {
            const groupTasks = filtered.filter((t) => t.timeGroup === groupConfig.key)
            if (groupTasks.length === 0) return null

            return (
              <CollapsibleSection
                key={groupConfig.key}
                title={groupConfig.label}
                count={groupTasks.length}
                defaultOpen={groupConfig.defaultOpen}
              >
                <div className="divide-y divide-gray-100">
                  {groupTasks.map((t) => (
                    <TaskItem key={t.id} task={t} />
                  ))}
                </div>
              </CollapsibleSection>
            )
          })}
        </div>
      )}
    </div>
  )
}
