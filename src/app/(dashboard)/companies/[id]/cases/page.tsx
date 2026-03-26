import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { CaseList } from '@/components/cases/CaseList'

interface Props {
  params: { id: string }
}

export default async function CompanyCasesPage({ params }: Props) {
  const session = await auth()
  if (!session) redirect('/login')

  // Layout already checks canAccessCompany
  const caseLinks = await prisma.caseCompany.findMany({
    where: {
      organization_id: session.user.organizationId,
      company_id: params.id,
    },
    include: {
      case: {
        select: {
          id: true,
          title: true,
          case_type: true,
          status: true,
          created_at: true,
          due_date: true,
          deleted_at: true,
          _count: {
            select: {
              tasks: {
                where: {
                  status: { not: 'LUKKET' },
                  deleted_at: null,
                },
              },
            },
          },
        },
      },
    },
  })

  const cases = caseLinks
    .filter((cl) => !cl.case.deleted_at)
    .map((cl) => cl.case)

  return (
    <CaseList
      cases={cases}
      companyId={params.id}
    />
  )
}
