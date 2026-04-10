'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import {
  ChevronRight,
  Upload,
  Plus,
  Sparkles,
  FileText,
  AlertTriangle,
  TrendingUp,
  Users,
  Calendar,
  Briefcase,
  CheckSquare,
  Activity,
  ArrowUpRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------
// Typer — modtages fra Server Component
// ---------------------------------------------------------------

export interface CompanyDetailData {
  id: string
  name: string
  cvr: string
  city: string
  address: string
  companyType: string
  status: string
  healthStatus: 'critical' | 'warning' | 'healthy'
  dimensions: HealthDimension[]
  aiTitle: string
  aiBody: string
}

export interface HealthDimension {
  label: string
  level: 'red' | 'amber' | 'green'
  sectionId: SectionId
}

export interface ContractItem {
  id: string
  displayName: string
  status: string
  statusLabel: string
  typeLabel: string
  expiryDate: string | null
  daysUntilExpiry: number | null
  urgency: 'critical' | 'warning' | 'healthy'
}

export interface CaseItem {
  id: string
  title: string
  caseNumber: string
  type: string
  typeLabel: string
  status: string
  statusLabel: string
  updatedDate: string
}

export interface TaskItem {
  id: string
  title: string
  status: string
  statusLabel: string
  priority: string
  priorityLabel: string
  dueDate: string | null
  assignedToName: string
}

export interface PersonItem {
  id: string
  name: string
  role: string
  email: string | null
}

export interface VisitItem {
  id: string
  typeLabel: string
  status: string
  statusLabel: string
  dateLabel: string
  visitorName: string
}

export interface DocumentItem {
  id: string
  fileName: string
  uploadedAt: string
  hasExtraction: boolean
  extractionStatus: string | null
}

export interface FinancialYear {
  year: number
  omsaetning: number | null
  ebitda: number | null
  resultat: number | null
}

export interface OwnershipItem {
  id: string
  ownerName: string
  ownershipPct: number
  isGroup: boolean
}

// ---------------------------------------------------------------
// Sektions-definition
// ---------------------------------------------------------------
type SectionId = 'ownership' | 'contracts' | 'finance' | 'cases' | 'tasks' | 'persons' | 'visits' | 'documents' | 'activity'

interface SectionMeta {
  id: SectionId
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const SECTIONS: SectionMeta[] = [
  { id: 'ownership', label: 'Ejerskab', icon: Briefcase },
  { id: 'contracts', label: 'Kontrakter', icon: FileText },
  { id: 'finance', label: 'Økonomi', icon: TrendingUp },
  { id: 'cases', label: 'Sager', icon: AlertTriangle },
  { id: 'tasks', label: 'Opgaver', icon: CheckSquare },
  { id: 'persons', label: 'Personer', icon: Users },
  { id: 'visits', label: 'Besøg', icon: Calendar },
  { id: 'documents', label: 'Dokumenter', icon: FileText },
  { id: 'activity', label: 'Aktivitet', icon: Activity },
]

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------
function formatMio(val: number): string {
  return (val / 1_000_000).toFixed(1) + 'M'
}
function formatK(val: number): string {
  return Math.round(val / 1000) + 'K'
}

function statusLabel(status: 'critical' | 'warning' | 'healthy'): string {
  if (status === 'critical') return 'Kritisk'
  if (status === 'warning') return 'Advarsel'
  return 'Sund'
}
function statusColor(status: 'critical' | 'warning' | 'healthy'): string {
  if (status === 'critical') return 'bg-rose-50 text-rose-700 ring-rose-200'
  if (status === 'warning') return 'bg-amber-50 text-amber-700 ring-amber-200'
  return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
}

function dimensionColor(level: 'red' | 'amber' | 'green'): string {
  if (level === 'red') return 'bg-rose-500'
  if (level === 'amber') return 'bg-amber-400'
  return 'bg-emerald-400'
}

// ---------------------------------------------------------------
// Sticky sektion-nav (venstre side)
// ---------------------------------------------------------------
function SectionNav({
  sections,
  activeId,
  onJump,
}: {
  sections: SectionMeta[]
  activeId: SectionId | null
  onJump: (id: SectionId) => void
}) {
  return (
    <nav className="sticky top-6 flex flex-col gap-0.5">
      <div className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.1em] px-3 mb-2">
        Oversigt
      </div>
      {sections.map((section) => {
        const Icon = section.icon
        const isActive = activeId === section.id
        return (
          <button
            key={section.id}
            type="button"
            onClick={() => onJump(section.id)}
            className={cn(
              'flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[12px] font-medium text-left transition-colors',
              isActive
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
            )}
          >
            <Icon className={cn('w-3.5 h-3.5 shrink-0', isActive ? 'text-white' : 'text-slate-400')} />
            {section.label}
          </button>
        )
      })}
    </nav>
  )
}

// ---------------------------------------------------------------
// Wrapper for section card
// ---------------------------------------------------------------
function Section({
  id,
  title,
  badge,
  action,
  children,
}: {
  id: SectionId
  title: string
  badge?: { label: string; tone: 'critical' | 'warning' | 'healthy' | 'info' }
  action?: { label: string; href: string }
  children: React.ReactNode
}) {
  const badgeClass =
    badge?.tone === 'critical'
      ? 'bg-rose-50 text-rose-700'
      : badge?.tone === 'warning'
      ? 'bg-amber-50 text-amber-700'
      : badge?.tone === 'healthy'
      ? 'bg-emerald-50 text-emerald-700'
      : 'bg-violet-50 text-violet-700'

  return (
    <section
      id={`section-${id}`}
      className="scroll-mt-6 bg-white rounded-xl ring-1 ring-slate-900/[0.06] shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden"
    >
      <header className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <h2 className="text-[13px] font-semibold text-slate-900">{title}</h2>
          {badge && (
            <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded', badgeClass)}>{badge.label}</span>
          )}
        </div>
        {action && (
          <Link href={action.href} className="text-[11px] font-medium text-slate-500 hover:text-slate-900 flex items-center gap-1 no-underline">
            {action.label}
            <ArrowUpRight className="w-3 h-3" />
          </Link>
        )}
      </header>
      <div className="p-5">{children}</div>
    </section>
  )
}

function DataRow({ label, value, danger, success }: { label: string; value: React.ReactNode; danger?: boolean; success?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-50 last:border-b-0">
      <span className="text-[12px] text-slate-500">{label}</span>
      <span
        className={cn(
          'text-[13px] font-medium tabular-nums',
          danger && 'text-rose-700',
          success && 'text-emerald-700',
          !danger && !success && 'text-slate-900',
        )}
      >
        {value}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------
// Year comparison bar
// ---------------------------------------------------------------
function YearBar({ label, omsaetning, maxValue, active }: { label: string; omsaetning: number; maxValue: number; active?: boolean }) {
  const pct = maxValue > 0 ? (omsaetning / maxValue) * 100 : 0
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-medium text-slate-500">{label}</span>
        <span className="text-[11px] font-medium text-slate-900 tabular-nums">{(omsaetning / 1_000_000).toFixed(1)}M</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={cn('h-full rounded-full', active ? 'bg-slate-900' : 'bg-slate-300')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------
// Hovedkomponent
// ---------------------------------------------------------------

interface Props {
  company: CompanyDetailData
  ownerships: OwnershipItem[]
  contracts: ContractItem[]
  cases: CaseItem[]
  tasks: TaskItem[]
  persons: PersonItem[]
  visits: VisitItem[]
  documents: DocumentItem[]
  latestFinancial: FinancialYear | null
  previousFinancial: FinancialYear | null
  omsaetningTrend: number | null
  ebitdaTrend: number | null
}

export default function CompanyDetailClient({
  company,
  ownerships,
  contracts,
  cases,
  tasks,
  persons,
  visits,
  documents,
  latestFinancial,
  previousFinancial,
  omsaetningTrend,
  ebitdaTrend,
}: Props) {
  const openCases = useMemo(() => cases.filter((c) => c.status !== 'LUKKET' && c.status !== 'ARKIVERET'), [cases])
  const openTasks = useMemo(() => tasks.filter((t) => t.status !== 'LUKKET'), [tasks])
  const expiredContracts = useMemo(() => contracts.filter((c) => c.urgency === 'critical'), [contracts])
  const expiringSoon = useMemo(() => contracts.filter((c) => c.urgency === 'warning'), [contracts])

  // Beregn gruppens og partners ejerskab
  const groupPct = useMemo(() => {
    const groupOwners = ownerships.filter((o) => o.isGroup)
    return groupOwners.reduce((sum, o) => sum + o.ownershipPct, 0)
  }, [ownerships])
  const partnerPct = useMemo(() => {
    const partners = ownerships.filter((o) => !o.isGroup)
    return partners.reduce((sum, o) => sum + o.ownershipPct, 0)
  }, [ownerships])
  const partnerNames = useMemo(() => {
    return ownerships.filter((o) => !o.isGroup).map((o) => o.ownerName)
  }, [ownerships])

  // Synlige sektioner — vis alt der har data
  const visibleSections = useMemo(() => {
    return SECTIONS.filter((section) => {
      if (section.id === 'ownership' && ownerships.length === 0) return false
      if (section.id === 'finance' && !latestFinancial) return false
      if (section.id === 'persons' && persons.length === 0) return false
      if (section.id === 'visits' && visits.length === 0) return false
      return true
    })
  }, [ownerships.length, latestFinancial, persons.length, visits.length])

  // Scroll-spy
  const [activeSection, setActiveSection] = useState<SectionId | null>(visibleSections[0]?.id ?? null)

  useEffect(() => {
    const handler = () => {
      const offsets = visibleSections
        .map((s) => {
          const el = document.getElementById(`section-${s.id}`)
          if (!el) return null
          return { id: s.id, top: el.getBoundingClientRect().top }
        })
        .filter((x): x is { id: SectionId; top: number } => x !== null)
      const active = offsets
        .filter((o) => o.top <= 140)
        .at(-1)
      setActiveSection(active?.id ?? visibleSections[0]?.id ?? null)
    }
    handler()
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [visibleSections])

  function jumpTo(id: SectionId) {
    const el = document.getElementById(`section-${id}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <div className="min-h-full bg-slate-50/60 p-8">
      <div className="max-w-[1280px] mx-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-4">
          <Link href="/companies" className="hover:text-slate-900 transition-colors no-underline">
            Selskaber
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-slate-700 font-medium">{company.name}</span>
        </div>

        {/* Header */}
        <div className="bg-white rounded-xl ring-1 ring-slate-900/[0.06] shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-6 mb-4">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">{company.name}</h1>
                <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded ring-1', statusColor(company.healthStatus))}>
                  {statusLabel(company.healthStatus)}
                </span>
              </div>
              <div className="flex items-center gap-4 text-[12px] text-slate-500 mt-1.5 flex-wrap">
                <span className="tabular-nums">CVR {company.cvr}</span>
                <span>{company.city}</span>
                <span>{company.address}</span>
              </div>

              {/* Health-dimensioner */}
              <div className="flex items-center gap-1.5 mt-4 flex-wrap">
                {company.dimensions.map((dim) => (
                  <button
                    key={dim.label}
                    type="button"
                    onClick={() => jumpTo(dim.sectionId)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-50 hover:bg-slate-100 text-[11px] font-medium text-slate-700 transition-colors"
                  >
                    <span className={cn('w-1.5 h-1.5 rounded-full', dimensionColor(dim.level))} />
                    {dim.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 text-white text-[12px] font-medium hover:bg-slate-800 transition-colors shadow-[0_1px_2px_rgba(15,23,42,0.1)]"
              >
                <Upload className="w-3.5 h-3.5" />
                Upload dokument
              </button>
              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white ring-1 ring-slate-900/[0.08] text-slate-700 text-[12px] font-medium hover:bg-slate-50 transition-colors shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
              >
                <Plus className="w-3.5 h-3.5" />
                Opret opgave
              </button>
            </div>
          </div>
        </div>

        {/* AI-insight */}
        <div className="bg-gradient-to-br from-violet-50 to-indigo-50 ring-1 ring-violet-200/60 rounded-xl p-4 mb-6 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-white ring-1 ring-violet-200 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-violet-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-medium text-violet-700 uppercase tracking-[0.08em]">AI-anbefaling</div>
            <div className="text-[13px] font-semibold text-slate-900 mt-0.5">{company.aiTitle}</div>
            <p className="text-[12px] text-slate-600 mt-1 leading-relaxed">{company.aiBody}</p>
          </div>
        </div>

        {/* Main grid: sticky nav + sections */}
        <div className="grid grid-cols-[180px_1fr] gap-8">
          <SectionNav sections={visibleSections} activeId={activeSection} onJump={jumpTo} />

          <div className="min-w-0 flex flex-col gap-4">
            {/* Ejerskab */}
            {visibleSections.some((s) => s.id === 'ownership') && (
              <Section id="ownership" title="Ejerskab">
                <DataRow label="Kædegruppe-andel" value={`${groupPct.toFixed(1)}%`} />
                {partnerNames.length > 0 && (
                  <DataRow label="Lokal partner" value={`${partnerNames.join(', ')} (${partnerPct.toFixed(1)}%)`} />
                )}
                <DataRow label="Selskabsform" value={company.companyType} />
                <DataRow label="Status" value={company.status === 'aktiv' ? 'Aktiv' : company.status} />

                {/* Ejerskabs-bar */}
                {(groupPct > 0 || partnerPct > 0) && (
                  <div className="mt-4">
                    <div className="flex h-1.5 rounded-full overflow-hidden bg-slate-100">
                      <div className="bg-slate-900" style={{ width: `${groupPct}%` }} />
                      <div className="bg-slate-300" style={{ width: `${partnerPct}%` }} />
                    </div>
                    <div className="flex items-center justify-between mt-1.5 text-[10px] text-slate-400">
                      <span>Kædegruppe {groupPct.toFixed(1)}%</span>
                      <span>Partner {partnerPct.toFixed(1)}%</span>
                    </div>
                  </div>
                )}
              </Section>
            )}

            {/* Kontrakter */}
            {visibleSections.some((s) => s.id === 'contracts') && (
              <Section
                id="contracts"
                title="Kontrakter"
                badge={
                  expiredContracts.length > 0
                    ? { label: `${expiredContracts.length} udløbet`, tone: 'critical' }
                    : expiringSoon.length > 0
                    ? { label: `${expiringSoon.length} udløber snart`, tone: 'warning' }
                    : undefined
                }
                action={contracts.length > 0 ? { label: `Se alle ${contracts.length}`, href: `/companies/${company.id}/contracts` } : undefined}
              >
                {contracts.length === 0 && (
                  <p className="text-[12px] text-slate-400 py-1">Ingen kontrakter registreret.</p>
                )}
                <div className="space-y-0">
                  {contracts.slice(0, 5).map((c) => (
                    <Link
                      key={c.id}
                      href={`/contracts/${c.id}`}
                      className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-b-0 hover:bg-slate-50/50 -mx-5 px-5 no-underline transition-colors"
                    >
                      <div
                        className={cn(
                          'w-8 h-8 rounded-md flex items-center justify-center text-[10px] font-semibold shrink-0',
                          c.urgency === 'critical'
                            ? 'bg-rose-50 text-rose-700'
                            : c.urgency === 'warning'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-slate-50 text-slate-600',
                        )}
                      >
                        {c.displayName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-medium text-slate-900 truncate">{c.displayName}</div>
                        <div className="text-[11px] text-slate-400">
                          {c.expiryDate
                            ? c.urgency === 'critical'
                              ? `Udløbet ${c.expiryDate}`
                              : `Udløber ${c.expiryDate}`
                            : c.statusLabel}
                        </div>
                      </div>
                      <span
                        className={cn(
                          'text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0',
                          c.urgency === 'critical'
                            ? 'bg-rose-50 text-rose-700'
                            : c.urgency === 'warning'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-emerald-50 text-emerald-700',
                        )}
                      >
                        {c.statusLabel}
                      </span>
                    </Link>
                  ))}
                </div>
              </Section>
            )}

            {/* Okonomi */}
            {visibleSections.some((s) => s.id === 'finance') && latestFinancial && (
              <Section
                id="finance"
                title={`Økonomi ${latestFinancial.year}`}
                badge={{
                  label: ebitdaTrend != null && ebitdaTrend < 0 ? 'Faldende EBITDA' : 'Positiv',
                  tone: ebitdaTrend != null && ebitdaTrend < 0 ? 'warning' : 'healthy',
                }}
              >
                <div className="grid grid-cols-2 gap-x-8 gap-y-0">
                  <DataRow
                    label="Omsætning"
                    value={
                      <span className="flex items-center gap-1.5">
                        {formatMio(latestFinancial.omsaetning ?? 0)}
                        {omsaetningTrend != null && (
                          <span className={cn(
                            'text-[10px] font-semibold',
                            omsaetningTrend >= 0 ? 'text-emerald-600' : 'text-rose-600',
                          )}>
                            {omsaetningTrend >= 0 ? '+' : ''}
                            {(omsaetningTrend * 100).toFixed(0)}%
                          </span>
                        )}
                      </span>
                    }
                  />
                  <DataRow
                    label="EBITDA"
                    value={
                      <span className="flex items-center gap-1.5">
                        {formatK(latestFinancial.ebitda ?? 0)}
                        {ebitdaTrend != null && (
                          <span className={cn(
                            'text-[10px] font-semibold',
                            ebitdaTrend >= 0 ? 'text-emerald-600' : 'text-rose-600',
                          )}>
                            {ebitdaTrend >= 0 ? '+' : ''}
                            {(ebitdaTrend * 100).toFixed(0)}%
                          </span>
                        )}
                      </span>
                    }
                  />
                  <DataRow
                    label="EBITDA margin"
                    value={`${latestFinancial.omsaetning ? (((latestFinancial.ebitda ?? 0) / latestFinancial.omsaetning) * 100).toFixed(1) : '0.0'}%`}
                  />
                  <DataRow label="Resultat" value={formatK(latestFinancial.resultat ?? 0)} success={(latestFinancial.resultat ?? 0) > 0} />
                </div>

                {/* Sammenligning */}
                {previousFinancial && (
                  <div className="mt-5 pt-4 border-t border-slate-100">
                    <div className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.08em] mb-2">
                      Udvikling
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <YearBar
                        label={String(previousFinancial.year)}
                        omsaetning={previousFinancial.omsaetning ?? 0}
                        maxValue={Math.max(previousFinancial.omsaetning ?? 0, latestFinancial.omsaetning ?? 0)}
                      />
                      <YearBar
                        label={String(latestFinancial.year)}
                        omsaetning={latestFinancial.omsaetning ?? 0}
                        maxValue={Math.max(previousFinancial.omsaetning ?? 0, latestFinancial.omsaetning ?? 0)}
                        active
                      />
                    </div>
                  </div>
                )}
              </Section>
            )}

            {/* Sager */}
            {visibleSections.some((s) => s.id === 'cases') && (
              <Section
                id="cases"
                title="Åbne sager"
                badge={
                  openCases.length > 0
                    ? { label: `${openCases.length} aktive`, tone: 'critical' }
                    : { label: 'Ingen åbne', tone: 'healthy' }
                }
              >
                {openCases.length === 0 && (
                  <p className="text-[12px] text-slate-400 py-1">Ingen åbne sager på dette selskab.</p>
                )}
                <div className="space-y-0">
                  {openCases.map((c) => (
                    <div key={c.id} className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-b-0">
                      <div
                        className={cn(
                          'w-8 h-8 rounded-md flex items-center justify-center text-[10px] font-semibold shrink-0',
                          c.type === 'COMPLIANCE' || c.type === 'TVIST'
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-amber-50 text-amber-700',
                        )}
                      >
                        {c.typeLabel.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-medium text-slate-900 truncate">{c.title}</div>
                        <div className="text-[11px] text-slate-400">
                          {c.typeLabel} · #{c.caseNumber} · Opdateret {c.updatedDate}
                        </div>
                      </div>
                      <span className="text-[10px] font-medium text-slate-500 shrink-0">{c.statusLabel}</span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Opgaver */}
            {visibleSections.some((s) => s.id === 'tasks') && (
              <Section
                id="tasks"
                title="Opgaver"
                badge={
                  openTasks.length > 0
                    ? { label: `${openTasks.length} åbne`, tone: 'info' }
                    : { label: 'Ingen åbne', tone: 'healthy' }
                }
                action={openTasks.length > 0 ? { label: 'Se alle', href: '/tasks' } : undefined}
              >
                {openTasks.length === 0 && (
                  <p className="text-[12px] text-slate-400 py-1">Ingen åbne opgaver.</p>
                )}
                <div className="space-y-0">
                  {openTasks.slice(0, 4).map((t) => (
                    <Link
                      key={t.id}
                      href={`/tasks/${t.id}`}
                      className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-b-0 hover:bg-slate-50/50 -mx-5 px-5 no-underline transition-colors"
                    >
                      <div
                        className={cn(
                          'w-1 self-stretch rounded-full shrink-0',
                          t.priority === 'KRITISK' ? 'bg-rose-500' : t.priority === 'HOEJ' ? 'bg-amber-400' : 'bg-slate-300',
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-medium text-slate-900 truncate">{t.title}</div>
                        <div className="text-[11px] text-slate-400">
                          {t.assignedToName} · {t.dueDate ? `Frist ${t.dueDate}` : 'Ingen frist'}
                        </div>
                      </div>
                      <span className="text-[10px] font-medium text-slate-500 shrink-0">{t.statusLabel}</span>
                    </Link>
                  ))}
                </div>
              </Section>
            )}

            {/* Personer */}
            {visibleSections.some((s) => s.id === 'persons') && (
              <Section
                id="persons"
                title="Nøglepersoner"
                action={persons.length > 3 ? { label: `Alle ${persons.length}`, href: `/companies/${company.id}/employees` } : undefined}
              >
                <div className="space-y-0">
                  {persons.slice(0, 4).map((p) => (
                    <div key={p.id} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-b-0">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-semibold text-slate-600 shrink-0">
                        {p.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-medium text-slate-900 truncate">{p.name}</div>
                        <div className="text-[11px] text-slate-400 truncate">{p.role}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Besog */}
            {visibleSections.some((s) => s.id === 'visits') && (
              <Section id="visits" title="Besøg & governance">
                <div className="space-y-0">
                  {visits.slice(0, 4).map((v) => (
                    <div key={v.id} className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-b-0">
                      <div
                        className={cn(
                          'w-8 h-8 rounded-md flex items-center justify-center text-[10px] font-semibold shrink-0',
                          v.status === 'PLANLAGT'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-emerald-50 text-emerald-700',
                        )}
                      >
                        <Calendar className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-medium text-slate-900 truncate">{v.typeLabel}</div>
                        <div className="text-[11px] text-slate-400">{v.dateLabel}</div>
                      </div>
                      <span className="text-[10px] font-medium text-slate-500 shrink-0">{v.statusLabel}</span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Dokumenter */}
            {visibleSections.some((s) => s.id === 'documents') && (
              <Section
                id="documents"
                title="Dokumenter"
                badge={documents.some((d) => d.extractionStatus === 'completed' && d.hasExtraction) ? { label: 'AI-behandlet', tone: 'info' } : undefined}
                action={documents.length > 0 ? { label: `Alle ${documents.length}`, href: `/companies/${company.id}/documents` } : undefined}
              >
                {documents.length === 0 && (
                  <p className="text-[12px] text-slate-400 py-1">Ingen dokumenter endnu.</p>
                )}
                <div className="space-y-0">
                  {documents.slice(0, 4).map((d) => (
                    <div key={d.id} className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-b-0">
                      <div className="w-8 h-8 rounded-md bg-slate-50 text-slate-500 flex items-center justify-center shrink-0">
                        <FileText className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-medium text-slate-900 truncate">{d.fileName}</div>
                        <div className="text-[11px] text-slate-400">
                          {d.uploadedAt}
                          {d.hasExtraction && <> · AI-behandlet</>}
                        </div>
                      </div>
                      <span
                        className={cn(
                          'text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0',
                          d.hasExtraction ? 'bg-violet-50 text-violet-700' : 'bg-slate-50 text-slate-600',
                        )}
                      >
                        {d.hasExtraction ? 'Til review' : 'Klar'}
                      </span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Aktivitet */}
            {visibleSections.some((s) => s.id === 'activity') && (
              <Section id="activity" title="Aktivitet">
                <p className="text-[12px] text-slate-400 py-1">Ingen aktivitet registreret endnu.</p>
              </Section>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
