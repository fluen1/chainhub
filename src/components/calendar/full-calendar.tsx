'use client'

import { useMemo, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  AlertTriangle,
  Users,
  Briefcase,
  RefreshCw,
  ClipboardCheck,
  CalendarPlus,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { MONTH_NAMES_DA, WEEKDAYS_DA_SHORT } from '@/lib/calendar-constants'
import type { CalendarEvent, CalendarEventType } from '@/types/ui'
import { createTask } from '@/actions/tasks'
import { toast } from 'sonner'
import { ExportButton } from '@/components/ui/export-button'
import { EmptyState } from '@/components/ui/empty-state'

// ---------------------------------------------------------------
// Constants
// ---------------------------------------------------------------

const EVENT_TYPE_LABELS: Record<CalendarEventType, string> = {
  expiry: 'Udløb',
  deadline: 'Frist',
  meeting: 'Besøg/møde',
  case: 'Sag',
  renewal: 'Fornyelse',
}

const ALL_EVENT_TYPES: CalendarEventType[] = ['expiry', 'deadline', 'meeting', 'case', 'renewal']

const EVENT_TYPE_ICONS: Record<CalendarEventType, typeof Clock> = {
  expiry: AlertTriangle,
  deadline: Clock,
  meeting: Users,
  case: Briefcase,
  renewal: RefreshCw,
}

// Tailwind-only farver — ingen inline hex
const EVENT_TYPE_STYLES: Record<
  CalendarEventType,
  { bg: string; text: string; badge: string; bar: string; borderL: string }
> = {
  expiry: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    badge: 'bg-red-100 text-red-700',
    bar: 'bg-red-500',
    borderL: 'border-l-red-500',
  },
  deadline: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-700',
    bar: 'bg-amber-500',
    borderL: 'border-l-amber-500',
  },
  meeting: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    badge: 'bg-blue-100 text-blue-700',
    bar: 'bg-blue-500',
    borderL: 'border-l-blue-500',
  },
  case: {
    bg: 'bg-violet-50',
    text: 'text-violet-700',
    badge: 'bg-violet-100 text-violet-700',
    bar: 'bg-violet-500',
    borderL: 'border-l-violet-500',
  },
  renewal: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    badge: 'bg-emerald-100 text-emerald-700',
    bar: 'bg-emerald-500',
    borderL: 'border-l-emerald-500',
  },
}

// ---------------------------------------------------------------
// URL helper — byg search params med filter-persistence
// ---------------------------------------------------------------

function buildUrl(
  pathname: string,
  monthStr: string,
  hiddenTypes: Set<CalendarEventType>,
  day?: number | null
) {
  const params = new URLSearchParams()
  params.set('month', monthStr)
  if (day) params.set('day', String(day))
  if (hiddenTypes.size > 0) params.set('hide', Array.from(hiddenTypes).join(','))
  return `${pathname}?${params.toString()}`
}

// ---------------------------------------------------------------
// Component
// ---------------------------------------------------------------

interface FullCalendarProps {
  events: CalendarEvent[]
  year: number
  month: number
  selectedDay: number | null
  todayISO: string
}

export function FullCalendar({ events, year, month, selectedDay, todayISO }: FullCalendarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Filter state — persisted i URL via ?hide=expiry,case
  const hiddenTypes = useMemo(() => {
    const hideParam = searchParams.get('hide')
    if (!hideParam) return new Set<CalendarEventType>()
    return new Set(
      hideParam
        .split(',')
        .filter((t): t is CalendarEventType => ALL_EVENT_TYPES.includes(t as CalendarEventType))
    )
  }, [searchParams])

  const [quickAddMode, setQuickAddMode] = useState<'task' | null>(null)
  const [quickAddLoading, setQuickAddLoading] = useState(false)

  const monthStr = `${year}-${String(month).padStart(2, '0')}`

  // Navigation — alle bevarer filter-state
  const navigate = (newMonthStr: string, day?: number | null) => {
    router.push(buildUrl(pathname, newMonthStr, hiddenTypes, day), { scroll: false })
  }

  const prevMonth = () => {
    const d = new Date(year, month - 2, 1)
    navigate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const nextMonth = () => {
    const d = new Date(year, month, 1)
    navigate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const goToday = () => {
    const today = new Date()
    navigate(
      `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`,
      today.getDate()
    )
  }
  const selectDay = (day: number) => {
    navigate(monthStr, day === selectedDay ? null : day)
  }

  // Toggle event type filter — persisted i URL
  const toggleType = (type: CalendarEventType) => {
    const next = new Set(hiddenTypes)
    if (next.has(type)) next.delete(type)
    else next.add(type)
    router.push(buildUrl(pathname, monthStr, next, selectedDay), { scroll: false })
  }

  // Build calendar grid
  const daysInMonth = new Date(year, month, 0).getDate()
  const startDow = (new Date(year, month - 1, 1).getDay() + 6) % 7

  // Filter + group events
  const filteredEvents = useMemo(
    () => events.filter((e) => !hiddenTypes.has(e.type)),
    [events, hiddenTypes]
  )

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const e of filteredEvents) {
      if (!map.has(e.date)) map.set(e.date, [])
      map.get(e.date)!.push(e)
    }
    return map
  }, [filteredEvents])

  // Selected day
  const selectedDateStr = selectedDay ? `${monthStr}-${String(selectedDay).padStart(2, '0')}` : null
  const selectedEvents = selectedDateStr ? (eventsByDate.get(selectedDateStr) ?? []) : null

  const MAX_SIDEBAR_EVENTS = 20
  const allMonthEvents = !selectedDay ? filteredEvents : null
  const visibleMonthEvents = allMonthEvents?.slice(0, MAX_SIDEBAR_EVENTS) ?? []
  const hiddenEventCount = allMonthEvents
    ? Math.max(0, allMonthEvents.length - MAX_SIDEBAR_EVENTS)
    : 0

  // Quick-add inline task
  async function handleQuickAddTask(formData: FormData) {
    if (!selectedDay) return
    setQuickAddLoading(true)
    const title = formData.get('title') as string
    if (!title.trim()) {
      toast.error('Indtast en titel')
      setQuickAddLoading(false)
      return
    }
    const dateISO = `${monthStr}-${String(selectedDay).padStart(2, '0')}`
    const result = await createTask({
      title,
      dueDate: dateISO,
      priority: 'MELLEM',
    })
    setQuickAddLoading(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Opgave oprettet')
      setQuickAddMode(null)
      router.refresh()
    }
  }

  return (
    <div>
      {/* Header — responsive */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Kalender</h1>
          <p className="mt-0.5 text-sm text-gray-500">Kontrakter, sager, besøg og frister samlet</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton entity="visits" label="Eksportér besøg" />
          <button
            onClick={goToday}
            className="h-10 px-3.5 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            I dag
          </button>
          <button
            onClick={prevMonth}
            className="flex items-center justify-center h-10 w-10 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
            aria-label="Forrige måned"
          >
            <ChevronLeft className="h-4 w-4 text-gray-600" />
          </button>
          <div className="text-sm font-semibold text-gray-900 min-w-[140px] text-center">
            {MONTH_NAMES_DA[month - 1]} {year}
          </div>
          <button
            onClick={nextMonth}
            className="flex items-center justify-center h-10 w-10 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
            aria-label="Næste måned"
          >
            <ChevronRight className="h-4 w-4 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Legend — clickable filter, horizontal on mobile */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {ALL_EVENT_TYPES.map((type) => {
          const styles = EVENT_TYPE_STYLES[type]
          const Icon = EVENT_TYPE_ICONS[type]
          const isHidden = hiddenTypes.has(type)
          return (
            <button
              key={type}
              onClick={() => toggleType(type)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border',
                isHidden
                  ? 'border-gray-200 bg-white text-gray-400 line-through'
                  : `border-transparent ${styles.bg} ${styles.text}`
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {EVENT_TYPE_LABELS[type]}
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
        {/* Calendar Grid */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-gray-100">
            {WEEKDAYS_DA_SHORT.map((d) => (
              <div
                key={d}
                className="py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7" role="grid" aria-label="Kalendergrid">
            {/* Empty cells */}
            {Array.from({ length: startDow }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="min-h-[80px] sm:min-h-[100px] border-b border-r border-gray-50 bg-gray-50/30"
                role="gridcell"
                aria-disabled="true"
              />
            ))}

            {/* Day cells */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dateStr = `${monthStr}-${String(day).padStart(2, '0')}`
              const dayEvents = eventsByDate.get(dateStr) ?? []
              const isToday = dateStr === todayISO
              const isSelected = day === selectedDay
              const isWeekend = (startDow + i) % 7 >= 5

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => selectDay(day)}
                  role="gridcell"
                  aria-label={`${day}. ${MONTH_NAMES_DA[month - 1]} ${year}${dayEvents.length > 0 ? `, ${dayEvents.length} events` : ''}`}
                  aria-selected={isSelected}
                  className={cn(
                    'min-h-[80px] sm:min-h-[100px] border-b border-r border-gray-50 p-1.5 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-400',
                    isSelected && 'bg-blue-50/60 ring-1 ring-inset ring-blue-200',
                    !isSelected && 'hover:bg-gray-50/60',
                    isWeekend && !isSelected && 'bg-gray-50/80'
                  )}
                >
                  <div
                    className={cn(
                      'text-xs font-medium mb-1 w-7 h-7 flex items-center justify-center rounded-full',
                      isToday && 'bg-blue-600 text-white',
                      !isToday && 'text-gray-700'
                    )}
                  >
                    {day}
                  </div>
                  {/* Desktop: badge med ikon + tekst. Mobil: farvede dots */}
                  <div className="space-y-0.5">
                    {/* Desktop badges */}
                    <div className="hidden sm:block space-y-0.5">
                      {dayEvents.slice(0, 2).map((e) => {
                        const s = EVENT_TYPE_STYLES[e.type]
                        const Icon = EVENT_TYPE_ICONS[e.type]
                        return (
                          <div
                            key={e.id}
                            className={cn(
                              'flex items-center gap-1 rounded px-1 py-0.5 text-xs font-medium border-l-2',
                              s.bg,
                              s.text,
                              s.borderL
                            )}
                          >
                            <Icon className="h-3 w-3 shrink-0" />
                            <span className="truncate">{e.title}</span>
                          </div>
                        )
                      })}
                      {dayEvents.length > 2 && (
                        <div className="text-xs text-gray-500 px-1 font-medium">
                          +{dayEvents.length - 2} mere
                        </div>
                      )}
                    </div>
                    {/* Mobile: farvede dots */}
                    {dayEvents.length > 0 && (
                      <div className="flex gap-0.5 sm:hidden mt-0.5">
                        {dayEvents.slice(0, 4).map((e) => (
                          <div
                            key={e.id}
                            className={cn(
                              'w-1.5 h-1.5 rounded-full',
                              EVENT_TYPE_STYLES[e.type].bar
                            )}
                          />
                        ))}
                        {dayEvents.length > 4 && (
                          <span className="text-[10px] text-gray-400 leading-none">+</span>
                        )}
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Right Panel */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            {selectedEvents !== null && selectedDateStr ? (
              <>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {selectedDay}. {MONTH_NAMES_DA[month - 1].toLowerCase()} {year}
                  </div>
                  <button
                    onClick={() => navigate(monthStr)}
                    className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
                    aria-label="Luk dagvisning"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {selectedEvents.length === 0 ? (
                  <EmptyState
                    icon={CalendarPlus}
                    title="Ingen events"
                    description="Ingen begivenheder på denne dag."
                    variant="compact"
                  />
                ) : (
                  <div className="space-y-1.5">
                    {selectedEvents.map((e) => (
                      <EventCard key={e.id} event={e} />
                    ))}
                  </div>
                )}
                {/* Quick-add inline */}
                <div className="mt-4 pt-3 border-t border-gray-100">
                  {quickAddMode === 'task' ? (
                    <form action={handleQuickAddTask} className="space-y-2">
                      <label className="block text-xs font-medium text-gray-700">
                        Ny opgave — {selectedDay}. {MONTH_NAMES_DA[month - 1].toLowerCase()}
                      </label>
                      <input
                        name="title"
                        type="text"
                        autoFocus
                        required
                        placeholder="Hvad skal gøres?"
                        className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={quickAddLoading}
                          className="flex-1 rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                          {quickAddLoading ? 'Opretter...' : 'Opret opgave'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setQuickAddMode(null)}
                          className="rounded-md border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                          Annuller
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        Opret på denne dag
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setQuickAddMode('task')}
                          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs font-medium text-gray-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                        >
                          <ClipboardCheck className="h-4 w-4" />
                          Ny opgave
                        </button>
                        <Link
                          href={`/visits/new?visitDate=${selectedDateStr}`}
                          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs font-medium text-gray-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-colors no-underline"
                        >
                          <CalendarPlus className="h-4 w-4" />
                          Nyt besøg
                        </Link>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : allMonthEvents !== null ? (
              <>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Alle events · {MONTH_NAMES_DA[month - 1].toLowerCase()}
                </div>
                {visibleMonthEvents.length === 0 ? (
                  <EmptyState
                    icon={CalendarPlus}
                    title="Ingen events denne måned"
                    description="Klik på en dag for at oprette."
                    variant="compact"
                  />
                ) : (
                  <>
                    <div className="space-y-1">
                      {visibleMonthEvents.map((e) => (
                        <EventCard key={e.id} event={e} />
                      ))}
                    </div>
                    {hiddenEventCount > 0 && (
                      <p className="text-xs text-gray-500 text-center mt-3 pt-2 border-t border-gray-100">
                        +{hiddenEventCount} flere events — klik på en dag for detaljer
                      </p>
                    )}
                  </>
                )}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------
// Event routes
// ---------------------------------------------------------------

const EVENT_TYPE_ROUTES: Record<CalendarEventType, string> = {
  expiry: '/contracts',
  deadline: '/tasks',
  meeting: '/visits',
  case: '/cases',
  renewal: '/contracts',
}

function eventHref(event: CalendarEvent): string {
  const rawId = event.id.replace(/^(contract|task|visit|case)-/, '')
  const base = EVENT_TYPE_ROUTES[event.type]
  return event.type === 'deadline' ? base : `${base}/${rawId}`
}

// ---------------------------------------------------------------
// EventCard
// ---------------------------------------------------------------

function EventCard({ event }: { event: CalendarEvent }) {
  const styles = EVENT_TYPE_STYLES[event.type]
  const Icon = EVENT_TYPE_ICONS[event.type]
  const href = eventHref(event)

  return (
    <Link
      href={href}
      className="flex items-start gap-3 rounded-lg p-2.5 hover:bg-gray-50 transition-colors no-underline group"
    >
      <div className={cn('w-1 self-stretch rounded-full shrink-0', styles.bar)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span
            className={cn(
              'flex items-center gap-1 text-xs font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded',
              styles.badge
            )}
          >
            <Icon className="h-3 w-3" />
            {EVENT_TYPE_LABELS[event.type]}
          </span>
          <span className="text-xs text-gray-500">
            {new Date(event.date).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })}
          </span>
        </div>
        <div className="text-sm font-medium text-gray-900 group-hover:text-blue-600 truncate">
          {event.title}
        </div>
        <div className="text-xs text-gray-500">{event.subtitle}</div>
      </div>
    </Link>
  )
}
