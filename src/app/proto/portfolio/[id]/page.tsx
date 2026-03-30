'use client'

import Link from 'next/link'
import { ArrowLeft, TrendingUp, TrendingDown, Building2 } from 'lucide-react'
import { usePrototype } from '@/components/prototype/PrototypeProvider'
import { InsightCard } from '@/components/prototype/InsightCard'
import { CollapsibleSection } from '@/components/ui/CollapsibleSection'
import { getInsights } from '@/mock/insights'
import { getCompanyById } from '@/mock/companies'
import { getContractsByCompany } from '@/mock/contracts'
import { getFinancialByCompany } from '@/mock/financial'
import { getDocumentsByCompany } from '@/mock/documents'
import { getVisibleCompanySections } from '@/mock/helpers'
import type { MockCompany } from '@/mock/types'

// ----------------------------------------------------------------
// Hjælpere
// ----------------------------------------------------------------

type HealthStatus = MockCompany['healthStatus']

function statusBadge(status: HealthStatus): { label: string; className: string } {
  switch (status) {
    case 'critical':
      return { label: 'Kritisk', className: 'bg-red-100 text-red-700' }
    case 'warning':
      return { label: 'Advarsel', className: 'bg-amber-100 text-amber-700' }
    case 'healthy':
      return { label: 'Sund', className: 'bg-green-100 text-green-700' }
  }
}

function companyStatusBadge(status: MockCompany['status']): string {
  switch (status) {
    case 'AKTIV': return 'bg-green-100 text-green-700'
    case 'UNDER_STIFTELSE': return 'bg-blue-100 text-blue-700'
    case 'UNDER_AFVIKLING': return 'bg-red-100 text-red-700'
    case 'INAKTIV': return 'bg-gray-100 text-gray-600'
  }
}

function contractUrgencyClass(urgency: string): string {
  if (urgency === 'critical') return 'border-l-4 border-l-red-500'
  if (urgency === 'warning') return 'border-l-4 border-l-amber-400'
  return 'border-l-4 border-l-gray-200'
}

function formatKr(val: number | null): string {
  if (val === null) return '—'
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M kr.`
  return `${(val / 1_000).toFixed(0)}K kr.`
}

function trendPct(trend: number | null): string {
  if (trend === null) return ''
  const sign = trend >= 0 ? '+' : ''
  return `${sign}${(trend * 100).toFixed(1)}%`
}

// ----------------------------------------------------------------
// Hardcoded testdata til sektioner
// ----------------------------------------------------------------

const hardcodedPersons: Record<string, { name: string; role: string; email: string }[]> = {
  default: [
    { name: 'Lars Jensen', role: 'Direktoer', email: 'lars@klinik.dk' },
    { name: 'Mette Andersen', role: 'Bestyrelsesmedlem', email: 'mette@andersen.dk' },
    { name: 'Sofie Madsen', role: 'Ansat', email: 'sofie@klinik.dk' },
  ],
}

const hardcodedCases: Record<string, { id: string; title: string; status: string; date: string }[]> = {
  default: [
    { id: 'sag-1', title: 'Tvist om overtagelsesvilkaar', status: 'Aaben', date: '12. januar 2026' },
    { id: 'sag-2', title: 'Revisionspaategning under behandling', status: 'Afventer', date: '3. marts 2026' },
  ],
}

const hardcodedVisits: Record<string, { type: string; date: string; completed?: boolean }[]> = {
  default: [
    { type: 'Tilsynsbesoeg (planlagt)', date: '3. april 2026', completed: false },
    { type: 'Tilsynsbesoeg (gennemfoert)', date: '15. november 2025', completed: true },
  ],
}

// ----------------------------------------------------------------
// Komponent
// ----------------------------------------------------------------

export default function CompanyDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const { activeUser, dataScenario } = usePrototype()
  const role = activeUser.role

  const company = getCompanyById(id)

  if (!company) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Link href="/proto/portfolio" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft className="h-4 w-4" />
          Portefolje
        </Link>
        <div className="flex flex-col items-center justify-center py-20 text-center text-gray-400">
          <Building2 className="h-12 w-12 mb-4 text-gray-300" />
          <p className="text-sm font-medium text-gray-600">Selskab ikke fundet</p>
          <p className="text-xs text-gray-400 mt-1">Det onskede selskab findes ikke eller er blevet slettet.</p>
        </div>
      </div>
    )
  }

  const visibleSections = getVisibleCompanySections(role)
  const insights = getInsights('portfolio', role, dataScenario).slice(0, 2)
  const contracts = getContractsByCompany(id)
  const financialMetrics = getFinancialByCompany(id)
  const documents = getDocumentsByCompany(id).slice(0, 3)

  const healthBadge = statusBadge(company.healthStatus)
  const persons = hardcodedPersons.default
  const cases = hardcodedCases.default
  const visits = hardcodedVisits.default

  // Gruppér kontrakter efter kategori
  const contractsByCategory = contracts.reduce<Record<string, typeof contracts>>((acc, c) => {
    if (!acc[c.categoryLabel]) acc[c.categoryLabel] = []
    acc[c.categoryLabel].push(c)
    return acc
  }, {})

  // Finansielle data for 2024 og 2025
  const fin2024 = financialMetrics.find((m) => m.year === 2024)
  const fin2025 = financialMetrics.find((m) => m.year === 2025)

  // Max omsaetning til simpel bar-visualisering
  const maxOmsaetning = Math.max(fin2024?.omsaetning ?? 0, fin2025?.omsaetning ?? 1)

  function hasSection(name: string) {
    return visibleSections.includes(name)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      {/* Breadcrumb */}
      <Link
        href="/proto/portfolio"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Portefolje
      </Link>

      {/* Selskabshoved */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{company.name}</h1>
            <p className="text-sm text-gray-500 mt-0.5">CVR {company.cvr} · {company.companyType}</p>
            <p className="text-sm text-gray-500 mt-0.5">
              Partner: <span className="font-medium text-gray-700">{company.partnerName}</span>
              {' '}({company.partnerOwnershipPct}% ejerandel)
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center rounded px-2.5 py-1 text-xs font-medium ${companyStatusBadge(company.status)}`}>
              {company.status}
            </span>
            <span className={`inline-flex items-center rounded px-2.5 py-1 text-xs font-medium ${healthBadge.className}`}>
              {healthBadge.label}
            </span>
          </div>
        </div>

        {/* Sundhedsaarsager */}
        {company.healthReasons.length > 0 && (
          <ul className="mt-3 space-y-1">
            {company.healthReasons.map((reason, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                <span className="text-xs text-red-700">{reason}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* InsightCards */}
      {insights.length > 0 && (
        <div className="space-y-2">
          {insights.map((ins) => (
            <InsightCard key={ins.id} insight={ins} />
          ))}
        </div>
      )}

      {/* ---- Sektioner i fast raekkefoelge ---- */}

      {/* STAMDATA / overview */}
      {hasSection('overview') && (
        <CollapsibleSection title="Stamdata" count={0} defaultOpen={true}>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-gray-500">Adresse</p>
              <p className="text-sm text-gray-900">{company.address}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">By</p>
              <p className="text-sm text-gray-900">{company.city}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Selskabstype</p>
              <p className="text-sm text-gray-900">{company.companyType}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Status</p>
              <p className="text-sm text-gray-900">{company.status}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Medarbejdere</p>
              <p className="text-sm text-gray-900">{company.employeeCount}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Aabne sager</p>
              <p className="text-sm text-gray-900">{company.openCaseCount}</p>
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* EJERSKAB / ownership */}
      {hasSection('ownership') && (
        <CollapsibleSection title="Ejerskab" count={0} defaultOpen={true}>
          <div className="p-5 space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Kaedegruppen</span>
                <span className="font-semibold text-gray-900">{company.groupOwnershipPct}%</span>
              </div>
              <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500"
                  style={{ width: `${company.groupOwnershipPct}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">{company.partnerName} (lokal partner)</span>
                <span className="font-semibold text-gray-900">{company.partnerOwnershipPct}%</span>
              </div>
              <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-green-500"
                  style={{ width: `${company.partnerOwnershipPct}%` }}
                />
              </div>
            </div>
            <div className="pt-1">
              <p className="text-xs text-gray-500">
                Ejeraftale: {contracts.find((c) => c.systemType === 'EJERAFTALE')
                  ? <span className="text-green-600 font-medium">Registreret</span>
                  : <span className="text-red-600 font-medium">Mangler</span>
                }
              </p>
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* KONTRAKTER / contracts */}
      {hasSection('contracts') && (
        <CollapsibleSection title="Kontrakter" count={contracts.length} defaultOpen={true}>
          <div className="p-5 space-y-4">
            {Object.entries(contractsByCategory).map(([category, catContracts]) => (
              <div key={category}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{category}</p>
                <ul className="space-y-1">
                  {catContracts.map((contract) => (
                    <li key={contract.id} className={`rounded px-3 py-2 ${contractUrgencyClass(contract.urgency)}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-gray-900">{contract.displayName}</span>
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                          contract.urgency === 'critical' ? 'bg-red-100 text-red-700' :
                          contract.urgency === 'warning' ? 'bg-amber-100 text-amber-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {contract.statusLabel}
                        </span>
                      </div>
                      {contract.expiryDate && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {contract.daysUntilExpiry !== null && contract.daysUntilExpiry < 0
                            ? `Udlobet ${Math.abs(contract.daysUntilExpiry)} dage siden`
                            : `Udloeber: ${contract.expiryDate}`
                          }
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="pt-1">
              <Link href="/proto/contracts" className="text-xs text-gray-500 hover:text-gray-700 underline">
                Se alle kontrakter paa tvaers →
              </Link>
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* OEKONOMI / finance */}
      {hasSection('finance') && (
        <CollapsibleSection title="Oekonomi" count={0} defaultOpen={true}>
          <div className="p-5 space-y-4">
            {[fin2024, fin2025].filter(Boolean).map((fin) => {
              if (!fin) return null
              const barWidth = maxOmsaetning > 0 ? Math.round(((fin.omsaetning ?? 0) / maxOmsaetning) * 100) : 0
              return (
                <div key={fin.year}>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{fin.year}</p>
                  <div className="grid grid-cols-3 gap-3 mb-2">
                    <div>
                      <p className="text-xs text-gray-500">Omsa&aelig;tning</p>
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-semibold text-gray-900">{formatKr(fin.omsaetning)}</span>
                        {fin.omsaetningTrend !== null && (
                          fin.omsaetningTrend >= 0
                            ? <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                            : <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                        )}
                      </div>
                      <p className="text-xs text-gray-400">{trendPct(fin.omsaetningTrend)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">EBITDA</p>
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-semibold text-gray-900">{formatKr(fin.ebitda)}</span>
                        {fin.ebitdaTrend !== null && (
                          fin.ebitdaTrend >= 0
                            ? <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                            : <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                        )}
                      </div>
                      <p className="text-xs text-gray-400">{trendPct(fin.ebitdaTrend)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Resultat</p>
                      <span className="text-sm font-semibold text-gray-900">{formatKr(fin.resultat)}</span>
                    </div>
                  </div>
                  {/* Simpel omsaetningsbar */}
                  <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-400"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </CollapsibleSection>
      )}

      {/* GOVERNANCE / governance */}
      {hasSection('governance') && (
        <CollapsibleSection title="Governance" count={0} defaultOpen={false}>
          <div className="p-5">
            <p className="text-sm text-gray-500">Bestyrelse og generalforsamling — data vises her.</p>
          </div>
        </CollapsibleSection>
      )}

      {/* MEDARBEJDERE / employees */}
      {hasSection('employees') && (
        <CollapsibleSection title="Personer" count={persons.length} defaultOpen={true}>
          <div className="divide-y divide-gray-100">
            {persons.map((person, i) => (
              <div key={i} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{person.name}</p>
                  <p className="text-xs text-gray-500">{person.email}</p>
                </div>
                <span className="text-xs bg-gray-100 text-gray-600 rounded px-2 py-0.5">{person.role}</span>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* SAGER / cases */}
      {hasSection('cases') && (
        <CollapsibleSection title="Sager" count={cases.length} defaultOpen={true}>
          <div className="divide-y divide-gray-100">
            {cases.map((c) => (
              <div key={c.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{c.title}</p>
                  <p className="text-xs text-gray-400">{c.date}</p>
                </div>
                <span className={`text-xs rounded px-2 py-0.5 font-medium ${
                  c.status === 'Aaben' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {c.status}
                </span>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* BESOEG (vises for alle roller med overview-adgang) */}
      {hasSection('overview') && (
        <CollapsibleSection title="Besoeg" count={visits.length} defaultOpen={true}>
          <div className="divide-y divide-gray-100">
            {visits.map((visit, i) => (
              <div key={i} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{visit.type}</p>
                  <p className="text-xs text-gray-400">{visit.date}</p>
                </div>
                <span className={`text-xs rounded px-2 py-0.5 font-medium ${
                  visit.completed ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  {visit.completed ? 'Gennemfoert' : 'Planlagt'}
                </span>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* DOKUMENTER / documents */}
      {hasSection('documents') && (
        <CollapsibleSection title="Dokumenter" count={documents.length} defaultOpen={true}>
          <div className="divide-y divide-gray-100">
            {documents.length === 0 ? (
              <p className="px-5 py-4 text-sm text-gray-400">Ingen dokumenter registreret.</p>
            ) : (
              documents.map((doc) => (
                <div key={doc.id} className="px-5 py-3 flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{doc.fileName}</p>
                    <p className="text-xs text-gray-400">{doc.uploadedBy} · {doc.uploadedAt.split('T')[0]}</p>
                  </div>
                  <span className={`ml-3 shrink-0 text-xs rounded px-2 py-0.5 font-medium ${
                    doc.status === 'ready_for_review' ? 'bg-amber-100 text-amber-700' :
                    doc.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {doc.status === 'ready_for_review' ? 'Afventer gennemgang' :
                     doc.status === 'processing' ? 'Behandles' :
                     doc.status === 'reviewed' ? 'Gennemgaaet' : 'Arkiveret'}
                  </span>
                </div>
              ))
            )}
          </div>
        </CollapsibleSection>
      )}
    </div>
  )
}
