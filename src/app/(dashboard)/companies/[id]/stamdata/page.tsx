import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { canAccessCompany } from '@/lib/permissions'
import { EditCompanyForm } from '@/components/companies/EditCompanyForm'

interface CompanyStamdataPageProps {
  params: { id: string }
}

export default async function CompanyStamdataPage({ params }: CompanyStamdataPageProps) {
  const session = await auth()
  if (!session) redirect('/login')

  const hasAccess = await canAccessCompany(session.user.id, params.id)
  if (!hasAccess) notFound()

  const company = await prisma.company.findFirst({
    where: {
      id: params.id,
      organization_id: session.user.organizationId,
      deleted_at: null,
    },
  })

  if (!company) notFound()

  return (
    <div className="space-y-6">
      <EditCompanyForm company={company} />
    </div>
  )
}
