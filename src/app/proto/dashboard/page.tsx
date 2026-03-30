'use client'

import Link from 'next/link'
import { Building2, AlertCircle, TrendingUp, TrendingDown, Calendar } from 'lucide-react'
import { usePrototype } from '@/components/prototype/PrototypeProvider'
import { InsightCard } from '@/components/prototype/InsightCard'
import { CoverageBar } from '@/components/ui/CoverageBar'
import { getInsights } from '@/mock/insights'
import { getCompanies } from '@/mock/companies'
import { getOverdueTasks } from '@/mock/tasks'
import { getExpiringContracts, getContractCoverage } from '@/mock/contracts'
import { getDocumentsAwaitingReview, getDocumentsProcessing } from '@/mock/documents'
import { getPortfolioTotals } from '@/mock/financial'
import { getVisibleDashboardBlocks, filterCompaniesByRole } from '@/mock/helpers'
import { getUpcomingVisits } from '@/mock/visits'
import { getOpenCases } from '@/mock/cases'

// Urgency-farver til venstre border
function urgencyBorder(urgency: 'critical' | 'warning' | 'normal' | 'none'): string {
  if (urgency === 'critical') return 'border-l-4 border-l-red-500'
  if (urgency === 'warning') return 'border-l-4 border-l-amber-400'
  return 'border-l-4 border-l-gray-200'
}

function urgencyDot(urgency: 'critical' | 'warning' | 'normal' | 'none'): string {
  if (urgency === 'critical') return 'bg-red-500'
  if (urgency === 'warning') return 'bg-amber-400'
  return 'bg-gray-300'
}

export default function DashboardPage() {
  const { activeUser, dataScenario, companyCount } = usePrototype()
  const role = activeUser.role

  const insights = getInsights('dashboard', role, dataScenario)
  const blocks = getVisibleDashboardBlocks(role)
  const companies = filterCompaniesByRole(getCompanies(dataScenario, companyCount), role, activeUser.companyIds)

  // Data til blokke
  const overdueTasks = getOverdueTasks()
  const expiringContracts = getExpiringContracts(90)
  const contractCoverage = getContractCoverage()
  const docsReview = getDocumentsAwaitingReview()
  const docsProcessing = getDocumentsProcessing()
  const totals2024 = getPortfolioTotals(2024)
  const totals2025 = getPortfolioTotals(2025)

  const criticalCompanies = companies.filter((c) => c.healthStatus === 'critical')
  const warningCompanies = companies.filter((c) => c.healthStatus === 'warning')
  const healthyCompanies = companies.filter((c) => c.healthStatus === 'healthy')

  // Urgency items: kombiner overdue tasks + udløbende kontrakter (maks 5 total)
  type UrgencyItem = {
    id: string
    urgency: 'critical' | 'warning'
    title: string
    subtitle: string
    href: string
  }

  const urgencyItems: UrgencyItem[] = [
    ...overdueTasks.slice(0, 3).map((t) => ({
      id: t.id,
      urgency: (t.priority === 'KRITISK' ? 'critical' : 'warning') as 'critical' | 'warning',
      title: t.title,
      subtitle: `Forfaldt ${Math.abs(t.daysUntilDue ?? 0)} dag${Math.abs(t.daysUntilDue ?? 0) === 1 ? '' : 'e'} siden · ${t.companyName}`,
      href: `/proto/tasks/${t.id}`,
    })),
    ...expiringContracts.slice(0, 2).map((c) => ({
      id: c.id,
      urgency: c.urgency as 'critical' | 'warning',
      title: c.displayName,
      subtitle: c.daysUntilExpiry !== null && c.daysUntilExpiry < 0
        ? `Udløbet ${Math.abs(c.daysUntilExpiry)} dage siden · ${c.companyName}`
        : `Udløber om ${c.daysUntilExpiry} dage · ${c.companyName}`,
      href: `/proto/contracts/${c.id}`,
    })),
  ].slice(0, 5)

  // Tomme tilstand
  if (dataScenario === 'empty') {
    return (
      <div className="p-6 max-w-4xl mx-auto">
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

  // Beregn om en blok er synlig
  function hasBlock(name: string) {
    return blocks.includes(name)
  }

  // Hjælp til trend-pile
  const omsaetningTrend = totals2025.totalOmsaetning - totals2024.totalOmsaetning
  const ebitdaTrend = totals2025.totalEbitda - totals2024.totalEbitda

  function formatMio(val: number): string {
    return (val / 1_000_000).toFixed(1)
  }

  // Kommende besoeg — vises kun for GROUP_OWNER og GROUP_ADMIN
  const upcomingVisits = getUpcomingVisits().slice(0, 4)

  // Aabne sager til compliance-blok (GROUP_LEGAL)
  const openCases = getOpenCases()

  // Kontraktdaekning pr. kategori (baseret paa coverage data + alle 22 selskaber)
  const totalCompanies = companies.length || 22
  const coverageItems = [
    { label: 'Ejeraftale', covered: totalCompanies - contractCoverage.filter((c) => c.missingTypes.includes('EJERAFTALE')).length },
    { label: 'Lejekontrakt', covered: totalCompanies - contractCoverage.filter((c) => c.missingTypes.includes('LEJEKONTRAKT')).length },
    { label: 'Erhvervsforsikring', covered: totalCompanies - contractCoverage.filter((c) => c.missingTypes.includes('FORSIKRING')).length },
    { label: 'Ansaettelseskontrakt', covered: totalCompanies - contractCoverage.filter((c) => c.missingTypes.includes('ANSAETTELSESKONTRAKT')).length },
  ]

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Hilsen */}
      <div className="border-b border-gray-200/60 pb-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Godmorgen, {activeUser.name}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {companies.length} selskaber ·{' '}
          {criticalCompanies.length + warningCompanies.length > 0
            ? `${criticalCompanies.length + warningCompanies.length} kræver opmærksomhed`
            : 'Alt ser godt ud'
          }
        </p>
      </div>

      {/* InsightCards (maks 2 — allerede begraenset af getInsights) */}
      {insights.length > 0 && (
        <div className="space-y-2">
          {insights.map((ins) => (
            <InsightCard key={ins.id} insight={ins} />
          ))}
        </div>
      )}

      {/* Dynamiske blokke — kun rolle-filtrerede */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* requires_action / urgency_feed */}
        {hasBlock('urgency_feed') && urgencyItems.length > 0 && (
          <div className="bg-white rounded-xl border-l-4 border-l-red-400 border border-gray-200/80 shadow-sm overflow-hidden">
            <div className="px-5 pt-5 pb-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-400">
                Kræver handling
              </p>
            </div>
            <ul>
              {urgencyItems.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className={`block px-5 py-4 hover:bg-gray-50/80 transition-colors border-b border-gray-100 last:border-b-0 ${urgencyBorder(item.urgency)}`}
                  >
                    <p className="text-sm font-medium text-gray-900">{item.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{item.subtitle}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* portfolio_summary */}
        {hasBlock('portfolio_summary') && (
          <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-400 mb-4">
              Portefoljesundhed
            </p>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${urgencyDot('critical')}`} />
                <span className="text-sm text-gray-700 flex-1">Kritiske</span>
                <span className="text-sm font-semibold text-gray-900">{criticalCompanies.length}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${urgencyDot('warning')}`} />
                <span className="text-sm text-gray-700 flex-1">Advarsel</span>
                <span className="text-sm font-semibold text-gray-900">{warningCompanies.length}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="h-2.5 w-2.5 rounded-full shrink-0 bg-green-500" />
                <span className="text-sm text-gray-700 flex-1">Sunde</span>
                <span className="text-sm font-semibold text-gray-900">{healthyCompanies.length}</span>
              </div>
              <div className="pt-2 border-t border-gray-100">
                <Link href="/proto/portfolio" className="text-xs text-gray-500 hover:text-gray-700 underline">
                  Se alle selskaber →
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* contract_expiry / contract_coverage */}
        {hasBlock('contract_expiry') && (
          <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-400 mb-4">
              Kontraktdækning
            </p>
            <div className="space-y-3">
              {coverageItems.map((item) => (
                <CoverageBar
                  key={item.label}
                  label={item.label}
                  covered={item.covered}
                  total={totalCompanies}
                />
              ))}
            </div>
            <div className="pt-3 border-t border-gray-100 mt-3">
              <Link href="/proto/contracts" className="text-xs text-gray-500 hover:text-gray-700 underline">
                Se kontrakter →
              </Link>
            </div>
          </div>
        )}

        {/* financial_kpi */}
        {hasBlock('financial_kpi') && (
          <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-400 mb-4">
              Økonomi — Portefølje 2025
            </p>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Samlet omsætning</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-light tracking-tight tabular-nums text-gray-900">
                    {formatMio(totals2025.totalOmsaetning)}M
                  </span>
                  <span className="text-xs text-gray-500">kr.</span>
                  {omsaetningTrend >= 0
                    ? <TrendingUp className="h-4 w-4 text-green-500 ml-1" />
                    : <TrendingDown className="h-4 w-4 text-red-500 ml-1" />
                  }
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Samlet EBITDA</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-light tracking-tight tabular-nums text-gray-900">
                    {formatMio(totals2025.totalEbitda)}M
                  </span>
                  <span className="text-xs text-gray-500">kr.</span>
                  {ebitdaTrend >= 0
                    ? <TrendingUp className="h-4 w-4 text-green-500 ml-1" />
                    : <TrendingDown className="h-4 w-4 text-red-500 ml-1" />
                  }
                </div>
              </div>
              <div className="pt-3 border-t border-gray-100 flex justify-between items-center">
                <span className="text-xs text-gray-400">EBITDA-margin</span>
                <span className="text-sm font-semibold text-gray-900">
                  {(totals2025.avgEbitdaMargin * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        )}

        {/* task_overview */}
        {hasBlock('task_overview') && overdueTasks.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-400 mb-4">
              Opgaver
            </p>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                <span className="text-sm text-gray-700 flex-1">Forfaldne opgaver</span>
                <span className="text-sm font-semibold text-red-600">{overdueTasks.length}</span>
              </div>
              <div className="pt-2 border-t border-gray-100">
                <Link href="/proto/tasks?filter=overdue" className="text-xs text-gray-500 hover:text-gray-700 underline">
                  Se forfaldne opgaver →
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* document_review */}
        {hasBlock('document_review') && docsReview.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-400 mb-4">
              Dokumenter til gennemgang
            </p>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Afventer gennemgang</span>
                <span className="text-sm font-semibold text-amber-600">{docsReview.length}</span>
              </div>
              {docsProcessing.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Under behandling</span>
                  <span className="text-sm font-semibold text-blue-600">{docsProcessing.length}</span>
                </div>
              )}
              <div className="pt-2 border-t border-gray-100">
                <Link href="/proto/documents?filter=ready_for_review" className="text-xs text-gray-500 hover:text-gray-700 underline">
                  Gennemgå dokumenter →
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* my_companies (COMPANY_MANAGER) */}
        {hasBlock('my_companies') && companies.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
            <div className="px-5 pt-5 pb-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-400">
                Dine klinikker
              </p>
            </div>
            <ul>
              {companies.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/proto/portfolio/${c.id}`}
                    className={`block px-5 py-4 hover:bg-gray-50/80 transition-colors border-b border-gray-100 last:border-b-0 ${urgencyBorder(c.healthStatus === 'healthy' ? 'normal' : c.healthStatus)}`}
                  >
                    <p className="text-sm font-medium text-gray-900">{c.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{c.city}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* kommende_besoeg — vises kun for GROUP_OWNER og GROUP_ADMIN */}
        {(role === 'GROUP_OWNER' || role === 'GROUP_ADMIN') && upcomingVisits.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-400 mb-4">
              Kommende besoeg
            </p>
            <ul className="space-y-3">
              {upcomingVisits.map((visit) => (
                <li key={visit.id} className="flex items-start gap-3">
                  <Calendar className="h-4 w-4 text-gray-300 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{visit.companyName}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{visit.typeLabel} · {visit.dateLabel}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* compliance_status — GROUP_LEGAL */}
        {hasBlock('compliance_status') && (
          <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-400 mb-4">
              Compliance-status
            </p>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Aabne compliance-sager</span>
                <span className="text-sm font-semibold text-red-600">
                  {openCases.filter((c) => c.type === 'COMPLIANCE').length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Governance-sager</span>
                <span className="text-sm font-semibold text-amber-600">
                  {openCases.filter((c) => c.type === 'GOVERNANCE').length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Kontrakt-sager</span>
                <span className="text-sm font-semibold text-gray-700">
                  {openCases.filter((c) => c.type === 'KONTRAKT').length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Tvister</span>
                <span className="text-sm font-semibold text-gray-700">
                  {openCases.filter((c) => c.type === 'TVIST').length}
                </span>
              </div>
              <div className="pt-1">
                <Link href="/proto/cases" className="text-xs text-gray-500 hover:text-gray-700 underline">
                  Se alle sager →
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* data_quality — GROUP_ADMIN */}
        {hasBlock('data_quality') && (
          <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-400 mb-4">
              Datakvalitet
            </p>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Selskaber uden ejeraftale</span>
                <span className="text-sm font-semibold text-red-600">1</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Selskaber med udloebne kontrakter</span>
                <span className="text-sm font-semibold text-amber-600">
                  {expiringContracts.filter((c) => c.daysUntilExpiry !== null && c.daysUntilExpiry < 0).length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Dokumenter under behandling</span>
                <span className="text-sm font-semibold text-blue-600">{docsProcessing.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Manglende CVR-data</span>
                <span className="text-sm font-semibold text-gray-700">0</span>
              </div>
              <div className="pt-1">
                <Link href="/proto/portfolio" className="text-xs text-gray-500 hover:text-gray-700 underline">
                  Se dataoverblik →
                </Link>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
