'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Plus, Sparkles } from 'lucide-react'
import { mockCalendarEvents } from '@/mock/calendar'
import type { MockCalendarEvent } from '@/mock/types'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------
// Event-type helpers
// ---------------------------------------------------------------
type EventType = MockCalendarEvent['type']

const TYPE_META: Record<EventType, { label: string; bg: string; text: string; dot: string; pill: string }> = {
  expiry:   { label: 'Udløb',     bg: 'bg-rose-50',    text: 'text-rose-700',    dot: 'bg-rose-500',    pill: 'ring-rose-200' },
  deadline: { label: 'Frist',     bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500',   pill: 'ring-amber-200' },
  meeting:  { label: 'Møde',      bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500',    pill: 'ring-blue-200' },
  case:     { label: 'Sag',       bg: 'bg-violet-50',  text: 'text-violet-700',  dot: 'bg-violet-500',  pill: 'ring-violet-200' },
  renewal:  { label: 'Fornyelse', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', pill: 'ring-emerald-200' },
}

const EVENT_TYPES: EventType[] = ['expiry', 'deadline', 'meeting', 'case', 'renewal']

// ---------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------
const MONTHS_DA = [
  'januar', 'februar', 'marts', 'april', 'maj', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'december',
]
const DAYS_DA = ['Ma', 'Ti', 'On', 'To', 'Fr', 'Lø', 'Sø']

// "I dag" i prototype-tiden (matcher mock-data: april 2026)
const TODAY = new Date('2026-04-08')

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate()
}

function parseIso(iso: string): Date {
  return new Date(iso + 'T00:00:00Z')
}

function formatDayLabel(iso: string): string {
  const d = parseIso(iso)
  const today = new Date('2026-04-08T00:00:00Z')
  const tomorrow = new Date('2026-04-09T00:00:00Z')
  if (isSameDay(d, today)) return 'I dag'
  if (isSameDay(d, tomorrow)) return 'I morgen'
  return `${d.getUTCDate()}. ${MONTHS_DA[d.getUTCMonth()]}`
}

// ---------------------------------------------------------------
// Byg month grid (6 rækker × 7 dage)
// ---------------------------------------------------------------
interface GridCell {
  date: Date
  iso: string
  day: number
  isCurrentMonth: boolean
  isToday: boolean
}

function buildMonthGrid(year: number, month: number): GridCell[] {
  const firstDay = new Date(Date.UTC(year, month, 1))
  const jsDay = firstDay.getUTCDay() // 0 = sunday
  const mondayOffset = jsDay === 0 ? 6 : jsDay - 1
  const start = new Date(firstDay)
  start.setUTCDate(start.getUTCDate() - mondayOffset)

  const cells: GridCell[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setUTCDate(start.getUTCDate() + i)
    cells.push({
      date: d,
      iso: d.toISOString().slice(0, 10),
      day: d.getUTCDate(),
      isCurrentMonth: d.getUTCMonth() === month,
      isToday: isSameDay(d, TODAY),
    })
  }
  return cells
}

// ---------------------------------------------------------------
// Hovedkomponent
// ---------------------------------------------------------------
export default function CalendarPage() {
  const [viewDate, setViewDate] = useState(new Date(TODAY))
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [activeFilters, setActiveFilters] = useState<Set<EventType>>(new Set())

  const year = viewDate.getUTCFullYear()
  const month = viewDate.getUTCMonth()
  const isViewingCurrentMonth =
    year === TODAY.getUTCFullYear() && month === TODAY.getUTCMonth()

  const cells = useMemo(() => buildMonthGrid(year, month), [year, month])

  // Events filtered by type
  const filteredEvents = useMemo(() => {
    if (activeFilters.size === 0) return mockCalendarEvents
    return mockCalendarEvents.filter((e) => activeFilters.has(e.type))
  }, [activeFilters])

  // Events grouped by ISO date
  const eventsByDay = useMemo(() => {
    const map = new Map<string, MockCalendarEvent[]>()
    for (const e of filteredEvents) {
      if (!map.has(e.date)) map.set(e.date, [])
      map.get(e.date)!.push(e)
    }
    return map
  }, [filteredEvents])

  // Upcoming list — følger viewed month
  // Hvis man ser den aktuelle måned: "næste 14 dage fra i dag"
  // Hvis man ser en anden måned: alle events i den måned
  const upcomingEvents = useMemo(() => {
    if (isViewingCurrentMonth) {
      const from = TODAY
      const to = new Date(TODAY)
      to.setUTCDate(to.getUTCDate() + 14)
      return filteredEvents
        .filter((e) => {
          const d = parseIso(e.date)
          return d >= from && d <= to
        })
        .sort((a, b) => a.date.localeCompare(b.date))
    }
    // Viewed month events
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`
    return filteredEvents
      .filter((e) => e.date.startsWith(prefix))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [filteredEvents, isViewingCurrentMonth, year, month])

  // Upcoming grouped by day label
  const upcomingGrouped = useMemo(() => {
    const groups = new Map<string, MockCalendarEvent[]>()
    for (const e of upcomingEvents) {
      const label = formatDayLabel(e.date)
      if (!groups.has(label)) groups.set(label, [])
      groups.get(label)!.push(e)
    }
    return Array.from(groups.entries())
  }, [upcomingEvents])

  function prevMonth() {
    setViewDate((d) => {
      const next = new Date(d)
      next.setUTCMonth(next.getUTCMonth() - 1)
      return next
    })
  }
  function nextMonth() {
    setViewDate((d) => {
      const next = new Date(d)
      next.setUTCMonth(next.getUTCMonth() + 1)
      return next
    })
  }
  function goToday() {
    setViewDate(new Date(TODAY))
    setSelectedDay(TODAY.toISOString().slice(0, 10))
  }

  function toggleFilter(type: EventType) {
    setActiveFilters((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  const selectedDayEvents = selectedDay ? eventsByDay.get(selectedDay) ?? [] : []

  return (
    <div className="min-h-full bg-slate-50/60 p-8">
      <div className="max-w-[1280px] mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[20px] font-semibold tracking-tight text-slate-900">Kalender</h1>
            <p className="text-[13px] text-slate-500 mt-1">
              Udløb, frister, møder og sager samlet på én tidslinje
            </p>
          </div>
          <button
            type="button"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 text-white text-[12px] font-medium hover:bg-slate-800 transition-colors shadow-[0_1px_2px_rgba(15,23,42,0.1)]"
          >
            <Plus className="w-3.5 h-3.5" />
            Opret event
          </button>
        </div>

        {/* Navigation + filters */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          {/* Month nav */}
          <div className="flex items-center gap-1 bg-white ring-1 ring-slate-900/[0.06] rounded-lg p-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <button
              type="button"
              onClick={prevMonth}
              className="w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              aria-label="Forrige måned"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={goToday}
              className="px-3 py-1 text-[12px] font-medium text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
            >
              I dag
            </button>
            <button
              type="button"
              onClick={nextMonth}
              className="w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              aria-label="Næste måned"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="text-[15px] font-semibold text-slate-900 capitalize px-1">
            {MONTHS_DA[month]} {year}
          </div>

          <div className="flex-1" />

          {/* Filter pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {EVENT_TYPES.map((type) => {
              const meta = TYPE_META[type]
              const isActive = activeFilters.has(type)
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleFilter(type)}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors bg-white ring-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
                    isActive ? 'ring-slate-900/20 text-slate-900' : 'ring-slate-900/[0.06] text-slate-600 hover:text-slate-900',
                  )}
                >
                  <span className={cn('w-1.5 h-1.5 rounded-full', meta.dot)} />
                  {meta.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Main layout: calendar grid + sidebar */}
        <div className="grid grid-cols-[1fr_320px] gap-4">
          {/* Calendar grid */}
          <div className="bg-white rounded-xl ring-1 ring-slate-900/[0.06] shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-slate-100">
              {DAYS_DA.map((d) => (
                <div
                  key={d}
                  className="px-3 py-2.5 text-[10px] font-medium text-slate-500 uppercase tracking-[0.08em] text-center"
                >
                  {d}
                </div>
              ))}
            </div>
            {/* Grid cells */}
            <div className="grid grid-cols-7">
              {cells.map((cell, i) => {
                const events = eventsByDay.get(cell.iso) ?? []
                const isSelected = selectedDay === cell.iso
                const isLastRow = i >= 35
                const isLastCol = i % 7 === 6
                return (
                  <div
                    key={cell.iso}
                    className={cn(
                      'min-h-[100px] p-2 transition-colors relative flex flex-col cursor-pointer',
                      !isLastCol && 'border-r border-slate-100',
                      !isLastRow && 'border-b border-slate-100',
                      !cell.isCurrentMonth && 'bg-slate-50/40',
                      isSelected && 'bg-slate-50 ring-1 ring-inset ring-slate-900/20',
                      !isSelected && 'hover:bg-slate-50/60',
                    )}
                    onClick={() => setSelectedDay(isSelected ? null : cell.iso)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={cn(
                          'text-[11px] font-semibold tabular-nums flex items-center justify-center',
                          cell.isToday && 'w-5 h-5 rounded-full bg-slate-900 text-white',
                          !cell.isToday && cell.isCurrentMonth && 'text-slate-700',
                          !cell.isToday && !cell.isCurrentMonth && 'text-slate-400',
                        )}
                      >
                        {cell.day}
                      </span>
                      {events.length > 0 && !cell.isToday && (
                        <span className="text-[9px] text-slate-400 tabular-nums">{events.length}</span>
                      )}
                    </div>

                    {/* Events (max 3) — direct links */}
                    <div className="space-y-1 flex-1 min-h-0">
                      {events.slice(0, 3).map((e) => {
                        const meta = TYPE_META[e.type]
                        return (
                          <Link
                            key={e.id}
                            href={e.href ?? '#'}
                            onClick={(ev) => ev.stopPropagation()}
                            className={cn(
                              'flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium truncate no-underline hover:ring-1 hover:ring-slate-300 transition-all',
                              meta.bg,
                              meta.text,
                            )}
                            title={e.title}
                          >
                            <span className={cn('w-1 h-1 rounded-full shrink-0', meta.dot)} />
                            <span className="truncate">{e.title}</span>
                          </Link>
                        )
                      })}
                      {events.length > 3 && (
                        <button
                          type="button"
                          onClick={(ev) => {
                            ev.stopPropagation()
                            setSelectedDay(cell.iso)
                          }}
                          className="text-[9px] text-slate-500 font-medium px-1.5 py-0.5 rounded hover:bg-slate-100 hover:text-slate-900 text-left transition-colors"
                        >
                          + {events.length - 3} mere →
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Sidebar */}
          <div className="flex flex-col gap-3">
            {/* Selected day (hvis valgt) */}
            {selectedDay && selectedDayEvents.length > 0 && (
              <div className="bg-white rounded-xl ring-1 ring-slate-900/[0.06] shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100">
                  <div className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.08em]">
                    Valgt dag
                  </div>
                  <div className="text-[13px] font-semibold text-slate-900 mt-0.5">
                    {formatDayLabel(selectedDay)}
                  </div>
                </div>
                <div className="divide-y divide-slate-50">
                  {selectedDayEvents.map((e) => (
                    <EventRow key={e.id} event={e} compact />
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming / viewed month events */}
            <div className="bg-white rounded-xl ring-1 ring-slate-900/[0.06] shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <div className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.08em]">
                  {isViewingCurrentMonth ? 'Næste 14 dage fra i dag' : `Alle i ${MONTHS_DA[month]}`}
                </div>
                <div className="text-[13px] font-semibold text-slate-900 mt-0.5">
                  {isViewingCurrentMonth ? 'Kommende events' : `Events · ${MONTHS_DA[month]} ${year}`}
                </div>
              </div>

              {upcomingGrouped.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-[12px] text-slate-400">Ingen events i perioden</p>
                </div>
              ) : (
                <div className="max-h-[520px] overflow-y-auto">
                  {upcomingGrouped.map(([label, events]) => (
                    <div key={label}>
                      <div className="sticky top-0 bg-slate-50/95 backdrop-blur-sm px-4 py-1.5 border-b border-slate-100">
                        <div className="text-[10px] font-medium text-slate-500 uppercase tracking-[0.08em]">{label}</div>
                      </div>
                      {events.map((e) => (
                        <EventRow key={e.id} event={e} compact />
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------
// Event row (genbrugt i sidebar)
// ---------------------------------------------------------------
function EventRow({ event, compact }: { event: MockCalendarEvent; compact?: boolean }) {
  const meta = TYPE_META[event.type]
  const href = event.href ?? '#'
  return (
    <Link href={href} className="flex items-start gap-2.5 px-4 py-2.5 hover:bg-slate-50/60 transition-colors no-underline border-b border-slate-50 last:border-b-0">
      <span className={cn('w-1.5 h-1.5 rounded-full mt-[7px] shrink-0', meta.dot)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] font-medium text-slate-900 truncate">{event.title}</span>
          {event.aiExtracted && (
            <Sparkles className="w-2.5 h-2.5 text-violet-500 shrink-0" />
          )}
        </div>
        <div className="text-[11px] text-slate-400 truncate">{event.subtitle}</div>
      </div>
      {!compact && (
        <span className={cn('text-[9px] font-medium px-1.5 py-0.5 rounded shrink-0', meta.bg, meta.text)}>
          {meta.label}
        </span>
      )}
    </Link>
  )
}
