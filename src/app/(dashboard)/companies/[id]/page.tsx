import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { canAccessCompany } from '@/lib/permissions'
import CompanyDetailClient from './company-detail-client'
import type {
  CompanyDetailData,
  ContractItem,
  CaseItem,
  TaskItem,
  PersonItem,
  VisitItem,
  DocumentItem,
  FinancialYear,
  OwnershipItem,
  HealthDimension,
} from './company-detail-client'
import {
  getContractStatusLabel,
  getContractTypeLabel,
  getCaseStatusLabel,
  getCaseTypeLabel,
  getTaskStatusLabel,
  getPriorityLabel,
  getCompanyPersonRoleLabel,
  getVisitTypeLabel,
  getVisitStatusLabel,
  formatDate,
  daysUntil,
} from '@/lib/labels'
import type { Decimal } from '@prisma/client/runtime/library'

// ---------------------------------------------------------------
// Hjælpere
// ---------------------------------------------------------------

function decimalToNumber(val: Decimal | null | undefined): number {
  if (val == null) return 0
  return Number(val)
}

type HealthLevel = 'red' | 'amber' | 'green'
type HealthStatus = 'critical' | 'warning' | 'healthy'

function deriveHealthStatus(
  expiredContracts: number,
  expiringSoon: number,
  openCases: number,
): HealthStatus {
  if (expiredContracts > 0 || openCases >= 2) return 'critical'
  if (expiringSoon > 0 || openCases === 1) return 'warning'
  return 'healthy'
}

// ---------------------------------------------------------------
// Server Component
// ---------------------------------------------------------------

interface Props {
  params: { id: string }
}

export default async function CompanyDetailPage({ params }: Props) {
  const session = await auth()
  if (!session) redirect('/login')

  const canAccess = await canAccessCompany(session.user.id, params.id)
  if (!canAccess) notFound()

  const company = await prisma.company.findFirst({
    where: {
      id: params.id,
      organization_id: session.user.organizationId,
      deleted_at: null,
    },
    include: {
      ownerships: {
        include: { owner_person: true },
      },
      company_persons: {
        include: { person: true },
      },
    },
  })

  if (!company) notFound()

  // Hent alt relateret data parallelt
  const [contracts, caseCompanies, tasks, visits, documents, financialMetrics] = await Promise.all([
    prisma.contract.findMany({
      where: {
        company_id: params.id,
        organization_id: session.user.organizationId,
        deleted_at: null,
      },
      orderBy: { expiry_date: 'asc' },
    }),
    prisma.caseCompany.findMany({
      where: {
        company_id: params.id,
        organization_id: session.user.organizationId,
      },
      include: {
        case: true,
      },
    }),
    prisma.task.findMany({
      where: {
        company_id: params.id,
        organization_id: session.user.organizationId,
        deleted_at: null,
      },
      include: { assignee: true },
      orderBy: { due_date: 'asc' },
    }),
    prisma.visit.findMany({
      where: {
        company_id: params.id,
        organization_id: session.user.organizationId,
        deleted_at: null,
      },
      include: { visitor: true },
      orderBy: { visit_date: 'desc' },
    }),
    prisma.document.findMany({
      where: {
        company_id: params.id,
        organization_id: session.user.organizationId,
        deleted_at: null,
      },
      include: { extraction: true },
      orderBy: { uploaded_at: 'desc' },
    }),
    prisma.financialMetric.findMany({
      where: {
        company_id: params.id,
        organization_id: session.user.organizationId,
      },
      orderBy: { period_year: 'desc' },
    }),
  ])

  // Filtrér sager (ekskludér slettede)
  const cases = caseCompanies
    .map((cc) => cc.case)
    .filter((c) => c.deleted_at === null)

  // Kontrakt-mapping
  const mappedContracts: ContractItem[] = contracts.map((c) => {
    const daysLeft = c.expiry_date ? daysUntil(c.expiry_date) : null
    const isExpired = c.status === 'UDLOEBET'
    const isExpiring = !isExpired && daysLeft != null && daysLeft >= 0 && daysLeft <= 30

    return {
      id: c.id,
      displayName: c.display_name,
      status: c.status,
      statusLabel: getContractStatusLabel(c.status),
      typeLabel: getContractTypeLabel(c.system_type),
      expiryDate: c.expiry_date ? formatDate(c.expiry_date) : null,
      daysUntilExpiry: daysLeft,
      urgency: isExpired ? 'critical' : isExpiring ? 'warning' : 'healthy',
    }
  })

  // Sager
  const openCases = cases.filter((c) => c.status !== 'LUKKET' && c.status !== 'ARKIVERET')
  const mappedCases: CaseItem[] = cases.map((c) => ({
    id: c.id,
    title: c.title,
    caseNumber: c.case_number ?? '—',
    type: c.case_type,
    typeLabel: getCaseTypeLabel(c.case_type),
    status: c.status,
    statusLabel: getCaseStatusLabel(c.status),
    updatedDate: formatDate(c.updated_at),
  }))

  // Opgaver
  const openTasks = tasks.filter((t) => t.status !== 'LUKKET')
  const mappedTasks: TaskItem[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    statusLabel: getTaskStatusLabel(t.status),
    priority: t.priority,
    priorityLabel: getPriorityLabel(t.priority),
    dueDate: t.due_date ? formatDate(t.due_date) : null,
    assignedToName: t.assignee?.name ?? '—',
  }))

  // Personer
  const mappedPersons: PersonItem[] = company.company_persons.map((cp) => ({
    id: cp.person_id,
    name: `${cp.person.first_name} ${cp.person.last_name}`,
    role: getCompanyPersonRoleLabel(cp.role),
    email: cp.person.email,
  }))

  // Besøg
  const mappedVisits: VisitItem[] = visits.map((v) => ({
    id: v.id,
    typeLabel: getVisitTypeLabel(v.visit_type),
    status: v.status,
    statusLabel: getVisitStatusLabel(v.status),
    dateLabel: formatDate(v.visit_date),
    visitorName: v.visitor.name,
  }))

  // Dokumenter
  const mappedDocuments: DocumentItem[] = documents.map((d) => ({
    id: d.id,
    fileName: d.file_name,
    uploadedAt: formatDate(d.uploaded_at),
    hasExtraction: d.extraction !== null,
    extractionStatus: d.extraction?.extraction_status ?? null,
  }))

  // Økonomi — aggreger per år
  const currentYear = new Date().getFullYear()
  const yearMap = new Map<number, FinancialYear>()
  for (const fm of financialMetrics) {
    const year = fm.period_year
    if (!yearMap.has(year)) {
      yearMap.set(year, { year, omsaetning: null, ebitda: null, resultat: null })
    }
    const entry = yearMap.get(year)!
    const val = decimalToNumber(fm.value)
    if (fm.metric_type === 'OMSAETNING') entry.omsaetning = val
    else if (fm.metric_type === 'EBITDA') entry.ebitda = val
    else if (fm.metric_type === 'RESULTAT') entry.resultat = val
  }
  const financialYears = Array.from(yearMap.values()).sort((a, b) => b.year - a.year)
  const latestYear = financialYears[0] ?? null
  const previousYear = financialYears[1] ?? null

  // Beregn trend (YoY)
  function trend(current: number | null, previous: number | null): number | null {
    if (current == null || previous == null || previous === 0) return null
    return (current - previous) / Math.abs(previous)
  }
  const omsaetningTrend = trend(latestYear?.omsaetning ?? null, previousYear?.omsaetning ?? null)
  const ebitdaTrend = trend(latestYear?.ebitda ?? null, previousYear?.ebitda ?? null)

  // Ejerskab
  const mappedOwnerships: OwnershipItem[] = company.ownerships.map((o) => ({
    id: o.id,
    ownerName: o.owner_person
      ? `${o.owner_person.first_name} ${o.owner_person.last_name}`
      : 'Kædegruppe',
    ownershipPct: decimalToNumber(o.ownership_pct),
    isGroup: !o.owner_person_id,
  }))

  // Health-beregning
  const expiredContracts = mappedContracts.filter((c) => c.urgency === 'critical')
  const expiringSoon = mappedContracts.filter((c) => c.urgency === 'warning')
  const healthStatus = deriveHealthStatus(expiredContracts.length, expiringSoon.length, openCases.length)

  // Health-dimensioner
  const contractsLevel: HealthLevel =
    expiredContracts.length > 0 ? 'red' : expiringSoon.length > 0 ? 'amber' : 'green'
  const casesLevel: HealthLevel =
    openCases.length >= 2 ? 'red' : openCases.length === 1 ? 'amber' : 'green'
  const financeLevel: HealthLevel =
    ebitdaTrend != null && ebitdaTrend < -0.1 ? 'red' : ebitdaTrend != null && ebitdaTrend < 0 ? 'amber' : 'green'
  const governanceLevel: HealthLevel =
    cases.some((c) => c.case_type === 'GOVERNANCE' && c.status !== 'LUKKET' && c.status !== 'ARKIVERET')
      ? 'amber'
      : 'green'

  const dimensions: HealthDimension[] = [
    { label: 'Kontrakter', level: contractsLevel, sectionId: 'contracts' },
    { label: 'Sager', level: casesLevel, sectionId: 'cases' },
    { label: 'Økonomi', level: financeLevel, sectionId: 'finance' },
    { label: 'Governance', level: governanceLevel, sectionId: 'activity' },
  ]

  // AI-anbefaling
  let aiTitle: string
  let aiBody: string
  if (healthStatus === 'healthy') {
    aiTitle = 'Selskabet er i god stand'
    const financeSummary = latestYear
      ? `Omsætning ${formatMio(latestYear.omsaetning ?? 0)}, EBITDA-margin ${latestYear.omsaetning ? (((latestYear.ebitda ?? 0) / latestYear.omsaetning) * 100).toFixed(1) : '0.0'}%.`
      : ''
    aiBody = `${company.name} har ingen kritiske forhold. ${financeSummary} Næste planlagte handling: ${visits.length > 0 ? 'driftsbesøg ' + formatDate(visits[0].visit_date) : 'kvartalsrapport'}.`
  } else {
    const topIssue = expiredContracts.length > 0
      ? `${expiredContracts.length} udløbet kontrakt${expiredContracts.length > 1 ? 'er' : ''}`
      : openCases.length > 0
        ? `${openCases.length} åben${openCases.length > 1 ? 'e' : ''} sag${openCases.length > 1 ? 'er' : ''}`
        : 'Forhold kræver opmærksomhed'
    aiTitle = topIssue
    aiBody = openCases.length > 0
      ? `${company.name} har ${openCases.length} åben${openCases.length > 1 ? 'e' : ''} sag${openCases.length > 1 ? 'er' : ''} og ${expiredContracts.length + expiringSoon.length} kontrakt${expiredContracts.length + expiringSoon.length === 1 ? '' : 'er'} der kræver handling. Anbefaling: prioriter ${expiredContracts.length > 0 ? 'fornyelse af udløbne kontrakter' : 'gennemgang af åbne sager'} inden for 7 dage.`
      : `${topIssue}. Gennemgå sektionerne nedenfor for at tage handling.`
  }

  // Saml company data
  const companyData: CompanyDetailData = {
    id: company.id,
    name: company.name,
    cvr: company.cvr ?? '—',
    city: company.city ?? '—',
    address: company.address ?? '—',
    companyType: company.company_type ?? '—',
    status: company.status,
    healthStatus,
    dimensions,
    aiTitle,
    aiBody,
  }

  return (
    <CompanyDetailClient
      company={companyData}
      ownerships={mappedOwnerships}
      contracts={mappedContracts}
      cases={mappedCases}
      tasks={mappedTasks}
      persons={mappedPersons}
      visits={mappedVisits}
      documents={mappedDocuments}
      latestFinancial={latestYear}
      previousFinancial={previousYear}
      omsaetningTrend={omsaetningTrend}
      ebitdaTrend={ebitdaTrend}
    />
  )
}

// ---------------------------------------------------------------
// Hjælpefunktion til formatering
// ---------------------------------------------------------------
function formatMio(val: number): string {
  return (val / 1_000_000).toFixed(1) + 'M'
}
