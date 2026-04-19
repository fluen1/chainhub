'use client'

import { useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { MONTH_NAMES_DA, MONTH_NAMES_DA_SHORT, WEEKDAYS_DA_SHORT } from '@/lib/calendar-constants'
import { getEventTypeColor, type CalendarEvent, type CalendarEventType } from '@/types/ui'

const LEGEND: { type: CalendarEventType; label: string; color: string }[] = [
  { type: 'expiry', label: 'Udløb', color: '#ef4444' },
  { type: 'deadline', label: 'Frist', color: '#f59e0b' },
  { type: 'meeting', label: 'Besøg/møde', color: '#3b82f6' },
  { type: 'case', label: 'Sag', color: '#8b5cf6' },
  { type: 'renewal', label: 'Fornyelse', color: '#22c55e' },
]

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number) {
  const day = new Date(year, month - 1, 1).getDay()
  return day === 0 ? 6 : day - 1
}

function formatEventDate(dateStr: string, today: string): string {
  if (dateStr === today) return 'I dag'
  const d = new Date(dateStr)
  return `${d.getDate()}. ${MONTH_NAMES_DA_SHORT[d.getMonth()]}`
}

export interface CalendarWidgetProps {
  events: CalendarEvent[]
  upcoming: CalendarEvent[]
  today?: string // 'YYYY-MM-DD' — defaults to new Date()
  fullCalendarHref?: string // defaults to /calendar
}

export function CalendarWidget({
  events,
  upcoming,
  today = new Date().toISOString().slice(0, 10),
  fullCalendarHref = '/calendar',
}: CalendarWidgetProps) {
  const initialYear = parseInt(today.slice(0, 4), 10)
  const initialMonth = parseInt(today.slice(5, 7), 10)
  const [year, setYear] = useState(initialYear)
  const [month, setMonth] = useState(initialMonth)

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfWeek(year, month)

  const prevMonthDays = getDaysInMonth(year, month === 1 ? 12 : month - 1)
  const prevDays = Array.from({ length: firstDay }, (_, i) => prevMonthDays - firstDay + 1 + i)
  const currentDays = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const totalCells = prevDays.length + currentDays.length
  const nextDays = Array.from({ length: (7 - (totalCells % 7)) % 7 }, (_, i) => i + 1)

  function getDotsForDay(day: number): CalendarEvent[] {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return events.filter((e) => e.date === dateStr).slice(0, 3)
  }

  function isToday(day: number): boolean {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` === today
  }

  function prevMonth() {
    if (month === 1) {
      setYear(year - 1)
      setMonth(12)
    } else setMonth(month - 1)
  }

  function nextMonth() {
    if (month === 12) {
      setYear(year + 1)
      setMonth(1)
    } else setMonth(month + 1)
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-semibold text-slate-900">
          {MONTH_NAMES_DA[month - 1]} {year}
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={prevMonth}
            aria-label="Forrige måned"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={nextMonth}
            aria-label="Næste måned"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
          >
            ›
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-0.5 mb-4">
        {WEEKDAYS_DA_SHORT.map((d) => (
          <div key={d} className="py-1 text-center text-[11px] font-medium text-gray-500">
            {d}
          </div>
        ))}
        {prevDays.map((d) => (
          <div
            key={`prev-${d}`}
            className="py-1.5 text-center text-[13px] text-gray-300 rounded-lg"
          >
            {d}
            <div className="flex justify-center gap-0.5 mt-0.5 min-h-[6px]" />
          </div>
        ))}
        {currentDays.map((d) => {
          const dots = getDotsForDay(d)
          return (
            <div
              key={d}
              className={cn(
                'py-1.5 text-center text-[13px] font-medium rounded-lg cursor-pointer transition-colors',
                isToday(d)
                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                  : 'text-slate-500 hover:bg-slate-50'
              )}
            >
              {d}
              <div className="flex justify-center gap-0.5 mt-0.5 min-h-[6px]">
                {dots.map((ev) => (
                  <div
                    key={ev.id}
                    className="h-[5px] w-[5px] rounded-full"
                    style={{ backgroundColor: isToday(d) ? '#fff' : getEventTypeColor(ev.type) }}
                  />
                ))}
              </div>
            </div>
          )
        })}
        {nextDays.map((d) => (
          <div
            key={`next-${d}`}
            className="py-1.5 text-center text-[13px] text-gray-300 rounded-lg"
          >
            {d}
            <div className="flex justify-center gap-0.5 mt-0.5 min-h-[6px]" />
          </div>
        ))}
      </div>

      <div className="h-px bg-slate-100 mb-3.5" />

      <div className="text-xs font-semibold uppercase tracking-[0.06em] text-gray-500 mb-2.5">
        Denne måned
      </div>

      <div className="space-y-0">
        {upcoming.map((ev) => (
          <div
            key={ev.id}
            className="flex items-start gap-2.5 border-b border-slate-50/80 py-2 last:border-none"
          >
            <div
              className="mt-0.5 w-1 min-h-[28px] self-stretch rounded-full"
              style={{ backgroundColor: getEventTypeColor(ev.type) }}
            />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-slate-800">{ev.title}</div>
              <div className="text-[11px] text-gray-500">
                {ev.subtitle}
                {ev.aiExtracted && (
                  <span className="ml-1 inline-flex items-center gap-0.5 rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-semibold text-purple-600">
                    AI
                  </span>
                )}
              </div>
            </div>
            <div
              className={cn(
                'shrink-0 text-[11px] tabular-nums',
                ev.type === 'expiry' ? 'font-medium text-red-600' : 'text-gray-500'
              )}
            >
              {formatEventDate(ev.date, today)}
            </div>
          </div>
        ))}
        {upcoming.length === 0 && (
          <div className="py-6 text-center text-sm text-gray-500">
            Ingen planlagte besøg.
            <span className="mt-1 block text-xs text-gray-400">
              Opret et besøg ved at klikke &quot;Nyt besøg&quot; på et selskab.
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-slate-100">
        {LEGEND.map((l) => (
          <div key={l.type} className="flex items-center gap-1.5 text-[11px] text-gray-500">
            <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: l.color }} />
            {l.label}
          </div>
        ))}
      </div>

      <div className="mt-3 text-center">
        <Link
          href={fullCalendarHref}
          className="text-xs font-medium text-blue-500 hover:text-blue-600 transition-colors"
        >
          Åbn fuld kalender →
        </Link>
      </div>
    </div>
  )
}
