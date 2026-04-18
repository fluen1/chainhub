import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getAccessibleCompanies } from '@/lib/permissions'

export async function GET() {
  const session = await auth()
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const companyIds = await getAccessibleCompanies(session.user.id, session.user.organizationId)

  if (companyIds.length === 0) return Response.json({ cases: [] })

  // Hent case IDs tilknyttet tilgængelige selskaber
  const caseCompanyLinks = await prisma.caseCompany.findMany({
    where: {
      organization_id: session.user.organizationId,
      company_id: { in: companyIds },
    },
    select: { case_id: true },
    distinct: ['case_id'],
  })

  const caseIds = caseCompanyLinks.map((cc) => cc.case_id)

  const cases =
    caseIds.length > 0
      ? await prisma.case.findMany({
          where: {
            id: { in: caseIds },
            organization_id: session.user.organizationId,
            deleted_at: null,
            status: { not: 'ARKIVERET' },
          },
          select: { id: true, title: true },
          orderBy: { created_at: 'desc' },
          take: 100,
        })
      : []

  return Response.json({ cases })
}
