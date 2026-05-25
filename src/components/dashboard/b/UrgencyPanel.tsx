'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Panel, PanelHeader, PanelGroupLabel, Badge, type BadgeTone } from '@/components/ui/b'
import type { TimelineColor, TimelineSectionData } from '@/lib/dashboard-helpers'

// ────────────────────────────────────────────────────────────────────────────
// Urgency-panel — "Kræver opmærksomhed".
//
// Bygger på eksisterende timelineSections (overdue/today/thisweek/nextweek)
// og kører klient-side fritekst-filter. Tomt-state vises hvis filteret ikke
// matcher noget.
// ────────────────────────────────────────────────────────────────────────────

const colorToTone: Record<TimelineColor, BadgeTone> = {
  red: 'red',
  amber: 'amber',
  blue: 'blue',
  green: 'green',
  purple: 'blue', // ingen lilla-badge i B-stil — vises som info
  gray: 'gray',
}

// Kortform-labels til urgency-kolonne — erstatter akronymerne fra split(' ')[0].
const SECTION_SHORT_LABEL: Record<string, string> = {
  Forfaldne: 'Frist',
  'I dag': 'I dag',
  'Denne uge': '7d',
  'Næste uge': '14d',
  'Næste 2 uger': '28d',
}

function badgeForItem(section: TimelineSectionData['id'], time: string, color: TimelineColor) {
  // "time" er allerede formateret af helper'en (fx "3d", "om 7d", "Ons").
  // Reducerer til kort form til badge-cellen.
  const short = time
    .replace(/^om\s+/, '')
    .replace(/\s*siden\s*$/, '')
    .trim()
  return { tone: colorToTone[color], text: short || section }
}

export function UrgencyPanel({ sections }: { sections: TimelineSectionData[] }) {
  const [filter, setFilter] = useState('')

  const filtered = useMemo(() => {
    if (!filter.trim()) return sections.filter((s) => s.items.length > 0)
    const q = filter.toLowerCase()
    return sections
      .map((s) => ({
        ...s,
        items: s.items.filter(
          (it) => it.title.toLowerCase().includes(q) || it.subtitle.toLowerCase().includes(q)
        ),
      }))
      .filter((s) => s.items.length > 0)
  }, [sections, filter])

  const totalAll = sections.reduce((acc, s) => acc + s.items.length, 0)
  const totalFiltered = filtered.reduce((acc, s) => acc + s.items.length, 0)

  return (
    <Panel>
      <PanelHeader
        title="Kræver opmærksomhed"
        meta={
          filter
            ? `${totalFiltered} resultat${totalFiltered !== 1 ? 'er' : ''}`
            : `${totalAll} elementer · sortér: hastighed`
        }
      />

      {/* Filter-input */}
      <div className="border-b border-b-divider px-3 py-1.5">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filtrér urgency-items..."
          aria-label="Filtrér urgency-elementer"
          className="w-full rounded-[4px] border border-b-border-strong bg-white px-2.5 py-1 text-[12px] text-b-1 placeholder:text-b-3 focus:border-b-blue-fg focus:outline-none focus:ring-2 focus:ring-b-blue-bg"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="px-3 py-3 text-center text-[12px] text-b-3">
          {filter
            ? `Ingen elementer matcher "${filter}"`
            : 'Ingen forfaldne eller kommende elementer'}
        </div>
      ) : (
        filtered.map((section) => (
          <div key={section.id}>
            <PanelGroupLabel>{section.label}</PanelGroupLabel>
            {section.items.map((item) => {
              const badge = badgeForItem(section.id, item.time, item.color)
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className="grid cursor-pointer grid-cols-[50px_1fr_70px_14px] items-center gap-2.5 border-b border-b-divider px-3 py-1.5 text-[13px] no-underline last:border-b-0 hover:bg-b-row-hover"
                >
                  <Badge tone={badge.tone}>{badge.text}</Badge>
                  <span className="truncate text-b-1">
                    <strong className="font-medium">{item.title}</strong>
                    <span className="text-b-2"> · {item.subtitle}</span>
                  </span>
                  <span className="text-[12px] text-b-2">
                    {SECTION_SHORT_LABEL[section.label] ?? section.label}
                  </span>
                  <span className="text-b-3">›</span>
                </Link>
              )
            })}
          </div>
        ))
      )}
    </Panel>
  )
}
