import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { getCompanyDetailData, getCompanyDetailPageExtras, getCompanyName } from '@/actions/company-detail'
import { formatDate, daysUntil } from '@/lib/labels'
import {
  CompanyDetailB,
  type OwnershipRow,
  type CompanyPersonRow,
  type MetricRow,
  type PersonOptionRow,
} from './company-detail-b'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const name = await getCompanyName(id)
  return { title: name ?? 'Selskab' }
}

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session) redirect('/login')

  const data = await getCompanyDetailData(id)
  if (!data) notFound()

  // Modal-wiring kræver raw IDs som ikke er i CompanyDetailData. Vi henter dem
  // via action der gater på visibleSections og canSeeOwnership.
  const extras = await getCompanyDetailPageExtras(id, data.visibleSections)
  if (!extras) notFound()

  const { rawOwnerships, rawCompanyPersons, allMetrics, allPersons, expiringLease, canSeeOwnership } = extras

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
