'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useParams, notFound } from 'next/navigation'
import {
  ChevronRight,
  Download,
  Plus,
  Sparkles,
  AlertTriangle,
  CheckSquare,
  FileText,
  Activity,
  ArrowUpRight,
  AlertCircle,
} from 'lucide-react'
import { getContractById, getContractsByCompany } from '@/mock/contracts'
import { getCompanyById } from '@/mock/companies'
import { getCasesByCompany } from '@/mock/cases'
import { getTasksByCompany } from '@/mock/tasks'
import { getDocumentsByCompany } from '@/mock/documents'
import { cn } from '@/lib/utils'
import type { MockContract } from '@/mock/types'

// ---------------------------------------------------------------
// Helpers (genbrugt fra liste)
// ---------------------------------------------------------------
type DerivedStatus = 'expired' | 'expiring' | 'active'

function deriveStatus(c: MockContract): DerivedStatus {
  if (c.status === 'UDLOEBET') return 'expired'
  if (c.status === 'AKTIV' && c.daysUntilExpiry != null && c.daysUntilExpiry >= 0 && c.daysUntilExpiry <= 90)
    return 'expiring'
  return 'active'
}

function statusLabel(s: DerivedStatus): string {
  if (s === 'expired') return 'Udløbet'
  if (s === 'expiring') return 'Udløber snart'
  return 'Aktiv'
}

function statusColor(s: DerivedStatus): string {
  if (s === 'expired') return 'bg-rose-50 text-rose-700 ring-rose-200'
  if (s === 'expiring') return 'bg-amber-50 text-amber-700 ring-amber-200'
  return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
}

function relativeDate(daysUntilExpiry: number | null): string {
  if (daysUntilExpiry == null) return '—'
  if (daysUntilExpiry < 0) return `${Math.abs(daysUntilExpiry)} dage siden`
  if (daysUntilExpiry === 0) return 'I dag'
  if (daysUntilExpiry === 1) return 'I morgen'
  return `om ${daysUntilExpiry} dage`
}

// ---------------------------------------------------------------
// Sektion-definition (til sticky sidebar-nav)
// ---------------------------------------------------------------
type SectionId = 'cases' | 'tasks' | 'documents' | 'activity'

interface SectionMeta {
  id: SectionId
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const SECTIONS: SectionMeta[] = [
  { id: 'cases',     label: 'Relaterede sager',   icon: AlertTriangle },
  { id: 'tasks',     label: 'Relaterede opgaver', icon: CheckSquare },
  { id: 'documents', label: 'Dokumenter',         icon: FileText },
  { id: 'activity',  label: 'Aktivitet',          icon: Activity },
]

// ---------------------------------------------------------------
// Sektion wrapper
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
          <Link
            href={action.href}
            className="text-[11px] font-medium text-slate-500 hover:text-slate-900 flex items-center gap-1 no-underline"
          >
            {action.label}
            <ArrowUpRight className="w-3 h-3" />
          </Link>
        )}
      </header>
      <div className="p-5">{children}</div>
    </section>
  )
}

// ---------------------------------------------------------------
// Sidebar-nav
// ---------------------------------------------------------------
function SectionNav({
  activeId,
  onJump,
}: {
  activeId: SectionId | null
  onJump: (id: SectionId) => void
}) {
  return (
    <nav className="sticky top-6 flex flex-col gap-0.5">
      <div className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.1em] px-3 mb-2">Oversigt</div>
      {SECTIONS.map((section) => {
        const Icon = section.icon
        const isActive = activeId === section.id
        return (
          <button
            key={section.id}
            type="button"
            onClick={() => onJump(section.id)}
            className={cn(
              'flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[12px] font-medium text-left transition-colors',
              isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
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
// Hovedkomponent
// ---------------------------------------------------------------
export default function ContractDetailPage() {
  const params = useParams<{ id: string }>()
  const contract = getContractById(params.id)
  if (!contract) notFound()

  const company = getCompanyById(contract.companyId)
  const derived = deriveStatus(contract)

  // Relaterede data
  const allCases = company ? getCasesByCompany(company.id) : []
  const relatedCases = allCases.filter(
    (c) => c.type === 'KONTRAKT' || c.status !== 'LUKKET',
  ).slice(0, 3)
  const allTasks = company ? getTasksByCompany(company.id) : []
  const relatedTasks = allTasks.filter((t) => t.status !== 'LUKKET').slice(0, 3)
  const allDocs = company ? getDocumentsByCompany(company.id) : []
  const relatedDocs = allDocs.slice(0, 3)

  // Andre kontrakter for samme selskab (til "samme kategori")
  const companyContracts = company ? getContractsByCompany(company.id) : []
  const sameCategory = companyContracts.filter((c) => c.id !== contract.id && c.categoryLabel === contract.categoryLabel)

  // Sticky sidebar scroll-spy
  const [activeSection, setActiveSection] = useState<SectionId | null>('cases')

  useEffect(() => {
    const handler = () => {
      const offsets = SECTIONS.map((s) => {
        const el = document.getElementById(`section-${s.id}`)
        if (!el) return null
        return { id: s.id, top: el.getBoundingClientRect().top }
      }).filter((x): x is { id: SectionId; top: number } => x !== null)
      const active = offsets.filter((o) => o.top <= 140).at(-1)
      setActiveSection(active?.id ?? SECTIONS[0].id)
    }
    handler()
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  function jumpTo(id: SectionId) {
    const el = document.getElementById(`section-${id}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Nøglevilkår — AI-mocket
  const keyTerms = useMemo(() => {
    const parter = company
      ? `${company.name.replace(' ApS', '')} (${company.groupOwnershipPct}%) · ${company.partnerName} (${company.partnerOwnershipPct}%)`
      : '—'

    return {
      type: contract.categoryLabel + ' — ' + contract.systemType.toLowerCase().replace(/_/g, ' '),
      parter,
      loebetid: contract.expiryDate ? 'Aftalt løbetid' : 'Løbende aftale',
      udloeb: contract.expiryDate
        ? `${contract.expiryDate} (${relativeDate(contract.daysUntilExpiry)})`
        : 'Ingen udløbsdato',
      opsigelse: '6 måneders varsel',
      status: contract.statusLabel,
    }
  }, [contract, company])

  // Kritisk indsigt — kun for expired/expiring
  const criticalInsight = useMemo(() => {
    if (derived === 'expired') {
      return {
        title: 'Kontrakten er udløbet',
        body: `Denne ${contract.categoryLabel.toLowerCase()} udløb ${relativeDate(contract.daysUntilExpiry)}. Selskabet er potentielt ikke dækket — start genforhandling umiddelbart eller opret opfølgningsopgave.`,
      }
    }
    if (derived === 'expiring') {
      return {
        title: 'Kontrakten udløber snart',
        body: `${contract.daysUntilExpiry} dage til udløb. Anbefaling: initier genforhandling inden for 14 dage for at undgå dækningsbrud.`,
      }
    }
    return null
  }, [derived, contract])

  // Primary CTA baseret på status
  const primaryCta =
    derived === 'expired'
      ? { label: 'Opret opfølgningsopgave', icon: Plus }
      : derived === 'expiring'
      ? { label: 'Opret opgave', icon: Plus }
      : { label: 'Opret opgave', icon: Plus }

  // Activity feed (mock)
  const activityFeed = [
    { dot: '#a855f7', text: `${contract.displayName} uploadet`, meta: 'AI-behandlet · 2 måneder siden' },
    { dot: '#3b82f6', text: 'Kontrakt gennemgået af jurist', meta: '2 måneder siden' },
    ...(derived === 'expired' ? [{ dot: '#ef4444', text: 'Udløbsdato overskredet — automatisk alert', meta: `${Math.abs(contract.daysUntilExpiry ?? 0)} dage siden` }] : []),
  ]

  return (
    <div className="min-h-full bg-slate-50/60 p-8">
      <div className="max-w-[1280px] mx-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-4">
          <Link href="/proto/contracts" className="hover:text-slate-900 transition-colors no-underline">
            Kontrakter
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-slate-700 font-medium">{contract.displayName}</span>
        </div>

        {/* Header */}
        <div className="bg-white rounded-xl ring-1 ring-slate-900/[0.06] shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-6 mb-4">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">{contract.displayName}</h1>
                <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded ring-1', statusColor(derived))}>
                  {statusLabel(derived)}
                </span>
              </div>
              <div className="flex items-center gap-4 text-[12px] text-slate-500 mt-1.5 flex-wrap">
                {company && (
                  <Link href={`/proto/portfolio/${company.id}`} className="text-slate-500 hover:text-slate-900 no-underline">
                    {company.name}
                  </Link>
                )}
                <span>{contract.categoryLabel}</span>
                {contract.sensitivity && <span>Følsomhed: {contract.sensitivity}</span>}
              </div>
            </div>

            {/* CTAs */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 text-white text-[12px] font-medium hover:bg-slate-800 transition-colors shadow-[0_1px_2px_rgba(15,23,42,0.1)]"
              >
                <primaryCta.icon className="w-3.5 h-3.5" />
                {primaryCta.label}
              </button>
              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white ring-1 ring-slate-900/[0.08] text-slate-700 text-[12px] font-medium hover:bg-slate-50 transition-colors shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
              >
                <Download className="w-3.5 h-3.5" />
                Download PDF
              </button>
            </div>
          </div>
        </div>

        {/* Hero: Nøglevilkår (AI-ekstraheret) */}
        <div className="bg-gradient-to-br from-violet-50 to-indigo-50 ring-1 ring-violet-200/60 rounded-xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-md bg-white ring-1 ring-violet-200 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-violet-600" />
            </div>
            <div className="text-[10px] font-medium text-violet-700 uppercase tracking-[0.08em]">
              Nøglevilkår · AI-ekstraheret
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-3">
            <KeyTerm label="Type" value={keyTerms.type} />
            <KeyTerm label="Parter" value={keyTerms.parter} />
            <KeyTerm label="Løbetid" value={keyTerms.loebetid} />
            <KeyTerm label="Udløb" value={keyTerms.udloeb} danger={derived === 'expired'} warning={derived === 'expiring'} />
            <KeyTerm label="Opsigelse" value={keyTerms.opsigelse} />
            <KeyTerm label="Status" value={keyTerms.status} />
          </div>

          {criticalInsight && (
            <div className="mt-4 pt-4 border-t border-violet-200/60 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <div className="text-[12px] font-semibold text-slate-900">{criticalInsight.title}</div>
                <p className="text-[12px] text-slate-700 mt-0.5 leading-relaxed">{criticalInsight.body}</p>
              </div>
            </div>
          )}
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-[180px_1fr] gap-8">
          <SectionNav activeId={activeSection} onJump={jumpTo} />

          <div className="min-w-0 flex flex-col gap-4">
            {/* Relaterede sager */}
            <Section
              id="cases"
              title="Relaterede sager"
              badge={
                relatedCases.length > 0
                  ? { label: `${relatedCases.length}`, tone: 'critical' }
                  : { label: 'Ingen', tone: 'healthy' }
              }
            >
              {relatedCases.length === 0 && (
                <p className="text-[12px] text-slate-400 py-1">Ingen relaterede sager på denne kontrakt.</p>
              )}
              <div className="space-y-0">
                {relatedCases.map((c) => (
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

            {/* Relaterede opgaver */}
            <Section
              id="tasks"
              title="Relaterede opgaver"
              badge={
                relatedTasks.length > 0
                  ? { label: `${relatedTasks.length} åbne`, tone: 'info' }
                  : { label: 'Ingen', tone: 'healthy' }
              }
            >
              {relatedTasks.length === 0 && (
                <p className="text-[12px] text-slate-400 py-1">Ingen åbne opgaver.</p>
              )}
              <div className="space-y-0">
                {relatedTasks.map((t) => (
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

            {/* Dokumenter */}
            <Section
              id="documents"
              title="Dokumenter"
              action={allDocs.length > 0 ? { label: `Alle ${allDocs.length}`, href: '/proto/documents' } : undefined}
            >
              {relatedDocs.length === 0 && (
                <p className="text-[12px] text-slate-400 py-1">Ingen dokumenter endnu.</p>
              )}
              <div className="space-y-0">
                {relatedDocs.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-b-0">
                    <div className="w-8 h-8 rounded-md bg-slate-50 text-slate-500 flex items-center justify-center shrink-0">
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-medium text-slate-900 truncate">{d.fileName}</div>
                      <div className="text-[11px] text-slate-400">{d.uploadedAt}</div>
                    </div>
                  </div>
                ))}
              </div>

              {sameCategory.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <div className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.08em] mb-2">
                    Relaterede kontrakter ({contract.categoryLabel.toLowerCase()})
                  </div>
                  {sameCategory.slice(0, 3).map((sc) => (
                    <Link
                      key={sc.id}
                      href={`/proto/contracts/${sc.id}`}
                      className="flex items-center justify-between py-1.5 no-underline text-slate-600 hover:text-slate-900"
                    >
                      <span className="text-[12px] truncate">{sc.displayName}</span>
                      <span className="text-[10px] text-slate-400 shrink-0 ml-2">{sc.statusLabel}</span>
                    </Link>
                  ))}
                </div>
              )}
            </Section>

            {/* Aktivitet */}
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
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------
// Key term row
// ---------------------------------------------------------------
function KeyTerm({
  label,
  value,
  danger,
  warning,
}: {
  label: string
  value: string
  danger?: boolean
  warning?: boolean
}) {
  return (
    <div>
      <div className="text-[10px] font-medium text-violet-700 uppercase tracking-[0.08em] mb-0.5">{label}</div>
      <div
        className={cn(
          'text-[13px] font-medium text-slate-900',
          danger && 'text-rose-700',
          warning && 'text-amber-700',
        )}
      >
        {value}
      </div>
    </div>
  )
}
