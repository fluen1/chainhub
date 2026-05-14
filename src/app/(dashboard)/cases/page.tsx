import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getAccessibleCompanies, canAccessModule } from '@/lib/permissions'
import { getCaseStatusLabel, getCaseTypeLabel } from '@/lib/labels'
import { formatShortDate } from '@/lib/date-helpers'
import { CasesListB, type CaseRow } from './cases-list-b'

export const metadata: Metadata = { title: 'Sager' }

export default async function CasesPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const orgId = session.user.organizationId

  const hasAccess = await canAccessModule(session.user.id, 'cases', orgId)
  if (!hasAccess) redirect('/dashboard')

  const companyIds = await getAccessibleCompanies(session.user.id, orgId)

  if (companyIds.length === 0) {
    return <CasesListB cases={[]} totalCount={0} />
  }

  // Find sager linkede til accessible companies
  const caseCompanyLinks = await prisma.caseCompany.findMany({
    where: {
      organization_id: orgId,
      company_id: { in: companyIds },
    },
    select: { case_id: true },
    distinct: ['case_id'],
  })
  const caseIds = caseCompanyLinks.map((cc) => cc.case_id)

  if (caseIds.length === 0) {
    return <CasesListB cases={[]} totalCount={0} />
  }

  const [rawCases, totalCount] = await Promise.all([
    prisma.case.findMany({
      where: {
        organization_id: orgId,
        deleted_at: null,
        id: { in: caseIds },
      },
      include: {
        case_companies: {
          take: 1,
          include: { company: { select: { id: true, name: true } } },
        },
      },
      orderBy: { due_date: 'asc' },
    }),
    prisma.case.count({
      where: { organization_id: orgId, deleted_at: null, id: { in: caseIds } },
    }),
  ])

  // Resolv ansvarlig user-navne
  const responsibleIds = Array.from(
    new Set(rawCases.map((c) => c.responsible_id).filter((id): id is string => !!id))
  )
  const users = responsibleIds.length
    ? await prisma.user.findMany({
        where: { id: { in: responsibleIds } },
        select: { id: true, name: true, email: true },
      })
    : []
  const userMap = new Map(users.map((u) => [u.id, u.name ?? u.email ?? 'Ukendt']))

  const today = new Date()

  const rows: CaseRow[] = rawCases.map((c) => {
    const dueMs = c.due_date?.getTime() ?? null
    const fristDays =
      dueMs != null ? Math.ceil((dueMs - today.getTime()) / (1000 * 60 * 60 * 24)) : 9999

    const firstCompany = c.case_companies[0]?.company
    return {
      id: c.id,
      nr: c.case_number ?? '—',
      type: getCaseTypeLabel(c.case_type),
      rawType: c.case_type,
      title: c.title,
      desc: c.description ?? '',
      companyId: firstCompany?.id ?? null,
      selskab: firstCompany?.name ?? '—',
      status: getCaseStatusLabel(c.status),
      rawStatus: c.status,
      frist: c.due_date ? formatShortDate(c.due_date) : '—',
      fristDays,
      ansvarlig: c.responsible_id ? (userMap.get(c.responsible_id) ?? '—') : '—',
      updatedAt: c.updated_at.getTime(),
    }
  })

  return <CasesListB cases={rows} totalCount={totalCount} />
}
