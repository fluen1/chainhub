'use client'

import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CalendarEvent, CalendarEventType } from '@/types/ui'
import { getEventTypeColor } from '@/types/ui'

const EVENT_TYPE_LABELS: Record<CalendarEventType, string> = {
  expiry: 'Udløb',
  deadline: 'Frist',
  meeting: 'Besøg/møde',
  case: 'Sag',
  renewal: 'Fornyelse',
}

const MONTH_NAMES = [
  'Januar', 'Februar', 'Marts', 'April', 'Maj', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'December',
]
const DAY_NAMES = ['Ma', 'Ti', 'On', 'To', 'Fr', 'Lø', 'Sø']

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

  const monthStr = `${year}-${String(month).padStart(2, '0')}`

  // Navigation helpers
  const prevMonth = () => {
    const d = new Date(year, month - 2, 1)
    router.push(`${pathname}?month=${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const nextMonth = () => {
    const d = new Date(year, month, 1)
    router.push(`${pathname}?month=${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const selectDay = (day: number) => {
    router.push(`${pathname}?month=${monthStr}&day=${day}`, { scroll: false })
  }

  // Build calendar grid
  const firstDayOfMonth = new Date(year, month - 1, 1)
  const daysInMonth = new Date(year, month, 0).getDate()
  // Monday = 0, Sunday = 6
  const startDow = (firstDayOfMonth.getDay() + 6) % 7

  // Group events by date
  const eventsByDate = new Map<string, CalendarEvent[]>()
  for (const e of events) {
    if (!eventsByDate.has(e.date)) eventsByDate.set(e.date, [])
    eventsByDate.get(e.date)!.push(e)
  }

  // Selected day events
  const selectedDateStr = selectedDay
    ? `${monthStr}-${String(selectedDay).padStart(2, '0')}`
    : null
  const selectedEvents = selectedDateStr
    ? (eventsByDate.get(selectedDateStr) ?? [])
    : null

  // Upcoming 7 days events (when no day selected)
  const upcoming = !selectedDay
    ? events
        .filter((e) => {
          const eventDate = new Date(e.date)
          const today = new Date(todayISO)
          const diff = (eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
          return diff >= 0 && diff <= 7
        })
        .slice(0, 8)
    : null

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Kalender</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Kontrakter, sager, besøg og frister samlet
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="flex items-center justify-center h-9 w-9 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
            aria-label="Forrige måned"
          >
            <ChevronLeft className="h-4 w-4 text-gray-600" />
          </button>
          <div className="text-sm font-semibold text-gray-900 min-w-[140px] text-center">
            {MONTH_NAMES[month - 1]} {year}
          </div>
          <button
            onClick={nextMonth}
            className="flex items-center justify-center h-9 w-9 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
            aria-label="Næste måned"
          >
            <ChevronRight className="h-4 w-4 text-gray-600" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_320px] gap-5">
        {/* Calendar Grid */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-gray-100">
            {DAY_NAMES.map((d) => (
              <div
                key={d}
                className="py-2.5 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wider"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {/* Empty cells before first day */}
            {Array.from({ length: startDow }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="min-h-[100px] border-b border-r border-gray-50 bg-gray-50/30"
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
                <div
                  key={day}
                  onClick={() => selectDay(day)}
                  className={cn(
                    'min-h-[100px] border-b border-r border-gray-50 p-1.5 cursor-pointer transition-colors',
                    isSelected && 'bg-blue-50/60 ring-1 ring-inset ring-blue-200',
                    !isSelected && 'hover:bg-gray-50/60',
                    isWeekend && !isSelected && 'bg-gray-50/20'
                  )}
                >
                  <div
                    className={cn(
                      'text-[12px] font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full',
                      isToday && 'bg-blue-600 text-white',
                      !isToday && 'text-gray-700'
                    )}
                  >
                    {day}
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map((e) => (
                      <div
                        key={e.id}
                        className="flex items-center gap-1 rounded px-1 py-0.5 text-[10px] font-medium truncate"
                        style={{
                          backgroundColor: `${getEventTypeColor(e.type)}15`,
                          borderLeft: `2px solid ${getEventTypeColor(e.type)}`,
                          color: getEventTypeColor(e.type),
                        }}
                      >
                        <span className="truncate">{e.title}</span>
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-[9px] text-gray-400 px-1">
                        +{dayEvents.length - 3} mere
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right Panel */}
        <div className="space-y-4">
          {/* Selected day events OR upcoming */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            {selectedEvents !== null ? (
              <>
                <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  {selectedDay}. {MONTH_NAMES[month - 1].toLowerCase()} {year}
                </div>
                {selectedEvents.length === 0 ? (
                  <p className="text-sm text-gray-400 py-4 text-center">
                    Ingen events denne dag
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedEvents.map((e) => (
                      <EventCard key={e.id} event={e} />
                    ))}
                  </div>
                )}
              </>
            ) : upcoming !== null ? (
              <>
                <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Kommende 7 dage
                </div>
                {upcoming.length === 0 ? (
                  <p className="text-sm text-gray-400 py-4 text-center">
                    Ingen events de næste 7 dage
                  </p>
                ) : (
                  <div className="space-y-2">
                    {upcoming.map((e) => (
                      <EventCard key={e.id} event={e} />
                    ))}
                  </div>
                )}
              </>
            ) : null}
          </div>

          {/* Legend */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Event-typer
            </div>
            <div className="space-y-2">
              {(
                Object.entries(EVENT_TYPE_LABELS) as [CalendarEventType, string][]
              ).map(([type, label]) => (
                <div key={type} className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: getEventTypeColor(type) }}
                  />
                  <span className="text-xs text-gray-600">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function EventCard({ event }: { event: CalendarEvent }) {
  const color = getEventTypeColor(event.type)
  const href = event.id.startsWith('contract-')
    ? `/contracts/${event.id.replace('contract-', '')}`
    : event.id.startsWith('task-')
      ? '/tasks'
      : event.id.startsWith('visit-')
        ? `/visits/${event.id.replace('visit-', '')}`
        : event.id.startsWith('case-')
          ? `/cases/${event.id.replace('case-', '')}`
          : '#'

  return (
    <Link
      href={href}
      className="flex items-start gap-3 rounded-lg p-2.5 hover:bg-gray-50 transition-colors no-underline"
    >
      <div
        className="w-1 h-8 rounded-full shrink-0 mt-0.5"
        style={{ backgroundColor: color }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-medium text-gray-900 truncate">
          {event.title}
        </div>
        <div className="text-[11px] text-gray-400">{event.subtitle}</div>
      </div>
      <div className="text-[10px] text-gray-400 shrink-0">
        {new Date(event.date).toLocaleDateString('da-DK', {
          day: 'numeric',
          month: 'short',
        })}
      </div>
    </Link>
  )
}
