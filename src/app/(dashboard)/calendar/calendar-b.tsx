'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Breadcrumb,
  PageHeader,
  BButton,
  Panel,
  PanelHeader,
  SegmentedToggle,
  BottomBar,
} from '@/components/ui/b'
import type { CalendarEvent, CalendarEventType } from '@/types/ui'
import { EditVisitModal, type EditVisitData } from '@/components/calendar/edit-visit-modal'
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
      // Besøg/møder → blå (matcher legend "Besøg / Tilsyn")
      return 'blue'
    case 'case':
      return 'red'
    case 'renewal':
      return 'green'
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
  const parts = dateString.split('-').map(Number)
  const y = parts[0] ?? 0
  const m = parts[1] ?? 1
  const d = parts[2] ?? 1
  const dow = new Date(y, m - 1, d).getDay()
  const dowEU = dow === 0 ? 6 : dow - 1
  const weekday = WEEKDAYS_DA_FULL[dowEU] ?? ''
  const cap = weekday.length > 0 ? weekday[0]!.toUpperCase() + weekday.slice(1) : ''
  return `${cap} ${d}. ${MONTH_NAMES_DA_LOWER[m - 1] ?? ''}`
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

  const [editVisit, setEditVisit] = useState<EditVisitData | null>(null)

  // Mobil: skift automatisk til agenda-view ved første mount på <md,
  // medmindre brugeren eksplicit har valgt et view via ?view-param.
  useEffect(() => {
    if (params.get('view')) return // respekter eksplicit valg
    if (viewMode === 'agenda') return // allerede agenda — intet at gøre
    const mq = window.matchMedia('(max-width: 767px)')
    if (mq.matches) {
      const sp = new URLSearchParams(params.toString())
      sp.set('view', 'agenda')
      router.replace(`/calendar?${sp.toString()}`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // kun ved mount

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
              className="rounded-[4px] border border-b-border-strong bg-white px-1.5 py-2 md:py-0.5 text-[12px] text-b-1 hover:bg-[#f6f8fa]"
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
              className="rounded-[4px] border border-b-border-strong bg-white px-1.5 py-2 md:py-0.5 text-[12px] text-b-1 hover:bg-[#f6f8fa]"
              aria-label="Næste måned"
            >
              →
            </button>
            <BButton onClick={goToday}>I dag</BButton>
          </span>
        }
        meta={
          <>
            {monthEvents.length} {monthEvents.length === 1 ? 'begivenhed' : 'begivenheder'}
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

      <div className="grid gap-3 md:grid-cols-[1fr_260px] lg:items-start">
        <div className="min-w-0">
          {viewMode === 'maaned' ? (
            <MonthView
              days={days}
              eventsByDate={eventsByDate}
              todayISO={todayISO}
              onVisitClick={setEditVisit}
            />
          ) : (
            <AgendaView events={monthEvents} todayISO={todayISO} onVisitClick={setEditVisit} />
          )}
        </div>
        <RightPanel upcoming={upcoming} />
      </div>

      <EditVisitModal
        open={editVisit !== null}
        onClose={() => setEditVisit(null)}
        visit={editVisit}
      />

      <BottomBar
        left={
          <>
            Kalender · {MONTH_NAMES_DA[monthIdx]} {year} · {monthEvents.length}{' '}
            {monthEvents.length === 1 ? 'begivenhed' : 'begivenheder'}
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
  onVisitClick,
}: {
  days: Array<{ y: number; m: number; d: number; curr: boolean }>
  eventsByDate: Map<string, CalendarEvent[]>
  todayISO: string
  onVisitClick: (v: EditVisitData) => void
}) {
  return (
    <div className="overflow-hidden rounded-[4px] border border-b-border bg-b-panel">
      {/* Ugedag-header */}
      <div className="grid grid-cols-7 border-b border-b-border bg-b-panel-h">
        {WEEKDAYS_DA_SHORT.map((d, i) => (
          <div
            key={d}
            className="px-2 py-1.5 text-[10px] font-semibold uppercase text-b-2"
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
                !day.curr ? 'bg-[#f0f2f5]' : isWE ? 'bg-[#fbfbfd]' : ''
              } ${i % 7 === 6 ? 'border-r-0' : ''}`}
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
                  if (ev.sourceType === 'visit' && ev.sourceId) {
                    return (
                      <button
                        key={ev.id}
                        type="button"
                        title={`${ev.title} · ${ev.subtitle}`}
                        onClick={() =>
                          onVisitClick({
                            id: ev.sourceId!,
                            title: ev.title,
                            date: ev.date,
                            notes: ev.notes,
                            summary: ev.summary,
                          })
                        }
                        className={`truncate rounded-[3px] px-1 py-px text-left text-[10px] hover:opacity-80 ${pillCls(c)}`}
                      >
                        {ev.title}
                      </button>
                    )
                  }
                  return (
                    <Link
                      key={ev.id}
                      href={ev.href}
                      title={`${ev.title} · ${ev.subtitle}`}
                      className={`truncate rounded-[3px] px-1 py-px text-[10px] no-underline hover:opacity-80 ${pillCls(c)}`}
                    >
                      {ev.title}
                    </Link>
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

function AgendaView({
  events,
  todayISO,
  onVisitClick,
}: {
  events: CalendarEvent[]
  todayISO: string
  onVisitClick: (v: EditVisitData) => void
}) {
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
              if (ev.sourceType === 'visit' && ev.sourceId) {
                return (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() =>
                      onVisitClick({
                        id: ev.sourceId!,
                        title: ev.title,
                        date: ev.date,
                        notes: ev.notes,
                        summary: ev.summary,
                      })
                    }
                    className="flex w-full items-center gap-2.5 border-b border-b-divider px-3 py-1.5 last:border-b-0 hover:bg-b-row-hover text-left"
                  >
                    <span className={`h-2 w-2 shrink-0 rounded-full ${dotCls(c)}`} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium text-b-1">{ev.title}</div>
                      <div className="truncate text-[11px] text-b-2">{ev.subtitle}</div>
                    </div>
                  </button>
                )
              }
              return (
                <Link
                  key={ev.id}
                  href={ev.href}
                  className="flex items-center gap-2.5 border-b border-b-divider px-3 py-1.5 last:border-b-0 hover:bg-b-row-hover no-underline"
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${dotCls(c)}`} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-b-1">{ev.title}</div>
                    <div className="truncate text-[11px] text-b-2">{ev.subtitle}</div>
                  </div>
                </Link>
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
            const evParts = ev.date.split('-').map(Number)
            const evM = evParts[1] ?? 1
            const evD = evParts[2] ?? 1
            const shortDate = `${evD}. ${MONTH_NAMES_DA_SHORT[evM - 1] ?? ''}`
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
          {/* Farver afspejler colorForType — ingen mismatch */}
          <LegendRow color={colorForType('meeting')} label="Besøg / Tilsyn" />
          <LegendRow color={colorForType('expiry')} label="Kontraktudløb / Sagsfrist" />
          <LegendRow color={colorForType('deadline')} label="Opgave / Frist" />
          <LegendRow color={colorForType('renewal')} label="Fornyelse" />
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
