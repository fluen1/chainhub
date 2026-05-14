'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Breadcrumb,
  PageHeader,
  MetaSep,
  BButton,
  BAddButton,
  Strip,
  type StripCellData,
  AlertBar,
  Panel,
  PanelHeader,
  PanelFooter,
  Badge,
  type BadgeTone,
  AIInsightCard,
  PlusBadge,
  BottomBar,
  KbdHint,
  PanelEmpty,
  SlutLink,
} from '@/components/ui/b'
import {
  AddOwnerModal,
  AddPersonModal,
  AddMetricModal,
  EndOwnershipRoleModal,
  type ExistingOwner,
  type ExistingCompanyPerson,
  type ExistingMetric,
  type PersonOption,
} from '@/components/modals/b'
import { AddDataDropdown } from './add-data-dropdown'
import { EditStamdataDialog } from '@/components/companies/EditStamdataDialog'
import { getCompanyPersonRoleLabel } from '@/lib/labels'
import type { CompanyDetailData } from '@/actions/company-detail'

// ────────────────────────────────────────────────────────────────────────────
// /companies/[id] — B-stil detail-side med 4 wired modaler.
// Layout matcher docs/design/handoff/project/uploads/mockup-company-detail-b.html.
// ────────────────────────────────────────────────────────────────────────────

export interface OwnershipRow {
  id: string
  pct: number
  name: string
  type: 'person' | 'holding'
  effectiveDate: string | null
}

export interface CompanyPersonRow {
  id: string
  name: string
  initials: string
  role: string
  employmentType: string | null
  startDate: string | null
}

export interface MetricRow {
  metricType: 'OMSAETNING' | 'EBITDA' | 'RESULTAT' | 'LIKVIDITET' | 'EGENKAPITAL' | 'ANDET_METRIC'
  periodType: 'HELAAR' | 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'MAANED'
  periodYear: number
  value: number
}

export interface PersonOptionRow {
  id: string
  firstName: string
  lastName: string
  email: string | null
}

interface ExpiringLeaseInfo {
  contractId: string
  displayName: string
  daysUntilExpiry: number
}

interface Props {
  data: CompanyDetailData
  ownerships: OwnershipRow[]
  companyPersons: CompanyPersonRow[]
  metrics: MetricRow[]
  persons: PersonOptionRow[]
  canSeeOwnership: boolean
  expiringLease: ExpiringLeaseInfo | null
}

export function CompanyDetailB({
  data,
  ownerships,
  companyPersons,
  metrics,
  persons,
  canSeeOwnership,
  expiringLease,
}: Props) {
  const { company } = data
  const readOnly = data.role === 'GROUP_READONLY' || data.role === 'COMPANY_READONLY'

  // Section-gates: paneler respekterer visibleSections fra getCompanyDetailData.
  // Uden disse leaker GROUP_FINANCE-rollen Personer/Sager/Dokumenter selvom
  // SECTIONS_BY_ROLE blokerer dem i strip-counts.
  const showOwnership = data.visibleSections.has('ownership')
  const showPersons = data.visibleSections.has('persons')
  const showInsight = data.visibleSections.has('insight')
  const showContracts = data.visibleSections.has('contracts')
  const showCases = data.visibleSections.has('cases')
  const showFinance = data.visibleSections.has('finance')
  const showVisits = data.visibleSections.has('visits')
  const showDocuments = data.visibleSections.has('documents')

  const topGroupCount = [showOwnership, showPersons, showInsight].filter(Boolean).length
  const midGroupCount = [showCases, showFinance, showVisits].filter(Boolean).length
  const colsClass = (n: number) =>
    n >= 3 ? 'lg:grid-cols-3' : n === 2 ? 'lg:grid-cols-2' : 'lg:grid-cols-1'

  const [addOwnerOpen, setAddOwnerOpen] = useState(false)
  const [addPersonOpen, setAddPersonOpen] = useState(false)
  const [addMetricOpen, setAddMetricOpen] = useState(false)
  const [stamdataOpen, setStamdataOpen] = useState(false)
  const [endOwnership, setEndOwnership] = useState<OwnershipRow | null>(null)
  const [endRole, setEndRole] = useState<CompanyPersonRow | null>(null)

  // Strip-data
  const kaedePct = data.ownership?.kaedegruppePct ?? 100
  const ebitdaShort = useMemo(() => {
    const f = data.finance
    if (!f) return '—'
    if (f.ebitda.value_k >= 1000)
      return `${(f.ebitda.value_k / 1000).toFixed(1).replace('.', ',')}m`
    return `${f.ebitda.value_k}k`
  }, [data.finance])

  const stripCells: StripCellData[] = [
    { num: `${kaedePct}%`, label: 'Kædeandel' },
    {
      num: data.contracts.totalCount,
      label: 'Kontrakter',
      color: data.contracts.top.some((c) => c.badge.tone === 'red') ? 'amber' : 'default',
    },
    {
      num: data.cases.totalCount,
      label: 'Åbne sager',
      color: data.cases.totalCount > 0 ? 'red' : 'default',
    },
    { num: data.persons.totalCount, label: 'Personer' },
    { num: data.documents.rows.length, label: 'Dokumenter' },
    {
      num: ebitdaShort,
      label: 'EBITDA',
      color: ebitdaShort !== '—' ? 'green' : 'default',
    },
  ]

  // Existing-owners-mapping til AddOwnerModal (filtrer end_date=null fra raw)
  const existingOwners: ExistingOwner[] = ownerships.map((o) => ({
    name: o.name,
    pct: o.pct,
    type: o.type === 'person' ? 'person' : 'holding',
  }))

  // Existing-personrelationer til AddPersonModal
  const existingPersonRelations: ExistingCompanyPerson[] = companyPersons.map((cp) => ({
    personId: cp.id, // companyPerson id, ikke person id — bruges kun til konfliktdetektion
    role: cp.role,
    name: cp.name,
  }))

  const existingMetrics: ExistingMetric[] = metrics.map((m) => ({
    metricType: m.metricType,
    periodType: m.periodType,
    periodYear: m.periodYear,
    value: m.value,
  }))

  const personOptions: PersonOption[] = persons.map((p) => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    email: p.email,
  }))

  return (
    <>
      <Breadcrumb trail={[{ label: 'Selskaber', href: '/companies' }]} current={company.name} />

      <PageHeader
        title={company.name}
        meta={
          <>
            {company.cvr && (
              <>
                CVR {company.cvr}
                <MetaSep />
              </>
            )}
            {company.address && (
              <>
                {company.address}
                {company.city ? `, ${company.postal_code ?? ''} ${company.city}` : ''}
                <MetaSep />
              </>
            )}
            {company.founded_date && (
              <>
                Aktiv siden {company.founded_date.getFullYear()}
                <MetaSep />
              </>
            )}
            <Badge tone={statusBadgeTone(data.statusBadge.severity)}>
              {data.statusBadge.label}
            </Badge>
          </>
        }
        actions={
          readOnly ? null : (
            <>
              <BButton onClick={() => setStamdataOpen(true)}>Rediger stamdata</BButton>
              <AddDataDropdown
                onAddOwner={() => setAddOwnerOpen(true)}
                onAddPerson={() => setAddPersonOpen(true)}
                onAddMetric={() => setAddMetricOpen(true)}
                canAddOwner={canSeeOwnership && showOwnership}
                canAddPerson={showPersons}
                canAddMetric={showFinance}
              />
            </>
          )
        }
      />

      <Strip cells={stripCells} />

      {expiringLease &&
        expiringLease.daysUntilExpiry >= 0 &&
        expiringLease.daysUntilExpiry <= 30 && (
          <AlertBar
            tone="red"
            actions={
              <>
                <BButton href={`/contracts/${expiringLease.contractId}`}>Se kontrakt</BButton>
              </>
            }
          >
            <strong>
              {expiringLease.displayName} udløber om {expiringLease.daysUntilExpiry} dage
            </strong>{' '}
            · forhandling ikke startet
          </AlertBar>
        )}

      {/* 3-col: Ejerskab + Personer + AI Insight */}
      {topGroupCount > 0 && (
        <div className={`grid gap-3 ${colsClass(topGroupCount)} lg:items-start`}>
          {/* Ejerskab */}
          {showOwnership && (
            <Panel>
              <PanelHeader
                title="Ejerskab"
                meta={`${ownerships.length} ${ownerships.length === 1 ? 'ejer' : 'ejere'}`}
              />
              {!canSeeOwnership ? (
                <PanelEmpty>Du har ikke adgang til ejerskabsoplysninger</PanelEmpty>
              ) : ownerships.length === 0 ? (
                <PanelEmpty>Ingen ejere registreret</PanelEmpty>
              ) : (
                ownerships.map((o, i) => (
                  <div
                    key={o.id}
                    className={`flex items-center justify-between gap-2 px-3 py-1.5 text-[13px] ${
                      i < ownerships.length - 1 ? 'border-b border-b-divider' : ''
                    }`}
                  >
                    <span className="truncate text-b-1">
                      {o.name}
                      {o.type === 'holding' && (
                        <span className="ml-1 text-[11px] text-b-2">(Holding)</span>
                      )}
                    </span>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="b-tnum font-medium">{o.pct.toFixed(0)}%</span>
                      {!readOnly && (
                        <SlutLink onClick={() => setEndOwnership(o)} title="Slut ejerskab" />
                      )}
                    </div>
                  </div>
                ))
              )}
              {data.ownership?.ejeraftaleStatus && (
                <div className="flex items-center justify-between border-t border-b-divider px-3 py-1.5 text-[12px]">
                  <span className="text-b-2">Ejeraftale</span>
                  <Badge tone={data.ownership.ejeraftaleStatus.danger ? 'red' : 'green'}>
                    {data.ownership.ejeraftaleStatus.label}
                  </Badge>
                </div>
              )}
              <PanelFooter>
                <div className="flex items-center justify-between">
                  <span>Total {ownerships.reduce((s, o) => s + o.pct, 0).toFixed(0)}%</span>
                  {!readOnly && canSeeOwnership && (
                    <BAddButton onClick={() => setAddOwnerOpen(true)}>+ Tilføj ejer</BAddButton>
                  )}
                </div>
              </PanelFooter>
            </Panel>
          )}

          {/* Personer */}
          {showPersons && (
            <Panel>
              <PanelHeader
                title="Personer"
                meta={`${companyPersons.length} ${companyPersons.length === 1 ? 'aktiv' : 'aktive'}`}
              />
              {companyPersons.length === 0 ? (
                <PanelEmpty>Ingen personer tilknyttet</PanelEmpty>
              ) : (
                companyPersons.slice(0, 6).map((cp, i) => (
                  <div
                    key={cp.id}
                    className={`grid grid-cols-[24px_1fr_auto] items-center gap-2.5 px-3 py-1.5 ${
                      i < Math.min(companyPersons.length, 6) - 1 ? 'border-b border-b-divider' : ''
                    }`}
                  >
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-[4px] bg-b-border text-[10px] font-semibold text-b-gray-fg">
                      {cp.initials}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-[13px] text-b-1">{cp.name}</div>
                      <div className="mt-px text-[11px] text-b-2">
                        {getCompanyPersonRoleLabel(cp.role)}
                        {cp.startDate && ` · ans. ${cp.startDate}`}
                      </div>
                    </div>
                    {!readOnly && <SlutLink onClick={() => setEndRole(cp)} title="Slut rolle" />}
                  </div>
                ))
              )}
              <PanelFooter>
                <div className="flex items-center justify-between">
                  <span>
                    {companyPersons.length > 6 && `+${companyPersons.length - 6} flere · `}
                    <Link href="/persons" className="text-b-blue-fg no-underline hover:underline">
                      Se alle →
                    </Link>
                  </span>
                  {!readOnly && (
                    <BAddButton onClick={() => setAddPersonOpen(true)}>+ Tilføj person</BAddButton>
                  )}
                </div>
              </PanelFooter>
            </Panel>
          )}

          {/* AI Insight */}
          {showInsight && (
            <Panel>
              <PanelHeader
                title={
                  <span className="flex items-center gap-1.5">
                    AI Insight <PlusBadge />
                  </span>
                }
                meta={data.aiInsight ? 'AI-beregnet' : 'Ingen analyse'}
              />
              {data.aiInsight ? (
                <div className="p-2">
                  <AIInsightCard label={`⚡ ${data.aiInsight.headline_md}`}>
                    {data.aiInsight.body_md}
                  </AIInsightCard>
                </div>
              ) : (
                <PanelEmpty>AI-analyse er ikke konfigureret eller cap-blokeret</PanelEmpty>
              )}
            </Panel>
          )}
        </div>
      )}

      {/* Kontrakter (full-width) */}
      {showContracts && (
        <Panel>
          <PanelHeader
            title={
              <span className="flex items-center gap-2">
                Kontrakter
                <span className="rounded-[8px] bg-b-border px-1.5 py-px text-[10px] font-medium text-b-gray-fg">
                  {data.contracts.totalCount}
                </span>
              </span>
            }
            meta="sortér: udløb"
          />
          {data.contracts.top.length === 0 ? (
            <PanelEmpty>Ingen aktive kontrakter</PanelEmpty>
          ) : (
            data.contracts.top.map((c, i) => (
              <Link
                key={c.id}
                href={`/contracts/${c.id}`}
                className={`grid grid-cols-[88px_1fr_14px] items-center gap-3 px-3 py-1.5 text-[13px] no-underline hover:bg-b-row-hover ${
                  i < data.contracts.top.length - 1 ? 'border-b border-b-divider' : ''
                }`}
              >
                <Badge tone={c.badge.tone}>{c.badge.label}</Badge>
                <span className="truncate">
                  <strong className="font-medium">{c.name}</strong>
                  {c.meta && <span className="text-b-2"> · {c.meta}</span>}
                </span>
                <span className="text-b-3">›</span>
              </Link>
            ))
          )}
          <PanelFooter>
            <div className="flex items-center justify-between">
              <span>
                {data.contracts.totalCount} aktive
                {data.contracts.totalCount > data.contracts.top.length &&
                  ` · ${data.contracts.totalCount - data.contracts.top.length} flere`}
              </span>
              <BAddButton href={`/contracts/new?company=${company.id}`}>
                + Opret kontrakt
              </BAddButton>
            </div>
          </PanelFooter>
        </Panel>
      )}

      {/* 3-col: Sager + Finans + Besøg */}
      {midGroupCount > 0 && (
        <div className={`grid gap-3 ${colsClass(midGroupCount)} lg:items-start`}>
          {/* Sager */}
          {showCases && (
            <Panel>
              <PanelHeader
                title={
                  <span className="flex items-center gap-2">
                    Sager
                    <span className="rounded-[8px] bg-b-border px-1.5 py-px text-[10px] font-medium text-b-gray-fg">
                      {data.cases.totalCount}
                    </span>
                  </span>
                }
                meta="åbne"
              />
              {data.cases.top.length === 0 ? (
                <PanelEmpty>Ingen åbne sager</PanelEmpty>
              ) : (
                data.cases.top.slice(0, 4).map((c, i) => (
                  <Link
                    key={c.id}
                    href={`/cases/${c.id}`}
                    className={`grid grid-cols-[50px_1fr_14px] items-center gap-2 px-3 py-1.5 text-[13px] no-underline hover:bg-b-row-hover ${
                      i < Math.min(data.cases.top.length, 4) - 1 ? 'border-b border-b-divider' : ''
                    }`}
                  >
                    <Badge tone={c.badge.tone}>{c.badge.label}</Badge>
                    <div className="min-w-0">
                      <div className="truncate text-b-1">{c.title}</div>
                      {c.meta && <div className="text-[11px] text-b-2">{c.meta}</div>}
                    </div>
                    <span className="text-b-3">›</span>
                  </Link>
                ))
              )}
              <PanelFooter>
                <div className="flex items-center justify-between">
                  <span />
                  <BAddButton href={`/cases/new?company=${company.id}`}>+ Opret sag</BAddButton>
                </div>
              </PanelFooter>
            </Panel>
          )}

          {/* Finans */}
          {showFinance && (
            <Panel>
              <PanelHeader title="Finans" meta={data.finance ? 'Seneste år' : 'Ingen data'} />
              {data.finance ? (
                <div className="px-3 py-2">
                  <FinRow
                    label="Omsætning"
                    value={`${data.finance.omsaetning.value_mio.toFixed(1).replace('.', ',')}m`}
                  />
                  <FinRow label="EBITDA" value={`${data.finance.ebitda.value_k}k`} />
                  <FinRow
                    label="Margin"
                    value={`${data.finance.margin_pct.toFixed(1).replace('.', ',')}%`}
                  />
                  <FinRow
                    label="Status"
                    value={
                      <Badge tone={data.finance.statusBadge.tone}>
                        {data.finance.statusBadge.label}
                      </Badge>
                    }
                    isLast
                  />
                </div>
              ) : (
                <PanelEmpty>Tilføj første finansiel metric</PanelEmpty>
              )}
              <PanelFooter>
                <div className="flex items-center justify-between">
                  <span />
                  {!readOnly && (
                    <BAddButton onClick={() => setAddMetricOpen(true)}>+ Tilføj metric</BAddButton>
                  )}
                </div>
              </PanelFooter>
            </Panel>
          )}

          {/* Besøg */}
          {showVisits && (
            <Panel>
              <PanelHeader title="Besøg" meta={`${data.visits.length} planlagt`} />
              {data.visits.length === 0 ? (
                <PanelEmpty>Ingen besøg</PanelEmpty>
              ) : (
                data.visits.slice(0, 4).map((v, i) => (
                  <div
                    key={v.id}
                    className={`flex items-center justify-between gap-2 px-3 py-1.5 text-[13px] ${
                      i < Math.min(data.visits.length, 4) - 1 ? 'border-b border-b-divider' : ''
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-b-1">{v.typeLabel}</div>
                      {v.meta && <div className="text-[11px] text-b-2">{v.meta}</div>}
                    </div>
                    <Badge tone={visitBadgeTone(v.badge.tone)}>{v.badge.label}</Badge>
                  </div>
                ))
              )}
              <PanelFooter>
                <div className="flex items-center justify-between">
                  <span />
                  <BAddButton href={`/visits/new?company=${company.id}`}>
                    + Planlæg besøg
                  </BAddButton>
                </div>
              </PanelFooter>
            </Panel>
          )}
        </div>
      )}

      {/* Dokumenter (full-width) */}
      {showDocuments && (
        <Panel>
          <PanelHeader
            title={
              <span className="flex items-center gap-2">
                Dokumenter
                <span className="rounded-[8px] bg-b-border px-1.5 py-px text-[10px] font-medium text-b-gray-fg">
                  {data.documents.rows.length}
                </span>
              </span>
            }
            meta={
              data.documents.awaitingReviewCount > 0
                ? `${data.documents.awaitingReviewCount} afventer review`
                : 'Alle behandlet'
            }
          />
          {data.documents.rows.length === 0 ? (
            <PanelEmpty>Ingen dokumenter uploadet endnu</PanelEmpty>
          ) : (
            data.documents.rows.map((d, i) => (
              <Link
                key={d.id}
                href={`/documents/review/${d.id}`}
                className={`grid grid-cols-[60px_1fr_96px_14px] items-center gap-2 px-3 py-1.5 text-[13px] no-underline hover:bg-b-row-hover ${
                  i < data.documents.rows.length - 1 ? 'border-b border-b-divider' : ''
                }`}
              >
                <Badge tone="gray">{d.fileName.split('.').pop()?.toUpperCase() ?? 'FIL'}</Badge>
                <span className="truncate">
                  <strong className="font-medium">{d.fileName}</strong>
                  {d.meta && <span className="text-b-2"> · {d.meta}</span>}
                </span>
                {/* DocumentViewRow.badge.label fra getCompanyDetailData er enten "AI ✓"
                  (når extraction.completed+reviewed) eller dårligt-passende "Arkiveret".
                  Mapper "Arkiveret" → "Ikke AI" så terminologi matcher /documents. */}
                <Badge tone={d.badge.label === 'AI ✓' ? 'green' : 'gray'}>
                  {d.badge.label === 'AI ✓' ? 'AI ✓' : 'Ikke AI'}
                </Badge>
                <span className="text-b-3">›</span>
              </Link>
            ))
          )}
          <PanelFooter>
            <div className="flex items-center justify-between">
              <Link
                href={`/documents?company=${company.id}`}
                className="text-b-blue-fg no-underline hover:underline"
              >
                Se alle dokumenter →
              </Link>
              <BAddButton href={`/documents?company=${company.id}`}>+ Upload dokument</BAddButton>
            </div>
          </PanelFooter>
        </Panel>
      )}

      <BottomBar
        left={`${company.name} · CVR ${company.cvr ?? '—'}`}
        right={
          <>
            <KbdHint k="⌘K" label="handling" />
            <span>·</span>
            <KbdHint k="E" label="rediger" />
            <span>·</span>
            <KbdHint k="G" label="derhen" />
          </>
        }
      />

      {/* Stamdata-modal (ikke section-gated — stamdata er altid tilgængeligt for non-readonly) */}
      {!readOnly && (
        <EditStamdataDialog
          open={stamdataOpen}
          onClose={() => setStamdataOpen(false)}
          companyId={company.id}
          initial={{
            name: company.name,
            cvr: company.cvr ?? null,
            address: company.address ?? null,
            postal_code: company.postal_code ?? null,
            city: company.city ?? null,
          }}
        />
      )}

      {/* Modaler — section-gated så rolle uden sektion-adgang ikke kan trigge */}
      {!readOnly && canSeeOwnership && showOwnership && (
        <AddOwnerModal
          open={addOwnerOpen}
          onClose={() => setAddOwnerOpen(false)}
          companyId={company.id}
          companyName={company.name}
          existingOwners={existingOwners}
          persons={personOptions}
        />
      )}
      {!readOnly && showPersons && (
        <AddPersonModal
          open={addPersonOpen}
          onClose={() => setAddPersonOpen(false)}
          companyId={company.id}
          companyName={company.name}
          existing={existingPersonRelations}
          persons={personOptions}
        />
      )}
      {!readOnly && showFinance && (
        <AddMetricModal
          open={addMetricOpen}
          onClose={() => setAddMetricOpen(false)}
          companyId={company.id}
          companyName={company.name}
          existing={existingMetrics}
        />
      )}
      {endOwnership && showOwnership && (
        <EndOwnershipRoleModal
          open
          onClose={() => setEndOwnership(null)}
          mode="ownership"
          id={endOwnership.id}
          personName={endOwnership.name}
          contextLabel={`${endOwnership.pct.toFixed(0)}% ejer i ${company.name}${
            endOwnership.effectiveDate ? ` (siden ${endOwnership.effectiveDate})` : ''
          }`}
        />
      )}
      {endRole && showPersons && (
        <EndOwnershipRoleModal
          open
          onClose={() => setEndRole(null)}
          mode="role"
          id={endRole.id}
          personName={endRole.name}
          contextLabel={`${getCompanyPersonRoleLabel(endRole.role)} i ${company.name}${
            endRole.startDate ? ` (siden ${endRole.startDate})` : ''
          }`}
        />
      )}
    </>
  )
}

// ────────────────────────────────────────────────────────────────────────────

function FinRow({
  label,
  value,
  isLast,
}: {
  label: string
  value: React.ReactNode
  isLast?: boolean
}) {
  return (
    <div
      className={`flex items-center justify-between py-1 text-[12px] ${
        isLast ? '' : 'border-b border-b-divider'
      }`}
    >
      <span className="text-b-2">{label}</span>
      <span className="b-tnum font-medium text-b-1">{value}</span>
    </div>
  )
}

function statusBadgeTone(severity: 'critical' | 'warning' | 'healthy'): BadgeTone {
  if (severity === 'critical') return 'red'
  if (severity === 'warning') return 'amber'
  return 'green'
}

function visitBadgeTone(t: 'blue' | 'green' | 'slate'): BadgeTone {
  if (t === 'blue') return 'blue'
  if (t === 'green') return 'green'
  return 'gray'
}
