'use client'

import { Building2 } from 'lucide-react'
import { usePrototype } from '@/components/prototype/PrototypeProvider'
import { ProtoCoverageBar } from '@/components/prototype/ProtoCoverageBar'
import { FinRow } from '@/components/prototype/FinRow'
import { getCompanies } from '@/mock/companies'
import { getExpiringContracts, getContractCoverage } from '@/mock/contracts'
import { getOverdueTasks } from '@/mock/tasks'
import { getOpenCases } from '@/mock/cases'
import { getPortfolioTotals, getUnderperformingCompanies, getFinancialByCompany } from '@/mock/financial'
import { filterCompaniesByRole } from '@/mock/helpers'
import { getCalendarEvents, getEventTypeColor } from '@/mock/calendar'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------
// Hjælpefunktioner
// ---------------------------------------------------------------
function formatMio(val: number): string {
  return (val / 1_000_000).toFixed(1)
}

// ---------------------------------------------------------------
// Timeline-typer og farver
// ---------------------------------------------------------------
type TimelineColor = 'red' | 'amber' | 'blue' | 'purple' | 'green' | 'gray'

interface TimelineItem {
  id: string
  letter: string
  color: TimelineColor
  title: string
  subtitle: string
  aiExtracted?: boolean
  time: string
  href?: string
}

interface TimelineSection {
  id: string
  label: string
  dotType: 'overdue' | 'today' | 'future'
  items: TimelineItem[]
}

function colorClass(c: TimelineColor): string {
  switch (c) {
    case 'red':    return 'bg-red-50 text-red-600'
    case 'amber':  return 'bg-amber-50 text-amber-600'
    case 'blue':   return 'bg-blue-50 text-blue-600'
    case 'purple': return 'bg-purple-50 text-purple-600'
    case 'green':  return 'bg-green-50 text-green-600'
    case 'gray':   return 'bg-slate-50 text-slate-500'
  }
}

// ---------------------------------------------------------------
// Rollespecifikke timeline-data
// ---------------------------------------------------------------
function getTimelineSections(role: string): TimelineSection[] {
  if (role === 'GROUP_OWNER') {
    return [
      {
        id: 'overdue',
        label: 'Overskredet',
        dotType: 'overdue',
        items: [
          { id: 'o1', letter: 'N', color: 'red', title: 'Ejeraftale Nordklinik', subtitle: 'Nordklinik ApS · 3 dage over frist', aiExtracted: true, time: '3d over', href: '/proto/contracts/con-1' },
          { id: 'o2', letter: 'S', color: 'amber', title: 'Huslejekontrakt Sundby', subtitle: 'Sundby Dental ApS · udløbet', aiExtracted: true, time: '1d over', href: '/proto/contracts/con-3' },
          { id: 'o3', letter: 'N', color: 'red', title: '3 forfaldne opgaver', subtitle: 'Nordklinik ApS', time: 'Nu', href: '/proto/tasks?filter=overdue' },
        ],
      },
      {
        id: 'today',
        label: 'I dag',
        dotType: 'today',
        items: [
          { id: 't1', letter: 'Ø', color: 'blue', title: 'Driftsbesøg Østklinikken', subtitle: 'Planlagt møde', time: '10:00', href: '/proto/portfolio/c3' },
          { id: 't2', letter: 'S', color: 'amber', title: 'Opsigelse mulig — Leverandøraftale Sundby', subtitle: 'Sundby Dental ApS · Frist', aiExtracted: true, time: 'Frist', href: '/proto/contracts/con-3' },
          { id: 't3', letter: 'N', color: 'purple', title: 'Dokument uploadet — Ejeraftale v3', subtitle: 'Nordklinik ApS · AI-behandlet', aiExtracted: true, time: 'Ny', href: '/proto/documents' },
        ],
      },
      {
        id: 'thisweek',
        label: 'Denne uge',
        dotType: 'future',
        items: [
          { id: 'w1', letter: 'N', color: 'blue', title: 'Møde Dr. Petersen — Nordklinik', subtitle: 'Nordklinik ApS · genforhandling', time: '1. apr', href: '/proto/portfolio/c1' },
          { id: 'w2', letter: 'A', color: 'purple', title: 'Frist indsigelse lejemål — Aalborg', subtitle: 'Aalborg Dental Group · sagsfrist', aiExtracted: true, time: '2. apr', href: '/proto/cases' },
          { id: 'w3', letter: 'V', color: 'amber', title: 'Udløb huslejekontrakt — Vesterbro', subtitle: 'Vesterbro Tandlæge ApS', aiExtracted: true, time: '5. apr', href: '/proto/contracts/con-6' },
        ],
      },
      {
        id: 'nextweek',
        label: 'Næste uge',
        dotType: 'future',
        items: [
          { id: 'n1', letter: 'Å', color: 'green', title: 'Auto-fornyelse — Aarhus Smile', subtitle: 'Aarhus Smile ApS · automatisk fornyelse', aiExtracted: true, time: '6. apr', href: '/proto/contracts/con-5' },
          { id: 'n2', letter: 'K', color: 'gray', title: 'Kvartalsregnskab Q1 deadline', subtitle: 'Alle lokationer · indberetningsfrist', time: '10. apr', href: '/proto/financial' },
        ],
      },
    ]
  }

  if (role === 'GROUP_LEGAL') {
    return [
      {
        id: 'overdue',
        label: 'Overskredet',
        dotType: 'overdue',
        items: [
          { id: 'o1', letter: 'N', color: 'red', title: 'Ejeraftale Nordklinik', subtitle: 'Nordklinik ApS · 3 dage over frist', aiExtracted: true, time: '3d over', href: '/proto/contracts/con-1' },
          { id: 'o2', letter: 'S', color: 'amber', title: 'Huslejekontrakt Sundby', subtitle: 'Sundby Dental ApS · udløbet', aiExtracted: true, time: '1d over', href: '/proto/contracts/con-3' },
        ],
      },
      {
        id: 'today',
        label: 'I dag',
        dotType: 'today',
        items: [
          { id: 't1', letter: 'N', color: 'purple', title: 'Dokument til review — Ejeraftale v3', subtitle: 'Nordklinik ApS · afventer gennemgang', aiExtracted: true, time: 'Review', href: '/proto/documents' },
          { id: 't2', letter: 'S', color: 'amber', title: 'Opsigelse mulig — Leverandøraftale', subtitle: 'Sundby Dental ApS · Frist', aiExtracted: true, time: 'Frist', href: '/proto/contracts/con-3' },
        ],
      },
      {
        id: 'thisweek',
        label: 'Denne uge',
        dotType: 'future',
        items: [
          { id: 'w1', letter: 'A', color: 'purple', title: 'Frist indsigelse lejemål', subtitle: 'Aalborg Dental Group · sagsfrist', aiExtracted: true, time: '2. apr', href: '/proto/cases' },
          { id: 'w2', letter: 'V', color: 'amber', title: 'Udløb huslejekontrakt', subtitle: 'Vesterbro Tandlæge ApS', aiExtracted: true, time: '5. apr', href: '/proto/contracts/con-6' },
          { id: 'w3', letter: 'D', color: 'red', title: 'Konkurrenceklausul — Dr. Hansen', subtitle: 'Horsens Tandklinik ApS · udløber', aiExtracted: true, time: '7. apr', href: '/proto/contracts' },
        ],
      },
    ]
  }

  if (role === 'GROUP_FINANCE') {
    return [
      {
        id: 'overdue',
        label: 'Økonomisk risiko',
        dotType: 'overdue',
        items: [
          { id: 'o1', letter: 'F', color: 'red', title: 'Forfaldne fakturaer — 340.000 kr.', subtitle: 'Udestående betalinger', time: 'Nu', href: '/proto/financial' },
          { id: 'o2', letter: 'N', color: 'red', title: 'Nordklinik — underskud EBITDA', subtitle: 'EBITDA -120.000 · fald på 23%', time: 'Nu', href: '/proto/portfolio/company-odense' },
        ],
      },
      {
        id: 'today',
        label: 'I dag',
        dotType: 'today',
        items: [
          { id: 't1', letter: 'S', color: 'amber', title: 'Opsigelse mulig — Leverandøraftale', subtitle: 'Sundby Dental ApS · 8% besparelse mulig', aiExtracted: true, time: 'Frist', href: '/proto/contracts/con-3' },
          { id: 't2', letter: 'Ø', color: 'purple', title: 'Regnskab uploadet — Q4 2025', subtitle: 'Østklinikken ApS · AI-behandlet', aiExtracted: true, time: 'Ny', href: '/proto/documents' },
        ],
      },
      {
        id: 'thisweek',
        label: 'Denne uge',
        dotType: 'future',
        items: [
          { id: 'w1', letter: 'V', color: 'amber', title: 'Udløb huslejekontrakt — Vesterbro', subtitle: 'Risiko for forhøjet leje', aiExtracted: true, time: '5. apr', href: '/proto/contracts/con-6' },
        ],
      },
      {
        id: 'nextweek',
        label: 'Næste uge',
        dotType: 'future',
        items: [
          { id: 'n1', letter: 'K', color: 'gray', title: 'Kvartalsregnskab Q1 deadline', subtitle: 'Alle lokationer · indberetningsfrist', time: '10. apr', href: '/proto/financial' },
        ],
      },
    ]
  }

  // Fallback
  return [
    {
      id: 'today',
      label: 'I dag',
      dotType: 'today',
      items: [],
    },
  ]
}

// ---------------------------------------------------------------
// Mini-kalender (kompakt grid med prikker)
// ---------------------------------------------------------------
function MiniCalendar() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const today = now.getDate()

  const events = getCalendarEvents(year, month)
  const eventDates = new Set(events.map((e) => new Date(e.date).getDate()))

  const firstDay = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  // Mandag = 0 offset
  const offset = firstDay === 0 ? 6 : firstDay - 1

  const cells: (number | null)[] = Array(offset).fill(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const monthNames = ['januar', 'februar', 'marts', 'april', 'maj', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'december']
  const dayLabels = ['Ma', 'Ti', 'On', 'To', 'Fr', 'Lø', 'Sø']

  return (
    <div>
      <div className="text-[10px] text-gray-400 text-center mb-2 capitalize">
        {monthNames[month - 1]} {year}
      </div>
      <div className="grid grid-cols-7 gap-0">
        {dayLabels.map((d) => (
          <div key={d} className="text-[9px] text-gray-400 text-center pb-1">{d}</div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} />
          const isToday = day === today
          const hasEvent = eventDates.has(day)
          const eventForDay = events.find((e) => new Date(e.date).getDate() === day)
          const dotColor = eventForDay ? getEventTypeColor(eventForDay.type) : undefined
          return (
            <div key={day} className="flex flex-col items-center py-0.5">
              <div
                className={cn(
                  'w-5 h-5 flex items-center justify-center rounded-full text-[9px] leading-none',
                  isToday
                    ? 'bg-blue-500 text-white font-bold'
                    : 'text-slate-700'
                )}
              >
                {day}
              </div>
              {hasEvent && (
                <div
                  className="w-1 h-1 rounded-full mt-0.5"
                  style={{ backgroundColor: dotColor ?? '#6366f1' }}
                />
              )}
              {!hasEvent && <div className="w-1 h-1 mt-0.5" />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------
// Heatmap-grid (GROUP_OWNER)
// ---------------------------------------------------------------
function HeatmapGrid({ companies }: { companies: Array<{ id: string; name: string; healthStatus: string; openCaseCount: number }> }) {
  const sorted = [...companies].sort((a, b) => {
    const order = { critical: 0, warning: 1, healthy: 2 }
    return (order[a.healthStatus as keyof typeof order] ?? 2) - (order[b.healthStatus as keyof typeof order] ?? 2)
  }).slice(0, 15)

  return (
    <div className="grid grid-cols-5 gap-1">
      {sorted.map((c) => {
        const shortName = c.name.replace(' ApS', '').replace(' Tandlægehus', '').replace(' Tandklinik', '').replace(' Tandlæge', '').replace(' Tandhus', '')
        const cellClass = c.healthStatus === 'critical'
          ? 'bg-red-50 border border-red-200 text-red-800'
          : c.healthStatus === 'warning'
          ? 'bg-amber-50 border border-amber-200 text-amber-800'
          : 'bg-green-50 border border-green-200 text-green-800'
        return (
          <a
            key={c.id}
            href={`/proto/portfolio/${c.id}`}
            className={cn('rounded p-1 text-center cursor-pointer hover:opacity-80 transition-opacity', cellClass)}
          >
            <div className="text-[11px] font-bold leading-tight">{c.openCaseCount > 0 ? c.openCaseCount : '·'}</div>
            <div className="text-[8px] leading-tight truncate">{shortName}</div>
          </a>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------
// Højre-panel wrapper
// ---------------------------------------------------------------
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3.5">
      <div className="text-[11px] font-semibold text-slate-900 mb-2.5">{title}</div>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------
// Rollespecifikke højre-paneler
// ---------------------------------------------------------------
function RightPanels({ role, data }: { role: string; data: ReturnType<typeof buildDashboardData> }) {
  if (role === 'GROUP_OWNER') {
    return (
      <div className="space-y-3">
        <Panel title="Porteføljeoverblik">
          <HeatmapGrid companies={data.companies} />
        </Panel>

        <Panel title="April 2026">
          <MiniCalendar />
        </Panel>

        <Panel title="Kontraktdækning">
          {data.coverageItems.map((item) => (
            <ProtoCoverageBar key={item.label} label={item.label} percentage={item.pct} />
          ))}
        </Panel>

        <Panel title="Økonomi snapshot">
          <FinRow label="Omsætning" value={`${formatMio(data.totals2025.totalOmsaetning)}M`} />
          <FinRow label="EBITDA" value={`${formatMio(data.totals2025.totalEbitda)}M`} />
          <FinRow label="Forfaldne" value="340k" valueColor="#ef4444" />
          <FinRow
            label="Underskud lok."
            value={String(data.underperforming.length)}
            valueColor={data.underperforming.length > 0 ? '#ef4444' : undefined}
          />
        </Panel>
      </div>
    )
  }

  if (role === 'GROUP_LEGAL') {
    return (
      <div className="space-y-3">
        <Panel title="Aktive sager">
          <FinRow label="Compliance" value={`${data.openCases.filter((c) => c.type === 'COMPLIANCE').length}`} />
          <FinRow label="Governance" value={`${data.openCases.filter((c) => c.type === 'GOVERNANCE').length}`} />
          <FinRow label="Tvist" value={`${data.openCases.filter((c) => c.type === 'TVIST').length}`} valueColor="#ef4444" />
        </Panel>

        <Panel title="Kontraktdækning">
          {data.coverageItems.map((item) => (
            <ProtoCoverageBar key={item.label} label={item.label} percentage={item.pct} />
          ))}
        </Panel>

        <Panel title="Dokumenter til review">
          <FinRow label="Afventer review" value="8" valueColor="#d97706" />
          <FinRow label="Under behandling" value="3" valueColor="#3b82f6" />
          <FinRow label="Godkendt denne uge" value="2" />
        </Panel>

        <Panel title="April 2026">
          <MiniCalendar />
        </Panel>
      </div>
    )
  }

  if (role === 'GROUP_FINANCE') {
    const topCompanies = [...data.companies]
      .sort((a, b) => {
        const fa = getFinancialByCompany(a.id).find((f) => f.year === 2025)
        const fb = getFinancialByCompany(b.id).find((f) => f.year === 2025)
        return (fb?.omsaetning ?? 0) - (fa?.omsaetning ?? 0)
      })
      .slice(0, 4)

    return (
      <div className="space-y-3">
        <Panel title="Top lokationer — Omsætning">
          {topCompanies.map((c) => {
            const fin = getFinancialByCompany(c.id).find((f) => f.year === 2025)
            const omsaetning = fin?.omsaetning ?? 0
            return (
              <FinRow
                key={c.id}
                label={c.name.replace(' ApS', '')}
                value={`${formatMio(omsaetning)}M`}
              />
            )
          })}
        </Panel>

        <Panel title="Nøgletal 2025">
          <FinRow label="Omsætning" value={`${formatMio(data.totals2025.totalOmsaetning)}M`} />
          <FinRow label="EBITDA" value={`${formatMio(data.totals2025.totalEbitda)}M`} />
          <FinRow label="Margin" value={`${(data.totals2025.avgEbitdaMargin * 100).toFixed(1)}%`} />
          <FinRow label="Gns. pr. lok." value={`${formatMio(data.totals2025.totalOmsaetning / Math.max(data.totalCompanies, 1))}M`} />
        </Panel>

        <Panel title="Udestående">
          <FinRow label="Forfaldne fakturaer" value="340k" valueColor="#ef4444" />
          <FinRow label="Kommende 30 dage" value="1,2M" valueColor="#d97706" />
          <FinRow label="Underskudslokationer" value={String(data.underperforming.length)} valueColor={data.underperforming.length > 0 ? '#ef4444' : undefined} />
          <FinRow label="Ingen regnskab 2025" value="2" valueColor="#d97706" />
        </Panel>
      </div>
    )
  }

  // Fallback
  return (
    <div className="space-y-3">
      <Panel title="April 2026">
        <MiniCalendar />
      </Panel>
    </div>
  )
}

// ---------------------------------------------------------------
// Saml al mock-data
// ---------------------------------------------------------------
function buildDashboardData(dataScenario: 'normal' | 'many_warnings' | 'empty', role: string, assignedIds: string[]) {
  const allCompanies = getCompanies(dataScenario, 22)
  const companies = filterCompaniesByRole(allCompanies, role as Parameters<typeof filterCompaniesByRole>[1], assignedIds)

  const expiringContracts = getExpiringContracts(90)
  const contractCoverage = getContractCoverage()
  const overdueTasks = getOverdueTasks()
  const openCases = getOpenCases()
  const totals2025 = getPortfolioTotals(2025)
  const underperforming = getUnderperformingCompanies()

  const totalCompanies = companies.length || 22

  const coverageItems = [
    {
      label: 'Ejeraftale',
      pct: Math.round(((totalCompanies - contractCoverage.filter((c) => c.missingTypes.includes('EJERAFTALE')).length) / totalCompanies) * 100),
    },
    {
      label: 'Lejekontrakt',
      pct: Math.round(((totalCompanies - contractCoverage.filter((c) => c.missingTypes.includes('LEJEKONTRAKT')).length) / totalCompanies) * 100),
    },
    {
      label: 'Forsikring',
      pct: Math.round(((totalCompanies - contractCoverage.filter((c) => c.missingTypes.includes('FORSIKRING')).length) / totalCompanies) * 100),
    },
    {
      label: 'Ansættelse',
      pct: Math.round(((totalCompanies - contractCoverage.filter((c) => c.missingTypes.includes('ANSAETTELSESKONTRAKT')).length) / totalCompanies) * 100),
    },
  ]

  return {
    companies,
    expiringContracts,
    contractCoverage,
    coverageItems,
    overdueTasks,
    openCases,
    totals2025,
    underperforming,
    totalCompanies,
  }
}

// ---------------------------------------------------------------
// Timeline-sektion komponent
// ---------------------------------------------------------------
function TimelineSection({ section }: { section: TimelineSection }) {
  const dotClass = cn(
    'absolute left-[-19px] top-[3px] w-2.5 h-2.5 rounded-full border-2',
    section.dotType === 'overdue' && 'border-red-500 bg-red-50',
    section.dotType === 'today' && 'border-blue-500 bg-blue-500',
    section.dotType === 'future' && 'border-gray-300 bg-gray-50',
  )

  const labelClass = cn(
    'text-[11px] font-semibold mb-2',
    section.dotType === 'overdue' && 'text-red-600',
    section.dotType === 'today' && 'text-blue-600',
    section.dotType === 'future' && 'text-gray-500',
  )

  if (section.items.length === 0) return null

  return (
    <div className="relative pl-5 mb-5">
      {/* Vertikal linje */}
      <div className="absolute left-[5px] top-[4px] bottom-0 w-0.5 bg-gray-200" />

      {/* Sektion-dot + label */}
      <div className="relative mb-2">
        <div className={dotClass} />
        <div className={labelClass}>{section.label}</div>
      </div>

      {/* Items */}
      {section.items.map((item) => (
        <a
          key={item.id}
          href={item.href ?? '#'}
          className="flex items-center gap-2.5 bg-white border border-gray-200 rounded-lg px-3 py-2.5 mb-1.5 cursor-pointer hover:shadow-sm hover:border-gray-300 transition-all no-underline"
        >
          <div className={cn('w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold shrink-0', colorClass(item.color))}>
            {item.letter}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-slate-800">{item.title}</div>
            <div className="text-[10px] text-gray-400">{item.subtitle}</div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {item.aiExtracted && (
              <span className="text-[8px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">AI</span>
            )}
            <span className="text-[10px] tabular-nums text-gray-400">{item.time}</span>
          </div>
        </a>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------
// Hoved-komponent
// ---------------------------------------------------------------
export default function DashboardPage() {
  const { activeUser, dataScenario } = usePrototype()
  const role = activeUser.role

  // Empty state
  if (dataScenario === 'empty') {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="border-b border-gray-200/60 pb-6 mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Godmorgen, {activeUser.name}
          </h1>
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Building2 className="h-16 w-16 text-gray-200 mb-4" />
          <p className="text-sm font-medium text-gray-500">Ingen data endnu</p>
          <p className="text-xs text-gray-400 mt-1">
            Upload dokumenter eller opret dit første selskab for at komme i gang.
          </p>
        </div>
      </div>
    )
  }

  const data = buildDashboardData(dataScenario, role, activeUser.companyIds)
  const timelineSections = getTimelineSections(role)

  return (
    <div className="p-5 h-full">
      <div className="grid grid-cols-[1fr_320px] gap-5 max-w-[1400px] mx-auto">

        {/* ── VENSTRE: Timeline River ── */}
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-slate-900 mb-4">Tidslinje</div>
          {timelineSections.map((section) => (
            <TimelineSection key={section.id} section={section} />
          ))}
        </div>

        {/* ── HØJRE: Kompakt paneler ── */}
        <div className="min-w-0">
          <RightPanels role={role} data={data} />
        </div>

      </div>
    </div>
  )
}
