import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getAccessibleCompanies } from '@/lib/permissions'

export async function GET() {
  const session = await auth()
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const companyIds = await getAccessibleCompanies(session.user.id, session.user.organizationId)

  const companies =
    companyIds.length > 0
      ? await prisma.company.findMany({
          where: {
            organization_id: session.user.organizationId,
            id: { in: companyIds },
            deleted_at: null,
            status: { not: 'solgt' },
          },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        })
      : []

  return Response.json({ companies })
}
