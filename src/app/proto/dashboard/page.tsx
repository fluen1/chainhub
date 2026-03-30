'use client'

import { Building2 } from 'lucide-react'
import { usePrototype } from '@/components/prototype/PrototypeProvider'
import { KpiCard } from '@/components/prototype/KpiCard'
import { UrgencyList, type UrgencyItem } from '@/components/prototype/UrgencyList'
import { HealthBar } from '@/components/prototype/HealthBar'
import { CompanyRow } from '@/components/prototype/CompanyRow'
import { ProtoCoverageBar } from '@/components/prototype/ProtoCoverageBar'
import { FinRow } from '@/components/prototype/FinRow'
import { SectionHeader } from '@/components/prototype/SectionHeader'
import { CalendarWidget } from '@/components/prototype/CalendarWidget'
import { getCompanies } from '@/mock/companies'
import { getExpiringContracts, getContractCoverage } from '@/mock/contracts'
import { getOverdueTasks } from '@/mock/tasks'
import { getOpenCases } from '@/mock/cases'
import { getPortfolioTotals, getUnderperformingCompanies, getFinancialByCompany } from '@/mock/financial'
import { filterCompaniesByRole, getDashboardSectionsForRole } from '@/mock/helpers'

// Farve-palette til firma-avatarer
const AVATAR_COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#ef4444', '#6366f1', '#14b8a6',
]

function getAvatarColor(index: number): string {
  return AVATAR_COLORS[index % AVATAR_COLORS.length]
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

function formatMio(val: number): string {
  return (val / 1_000_000).toFixed(1)
}

interface KpiCardDef {
  label: string
  value: string | number
  valueColor?: 'default' | 'warning' | 'danger'
  trend?: { text: string; direction: 'up' | 'down' | 'neutral' }
}

// ---------------------------------------------------------------
// Rollespecifikke KPI-definitioner
// ---------------------------------------------------------------
function getKpiCards(role: string, data: ReturnType<typeof buildDashboardData>): KpiCardDef[] {
  switch (role) {
    case 'GROUP_OWNER':
      return [
        { label: 'Selskaber', value: data.totalCompanies },
        {
          label: 'Udløbende kontrakter',
          value: data.expiringCount,
          valueColor: 'warning' as const,
          trend: { text: '90 dage', direction: 'neutral' as const },
        },
        { label: 'Aktive sager', value: data.openCaseCount },
        {
          label: 'Forfaldne opgaver',
          value: data.overdueTaskCount,
          valueColor: data.overdueTaskCount > 0 ? 'danger' as const : 'default' as const,
        },
      ]
    case 'GROUP_LEGAL':
      return [
        {
          label: 'Udløbende kontrakter',
          value: data.expiringCount,
          valueColor: 'warning' as const,
        },
        { label: 'Aktive tvister', value: data.tvistsCount },
        { label: 'Kontrakter til gennemgang', value: 8 },
        { label: 'Kontraktdækning', value: '86%' },
      ]
    case 'GROUP_FINANCE':
      return [
        {
          label: 'Omsætning 2025',
          value: `${formatMio(data.totals2025.totalOmsaetning)}M`,
          trend: { text: '+5,2%', direction: 'up' as const },
        },
        {
          label: 'EBITDA 2025',
          value: `${formatMio(data.totals2025.totalEbitda)}M`,
          trend: { text: '+3,8%', direction: 'up' as const },
        },
        {
          label: 'EBITDA-margin',
          value: `${(data.totals2025.avgEbitdaMargin * 100).toFixed(1)}%`,
        },
        {
          label: 'Gns. pr. lokation',
          value: `${formatMio(data.totals2025.totalOmsaetning / Math.max(data.totalCompanies, 1))}M`,
        },
      ]
    case 'GROUP_ADMIN':
      return [
        { label: 'Selskaber', value: data.totalCompanies },
        {
          label: 'Forfaldne opgaver',
          value: data.overdueTaskCount,
          valueColor: data.overdueTaskCount > 0 ? 'danger' as const : 'default' as const,
        },
        { label: 'Aktive sager', value: data.openCaseCount },
        { label: 'Udløbende kontrakter', value: data.expiringCount, valueColor: 'warning' as const },
      ]
    default:
      // COMPANY_MANAGER og fallback
      return [
        { label: 'Mine selskaber', value: data.totalCompanies },
        {
          label: 'Forfaldne opgaver',
          value: data.overdueTaskCount,
          valueColor: data.overdueTaskCount > 0 ? 'danger' as const : 'default' as const,
        },
        { label: 'Åbne sager', value: data.openCaseCount },
      ]
  }
}

// ---------------------------------------------------------------
// Saml al mock-data ét sted
// ---------------------------------------------------------------
function buildDashboardData(dataScenario: 'normal' | 'many_warnings' | 'empty', role: string, assignedIds: string[]) {
  const allCompanies = getCompanies(dataScenario, 22)
  const companies = filterCompaniesByRole(allCompanies, role as Parameters<typeof filterCompaniesByRole>[1], assignedIds)

  const expiringContracts = getExpiringContracts(90)
  const contractCoverage = getContractCoverage()
  const overdueTasks = getOverdueTasks()
  const openCases = getOpenCases()
  const totals2025 = getPortfolioTotals(2025)
  const totals2024 = getPortfolioTotals(2024)
  const underperforming = getUnderperformingCompanies()

  const criticalCompanies = companies.filter((c) => c.healthStatus === 'critical')
  const warningCompanies = companies.filter((c) => c.healthStatus === 'warning')
  const healthyCompanies = companies.filter((c) => c.healthStatus === 'healthy')

  const totalCompanies = companies.length || 22

  // Kontraktdækning pr. kategori
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
      label: 'Erhvervsforsikring',
      pct: Math.round(((totalCompanies - contractCoverage.filter((c) => c.missingTypes.includes('FORSIKRING')).length) / totalCompanies) * 100),
    },
    {
      label: 'Ansættelseskontrakt',
      pct: Math.round(((totalCompanies - contractCoverage.filter((c) => c.missingTypes.includes('ANSAETTELSESKONTRAKT')).length) / totalCompanies) * 100),
    },
  ]

  return {
    companies,
    criticalCompanies,
    warningCompanies,
    healthyCompanies,
    expiringContracts,
    expiringCount: expiringContracts.length,
    contractCoverage,
    coverageItems,
    overdueTasks,
    overdueTaskCount: overdueTasks.length,
    openCases,
    openCaseCount: openCases.filter((c) => c.status !== 'LUKKET').length,
    tvistsCount: openCases.filter((c) => c.type === 'TVIST').length,
    totals2025,
    totals2024,
    underperforming,
    totalCompanies,
  }
}

// ---------------------------------------------------------------
// Byg UrgencyList-items (rolle-tilpasset)
// ---------------------------------------------------------------
function buildUrgencyItems(
  role: string,
  data: ReturnType<typeof buildDashboardData>
): UrgencyItem[] {
  const items: UrgencyItem[] = []

  if (role === 'GROUP_FINANCE') {
    // Økonomi fokus: underperformende lokationer
    data.underperforming.forEach((u, i) => {
      items.push({
        id: `fin-${i}`,
        name: u.companyName,
        subtitle: u.reason,
        days: 'Nu',
        indicator: 'red',
        overdue: true,
        href: `/proto/portfolio/${u.companyId}`,
      })
    })
    // Tilføj udløbende kontrakter med finansiel impact
    data.expiringContracts.slice(0, 3).forEach((c) => {
      items.push({
        id: c.id,
        name: c.displayName,
        subtitle: c.companyName,
        days: c.daysUntilExpiry !== null && c.daysUntilExpiry < 0
          ? `Udløbet`
          : `${c.daysUntilExpiry}d`,
        indicator: c.urgency === 'critical' ? 'red' : 'amber',
        overdue: c.daysUntilExpiry !== null && c.daysUntilExpiry < 0,
        href: `/proto/contracts/${c.id}`,
      })
    })
    return items.slice(0, 5)
  }

  // Standard: overdue tasks + udløbende kontrakter
  data.overdueTasks.slice(0, 3).forEach((t) => {
    items.push({
      id: t.id,
      name: t.title,
      subtitle: t.companyName,
      days: `${Math.abs(t.daysUntilDue ?? 0)}d siden`,
      indicator: t.priority === 'KRITISK' ? 'red' : 'amber',
      overdue: true,
      href: `/proto/tasks/${t.id}`,
    })
  })

  data.expiringContracts.slice(0, 2).forEach((c) => {
    items.push({
      id: c.id,
      name: c.displayName,
      subtitle: c.companyName,
      days: c.daysUntilExpiry !== null && c.daysUntilExpiry < 0
        ? `Udløbet`
        : `${c.daysUntilExpiry}d`,
      indicator: c.urgency === 'critical' ? 'red' : 'amber',
      overdue: c.daysUntilExpiry !== null && c.daysUntilExpiry < 0,
      href: `/proto/contracts/${c.id}`,
    })
  })

  return items.slice(0, 5)
}

// ---------------------------------------------------------------
// Hoved-komponent
// ---------------------------------------------------------------
export default function DashboardPage() {
  const { activeUser, dataScenario, companyCount } = usePrototype()
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
  const sections = getDashboardSectionsForRole(role)
  const urgencyItems = buildUrgencyItems(role, data)
  const kpiCards = getKpiCards(role, data)

  const hasSection = (s: string): boolean => (sections as string[]).includes(s)

  // Greeting
  const greeting = (() => {
    switch (role) {
      case 'GROUP_OWNER': return `${data.totalCompanies} selskaber · ${data.criticalCompanies.length + data.warningCompanies.length > 0 ? `${data.criticalCompanies.length + data.warningCompanies.length} kræver opmærksomhed` : 'Alt ser godt ud'}`
      case 'GROUP_LEGAL': return `${data.expiringCount} udløbende kontrakter · ${data.openCaseCount} åbne sager`
      case 'GROUP_FINANCE': return `Portefølje 2025 · ${formatMio(data.totals2025.totalOmsaetning)}M kr. omsætning`
      case 'GROUP_ADMIN': return `${data.totalCompanies} selskaber · ${data.overdueTaskCount} forfaldne opgaver`
      default: return `${data.totalCompanies} selskaber`
    }
  })()

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      {/* Hilsen */}
      <div className="border-b border-gray-200/60 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Godmorgen, {activeUser.name}
        </h1>
        <p className="mt-1 text-sm text-gray-500">{greeting}</p>
      </div>

      {/* KPI grid */}
      {hasSection('kpi') && (
        <div className={`grid gap-4 ${kpiCards.length === 4 ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2 lg:grid-cols-3'}`}>
          {kpiCards.map((card, i) => (
            <KpiCard
              key={i}
              label={card.label}
              value={card.value}
              valueColor={card.valueColor}
              trend={card.trend}
            />
          ))}
        </div>
      )}

      {/* Primær content-grid: urgency/top + kalender */}
      {(hasSection('urgency') || hasSection('top_locations')) && hasSection('calendar') ? (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
          {/* Venstre: urgency eller top locations */}
          <div className="space-y-4">
            {hasSection('urgency') && urgencyItems.length > 0 && (
              <UrgencyList
                title="Kræver handling"
                items={urgencyItems}
                viewAllHref="/proto/tasks?filter=overdue"
              />
            )}

            {hasSection('top_locations') && (
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="mb-4 text-sm font-semibold text-slate-900">Top lokationer — Omsætning 2025</div>
                {data.companies
                  .slice()
                  .sort((a, b) => {
                    const fa = getFinancialByCompany(a.id).find((f) => f.year === 2025)
                    const fb = getFinancialByCompany(b.id).find((f) => f.year === 2025)
                    return (fb?.omsaetning ?? 0) - (fa?.omsaetning ?? 0)
                  })
                  .slice(0, 5)
                  .map((c, i) => {
                    const fin = getFinancialByCompany(c.id).find((f) => f.year === 2025)
                    const omsaetning = fin?.omsaetning ?? 0
                    const ebitdaMargin = fin && omsaetning > 0 ? ((fin.ebitda ?? 0) / omsaetning * 100).toFixed(1) : '—'
                    return (
                      <CompanyRow
                        key={c.id}
                        initials={getInitials(c.name)}
                        name={c.name}
                        meta={`${formatMio(omsaetning)}M kr. · EBITDA ${ebitdaMargin}%`}
                        status={{ label: 'Aktiv', type: 'ok' }}
                        avatarColor={getAvatarColor(i)}
                        href={`/proto/portfolio/${c.id}`}
                      />
                    )
                  })}
              </div>
            )}

            {/* Porteføljesundhed under urgency (GROUP_OWNER, GROUP_ADMIN) */}
            {hasSection('health') && (
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="mb-1 text-sm font-semibold text-slate-900">Porteføljesundhed</div>
                <HealthBar
                  healthy={data.healthyCompanies.length}
                  warning={data.warningCompanies.length}
                  critical={data.criticalCompanies.length}
                />
                {(data.criticalCompanies.length > 0 || data.warningCompanies.length > 0) && (
                  <div className="mt-4 space-y-0">
                    <div className="text-xs font-medium uppercase tracking-[0.06em] text-gray-400 mb-2">
                      Kræver opmærksomhed
                    </div>
                    {[...data.criticalCompanies, ...data.warningCompanies].slice(0, 4).map((c, i) => (
                      <CompanyRow
                        key={c.id}
                        initials={getInitials(c.name)}
                        name={c.name}
                        meta={c.healthReasons[0] ?? c.city}
                        status={{
                          label: c.healthStatus === 'critical' ? 'Kritisk' : 'Advarsel',
                          type: c.healthStatus === 'critical' ? 'critical' : 'warning',
                        }}
                        avatarColor={c.healthStatus === 'critical' ? '#ef4444' : '#f59e0b'}
                        href={`/proto/portfolio/${c.id}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Højre: kalender */}
          {hasSection('calendar') && <CalendarWidget />}
        </div>
      ) : hasSection('calendar') ? (
        // Kun kalender — ingen urgency
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
          <div />
          <CalendarWidget />
        </div>
      ) : null}

      {/* --- JURIDISK sektion (GROUP_OWNER) --- */}
      {role === 'GROUP_OWNER' && (
        <>
          <SectionHeader title="Juridisk" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Kontraktdækning */}
            {hasSection('coverage') && (
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="mb-4 text-sm font-semibold text-slate-900">Kontraktdækning</div>
                {data.coverageItems.map((item) => (
                  <ProtoCoverageBar key={item.label} label={item.label} percentage={item.pct} />
                ))}
              </div>
            )}

            {/* Sager fordelt på type */}
            {hasSection('cases') && (
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="mb-4 text-sm font-semibold text-slate-900">Sager pr. type</div>
                <FinRow label="Compliance" value={`${data.openCases.filter((c) => c.type === 'COMPLIANCE').length}`} />
                <FinRow label="Governance" value={`${data.openCases.filter((c) => c.type === 'GOVERNANCE').length}`} />
                <FinRow label="Kontrakt" value={`${data.openCases.filter((c) => c.type === 'KONTRAKT').length}`} />
                <FinRow label="Tvist" value={`${data.openCases.filter((c) => c.type === 'TVIST').length}`} />
              </div>
            )}
          </div>
        </>
      )}

      {/* --- ØKONOMI sektion (GROUP_OWNER) --- */}
      {role === 'GROUP_OWNER' && (
        <>
          <SectionHeader title="Økonomi" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {hasSection('finance') && (
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="mb-4 text-sm font-semibold text-slate-900">Nøgletal 2025</div>
                <FinRow
                  label="Samlet omsætning"
                  value={`${formatMio(data.totals2025.totalOmsaetning)}M kr.`}
                  trend={{ text: '+5,2%', direction: 'up' }}
                />
                <FinRow
                  label="Samlet EBITDA"
                  value={`${formatMio(data.totals2025.totalEbitda)}M kr.`}
                  trend={{ text: '+3,8%', direction: 'up' }}
                />
                <FinRow
                  label="EBITDA-margin"
                  value={`${(data.totals2025.avgEbitdaMargin * 100).toFixed(1)}%`}
                />
                <FinRow
                  label="Gns. pr. lokation"
                  value={`${formatMio(data.totals2025.totalOmsaetning / Math.max(data.totalCompanies, 1))}M kr.`}
                />
              </div>
            )}

            {hasSection('finance_alerts') && (
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="mb-4 text-sm font-semibold text-slate-900">Opmærksomhedspunkter</div>
                {data.underperforming.map((u) => (
                  <FinRow
                    key={u.companyId}
                    label={u.companyName.replace(' ApS', '')}
                    value={u.reason.split('(')[0].trim()}
                    valueColor="#ef4444"
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* --- GROUP_LEGAL: sager + dækning + docs --- */}
      {role === 'GROUP_LEGAL' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {hasSection('cases') && (
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="mb-4 text-sm font-semibold text-slate-900">Sager pr. type</div>
                <FinRow label="Compliance" value={`${data.openCases.filter((c) => c.type === 'COMPLIANCE').length}`} />
                <FinRow label="Governance" value={`${data.openCases.filter((c) => c.type === 'GOVERNANCE').length}`} />
                <FinRow label="Kontrakt" value={`${data.openCases.filter((c) => c.type === 'KONTRAKT').length}`} />
                <FinRow label="Tvist" value={`${data.openCases.filter((c) => c.type === 'TVIST').length}`} />
              </div>
            )}

            {hasSection('coverage') && (
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="mb-4 text-sm font-semibold text-slate-900">Kontraktdækning</div>
                {data.coverageItems.map((item) => (
                  <ProtoCoverageBar key={item.label} label={item.label} percentage={item.pct} />
                ))}
              </div>
            )}
          </div>

          {hasSection('legal_docs') && (
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="mb-4 text-sm font-semibold text-slate-900">Dokumenter til gennemgang</div>
              <FinRow label="Afventer gennemgang" value="8" valueColor="#d97706" />
              <FinRow label="Under behandling" value="3" valueColor="#3b82f6" />
            </div>
          )}
        </>
      )}

      {/* --- GROUP_FINANCE: tabslokationer + fin-kontrakter --- */}
      {role === 'GROUP_FINANCE' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {hasSection('finance_alerts') && (
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="mb-4 text-sm font-semibold text-slate-900">Opmærksomhedspunkter</div>
                {data.underperforming.map((u) => (
                  <FinRow
                    key={u.companyId}
                    label={u.companyName.replace(' ApS', '')}
                    value={u.reason.split('(')[0].trim()}
                    valueColor="#ef4444"
                  />
                ))}
              </div>
            )}

            {hasSection('loss_locations') && (
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="mb-4 text-sm font-semibold text-slate-900">Lokationer med fald</div>
                {data.underperforming.map((u, i) => {
                  const fin = getFinancialByCompany(u.companyId).find((f) => f.year === 2025)
                  return (
                    <CompanyRow
                      key={u.companyId}
                      initials={getInitials(u.companyName)}
                      name={u.companyName}
                      meta={u.reason}
                      status={{ label: 'Fald', type: 'critical' }}
                      avatarColor={getAvatarColor(i + 4)}
                      href={`/proto/portfolio/${u.companyId}`}
                    />
                  )
                })}
              </div>
            )}
          </div>

          {hasSection('finance_contracts') && (
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="mb-4 text-sm font-semibold text-slate-900">Kontrakter med finansiel impact</div>
              {data.expiringContracts.slice(0, 4).map((c) => (
                <FinRow
                  key={c.id}
                  label={c.displayName}
                  value={c.daysUntilExpiry !== null && c.daysUntilExpiry < 0
                    ? 'Udløbet'
                    : `${c.daysUntilExpiry} dage`}
                  valueColor={c.urgency === 'critical' ? '#ef4444' : '#d97706'}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
