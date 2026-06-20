'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { ActivityEvent } from '@/actions/activity-feed'
import { Panel } from '@/components/ui/b'
import { antalEnhed } from '@/lib/labels'

// ────────────────────────────────────────────────────────────────────────────
// "Sidste aktivitet"-panel — kollapsibel, klik header for at åbne/lukke.
// Events er klikbare links til den pågældende ressource.
// ────────────────────────────────────────────────────────────────────────────

const RESOURCE_ROUTES: Record<string, string> = {
  case: '/cases',
  contract: '/contracts',
  task: '/tasks',
  company: '/companies',
  person: '/persons',
  document: '/documents',
}

// Resource-typer der ikke har en egen detail-side (export-events, ownership-
// records osv) — vi linker ikke til dem.
function eventHref(event: ActivityEvent): string | null {
  if (!event.resource_id) return null
  const base = RESOURCE_ROUTES[event.resource_type.toLowerCase()]
  if (!base) return null
  return `${base}/${event.resource_id}`
}

export function ActivityPanel({ events }: { events: ActivityEvent[] }) {
  const [open, setOpen] = useState(true)

  return (
    <Panel>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-b-row-hover"
        aria-expanded={open}
      >
        <span
          className="text-[12px] font-semibold uppercase text-b-1"
          style={{ letterSpacing: '0.4px' }}
        >
          Sidste aktivitet
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-b-2">
          <span>{antalEnhed(events.length, 'hændelse', 'hændelser')} · seneste 24 timer</span>
          <span className="text-[10px] text-b-3">{open ? '▾' : '▸'}</span>
        </span>
      </button>

      {open && (
        <div aria-live="polite" aria-atomic="false">
          {events.length === 0 ? (
            <div className="px-3 py-3 text-center text-[12px] text-b-3">
              Ingen aktivitet seneste 24 timer
            </div>
          ) : (
            events.map((e) => {
              const href = eventHref(e)
              const inner = (
                <>
                  <span className="min-w-0 flex-1 truncate text-b-1">
                    <span className="font-medium">{e.who}</span> {e.action}{' '}
                    <span className="text-b-2">· {e.target}</span>
                  </span>
                  <span className="b-tnum shrink-0 text-[11px] text-b-3">{e.time}</span>
                </>
              )

              const rowClass =
                'flex items-baseline justify-between gap-3 border-b border-b-divider px-3 py-1.5 text-[12px] last:border-b-0 hover:bg-b-row-hover'

              return href ? (
                <Link key={e.id} href={href} className={`${rowClass} no-underline`}>
                  {inner}
                </Link>
              ) : (
                <div key={e.id} className={rowClass}>
                  {inner}
                </div>
              )
            })
          )}
        </div>
      )}
    </Panel>
  )
}
