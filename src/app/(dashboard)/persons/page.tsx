import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getAccessibleCompanies } from '@/lib/permissions'
import { getCompanyPersonRoleLabel } from '@/lib/labels'
import { PersonsListB, type PersonRow } from './persons-list-b'

export const metadata: Metadata = { title: 'Personer' }

function formatShortDate(d: Date | null): string {
  if (!d) return '—'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yy = String(d.getFullYear()).slice(-2)
  return `${dd}.${mm}.${yy}`
}

function initials(first: string, last: string): string {
  const f = first?.[0] ?? ''
  const l = last?.[0] ?? ''
  return (f + l).toUpperCase() || '?'
}

export default async function PersonsPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const orgId = session.user.organizationId
  const companyIds = await getAccessibleCompanies(session.user.id, orgId)

  const [rawPersons, totalCount] = await Promise.all([
    prisma.person.findMany({
      where: { organization_id: orgId, deleted_at: null },
      include: {
        company_persons: {
          include: { company: { select: { id: true, name: true } } },
          orderBy: { start_date: 'desc' },
        },
      },
      orderBy: [{ first_name: 'asc' }, { last_name: 'asc' }],
    }),
    prisma.person.count({ where: { organization_id: orgId, deleted_at: null } }),
  ])

  // Filtrer til personer der har relation til mindst ét accessible selskab
  // (eller ingen company_person — dvs. orphan-personer som org kan se)
  const accessible = rawPersons.filter((p) => {
    if (p.company_persons.length === 0) return true
    return p.company_persons.some((cp) => companyIds.includes(cp.company.id))
  })

  const rows: PersonRow[] = accessible.map((p) => {
    const activeCp = p.company_persons.find((cp) => !cp.end_date) ?? p.company_persons[0]
    const role = activeCp?.role ?? null
    const status = activeCp == null ? 'Inaktiv' : activeCp.end_date ? 'Opsagt' : 'Aktiv'
    // Unikke aktive selskaber — én person kan have rolle i flere lokationer
    const uniqueCompanies = new Set(
      p.company_persons.filter((cp) => !cp.end_date).map((cp) => cp.company.id)
    )

    return {
      id: p.id,
      ini: initials(p.first_name, p.last_name),
      navn: `${p.first_name} ${p.last_name}`,
      rolle: role ? getCompanyPersonRoleLabel(role) : '—',
      rawRole: role,
      selskab: activeCp?.company.name ?? '—',
      companyId: activeCp?.company.id ?? null,
      ansat: activeCp?.start_date ? formatShortDate(activeCp.start_date) : '—',
      ansatSort: activeCp?.start_date?.getTime() ?? 0,
      status,
      // Person har ingen direkte sensitivity. Default STANDARD.
      sens: 'STANDARD',
      email: p.email,
      phone: p.phone,
      selskabsCount: uniqueCompanies.size,
    }
  })

  return <PersonsListB persons={rows} totalCount={totalCount} />
}
