'use client'

import { useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Breadcrumb,
  PageHeader,
  BButton,
  Panel,
  PanelHeader,
  SegmentedToggle,
  BottomBar,
  KbdHint,
} from '@/components/ui/b'
import type { CalendarEvent, CalendarEventType } from '@/types/ui'
import {
  MONTH_NAMES_DA,
  MONTH_NAMES_DA_SHORT,
  MONTH_NAMES_DA_LOWER,
  WEEKDAYS_DA_SHORT,
  WEEKDAYS_DA_FULL,
} from '@/lib/calendar-constants'

// ────────────────────────────────────────────────────────────────────────────
// /calendar — klient-komponent.
// Layout matcher docs/design/handoff/project/Kalender.html.
// Month navigation håndteres via router (?month=YYYY-MM), så server re-fetcher.
// View-toggle (?view=agenda) er også URL-state.
// ────────────────────────────────────────────────────────────────────────────

// CalendarEventType → B-stil farver. Holdt afgrænset til design's 6 farver.
type EvColor = 'blue' | 'amber' | 'red' | 'purple' | 'gray' | 'green'

function colorForType(t: CalendarEventType): EvColor {
  switch (t) {
    case 'expiry':
      return 'red'
    case 'deadline':
      return 'amber'
    case 'meeting':
      return 'purple'
    case 'case':
      return 'red'
    case 'renewal':
      return 'blue'
    default:
      return 'gray'
  }
}

function pillCls(c: EvColor): string {
  switch (c) {
    case 'blue':
      return 'bg-b-blue-bg text-b-blue-fg'
    case 'amber':
      return 'bg-b-amber-bg text-b-amber-fg'
    case 'red':
      return 'bg-b-red-bg text-b-red-fg'
    case 'purple':
      return 'bg-[#f3e8ff] text-b-ai-accent'
    case 'green':
      return 'bg-b-green-bg text-b-green-fg'
    default:
      return 'bg-b-gray-bg text-b-gray-fg'
  }
}

function dotCls(c: EvColor): string {
  switch (c) {
    case 'blue':
      return 'bg-b-blue-fg'
    case 'amber':
      return 'bg-b-amber-fg'
    case 'red':
      return 'bg-b-red-fg'
    case 'purple':
      return 'bg-b-ai-accent'
    case 'green':
      return 'bg-b-green-fg'
    default:
      return 'bg-b-gray-fg'
  }
}

function dateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

// 35-celle grid (5 uger × 7 dage), mandag som første dag (europæisk).
function buildCalDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay()
  const offset = firstDay === 0 ? 6 : firstDay - 1
  const inMonth = new Date(year, month + 1, 0).getDate()
  const inPrev = new Date(year, month, 0).getDate()
  const days: Array<{ y: number; m: number; d: number; curr: boolean }> = []
  for (let i = offset - 1; i >= 0; i--) {
    const pm = month === 0 ? 11 : month - 1
    const py = month === 0 ? year - 1 : year
    days.push({ y: py, m: pm, d: inPrev - i, curr: false })
  }
  for (let d = 1; d <= inMonth; d++) days.push({ y: year, m: month, d, curr: true })
  let nextD = 1
  while (days.length < 42) {
    const nm = month === 11 ? 0 : month + 1
    const ny = month === 11 ? year + 1 : year
    days.push({ y: ny, m: nm, d: nextD++, curr: false })
  }
  return days.slice(0, days.length === 35 ? 35 : 42)
}

function formatAgendaDate(dateString: string): string {
  const [y, m, d] = dateString.split('-').map(Number)
  const dow = new Date(y, m - 1, d).getDay()
  const dowEU = dow === 0 ? 6 : dow - 1
  const cap = WEEKDAYS_DA_FULL[dowEU][0].toUpperCase() + WEEKDAYS_DA_FULL[dowEU].slice(1)
  return `${cap} ${d}. ${MONTH_NAMES_DA_LOWER[m - 1]}`
}

// ────────────────────────────────────────────────────────────────────────────

export function CalendarPageB({
  year,
  month, // 1-indexed
  monthEvents,
  nextMonthEvents,
  todayISO,
  viewMode,
}: {
  year: number
  month: number
  monthEvents: CalendarEvent[]
  nextMonthEvents: CalendarEvent[]
  todayISO: string
  viewMode: 'maaned' | 'agenda'
}) {
  const router = useRouter()
  const params = useSearchParams()

  const monthIdx = month - 1 // 0-indexed til Date

  // Index events efter dato → for hurtig lookup i grid
  const eventsByDate = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>()
    for (const ev of monthEvents) {
      const arr = m.get(ev.date) ?? []
      arr.push(ev)
      m.set(ev.date, arr)
    }
    return m
  }, [monthEvents])

  const days = useMemo(() => buildCalDays(year, monthIdx), [year, monthIdx])

  const criticalThisMonth = monthEvents.filter((e) => colorForType(e.type) === 'red').length
  const meetingsThisMonth = monthEvents.filter((e) => e.type === 'meeting').length

  // "Kommende" = events fra i dag og frem, op til 8 (denne måned + næste måned)
  const upcoming = useMemo(() => {
    const all = [...monthEvents, ...nextMonthEvents].filter((e) => e.date >= todayISO)
    all.sort((a, b) => a.date.localeCompare(b.date))
    return all.slice(0, 8)
  }, [monthEvents, nextMonthEvents, todayISO])

  function navigateMonth(deltaMonths: number) {
    const d = new Date(year, monthIdx + deltaMonths, 1)
    const newMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const sp = new URLSearchParams(params.toString())
    sp.set('month', newMonth)
    router.push(`/calendar?${sp.toString()}`)
  }

  function goToday() {
    const sp = new URLSearchParams(params.toString())
    sp.delete('month')
    router.push(`/calendar?${sp.toString()}`)
  }

  function setView(v: 'maaned' | 'agenda') {
    const sp = new URLSearchParams(params.toString())
    if (v === 'agenda') sp.set('view', 'agenda')
    else sp.delete('view')
    router.push(`/calendar?${sp.toString()}`)
  }

  return (
    <>
      <Breadcrumb trail={[]} current="Kalender" />

      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <span>Kalender</span>
            <button
              type="button"
              onClick={() => navigateMonth(-1)}
              className="rounded-[4px] border border-b-border-strong bg-white px-1.5 py-0.5 text-[12px] text-b-1 hover:bg-[#f6f8fa]"
              aria-label="Forrige måned"
            >
              ←
            </button>
            <span className="b-tnum text-[14px] font-medium text-b-1">
              {MONTH_NAMES_DA[monthIdx]} {year}
            </span>
            <button
              type="button"
              onClick={() => navigateMonth(1)}
              className="rounded-[4px] border border-b-border-strong bg-white px-1.5 py-0.5 text-[12px] text-b-1 hover:bg-[#f6f8fa]"
              aria-label="Næste måned"
            >
              →
            </button>
            <BButton onClick={goToday}>I dag</BButton>
          </span>
        }
        meta={
          <>
            {monthEvents.length} begivenheder
            {criticalThisMonth > 0 && (
              <>
                {' · '}
                <span className="font-medium text-b-red-fg">{criticalThisMonth} kritiske</span>
              </>
            )}
            {meetingsThisMonth > 0 && (
              <>
                {' · '}
                {meetingsThisMonth} {meetingsThisMonth === 1 ? 'møde' : 'møder'}
              </>
            )}
          </>
        }
        actions={
          <>
            <SegmentedToggle<'maaned' | 'agenda'>
              value={viewMode}
              onChange={setView}
              options={[
                { value: 'maaned', label: 'Måned' },
                { value: 'agenda', label: 'Agenda' },
              ]}
            />
            <BButton primary href="/visits/new">
              + Planlæg besøg
            </BButton>
          </>
        }
      />

      <div className="grid gap-3 lg:grid-cols-[1fr_260px] lg:items-start">
        <div className="min-w-0">
          {viewMode === 'maaned' ? (
            <MonthView days={days} eventsByDate={eventsByDate} todayISO={todayISO} />
          ) : (
            <AgendaView events={monthEvents} todayISO={todayISO} />
          )}
        </div>
        <RightPanel upcoming={upcoming} />
      </div>

      <BottomBar
        left={
          <>
            Kalender · {MONTH_NAMES_DA[monthIdx]} {year} · {monthEvents.length} begivenheder
          </>
        }
        right={
          <>
            <KbdHint k="⌘K" label="handling" />
            <span>·</span>
            <KbdHint k="←" />
            <KbdHint k="→" label="måned" />
            <span>·</span>
            <KbdHint k="T" label="i dag" />
          </>
        }
      />
    </>
  )
}

// ────────────────────────────────────────────────────────────────────────────

function MonthView({
  days,
  eventsByDate,
  todayISO,
}: {
  days: Array<{ y: number; m: number; d: number; curr: boolean }>
  eventsByDate: Map<string, CalendarEvent[]>
  todayISO: string
}) {
  return (
    <div className="overflow-hidden rounded-[4px] border border-b-border bg-b-panel">
      {/* Ugedag-header */}
      <div className="grid grid-cols-7 border-b border-b-border bg-b-panel-h">
        {WEEKDAYS_DA_SHORT.map((d, i) => (
          <div
            key={d}
            className={`px-2 py-1.5 text-[10px] font-semibold uppercase ${
              i >= 5 ? 'text-b-3' : 'text-b-2'
            }`}
            style={{ letterSpacing: '0.5px' }}
          >
            {d}
          </div>
        ))}
      </div>
      {/* Måned-grid */}
      <div className="grid grid-cols-7" style={{ gridAutoRows: 'minmax(96px, auto)' }}>
        {days.map((day, i) => {
          const ds = dateStr(day.y, day.m, day.d)
          const evs = eventsByDate.get(ds) ?? []
          const isToday = ds === todayISO
          const isWE = i % 7 >= 5
          const visible = evs.slice(0, 2)
          const more = evs.length - visible.length
          return (
            <div
              key={`${ds}-${i}`}
              className={`relative border-b border-r border-b-divider p-1 ${
                isWE ? 'bg-[#fbfbfd]' : ''
              } ${!day.curr ? 'opacity-50' : ''} ${i % 7 === 6 ? 'border-r-0' : ''}`}
            >
              <div
                className={`b-tnum inline-flex h-5 w-5 items-center justify-center text-[11px] font-medium ${
                  isToday
                    ? 'rounded-full bg-b-blue-fg text-white'
                    : day.curr
                      ? 'text-b-1'
                      : 'text-b-3'
                }`}
              >
                {day.d}
              </div>
              <div className="mt-1 flex flex-col gap-0.5">
                {visible.map((ev) => {
                  const c = colorForType(ev.type)
                  return (
                    <div
                      key={ev.id}
                      title={`${ev.title} · ${ev.subtitle}`}
                      className={`truncate rounded-[3px] px-1 py-px text-[10px] ${pillCls(c)}`}
                    >
                      {ev.title}
                    </div>
                  )
                })}
                {more > 0 && <div className="text-[10px] text-b-2">+{more} mere</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────

function AgendaView({ events, todayISO }: { events: CalendarEvent[]; todayISO: string }) {
  const upcoming = useMemo(() => {
    const arr = events.filter((e) => e.date >= todayISO)
    arr.sort((a, b) => a.date.localeCompare(b.date))
    return arr
  }, [events, todayISO])

  const grouped = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>()
    for (const ev of upcoming) {
      const arr = m.get(ev.date) ?? []
      arr.push(ev)
      m.set(ev.date, arr)
    }
    return Array.from(m.entries())
  }, [upcoming])

  if (grouped.length === 0) {
    return (
      <Panel>
        <div className="px-3 py-8 text-center text-[13px] text-b-3">
          Ingen kommende begivenheder i denne måned
        </div>
      </Panel>
    )
  }

  return (
    <Panel>
      {grouped.map(([date, evs]) => {
        const isToday = date === todayISO
        return (
          <div key={date}>
            <div
              className={`border-b border-b-divider px-3 py-1.5 text-[11px] font-semibold ${
                isToday ? 'bg-b-blue-bg text-b-blue-fg' : 'bg-b-panel-h text-b-2'
              }`}
              style={{ letterSpacing: '0.4px' }}
            >
              {formatAgendaDate(date)}
              {isToday && ' — i dag'}
            </div>
            {evs.map((ev) => {
              const c = colorForType(ev.type)
              return (
                <div
                  key={ev.id}
                  className="flex items-center gap-2.5 border-b border-b-divider px-3 py-1.5 last:border-b-0 hover:bg-b-row-hover"
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${dotCls(c)}`} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-b-1">{ev.title}</div>
                    <div className="truncate text-[11px] text-b-2">{ev.subtitle}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </Panel>
  )
}

// ────────────────────────────────────────────────────────────────────────────

function RightPanel({ upcoming }: { upcoming: CalendarEvent[] }) {
  return (
    <aside className="flex flex-col gap-3">
      <Panel>
        <PanelHeader title="Kommende" meta={`${upcoming.length} events`} />
        {upcoming.length === 0 ? (
          <div className="px-3 py-3 text-center text-[12px] text-b-3">Ingen kommende events</div>
        ) : (
          upcoming.map((ev, i) => {
            const [, m, d] = ev.date.split('-').map(Number)
            const shortDate = `${d}. ${MONTH_NAMES_DA_SHORT[m - 1]}`
            const c = colorForType(ev.type)
            return (
              <div
                key={ev.id}
                className={`flex items-center gap-2 px-3 py-1.5 ${
                  i < upcoming.length - 1 ? 'border-b border-b-divider' : ''
                }`}
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${dotCls(c)}`} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-medium text-b-1">{ev.title}</div>
                  <div className="truncate text-[11px] text-b-2">{ev.subtitle}</div>
                </div>
                <div className="b-tnum shrink-0 text-right text-[10px] text-b-2 leading-tight">
                  <div>{shortDate}</div>
                </div>
              </div>
            )
          })
        )}
      </Panel>

      <Panel>
        <PanelHeader title="Legende" />
        <div className="py-1">
          <LegendRow color="blue" label="Besøg / Tilsyn" />
          <LegendRow color="purple" label="Bestyrelsesmøde" />
          <LegendRow color="red" label="Sagsfrist / Udløb" />
          <LegendRow color="amber" label="Opgave / Frist" />
          <LegendRow color="gray" label="Andet" />
        </div>
      </Panel>
    </aside>
  )
}

function LegendRow({ color, label }: { color: EvColor; label: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-0.5 text-[11px] text-b-1">
      <span className={`h-2 w-2 rounded-full ${dotCls(color)}`} />
      <span>{label}</span>
    </div>
  )
}
