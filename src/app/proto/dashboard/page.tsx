'use client'

import Link from 'next/link'
import { Building2, AlertCircle, TrendingUp, TrendingDown, Calendar, Clock } from 'lucide-react'
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
  const { activeUser, dataScenario } = usePrototype()
  const role = activeUser.role

  const insights = getInsights('dashboard', role, dataScenario)
  const blocks = getVisibleDashboardBlocks(role)
  const companies = filterCompaniesByRole(getCompanies(dataScenario), role, activeUser.companyIds)

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
      href: `/proto/tasks`,
    })),
    ...expiringContracts.slice(0, 2).map((c) => ({
      id: c.id,
      urgency: c.urgency as 'critical' | 'warning',
      title: c.displayName,
      subtitle: c.daysUntilExpiry !== null && c.daysUntilExpiry < 0
        ? `Udløbet ${Math.abs(c.daysUntilExpiry)} dage siden · ${c.companyName}`
        : `Udløber om ${c.daysUntilExpiry} dage · ${c.companyName}`,
      href: `/proto/contracts`,
    })),
  ].slice(0, 5)

  // Tomme tilstand
  if (dataScenario === 'empty') {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Godmorgen, {activeUser.name}
        </h1>
        <div className="flex flex-col items-center justify-center py-20 text-center text-gray-400">
          <Building2 className="h-12 w-12 mb-4 text-gray-300" />
          <p className="text-sm">
            Ingen data endnu. Upload dokumenter eller opret dit foerste selskab for at komme i gang.
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
    return `${(val / 1_000_000).toFixed(1)}M kr.`
  }

  // Hardcodede recent activity
  const recentActivity = [
    { id: 1, text: 'Dokument uploadet: Ejeraftale_Horsens_2026_udkast.pdf', time: 'I dag, 09:15' },
    { id: 2, text: 'Opgave forfaldne: Forny erhvervsforsikring — Odense', time: 'I dag, 08:00' },
    { id: 3, text: 'Ny kontrakt oprettet: Klinikdriftsaftale Aalborg', time: 'I gaar' },
    { id: 4, text: 'Kommentar tilfojet: Sag 24-087 Randers', time: 'I gaar' },
    { id: 5, text: 'Selskabsdata opdateret: Silkeborg Tandhus', time: '2 dage siden' },
  ]

  // Hardcodede upcoming visits
  const upcomingVisits = [
    { id: 1, company: 'Odense Tandlægehus ApS', date: '3. april 2026', type: 'Tilsynsbesoeg' },
    { id: 2, company: 'Horsens Tandklinik ApS', date: '10. april 2026', type: 'Partnermøde' },
    { id: 3, company: 'Viborg Tandlæge ApS', date: '17. april 2026', type: 'Tilsynsbesoeg' },
  ]

  // Kontraktdaekning pr. kategori (baseret paa coverage data + alle 22 selskaber)
  const totalCompanies = companies.length || 22
  const coverageItems = [
    { label: 'Ejeraftale', covered: totalCompanies - contractCoverage.filter((c) => c.missingTypes.includes('EJERAFTALE')).length },
    { label: 'Lejekontrakt', covered: totalCompanies - contractCoverage.filter((c) => c.missingTypes.includes('LEJEKONTRAKT')).length },
    { label: 'Erhvervsforsikring', covered: totalCompanies - contractCoverage.filter((c) => c.missingTypes.includes('FORSIKRING')).length },
    { label: 'Ansaettelseskontrakt', covered: totalCompanies - contractCoverage.filter((c) => c.missingTypes.includes('ANSAETTELSESKONTRAKT')).length },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Hilsen */}
      <h1 className="text-2xl font-bold text-gray-900">
        Godmorgen, {activeUser.name}
      </h1>

      {/* InsightCards (maks 2) */}
      {insights.length > 0 && (
        <div className="space-y-2">
          {insights.map((ins) => (
            <InsightCard key={ins.id} insight={ins} />
          ))}
        </div>
      )}

      {/* Dynamiske blokke */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* requires_action / urgency_feed */}
        {hasBlock('urgency_feed') && urgencyItems.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Kraever handling
            </p>
            <ul className="space-y-2">
              {urgencyItems.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className={`block rounded px-3 py-2 hover:bg-gray-50 transition-colors ${urgencyBorder(item.urgency)}`}
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
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Portefoljesundhed
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className={`h-3 w-3 rounded-full ${urgencyDot('critical')}`} />
                <span className="text-sm text-gray-700">
                  <span className="font-semibold">{criticalCompanies.length}</span> kritiske
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`h-3 w-3 rounded-full ${urgencyDot('warning')}`} />
                <span className="text-sm text-gray-700">
                  <span className="font-semibold">{warningCompanies.length}</span> advarsel
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`h-3 w-3 rounded-full bg-green-500`} />
                <span className="text-sm text-gray-700">
                  <span className="font-semibold">{healthyCompanies.length}</span> sunde
                </span>
              </div>
              <div className="pt-2">
                <Link href="/proto/portfolio" className="text-xs text-gray-500 hover:text-gray-700 underline">
                  Se alle selskaber →
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* contract_expiry / contract_coverage */}
        {hasBlock('contract_expiry') && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Kontraktdaekning
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
            <div className="pt-3">
              <Link href="/proto/contracts" className="text-xs text-gray-500 hover:text-gray-700 underline">
                Se kontrakter →
              </Link>
            </div>
          </div>
        )}

        {/* financial_kpi */}
        {hasBlock('financial_kpi') && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Oekonomi — Portefolje 2025
            </p>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Samlet omsa&aelig;tning</span>
                <span className="flex items-center gap-1 text-sm font-semibold text-gray-900">
                  {formatMio(totals2025.totalOmsaetning)}
                  {omsaetningTrend >= 0
                    ? <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                    : <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                  }
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Samlet EBITDA</span>
                <span className="flex items-center gap-1 text-sm font-semibold text-gray-900">
                  {formatMio(totals2025.totalEbitda)}
                  {ebitdaTrend >= 0
                    ? <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                    : <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                  }
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">EBITDA-margin</span>
                <span className="text-sm font-semibold text-gray-900">
                  {(totals2025.avgEbitdaMargin * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        )}

        {/* task_overview */}
        {hasBlock('task_overview') && overdueTasks.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Opgaver
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <span className="text-sm text-gray-700">
                  <span className="font-semibold text-red-600">{overdueTasks.length}</span> forfaldne opgaver
                </span>
              </div>
              <Link href="/proto/tasks?filter=overdue" className="text-xs text-gray-500 hover:text-gray-700 underline">
                Se forfaldne opgaver →
              </Link>
            </div>
          </div>
        )}

        {/* document_review */}
        {hasBlock('document_review') && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Dokumenter til gennemgang
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Afventer gennemgang</span>
                <span className="text-sm font-semibold text-amber-600">{docsReview.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Under behandling</span>
                <span className="text-sm font-semibold text-blue-600">{docsProcessing.length}</span>
              </div>
              <div className="pt-1">
                <Link href="/proto/documents?filter=ready_for_review" className="text-xs text-gray-500 hover:text-gray-700 underline">
                  Gennemgaa dokumenter →
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* my_companies (COMPANY_MANAGER) */}
        {hasBlock('my_companies') && companies.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Dine klinikker
            </p>
            <ul className="space-y-2">
              {companies.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/proto/portfolio/${c.id}`}
                    className={`block rounded px-3 py-2 hover:bg-gray-50 transition-colors ${urgencyBorder(c.healthStatus === 'healthy' ? 'normal' : c.healthStatus)}`}
                  >
                    <p className="text-sm font-medium text-gray-900">{c.name}</p>
                    <p className="text-xs text-gray-500">{c.city}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* compliance_status (hardcoded) */}
        {hasBlock('ai_insights') && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Compliance-status
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Aabne sager</span>
                <span className="text-sm font-semibold text-red-600">2</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Afventer svar</span>
                <span className="text-sm font-semibold text-amber-600">1</span>
              </div>
              <div className="pt-1">
                <Link href="/proto/cases" className="text-xs text-gray-500 hover:text-gray-700 underline">
                  Se alle sager →
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* recent_activity (hardcoded) */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Seneste aktivitet
          </p>
          <ul className="space-y-2">
            {recentActivity.map((item) => (
              <li key={item.id} className="flex items-start gap-2">
                <Clock className="h-3.5 w-3.5 text-gray-300 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-700">{item.text}</p>
                  <p className="text-xs text-gray-400">{item.time}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* upcoming_visits (hardcoded) */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Kommende besoeg
          </p>
          <ul className="space-y-3">
            {upcomingVisits.map((visit) => (
              <li key={visit.id} className="flex items-start gap-2">
                <Calendar className="h-4 w-4 text-gray-300 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{visit.company}</p>
                  <p className="text-xs text-gray-500">{visit.type} · {visit.date}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* data_quality (hardcoded) */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Datakvalitet
          </p>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Selskaber med ufuldstaendige data</span>
              <span className="text-sm font-semibold text-amber-600">3</span>
            </div>
            <p className="text-xs text-gray-400">
              Manglende felter: CVR-adresse, kontaktperson, vedtaegter
            </p>
            <div className="pt-1">
              <Link href="/proto/portfolio" className="text-xs text-gray-500 hover:text-gray-700 underline">
                Se selskaber →
              </Link>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
