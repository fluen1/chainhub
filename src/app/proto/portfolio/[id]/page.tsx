'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useParams, notFound } from 'next/navigation'
import {
  ChevronRight,
  Upload,
  Plus,
  Sparkles,
  FileText,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Users,
  Calendar,
  Briefcase,
  CheckSquare,
  Activity,
  ArrowUpRight,
} from 'lucide-react'
import { usePrototype } from '@/components/prototype/PrototypeProvider'
import { getCompanyById } from '@/mock/companies'
import { getContractsByCompany } from '@/mock/contracts'
import { getFinancialByCompany } from '@/mock/financial'
import { getDocumentsByCompany } from '@/mock/documents'
import { getPersonsByCompany } from '@/mock/persons'
import { getCasesByCompany } from '@/mock/cases'
import { getVisitsByCompany } from '@/mock/visits'
import { getTasksByCompany } from '@/mock/tasks'
import type { MockCompany } from '@/mock/types'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------
// Sektions-definition — bestemmer rækkefølge + rolle-synlighed
// ---------------------------------------------------------------
type SectionId = 'ownership' | 'contracts' | 'finance' | 'cases' | 'tasks' | 'persons' | 'visits' | 'documents' | 'activity'

interface SectionMeta {
  id: SectionId
  label: string
  icon: React.ComponentType<{ className?: string }>
  roles: string[]
}

const SECTIONS: SectionMeta[] = [
  { id: 'ownership', label: 'Ejerskab',     icon: Briefcase,   roles: ['GROUP_OWNER', 'GROUP_LEGAL', 'GROUP_ADMIN'] },
  { id: 'contracts', label: 'Kontrakter',   icon: FileText,    roles: ['GROUP_OWNER', 'GROUP_LEGAL', 'GROUP_FINANCE'] },
  { id: 'finance',   label: 'Økonomi',      icon: TrendingUp,  roles: ['GROUP_OWNER', 'GROUP_FINANCE'] },
  { id: 'cases',     label: 'Sager',        icon: AlertTriangle, roles: ['GROUP_OWNER', 'GROUP_LEGAL'] },
  { id: 'tasks',     label: 'Opgaver',      icon: CheckSquare, roles: ['GROUP_OWNER', 'GROUP_LEGAL', 'GROUP_FINANCE', 'GROUP_ADMIN'] },
  { id: 'persons',   label: 'Personer',     icon: Users,       roles: ['GROUP_OWNER', 'GROUP_ADMIN', 'COMPANY_MANAGER'] },
  { id: 'visits',    label: 'Besøg',        icon: Calendar,    roles: ['GROUP_OWNER', 'GROUP_ADMIN', 'COMPANY_MANAGER'] },
  { id: 'documents', label: 'Dokumenter',   icon: FileText,    roles: ['GROUP_OWNER', 'GROUP_LEGAL', 'GROUP_ADMIN'] },
  { id: 'activity',  label: 'Aktivitet',    icon: Activity,    roles: ['GROUP_OWNER', 'GROUP_LEGAL', 'GROUP_FINANCE', 'GROUP_ADMIN'] },
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

function statusLabel(status: MockCompany['healthStatus']): string {
  if (status === 'critical') return 'Kritisk'
  if (status === 'warning') return 'Advarsel'
  return 'Sund'
}
function statusColor(status: MockCompany['healthStatus']): string {
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
// Wrapper for section card (med id til anchor-scroll)
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
// Hovedkomponent
// ---------------------------------------------------------------
export default function CompanyDetailPage() {
  const params = useParams<{ id: string }>()
  const { activeUser } = usePrototype()
  const role = activeUser.role

  const company = getCompanyById(params.id)
  if (!company) notFound()

  // Data
  const contracts = getContractsByCompany(company.id)
  const financial = getFinancialByCompany(company.id)
  const fin2025 = financial.find((f) => f.year === 2025)
  const fin2024 = financial.find((f) => f.year === 2024)
  const persons = getPersonsByCompany(company.id)
  const cases = getCasesByCompany(company.id)
  const visits = getVisitsByCompany(company.id)
  const documents = getDocumentsByCompany(company.id)
  const tasks = getTasksByCompany(company.id)

  const openCases = cases.filter((c) => c.status !== 'LUKKET')
  const openTasks = tasks.filter((t) => t.status !== 'LUKKET')
  const expiredContracts = contracts.filter((c) => c.status === 'UDLOEBET')
  const expiringSoon = contracts.filter((c) => c.daysUntilExpiry != null && c.daysUntilExpiry <= 30 && c.daysUntilExpiry >= 0)

  // Health-dimensioner (afledt)
  const dimensions = useMemo(() => {
    const contractsLvl: 'red' | 'amber' | 'green' =
      expiredContracts.length > 0 ? 'red' : expiringSoon.length > 0 ? 'amber' : 'green'
    const casesLvl: 'red' | 'amber' | 'green' =
      openCases.length >= 2 ? 'red' : openCases.length === 1 ? 'amber' : 'green'
    const ebitdaTrend = fin2025?.ebitdaTrend ?? 0
    const financeLvl: 'red' | 'amber' | 'green' = ebitdaTrend < -0.1 ? 'red' : ebitdaTrend < 0 ? 'amber' : 'green'
    const governanceLvl: 'red' | 'amber' | 'green' =
      cases.some((c) => c.type === 'GOVERNANCE' && c.status !== 'LUKKET') ? 'amber' : 'green'

    return [
      { label: 'Kontrakter', level: contractsLvl, sectionId: 'contracts' as SectionId },
      { label: 'Sager',      level: casesLvl,     sectionId: 'cases' as SectionId },
      { label: 'Økonomi',    level: financeLvl,   sectionId: 'finance' as SectionId },
      { label: 'Governance', level: governanceLvl, sectionId: 'activity' as SectionId },
    ]
  }, [expiredContracts.length, expiringSoon.length, openCases, fin2025?.ebitdaTrend, cases])

  // Synlige sektioner baseret på rolle + data
  const visibleSections = useMemo(() => {
    return SECTIONS.filter((section) => {
      if (!section.roles.includes(role)) return false
      // Skjul sektioner uden data
      if (section.id === 'finance' && !fin2025) return false
      if (section.id === 'persons' && persons.length === 0) return false
      if (section.id === 'visits' && visits.length === 0) return false
      return true
    })
  }, [role, fin2025, persons.length, visits.length])

  // Scroll-spy for aktiv sektion i sidebar
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
      const current = offsets.find((o) => o.top > 80) ?? offsets[offsets.length - 1]
      // vælg forrige hvis current er langt nede
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

  // AI-anbefaling (afledt — prototype)
  const topIssue = company.healthReasons[0] ?? null
  const aiRecommendation = useMemo(() => {
    if (company.healthStatus === 'healthy') {
      return {
        title: 'Selskabet er i god stand',
        body: `${company.name.replace(' ApS', '')} har ingen kritiske forhold. ${fin2025 ? `Omsætning ${formatMio(fin2025.omsaetning ?? 0)}, EBITDA-margin ${((fin2025.ebitda ?? 0) / (fin2025.omsaetning ?? 1) * 100).toFixed(1)}%.` : ''} Næste planlagte handling: ${visits[0]?.dateLabel ? 'driftsbesøg ' + visits[0].dateLabel : 'kvartalsrapport'}.`,
      }
    }
    return {
      title: topIssue ?? 'Kræver opmærksomhed',
      body:
        openCases.length > 0
          ? `${company.name.replace(' ApS', '')} har ${openCases.length} åben${openCases.length > 1 ? 'ne' : ''} sag${openCases.length > 1 ? 'er' : ''} og ${expiredContracts.length + expiringSoon.length} kontrakt${expiredContracts.length + expiringSoon.length === 1 ? '' : 'er'} der kræver handling. Anbefaling: prioriter ${expiredContracts.length > 0 ? 'fornyelse af udløbne kontrakter' : 'gennemgang af åbne sager'} inden for 7 dage.`
          : `${topIssue ?? 'Selskabet har forhold der kræver opmærksomhed.'} Gennemgå sektionerne nedenfor for at tage handling.`,
    }
  }, [company, fin2025, topIssue, openCases, expiredContracts, expiringSoon, visits])

  // Activity feed — genereret
  const activityFeed = useMemo(() => {
    const items: { dot: string; text: string; meta: string }[] = []
    if (documents.length > 0) {
      items.push({ dot: '#a855f7', text: `Dokument uploadet: ${documents[0].fileName}`, meta: 'AI-behandlet · 2t siden' })
    }
    if (visits.length > 0) {
      items.push({ dot: '#3b82f6', text: `${visits[0].typeLabel} ${visits[0].status === 'GENNEMFOERT' ? 'gennemført' : 'planlagt'}`, meta: '1 dag siden' })
    }
    if (openCases.length > 0) {
      items.push({ dot: '#ef4444', text: `Sag opdateret: ${openCases[0].title}`, meta: '3 dage siden' })
    }
    if (openTasks.length > 0) {
      items.push({ dot: '#f59e0b', text: `Opgave oprettet: ${openTasks[0].title}`, meta: '5 dage siden' })
    }
    items.push({ dot: '#22c55e', text: 'Månedsrapport genereret', meta: '7 dage siden' })
    return items.slice(0, 5)
  }, [documents, visits, openCases, openTasks])

  return (
    <div className="min-h-full bg-slate-50/60 p-8">
      <div className="max-w-[1280px] mx-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-4">
          <Link href="/proto/portfolio" className="hover:text-slate-900 transition-colors no-underline">
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
                <span>{company.employeeCount} medarbejdere</span>
              </div>

              {/* Health-dimensioner — klikbare */}
              <div className="flex items-center gap-1.5 mt-4 flex-wrap">
                {dimensions.map((dim) => (
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

        {/* AI-insight — placeret øverst hvor den gør mest gavn */}
        <div className="bg-gradient-to-br from-violet-50 to-indigo-50 ring-1 ring-violet-200/60 rounded-xl p-4 mb-6 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-white ring-1 ring-violet-200 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-violet-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-medium text-violet-700 uppercase tracking-[0.08em]">AI-anbefaling</div>
            <div className="text-[13px] font-semibold text-slate-900 mt-0.5">{aiRecommendation.title}</div>
            <p className="text-[12px] text-slate-600 mt-1 leading-relaxed">{aiRecommendation.body}</p>
          </div>
        </div>

        {/* Main grid: sticky nav + sections */}
        <div className="grid grid-cols-[180px_1fr] gap-8">
          <SectionNav sections={visibleSections} activeId={activeSection} onJump={jumpTo} />

          <div className="min-w-0 flex flex-col gap-4">
            {/* Ownership */}
            {visibleSections.some((s) => s.id === 'ownership') && (
              <Section id="ownership" title="Ejerskab">
                <DataRow label="Kædegruppe-andel" value={`${company.groupOwnershipPct}%`} />
                <DataRow label="Lokal partner" value={`${company.partnerName} (${company.partnerOwnershipPct}%)`} />
                <DataRow label="Selskabsform" value={company.companyType} />
                <DataRow label="Status" value={company.status === 'AKTIV' ? 'Aktiv' : company.status} />

                {/* Ejerskabs-bar */}
                <div className="mt-4">
                  <div className="flex h-1.5 rounded-full overflow-hidden bg-slate-100">
                    <div className="bg-slate-900" style={{ width: `${company.groupOwnershipPct}%` }} />
                    <div className="bg-slate-300" style={{ width: `${company.partnerOwnershipPct}%` }} />
                  </div>
                  <div className="flex items-center justify-between mt-1.5 text-[10px] text-slate-400">
                    <span>Kædegruppe {company.groupOwnershipPct}%</span>
                    <span>Partner {company.partnerOwnershipPct}%</span>
                  </div>
                </div>
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
                action={{ label: `Se alle ${contracts.length}`, href: '/proto/contracts' }}
              >
                <div className="space-y-0">
                  {contracts.slice(0, 5).map((c) => (
                    <Link
                      key={c.id}
                      href={`/proto/contracts/${c.id}`}
                      className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-b-0 hover:bg-slate-50/50 -mx-5 px-5 no-underline transition-colors"
                    >
                      <div
                        className={cn(
                          'w-8 h-8 rounded-md flex items-center justify-center text-[10px] font-semibold shrink-0',
                          c.status === 'UDLOEBET'
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
                            ? c.status === 'UDLOEBET'
                              ? `Udløbet ${c.expiryDate}`
                              : `Udløber ${c.expiryDate}`
                            : c.statusLabel}
                        </div>
                      </div>
                      <span
                        className={cn(
                          'text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0',
                          c.status === 'UDLOEBET'
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

            {/* Økonomi */}
            {visibleSections.some((s) => s.id === 'finance') && fin2025 && (
              <Section
                id="finance"
                title="Økonomi 2025"
                badge={{
                  label: (fin2025.ebitdaTrend ?? 0) < 0 ? 'Faldende EBITDA' : 'Positiv',
                  tone: (fin2025.ebitdaTrend ?? 0) < 0 ? 'warning' : 'healthy',
                }}
              >
                <div className="grid grid-cols-2 gap-x-8 gap-y-0">
                  <DataRow
                    label="Omsætning"
                    value={
                      <span className="flex items-center gap-1.5">
                        {formatMio(fin2025.omsaetning ?? 0)}
                        {fin2025.omsaetningTrend != null && (
                          <span className={cn(
                            'text-[10px] font-semibold',
                            fin2025.omsaetningTrend >= 0 ? 'text-emerald-600' : 'text-rose-600',
                          )}>
                            {fin2025.omsaetningTrend >= 0 ? '+' : ''}
                            {(fin2025.omsaetningTrend * 100).toFixed(0)}%
                          </span>
                        )}
                      </span>
                    }
                  />
                  <DataRow
                    label="EBITDA"
                    value={
                      <span className="flex items-center gap-1.5">
                        {formatK(fin2025.ebitda ?? 0)}
                        {fin2025.ebitdaTrend != null && (
                          <span className={cn(
                            'text-[10px] font-semibold',
                            fin2025.ebitdaTrend >= 0 ? 'text-emerald-600' : 'text-rose-600',
                          )}>
                            {fin2025.ebitdaTrend >= 0 ? '+' : ''}
                            {(fin2025.ebitdaTrend * 100).toFixed(0)}%
                          </span>
                        )}
                      </span>
                    }
                  />
                  <DataRow
                    label="EBITDA margin"
                    value={`${(((fin2025.ebitda ?? 0) / (fin2025.omsaetning ?? 1)) * 100).toFixed(1)}%`}
                  />
                  <DataRow label="Resultat" value={formatK(fin2025.resultat ?? 0)} success={(fin2025.resultat ?? 0) > 0} />
                </div>

                {/* Sammenligning 2024 vs 2025 */}
                {fin2024 && (
                  <div className="mt-5 pt-4 border-t border-slate-100">
                    <div className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.08em] mb-2">
                      Udvikling
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <YearBar label="2024" omsaetning={fin2024.omsaetning ?? 0} maxValue={Math.max(fin2024.omsaetning ?? 0, fin2025.omsaetning ?? 0)} />
                      <YearBar label="2025" omsaetning={fin2025.omsaetning ?? 0} maxValue={Math.max(fin2024.omsaetning ?? 0, fin2025.omsaetning ?? 0)} active />
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
                action={openTasks.length > 0 ? { label: 'Se alle', href: '/proto/tasks' } : undefined}
              >
                {openTasks.length === 0 && (
                  <p className="text-[12px] text-slate-400 py-1">Ingen åbne opgaver.</p>
                )}
                <div className="space-y-0">
                  {openTasks.slice(0, 4).map((t) => (
                    <Link
                      key={t.id}
                      href={`/proto/tasks/${t.id}`}
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
                action={persons.length > 3 ? { label: `Alle ${persons.length}`, href: '#' } : undefined}
              >
                <div className="space-y-0">
                  {persons.slice(0, 4).map((p) => (
                    <div key={p.email} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-b-0">
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

            {/* Besøg */}
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
                      <span className="text-[10px] font-medium text-slate-500 shrink-0">
                        {v.status === 'PLANLAGT' ? 'Planlagt' : v.status === 'GENNEMFOERT' ? 'Gennemført' : 'Aflyst'}
                      </span>
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
                badge={documents.some((d) => d.status === 'ready_for_review') ? { label: '1 til review', tone: 'info' } : undefined}
                action={documents.length > 0 ? { label: `Alle ${documents.length}`, href: '/proto/documents' } : undefined}
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
                          {d.status === 'ready_for_review' && <> · AI-behandlet</>}
                        </div>
                      </div>
                      <span
                        className={cn(
                          'text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0',
                          d.status === 'ready_for_review' ? 'bg-violet-50 text-violet-700' : 'bg-slate-50 text-slate-600',
                        )}
                      >
                        {d.status === 'ready_for_review' ? 'Til review' : d.status === 'archived' ? 'Arkiveret' : 'Klar'}
                      </span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Aktivitet */}
            {visibleSections.some((s) => s.id === 'activity') && (
              <Section id="activity" title="Aktivitet">
                <div className="space-y-0">
                  {activityFeed.map((item, i) => (
                    <div key={i} className="flex gap-3 py-2 border-b border-slate-50 last:border-b-0">
                      <div className="w-1.5 h-1.5 rounded-full mt-[7px] shrink-0" style={{ backgroundColor: item.dot }} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] font-medium text-slate-800 leading-snug">{item.text}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{item.meta}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------
// Year comparison bar (finance sektion)
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
