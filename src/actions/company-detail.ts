'use server'

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { getAccessibleCompanies } from '@/lib/permissions'
import {
  sectionsForRole,
  pickHighestPriorityRole,
  deriveHealthDimensions,
  deriveStatusBadge,
  sortContractsByUrgency,
  sortCasesByUrgency,
  selectKeyPersons,
  type SectionKey,
  type HealthDimensions,
  type StatusBadge,
} from '@/lib/company-detail/helpers'
import {
  generateCompanyInsights,
  type CompanySnapshot,
  type CompanyAlert,
  type AiInsight,
} from '@/lib/ai/jobs/company-insights'

// -----------------------------------------------------------------
// Output-typer
// -----------------------------------------------------------------

export interface CompanyDetailData {
  company: {
    id: string
    name: string
    cvr: string | null
    address: string | null
    city: string | null
    postal_code: string | null
    status: string
    founded_date: Date | null
  }
  visibleSections: Set<SectionKey>
  healthDimensions: HealthDimensions
  statusBadge: StatusBadge
  alerts: CompanyAlert[]
  aiInsight: AiInsight | null
  ownership: OwnershipData | null
  contracts: { top: ContractViewRow[]; totalCount: number }
  finance: FinanceViewData | null
  cases: { top: CaseViewRow[]; totalCount: number }
  persons: { top: PersonViewRow[]; totalCount: number }
  visits: VisitViewRow[]
  documents: { rows: DocumentViewRow[]; awaitingReviewCount: number }
  role: string
}

export interface OwnershipData {
  kaedegruppePct: number
  localPartner: { name: string; pct: number } | null
  ejeraftaleStatus: { label: string; danger: boolean } | null
  holdingCompanyName: string | null
}

export interface ContractViewRow {
  id: string
  iconLetters: string
  iconTone: 'red' | 'amber' | 'green'
  name: string
  meta: string
  badge: { label: string; tone: 'red' | 'amber' | 'green' }
}

export interface FinanceViewData {
  omsaetning: { value_mio: number; yoy_pct: number | null }
  ebitda: { value_k: number; yoy_pct: number | null }
  margin_pct: number
  resultat: { value_k: number; positive: boolean }
  quarterly: Array<{ label: string; fraction: number }>
  statusBadge: { label: string; tone: 'green' | 'amber' | 'red' }
}

export interface CaseViewRow {
  id: string
  iconLetter: string
  iconTone: 'red' | 'amber'
  title: string
  meta: string
  badge: { label: string; tone: 'red' | 'amber' }
}

export interface PersonViewRow {
  id: string
  initials: string
  name: string
  role: string
}

export interface VisitViewRow {
  id: string
  typeLabel: string
  meta: string
  badge: { label: string; tone: 'blue' | 'green' | 'slate' }
}

export interface DocumentViewRow {
  id: string
  isAiExtracted: boolean
  fileName: string
  meta: string
  badge: { label: string; tone: 'purple' | 'green' }
}

// -----------------------------------------------------------------
// Hovedfunktion
// -----------------------------------------------------------------

const CACHE_TTL_MS = 24 * 60 * 60 * 1000

export async function getCompanyDetailData(
  companyId: string,
  userId: string,
  organizationId: string
): Promise<CompanyDetailData | null> {
  const [accessibleIds, roleRows] = await Promise.all([
    getAccessibleCompanies(userId, organizationId),
    prisma.userRoleAssignment.findMany({
      where: { user_id: userId, organization_id: organizationId },
      select: { role: true },
    }),
  ])
  if (!accessibleIds.includes(companyId)) return null

  const role = pickHighestPriorityRole(roleRows)
  const visibleSections = sectionsForRole(role)
  const today = new Date()

  const [
    company,
    ownerships,
    ejeraftale,
    contractsRaw,
    contractsTotal,
    finance2025Raw,
    finance2024Raw,
    quarterlyRaw,
    casesRaw,
    casesTotal,
    companyPersonsRaw,
    personsTotal,
    visitsRaw,
    documentsRaw,
    aiCacheRow,
  ] = await Promise.all([
    prisma.company.findFirst({
      where: { id: companyId, organization_id: organizationId, deleted_at: null },
    }),
    prisma.ownership.findMany({
      where: { company_id: companyId, organization_id: organizationId },
      include: { owner_person: { select: { first_name: true, last_name: true } } },
    }),
    prisma.contract.findFirst({
      where: {
        company_id: companyId,
        organization_id: organizationId,
        system_type: 'EJERAFTALE',
        deleted_at: null,
      },
      orderBy: { effective_date: 'desc' },
    }),
    prisma.contract.findMany({
      where: {
        company_id: companyId,
        organization_id: organizationId,
        deleted_at: null,
        status: 'AKTIV',
      },
      take: 20,
    }),
    prisma.contract.count({
      where: {
        company_id: companyId,
        organization_id: organizationId,
        deleted_at: null,
        status: 'AKTIV',
      },
    }),
    prisma.financialMetric.findMany({
      where: {
        company_id: companyId,
        organization_id: organizationId,
        period_year: 2025,
        period_type: 'HELAAR',
      },
    }),
    prisma.financialMetric.findMany({
      where: {
        company_id: companyId,
        organization_id: organizationId,
        period_year: 2024,
        period_type: 'HELAAR',
      },
    }),
    // Kvartals-omsaetning: PeriodType har Q1/Q2/Q3/Q4 som separate enum values
    prisma.financialMetric.findMany({
      where: {
        company_id: companyId,
        organization_id: organizationId,
        period_year: 2025,
        period_type: { in: ['Q1', 'Q2', 'Q3', 'Q4'] },
        metric_type: 'OMSAETNING',
      },
    }),
    prisma.case.findMany({
      where: {
        organization_id: organizationId,
        deleted_at: null,
        status: { in: ['NY', 'AKTIV', 'AFVENTER_EKSTERN', 'AFVENTER_KLIENT'] },
        case_companies: { some: { company_id: companyId } },
      },
      take: 10,
    }),
    prisma.case.count({
      where: {
        organization_id: organizationId,
        deleted_at: null,
        status: { in: ['NY', 'AKTIV', 'AFVENTER_EKSTERN', 'AFVENTER_KLIENT'] },
        case_companies: { some: { company_id: companyId } },
      },
    }),
    prisma.companyPerson.findMany({
      where: {
        company_id: companyId,
        organization_id: organizationId,
        end_date: null,
      },
      include: { person: { select: { first_name: true, last_name: true } } },
    }),
    prisma.companyPerson.count({
      where: { company_id: companyId, organization_id: organizationId, end_date: null },
    }),
    prisma.visit.findMany({
      where: { company_id: companyId, organization_id: organizationId, deleted_at: null },
      orderBy: { visit_date: 'desc' },
      take: 5,
    }),
    prisma.document.findMany({
      where: { company_id: companyId, organization_id: organizationId, deleted_at: null },
      orderBy: { uploaded_at: 'desc' },
      take: 5,
      include: { extraction: { select: { extraction_status: true, reviewed_at: true } } },
    }),
    prisma.companyInsightsCache.findUnique({ where: { company_id: companyId } }),
  ])

  if (!company) return null

  // Health dimensions
  const finance2025Sum = sumFinance(finance2025Raw)
  const finance2024Sum = sumFinance(finance2024Raw)
  const lastVisitDate = visitsRaw[0]?.visit_date ?? null
  const healthDimensions = deriveHealthDimensions({
    activeContracts: contractsRaw.map((c) => ({ expiry_date: c.expiry_date })),
    openCases: casesRaw.map((c) => ({ status: c.status })),
    finance2025:
      finance2025Sum.omsaetning !== null && finance2025Sum.ebitda !== null
        ? {
            ebitda: finance2025Sum.ebitda,
            margin:
              finance2025Sum.omsaetning > 0
                ? finance2025Sum.ebitda / finance2025Sum.omsaetning
                : 0,
            omsaetning: finance2025Sum.omsaetning,
          }
        : null,
    finance2024:
      finance2024Sum.omsaetning !== null
        ? { omsaetning: finance2024Sum.omsaetning }
        : null,
    lastVisitDate,
    today,
  })
  const statusBadge = deriveStatusBadge(healthDimensions)

  // AI cache: read eller regenerer
  let alerts: CompanyAlert[] = []
  let aiInsight: AiInsight | null = null
  if (visibleSections.has('insight')) {
    const cacheAge = aiCacheRow
      ? Date.now() - aiCacheRow.generated_at.getTime()
      : Number.POSITIVE_INFINITY
    if (aiCacheRow && cacheAge < CACHE_TTL_MS) {
      const cachedAlerts = (aiCacheRow.alerts as unknown as CompanyAlert[]) ?? []
      alerts = cachedAlerts.filter((a) => a.roles.includes(rolename(role)))
      aiInsight = (aiCacheRow.insight as unknown as AiInsight | null) ?? null
    } else {
      const snapshot = await buildSnapshot(companyId, organizationId, company)
      const result = await generateCompanyInsights(snapshot)
      if (result.ok) {
        await prisma.companyInsightsCache.upsert({
          where: { company_id: companyId },
          create: {
            organization_id: organizationId,
            company_id: companyId,
            alerts: result.data.alerts as unknown as Prisma.InputJsonValue,
            insight:
              result.data.insight === null
                ? Prisma.JsonNull
                : (result.data.insight as unknown as Prisma.InputJsonValue),
            model_name: result.model_name,
            total_cost_usd: result.cost_usd,
            generated_at: new Date(),
          },
          update: {
            alerts: result.data.alerts as unknown as Prisma.InputJsonValue,
            insight:
              result.data.insight === null
                ? Prisma.JsonNull
                : (result.data.insight as unknown as Prisma.InputJsonValue),
            model_name: result.model_name,
            total_cost_usd: result.cost_usd,
            generated_at: new Date(),
          },
        })
        alerts = result.data.alerts.filter((a) => a.roles.includes(rolename(role)))
        aiInsight = result.data.insight
      }
    }
  }

  // Byg view-data pr. sektion (kun dem der er synlige)
  const ownership = visibleSections.has('ownership')
    ? buildOwnership(ownerships, ejeraftale, today)
    : null
  const contractsView = visibleSections.has('contracts')
    ? buildContracts(contractsRaw, today, contractsTotal)
    : { top: [], totalCount: 0 }
  const financeView = visibleSections.has('finance')
    ? buildFinance(finance2025Sum, finance2024Sum, quarterlyRaw)
    : null
  const casesView = visibleSections.has('cases')
    ? buildCases(casesRaw, casesTotal)
    : { top: [], totalCount: 0 }
  const personsView = visibleSections.has('persons')
    ? buildPersons(companyPersonsRaw, personsTotal)
    : { top: [], totalCount: 0 }
  const visitsView = visibleSections.has('visits') ? buildVisits(visitsRaw) : []
  const documentsView = visibleSections.has('documents')
    ? buildDocuments(documentsRaw)
    : { rows: [], awaitingReviewCount: 0 }

  return {
    company: {
      id: company.id,
      name: company.name,
      cvr: company.cvr,
      address: company.address,
      city: company.city,
      postal_code: company.postal_code,
      status: company.status,
      founded_date: company.founded_date,
    },
    visibleSections,
    healthDimensions,
    statusBadge,
    alerts,
    aiInsight,
    ownership,
    contracts: contractsView,
    finance: financeView,
    cases: casesView,
    persons: personsView,
    visits: visitsView,
    documents: documentsView,
    role,
  }
}

// -----------------------------------------------------------------
// Role mapping
// -----------------------------------------------------------------

function rolename(role: string): 'owner' | 'legal' | 'finance' | 'admin' | 'manager' {
  switch (role) {
    case 'GROUP_OWNER':
    case 'GROUP_READONLY':
      return 'owner'
    case 'GROUP_LEGAL':
    case 'COMPANY_LEGAL':
      return 'legal'
    case 'GROUP_FINANCE':
      return 'finance'
    case 'GROUP_ADMIN':
      return 'admin'
    case 'COMPANY_MANAGER':
    case 'COMPANY_READONLY':
      return 'manager'
    default:
      return 'owner'
  }
}

// -----------------------------------------------------------------
// Finance summing
// -----------------------------------------------------------------

interface FinanceSum {
  omsaetning: number | null
  ebitda: number | null
  resultat: number | null
}

function sumFinance(
  metrics: Array<{ metric_type: string; value: Prisma.Decimal }>
): FinanceSum {
  const sum: FinanceSum = { omsaetning: null, ebitda: null, resultat: null }
  for (const m of metrics) {
    const val = Number(m.value)
    if (m.metric_type === 'OMSAETNING') sum.omsaetning = (sum.omsaetning ?? 0) + val
    if (m.metric_type === 'EBITDA') sum.ebitda = (sum.ebitda ?? 0) + val
    if (m.metric_type === 'RESULTAT') sum.resultat = (sum.resultat ?? 0) + val
  }
  return sum
}

// -----------------------------------------------------------------
// View-builders
// -----------------------------------------------------------------

const MONTHS_DA = [
  'jan',
  'feb',
  'mar',
  'apr',
  'maj',
  'jun',
  'jul',
  'aug',
  'sep',
  'okt',
  'nov',
  'dec',
]

function formatDateDa(date: Date): string {
  return `${date.getDate()}. ${MONTHS_DA[date.getMonth()]} ${date.getFullYear()}`
}

function humanizeVisitType(type: string): string {
  const map: Record<string, string> = {
    KVARTALSBESOEG: 'Kvartalsbesoeg',
    OPFOELGNING: 'Opfoelgning',
    AD_HOC: 'Ad hoc',
    AUDIT: 'Audit',
    ONBOARDING: 'Onboarding',
    OVERDRAGELSE: 'Overdragelse',
  }
  return map[type] ?? type
}

function buildOwnership(
  ownerships: Array<{
    ownership_pct: Prisma.Decimal
    owner_person_id: string | null
    owner_company_id: string | null
    owner_person: { first_name: string; last_name: string } | null
  }>,
  ejeraftale: { expiry_date: Date | null; status: string } | null,
  today: Date
): OwnershipData | null {
  if (ownerships.length === 0) return null

  let kaedegruppePct = 0
  let maxPersonPct = 0
  let maxPerson: { first_name: string; last_name: string } | null = null

  for (const o of ownerships) {
    const pct = Number(o.ownership_pct)
    if (o.owner_company_id) {
      kaedegruppePct += pct
    }
    if (o.owner_person_id && o.owner_person && pct > maxPersonPct) {
      maxPersonPct = pct
      maxPerson = o.owner_person
    }
  }

  let ejeraftaleStatus: { label: string; danger: boolean } | null = null
  if (ejeraftale) {
    if (ejeraftale.expiry_date && ejeraftale.expiry_date < today) {
      ejeraftaleStatus = {
        label: `Udloebet ${formatDateDa(ejeraftale.expiry_date)}`,
        danger: true,
      }
    } else {
      ejeraftaleStatus = { label: 'Aktiv', danger: false }
    }
  }

  return {
    kaedegruppePct: Math.round(kaedegruppePct),
    localPartner: maxPerson
      ? {
          name: `${maxPerson.first_name} ${maxPerson.last_name}`,
          pct: Math.round(maxPersonPct),
        }
      : null,
    ejeraftaleStatus,
    holdingCompanyName: null,
  }
}

function buildContracts(
  contracts: Array<{
    id: string
    display_name: string
    system_type: string
    expiry_date: Date | null
  }>,
  today: Date,
  totalCount: number
): { top: ContractViewRow[]; totalCount: number } {
  const sorted = sortContractsByUrgency(
    contracts.map((c) => ({ ...c })),
    today
  )
  const in30days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
  const top: ContractViewRow[] = sorted.slice(0, 3).map((c) => {
    const expired = c.expiry_date !== null && c.expiry_date < today
    const soon =
      c.expiry_date !== null && c.expiry_date >= today && c.expiry_date < in30days
    const tone: 'red' | 'amber' | 'green' = expired ? 'red' : soon ? 'amber' : 'green'
    const meta = c.expiry_date
      ? expired
        ? `Udloebet ${formatDateDa(c.expiry_date)}`
        : `Udloeber ${formatDateDa(c.expiry_date)}`
      : 'Ingen udloebsdato'
    const badgeLabel = expired ? 'Udloebet' : soon ? 'Udloeber snart' : 'Aktiv'
    return {
      id: c.id,
      iconLetters: c.system_type.slice(0, 2).toUpperCase(),
      iconTone: tone,
      name: c.display_name,
      meta,
      badge: { label: badgeLabel, tone },
    }
  })
  return { top, totalCount }
}

function buildFinance(
  sum2025: FinanceSum,
  sum2024: FinanceSum,
  quarterly: Array<{ period_type: string; value: Prisma.Decimal }>
): FinanceViewData | null {
  if (sum2025.omsaetning === null || sum2025.ebitda === null) return null

  const omsaetningYoY =
    sum2024.omsaetning !== null && sum2024.omsaetning > 0
      ? ((sum2025.omsaetning - sum2024.omsaetning) / sum2024.omsaetning) * 100
      : null
  const ebitdaYoY =
    sum2024.ebitda !== null && sum2024.ebitda !== 0
      ? ((sum2025.ebitda - sum2024.ebitda) / Math.abs(sum2024.ebitda)) * 100
      : null
  const margin = sum2025.omsaetning > 0 ? sum2025.ebitda / sum2025.omsaetning : 0
  const resultat = sum2025.resultat ?? sum2025.ebitda

  // Kvartaler sorteres eksplicit efter period_type (Q1..Q4)
  const qLabels = ['Q1', 'Q2', 'Q3', 'Q4'] as const
  const byPeriod = new Map<string, number>()
  for (const q of quarterly) {
    byPeriod.set(q.period_type, Number(q.value))
  }
  const qValues = qLabels.map((l) => byPeriod.get(l) ?? 0)
  const maxQ = Math.max(...qValues, 1)
  const qData = qLabels.map((label, i) => ({
    label,
    fraction: qValues[i] ? qValues[i] / maxQ : 0,
  }))

  const statusBadge =
    sum2025.ebitda < 0
      ? { label: 'Underskud', tone: 'red' as const }
      : margin < 0.05
        ? { label: 'Presset', tone: 'amber' as const }
        : { label: 'Positiv', tone: 'green' as const }

  return {
    omsaetning: { value_mio: sum2025.omsaetning / 1_000_000, yoy_pct: omsaetningYoY },
    ebitda: { value_k: sum2025.ebitda / 1_000, yoy_pct: ebitdaYoY },
    margin_pct: margin * 100,
    resultat: { value_k: resultat / 1_000, positive: resultat >= 0 },
    quarterly: qData,
    statusBadge,
  }
}

function buildCases(
  cases: Array<{
    id: string
    title: string
    case_type: string
    status: string
    created_at: Date
  }>,
  totalCount: number
): { top: CaseViewRow[]; totalCount: number } {
  const sorted = sortCasesByUrgency(cases)
  const top: CaseViewRow[] = sorted.slice(0, 3).map((c) => {
    const isAwaiting = c.status.startsWith('AFVENTER_')
    const tone: 'red' | 'amber' = isAwaiting ? 'amber' : 'red'
    const badgeLabel =
      c.status === 'NY' ? 'Ny' : c.status === 'AKTIV' ? 'Aktiv' : 'Afventer'
    const meta = `Oprettet ${formatDateDa(c.created_at)}${isAwaiting ? ' · Afventer' : ''}`
    return {
      id: c.id,
      iconLetter: c.case_type.charAt(0).toUpperCase(),
      iconTone: tone,
      title: c.title,
      meta,
      badge: { label: badgeLabel, tone },
    }
  })
  return { top, totalCount }
}

function buildPersons(
  companyPersons: Array<{
    id: string
    role: string
    anciennity_start: Date | null
    person: { first_name: string; last_name: string }
  }>,
  totalCount: number
): { top: PersonViewRow[]; totalCount: number } {
  const selected = selectKeyPersons(companyPersons)
  const top: PersonViewRow[] = selected.map((cp) => ({
    id: cp.id,
    initials: `${cp.person.first_name[0] ?? ''}${cp.person.last_name[0] ?? ''}`.toUpperCase(),
    name: `${cp.person.first_name} ${cp.person.last_name}`,
    role: cp.role,
  }))
  return { top, totalCount }
}

function buildVisits(
  visits: Array<{ id: string; visit_type: string; visit_date: Date; status: string }>
): VisitViewRow[] {
  return visits.slice(0, 3).map((v) => {
    const tone: 'blue' | 'green' | 'slate' =
      v.status === 'PLANLAGT' ? 'blue' : v.status === 'GENNEMFOERT' ? 'green' : 'slate'
    const statusLabel =
      v.status === 'PLANLAGT'
        ? 'Planlagt'
        : v.status === 'GENNEMFOERT'
          ? 'Gennemfoert'
          : 'Aflyst'
    return {
      id: v.id,
      typeLabel: humanizeVisitType(v.visit_type),
      meta: `${statusLabel} ${formatDateDa(v.visit_date)}`,
      badge: { label: statusLabel, tone },
    }
  })
}

function buildDocuments(
  documents: Array<{
    id: string
    file_name: string
    uploaded_at: Date
    extraction: { extraction_status: string; reviewed_at: Date | null } | null
  }>
): { rows: DocumentViewRow[]; awaitingReviewCount: number } {
  let awaiting = 0
  const rows: DocumentViewRow[] = documents.slice(0, 3).map((d) => {
    const isExtracted = d.extraction !== null
    const needsReview =
      d.extraction?.extraction_status === 'completed' && d.extraction.reviewed_at === null
    if (needsReview) awaiting++
    return {
      id: d.id,
      isAiExtracted: isExtracted,
      fileName: d.file_name,
      meta: isExtracted
        ? `Uploadet ${formatDateDa(d.uploaded_at)} · AI-behandlet`
        : `Uploadet ${formatDateDa(d.uploaded_at)}`,
      badge: needsReview
        ? { label: 'Til review', tone: 'purple' as const }
        : { label: 'Arkiveret', tone: 'green' as const },
    }
  })
  return { rows, awaitingReviewCount: awaiting }
}

// -----------------------------------------------------------------
// Snapshot builder (minimal v1)
// -----------------------------------------------------------------

async function buildSnapshot(
  companyId: string,
  organizationId: string,
  company: {
    name: string
    cvr: string | null
    city: string | null
    status: string
    founded_date: Date | null
    company_type: string | null
  }
): Promise<CompanySnapshot> {
  const peers = await prisma.company.findMany({
    where: {
      organization_id: organizationId,
      deleted_at: null,
      id: { not: companyId },
      ...(company.city ? { city: company.city } : {}),
    },
    take: 5,
    select: { id: true, name: true },
  })

  const peerMetrics =
    peers.length > 0
      ? await prisma.financialMetric.findMany({
          where: {
            company_id: { in: peers.map((p) => p.id) },
            period_year: 2025,
            period_type: 'HELAAR',
            metric_type: 'OMSAETNING',
          },
          select: { company_id: true, value: true },
        })
      : []

  return {
    company: {
      name: company.name,
      cvr: company.cvr,
      city: company.city,
      status: company.status,
      founded_year: company.founded_date?.getFullYear() ?? null,
      company_type: company.company_type,
    },
    cluster: {
      name: company.city ?? 'portefoeljen',
      peers: peers.map((p) => {
        const metric = peerMetrics.find((m) => m.company_id === p.id)
        return { name: p.name, omsaetning_2025: metric ? Number(metric.value) : 0 }
      }),
    },
    contracts: [],
    cases: [],
    finance: null,
    visits: { last_visit_date: null, days_since_last: null, planned_count: 0 },
    persons: [],
    documents: { total: 0, recently_uploaded: 0, awaiting_review: 0 },
  }
}
