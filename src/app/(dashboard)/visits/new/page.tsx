import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getAccessibleCompanies } from '@/lib/permissions'
import { CreateVisitForm } from '@/components/visits/CreateVisitForm'
import { Suspense } from 'react'

export default async function NewVisitPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const companyIds = await getAccessibleCompanies(session.user.id, session.user.organizationId)

  const companies =
    companyIds.length > 0
      ? await prisma.company.findMany({
          where: {
            id: { in: companyIds },
            organization_id: session.user.organizationId,
            deleted_at: null,
          },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        })
      : []

  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-gray-500">Indlæser...</div>}>
      <CreateVisitForm companies={companies} />
    </Suspense>
  )
}
