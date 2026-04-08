'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ChevronRight,
  CheckCircle2,
  MessageSquare,
  Activity,
  AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { getTaskById } from '@/mock/tasks'
import { getCompanyById } from '@/mock/companies'
import { cn } from '@/lib/utils'
import type { MockTask } from '@/mock/types'

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------
function statusStyle(status: MockTask['status']): string {
  switch (status) {
    case 'NY':       return 'bg-blue-50 text-blue-700 ring-blue-200'
    case 'AKTIV':    return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
    case 'AFVENTER': return 'bg-amber-50 text-amber-700 ring-amber-200'
    case 'LUKKET':   return 'bg-slate-50 text-slate-500 ring-slate-200'
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

function priorityDot(priority: MockTask['priority']): string {
  switch (priority) {
    case 'KRITISK': return 'bg-rose-500'
    case 'HOEJ':    return 'bg-amber-400'
    case 'MELLEM':  return 'bg-blue-400'
    case 'LAV':     return 'bg-slate-300'
  }
}

function dueDateLabel(task: MockTask): string {
  const days = task.daysUntilDue
  if (days === null) return 'Ingen frist'
  if (days < 0) return `Forfaldet — ${Math.abs(days)} dage siden`
  if (days === 0) return 'Forfalder i dag'
  if (days === 1) return 'Forfalder i morgen'
  return `Forfalder om ${days} dage`
}

function dueDateColor(task: MockTask): string {
  const days = task.daysUntilDue
  if (days === null) return 'text-slate-500'
  if (days < 0) return 'text-rose-700'
  if (days <= 7) return 'text-amber-700'
  return 'text-slate-900'
}

// ---------------------------------------------------------------
// Hovedkomponent
// ---------------------------------------------------------------
export default function TaskDetailPage({ params }: { params: { id: string } }) {
  const task = getTaskById(params.id)
  const [comment, setComment] = useState('')
  const [completed, setCompleted] = useState(false)

  if (!task) {
    return (
      <div className="min-h-full bg-slate-50/60 p-8">
        <div className="max-w-[1280px] mx-auto">
          <Link href="/proto/tasks" className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-900 no-underline">
            <ChevronRight className="w-3 h-3 rotate-180" />
            Opgaver
          </Link>
          <div className="mt-6 bg-white rounded-xl ring-1 ring-slate-900/[0.06] p-16 text-center">
            <p className="text-[13px] text-slate-500">Opgave ikke fundet</p>
          </div>
        </div>
      </div>
    )
  }

  const company = getCompanyById(task.companyId)

  // Fake activity feed
  const activity = [
    { dot: '#3b82f6', text: `Opgave oprettet af ${task.assignedToName}`, meta: 'For 5 dage siden' },
    { dot: '#f59e0b', text: 'Status ændret til AFVENTER', meta: 'For 3 dage siden' },
    { dot: '#a855f7', text: 'Prioritet opgraderet til HØJ', meta: 'For 1 dag siden' },
  ]

  return (
    <div className="min-h-full bg-slate-50/60 p-8">
      <div className="max-w-[1280px] mx-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-4">
          <Link href="/proto/tasks" className="hover:text-slate-900 transition-colors no-underline">
            Opgaver
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-slate-700 font-medium truncate">{task.title}</span>
        </div>

        {/* Header */}
        <div className="bg-white rounded-xl ring-1 ring-slate-900/[0.06] shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-6 mb-4">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className={cn('text-[22px] font-semibold tracking-tight', completed ? 'text-slate-400 line-through' : 'text-slate-900')}>
                  {task.title}
                </h1>
                <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded ring-1', statusStyle(completed ? 'LUKKET' : task.status))}>
                  {completed ? 'Lukket' : task.statusLabel}
                </span>
              </div>
              <div className="flex items-center gap-4 text-[12px] text-slate-500 mt-1.5 flex-wrap">
                {company && (
                  <Link href={`/proto/portfolio/${company.id}`} className="text-slate-500 hover:text-slate-900 no-underline">
                    {company.name}
                  </Link>
                )}
                <span>Opgave #{task.id.replace('task-', '').toUpperCase()}</span>
              </div>
            </div>

            {/* CTA */}
            <div className="shrink-0">
              <button
                type="button"
                onClick={() => {
                  setCompleted(!completed)
                  toast.success(completed ? 'Opgave genåbnet' : 'Opgave markeret som afsluttet')
                }}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-colors shadow-[0_1px_2px_rgba(15,23,42,0.1)]',
                  completed
                    ? 'bg-white ring-1 ring-slate-900/[0.08] text-slate-700 hover:bg-slate-50'
                    : 'bg-slate-900 text-white hover:bg-slate-800',
                )}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {completed ? 'Genåbn' : 'Marker som afsluttet'}
              </button>
            </div>
          </div>
        </div>

        {/* Key info hero */}
        <div className="bg-white rounded-xl ring-1 ring-slate-900/[0.06] shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-5 mb-4">
          <div className="grid grid-cols-4 gap-x-6 gap-y-4">
            <KeyInfo label="Prioritet">
              <span className={cn('inline-flex items-center gap-1.5 text-[12px] font-medium px-2 py-0.5 rounded', priorityStyle(task.priority))}>
                <span className={cn('w-1.5 h-1.5 rounded-full', priorityDot(task.priority))} />
                {task.priorityLabel}
              </span>
            </KeyInfo>
            <KeyInfo label="Forfaldsdato">
              <div className={cn('text-[13px] font-medium tabular-nums', dueDateColor(task))}>
                {task.dueDate ?? '—'}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">{dueDateLabel(task)}</div>
            </KeyInfo>
            <KeyInfo label="Tildelt til">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[9px] font-semibold text-slate-600">
                  {task.assignedToName.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                </div>
                <span className="text-[13px] font-medium text-slate-900">{task.assignedToName}</span>
              </div>
            </KeyInfo>
            <KeyInfo label="Selskab">
              {company ? (
                <Link href={`/proto/portfolio/${company.id}`} className="text-[13px] font-medium text-slate-900 hover:text-slate-700 no-underline">
                  {company.name.replace(' ApS', '')}
                </Link>
              ) : (
                <span className="text-[13px] text-slate-400">—</span>
              )}
            </KeyInfo>
          </div>
        </div>

        {/* Critical alert for overdue */}
        {task.timeGroup === 'overdue' && !completed && (
          <div className="bg-rose-50 ring-1 ring-rose-200/60 rounded-xl p-4 mb-4 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <div className="text-[13px] font-semibold text-slate-900">Opgaven er forfalden</div>
              <p className="text-[12px] text-slate-700 mt-0.5 leading-relaxed">
                {dueDateLabel(task)}. Overvej at eskalere eller justere fristen hvis der er gode grunde til forsinkelsen.
              </p>
            </div>
          </div>
        )}

        {/* Sections */}
        <div className="space-y-4">
          {/* Kommentarer */}
          <section className="bg-white rounded-xl ring-1 ring-slate-900/[0.06] shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
            <header className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100">
              <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
              <h2 className="text-[13px] font-semibold text-slate-900">Kommentarer</h2>
              <span className="text-[10px] text-slate-400">(0)</span>
            </header>
            <div className="p-5">
              <p className="text-[12px] text-slate-400 mb-4">Ingen kommentarer endnu. Tilføj den første.</p>

              {/* Comment input */}
              <div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && comment.trim()) {
                        toast.success('Kommentar tilføjet (simuleret)')
                        setComment('')
                      }
                    }}
                    placeholder="Skriv en kommentar..."
                    className="flex-1 bg-slate-50 ring-1 ring-slate-900/[0.06] rounded-lg px-3 py-2 text-[12px] text-slate-700 placeholder:text-slate-400 outline-none focus:ring-slate-900/20 transition-colors"
                  />
                  <button
                    type="button"
                    disabled={!comment.trim()}
                    onClick={() => {
                      toast.success('Kommentar tilføjet (simuleret)')
                      setComment('')
                    }}
                    className={cn(
                      'px-3.5 py-2 rounded-lg text-[12px] font-medium transition-colors',
                      comment.trim() ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-slate-100 text-slate-400 cursor-not-allowed',
                    )}
                  >
                    Send
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5 ml-1">
                  Tryk <kbd className="bg-slate-100 ring-1 ring-slate-200 rounded px-1 py-0.5 text-[9px] font-mono">Enter</kbd> for at sende
                </p>
              </div>
            </div>
          </section>

          {/* Aktivitet */}
          <section className="bg-white rounded-xl ring-1 ring-slate-900/[0.06] shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
            <header className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100">
              <Activity className="w-3.5 h-3.5 text-slate-400" />
              <h2 className="text-[13px] font-semibold text-slate-900">Aktivitet</h2>
            </header>
            <div className="p-5">
              <div className="space-y-0">
                {activity.map((item, i) => (
                  <div key={i} className="flex gap-3 py-2 border-b border-slate-50 last:border-b-0">
                    <div className="w-1.5 h-1.5 rounded-full mt-[7px] shrink-0" style={{ backgroundColor: item.dot }} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-medium text-slate-800 leading-snug">{item.text}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{item.meta}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------
// Key info field
// ---------------------------------------------------------------
function KeyInfo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.08em] mb-1.5">{label}</div>
      {children}
    </div>
  )
}
