import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { canAccessSensitivity } from '@/lib/permissions'
import { getCompanyDetailData } from '@/actions/company-detail'
import { formatDate, daysUntil } from '@/lib/labels'
import {
  CompanyDetailB,
  type OwnershipRow,
  type CompanyPersonRow,
  type MetricRow,
  type PersonOptionRow,
} from './company-detail-b'

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const session = await auth()
  if (!session) return { title: 'Selskab' }
  const company = await prisma.company.findFirst({
    where: { id: params.id, organization_id: session.user.organizationId, deleted_at: null },
    select: { name: true },
  })
  return { title: company?.name ?? 'Selskab' }
}

export default async function CompanyDetailPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) redirect('/login')

  const orgId = session.user.organizationId
  const data = await getCompanyDetailData(params.id, session.user.id, orgId)
  if (!data) notFound()

  // Modal-wiring kræver raw IDs som ikke er i CompanyDetailData. Vi henter dem
  // separat fra databasen her — billigt fordi vi allerede har company-adgang.
  // STRENGT_FORTROLIG-check for ownership-IDs så vi ikke lækker dem til brugere
  // uden adgang. Raw-queries gates desuden via data.visibleSections så roller
  // uden adgang til en sektion ikke får PII serialiseret ind i client-props.
  const canSeeOwnership = await canAccessSensitivity(session.user.id, 'STRENGT_FORTROLIG', orgId)
  const wantOwnership = canSeeOwnership && data.visibleSections.has('ownership')
  const wantPersons = data.visibleSections.has('persons')
  const wantFinance = data.visibleSections.has('finance')
  const wantContracts = data.visibleSections.has('contracts')
  // AddOwnerModal og AddPersonModal har brug for person-select; hent kun hvis
  // mindst én af de to add-flows er tilgængelige.
  const wantPersonOptions = wantOwnership || wantPersons

  const [rawOwnerships, rawCompanyPersons, allMetrics, allPersons, expiringLease] =
    await Promise.all([
      wantOwnership
        ? prisma.ownership.findMany({
            where: { company_id: params.id, organization_id: orgId, end_date: null },
            include: {
              owner_person: { select: { id: true, first_name: true, last_name: true } },
            },
            orderBy: { effective_date: 'desc' },
          })
        : Promise.resolve([]),
      wantPersons
        ? prisma.companyPerson.findMany({
            where: { company_id: params.id, organization_id: orgId, end_date: null },
            include: { person: { select: { first_name: true, last_name: true } } },
            orderBy: { start_date: 'desc' },
          })
        : Promise.resolve([]),
      wantFinance
        ? prisma.financialMetric.findMany({
            where: { company_id: params.id, organization_id: orgId },
            orderBy: { period_year: 'desc' },
          })
        : Promise.resolve([]),
      // Alle personer i org (til select i AddOwner + AddPerson modaler).
      // Skåret til 200 for at undgå rendering-bottleneck ved store kæder.
      wantPersonOptions
        ? prisma.person.findMany({
            where: { organization_id: orgId, deleted_at: null },
            select: { id: true, first_name: true, last_name: true, email: true },
            orderBy: [{ first_name: 'asc' }, { last_name: 'asc' }],
            take: 200,
          })
        : Promise.resolve([]),
      wantContracts
        ? prisma.contract.findFirst({
            where: {
              company_id: params.id,
              organization_id: orgId,
              deleted_at: null,
              status: 'AKTIV',
              system_type: 'LEJEKONTRAKT_ERHVERV',
              expiry_date: { not: null },
            },
            orderBy: { expiry_date: 'asc' },
          })
        : Promise.resolve(null),
    ])

  const ownerships: OwnershipRow[] = rawOwnerships.map((o) => ({
    id: o.id,
    pct: Number(o.ownership_pct),
    name: o.owner_person
      ? `${o.owner_person.first_name} ${o.owner_person.last_name}`
      : (data.ownership?.holdingCompanyName ?? 'Holding'),
    type: o.owner_person ? 'person' : 'holding',
    effectiveDate: o.effective_date ? formatDate(o.effective_date) : null,
  }))

  const companyPersons: CompanyPersonRow[] = rawCompanyPersons.map((cp) => ({
    id: cp.id,
    name: `${cp.person.first_name} ${cp.person.last_name}`,
    initials: `${cp.person.first_name[0] ?? ''}${cp.person.last_name[0] ?? ''}`.toUpperCase(),
    role: cp.role,
    employmentType: cp.employment_type,
    startDate: cp.start_date ? formatDate(cp.start_date) : null,
  }))

  const metrics: MetricRow[] = allMetrics.map((m) => ({
    metricType: m.metric_type as MetricRow['metricType'],
    periodType: m.period_type as MetricRow['periodType'],
    periodYear: m.period_year,
    value: Number(m.value),
  }))

  const persons: PersonOptionRow[] = allPersons.map((p) => ({
    id: p.id,
    firstName: p.first_name,
    lastName: p.last_name,
    email: p.email,
  }))

  const expiringLeaseInfo =
    expiringLease && expiringLease.expiry_date
      ? {
          contractId: expiringLease.id,
          displayName: expiringLease.display_name,
          daysUntilExpiry: daysUntil(expiringLease.expiry_date),
        }
      : null

  return (
    <CompanyDetailB
      data={data}
      ownerships={ownerships}
      companyPersons={companyPersons}
      metrics={metrics}
      persons={persons}
      canSeeOwnership={canSeeOwnership}
      expiringLease={expiringLeaseInfo}
    />
  )
}
