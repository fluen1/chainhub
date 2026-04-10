import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { canAccessCompany, canAccessSensitivity, canAccessModule } from '@/lib/permissions'
import ContractDetailClient from './contract-detail-client'
import type { ContractDetailData, RelatedCase, RelatedTask, RelatedDocument, RelatedContract, KeyTermData, ActivityItem } from './contract-detail-client'
import {
  getContractTypeLabel,
  getContractStatusLabel,
  getContractCategory,
  getContractCategoryLabel,
  getSensitivityLabel,
  getCaseStatusLabel,
  getCaseTypeLabel,
  getTaskStatusLabel,
  getPriorityLabel,
  formatDate,
  daysUntil,
} from '@/lib/labels'

// ---------------------------------------------------------------
// Hjælpere
// ---------------------------------------------------------------

function computeDaysUntilExpiry(expiryDate: Date | null): number | null {
  if (!expiryDate) return null
  return daysUntil(expiryDate)
}

type DerivedStatus = 'expired' | 'expiring' | 'active'

function deriveStatus(status: string, daysUntilExpiry: number | null): DerivedStatus {
  if (status === 'UDLOEBET') return 'expired'
  if (status === 'AKTIV' && daysUntilExpiry != null && daysUntilExpiry >= 0 && daysUntilExpiry <= 90) return 'expiring'
  return 'active'
}

function relativeDate(daysUntilExpiry: number | null): string {
  if (daysUntilExpiry == null) return '—'
  if (daysUntilExpiry < 0) return `${Math.abs(daysUntilExpiry)} dage siden`
  if (daysUntilExpiry === 0) return 'I dag'
  if (daysUntilExpiry === 1) return 'I morgen'
  return `om ${daysUntilExpiry} dage`
}

// ---------------------------------------------------------------
// Server Component
// ---------------------------------------------------------------

interface Props {
  params: { id: string }
}

export default async function ContractDetailPage({ params }: Props) {
  const session = await auth()
  if (!session) redirect('/login')

  const hasModuleAccess = await canAccessModule(session.user.id, 'contracts')
  if (!hasModuleAccess) redirect('/dashboard')

  const orgId = session.user.organizationId

  const contract = await prisma.contract.findFirst({
    where: {
      id: params.id,
      organization_id: orgId,
      deleted_at: null,
    },
    include: {
      company: { select: { id: true, name: true } },
      parties: {
        include: {
          person: { select: { id: true, first_name: true, last_name: true } },
        },
      },
      versions: { orderBy: { version_number: 'desc' }, take: 3 },
    },
  })

  if (!contract) notFound()

  // Permission checks
  const canAccess = await canAccessCompany(session.user.id, contract.company_id)
  if (!canAccess) notFound()

  const hasSensitivity = await canAccessSensitivity(session.user.id, contract.sensitivity)
  if (!hasSensitivity) notFound()

  // Audit log for sensitive contracts
  if (contract.sensitivity === 'STRENGT_FORTROLIG' || contract.sensitivity === 'FORTROLIG') {
    await prisma.auditLog.create({
      data: {
        organization_id: orgId,
        user_id: session.user.id,
        action: 'VIEW',
        resource_type: 'contract',
        resource_id: contract.id,
        sensitivity: contract.sensitivity,
      },
    })

    await prisma.contract.update({
      where: { id: contract.id },
      data: {
        last_viewed_at: new Date(),
        last_viewed_by: session.user.id,
      },
    })
  }

  // Fetch related data in parallel
  const [cases, tasks, documents, sameTypeContracts, linkedDocExtractions] = await Promise.all([
    // Sager knyttet via CaseContract
    prisma.case.findMany({
      where: {
        organization_id: orgId,
        deleted_at: null,
        case_contracts: {
          some: { contract_id: contract.id },
        },
      },
      orderBy: { updated_at: 'desc' },
      take: 5,
    }),
    // Opgaver knyttet til kontrakten eller selskabet
    prisma.task.findMany({
      where: {
        organization_id: orgId,
        deleted_at: null,
        OR: [
          { contract_id: contract.id },
          { company_id: contract.company_id },
        ],
        status: { not: 'LUKKET' },
      },
      include: {
        assignee: { select: { name: true } },
      },
      orderBy: { due_date: 'asc' },
      take: 5,
    }),
    // Dokumenter knyttet til selskabet
    prisma.document.findMany({
      where: {
        organization_id: orgId,
        company_id: contract.company_id,
        deleted_at: null,
      },
      orderBy: { uploaded_at: 'desc' },
      take: 5,
    }),
    // Relaterede kontrakter af samme type
    prisma.contract.findMany({
      where: {
        organization_id: orgId,
        company_id: contract.company_id,
        system_type: contract.system_type,
        id: { not: contract.id },
        deleted_at: null,
      },
      include: {
        company: { select: { id: true, name: true } },
      },
      take: 3,
    }),
    // DocumentExtraction for linked documents
    prisma.documentExtraction.findMany({
      where: {
        organization_id: orgId,
        document: {
          company_id: contract.company_id,
          deleted_at: null,
        },
      },
      take: 1,
    }),
  ])

  // ---------------------------------------------------------------
  // Map data to serializable types
  // ---------------------------------------------------------------

  const daysUntilExpiry = computeDaysUntilExpiry(contract.expiry_date)
  const derived = deriveStatus(contract.status, daysUntilExpiry)
  const category = getContractCategory(contract.system_type)
  const categoryLabel = getContractCategoryLabel(category)

  // Build key terms
  const hasExtractionData = linkedDocExtractions.length > 0
  const extractionFields = hasExtractionData
    ? (linkedDocExtractions[0].extracted_fields as Record<string, unknown>)
    : null

  // Parter string
  const parterStr = contract.parties.length > 0
    ? contract.parties
        .map((p) =>
          p.person
            ? `${p.person.first_name} ${p.person.last_name}`
            : p.counterparty_name ?? 'Ekstern part'
        )
        .join(' · ')
    : '—'

  const keyTerms: KeyTermData = {
    type: extractionFields?.type as string
      ?? `${categoryLabel} — ${getContractTypeLabel(contract.system_type)}`,
    parter: extractionFields?.parties as string ?? parterStr,
    loebetid: extractionFields?.duration as string
      ?? (contract.expiry_date ? 'Aftalt løbetid' : 'Løbende aftale'),
    udloeb: extractionFields?.expiry as string
      ?? (contract.expiry_date
        ? `${formatDate(contract.expiry_date)} (${relativeDate(daysUntilExpiry)})`
        : 'Ingen udløbsdato'),
    opsigelse: extractionFields?.notice_period as string
      ?? (contract.notice_period_days
        ? `${contract.notice_period_days} dages varsel`
        : '—'),
    status: getContractStatusLabel(contract.status),
    hasExtractionData,
  }

  const contractData: ContractDetailData = {
    id: contract.id,
    displayName: contract.display_name,
    companyId: contract.company_id,
    companyName: contract.company.name,
    status: contract.status,
    statusLabel: getContractStatusLabel(contract.status),
    derivedStatus: derived,
    systemType: contract.system_type,
    categoryLabel,
    sensitivityLabel: getSensitivityLabel(contract.sensitivity),
    expiryDate: contract.expiry_date?.toISOString() ?? null,
    daysUntilExpiry,
    effectiveDate: contract.effective_date?.toISOString() ?? null,
    noticePeriodDays: contract.notice_period_days,
    createdAt: contract.created_at.toISOString(),
  }

  const mappedCases: RelatedCase[] = cases.map((c) => ({
    id: c.id,
    title: c.title,
    caseNumber: c.case_number ?? '—',
    type: c.case_type,
    typeLabel: getCaseTypeLabel(c.case_type),
    status: c.status,
    statusLabel: getCaseStatusLabel(c.status),
    updatedDate: formatDate(c.updated_at),
  }))

  const mappedTasks: RelatedTask[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    priority: t.priority,
    priorityLabel: getPriorityLabel(t.priority),
    status: t.status,
    statusLabel: getTaskStatusLabel(t.status),
    assignedToName: t.assignee
      ? t.assignee.name
      : 'Ikke tildelt',
    dueDate: t.due_date ? formatDate(t.due_date) : null,
  }))

  const mappedDocuments: RelatedDocument[] = documents.map((d) => ({
    id: d.id,
    fileName: d.file_name,
    uploadedAt: formatDate(d.uploaded_at),
  }))

  const mappedRelated: RelatedContract[] = sameTypeContracts.map((c) => ({
    id: c.id,
    displayName: c.display_name,
    statusLabel: getContractStatusLabel(c.status),
  }))

  // Build activity feed from real data (contract lifecycle events)
  const activityItems: ActivityItem[] = [
    {
      dotColor: 'violet',
      text: `${contract.display_name} oprettet`,
      meta: formatDate(contract.created_at),
    },
  ]

  // Tilføj version events
  for (const v of contract.versions.slice(0, 2)) {
    activityItems.push({
      dotColor: 'blue',
      text: `Version ${v.version_number} uploadet`,
      meta: formatDate(v.uploaded_at),
    })
  }

  if (derived === 'expired' && daysUntilExpiry != null) {
    activityItems.push({
      dotColor: 'red',
      text: 'Udløbsdato overskredet — automatisk alert',
      meta: `${Math.abs(daysUntilExpiry)} dage siden`,
    })
  }

  return (
    <ContractDetailClient
      contract={contractData}
      keyTerms={keyTerms}
      cases={mappedCases}
      tasks={mappedTasks}
      documents={mappedDocuments}
      relatedContracts={mappedRelated}
      activity={activityItems}
      totalDocuments={documents.length}
    />
  )
}
