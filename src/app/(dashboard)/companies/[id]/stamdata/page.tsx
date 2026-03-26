import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { EditCompanyForm } from '@/components/companies/EditCompanyForm'

interface CompanyStamdataPageProps {
  params: { id: string }
}

export default async function CompanyStamdataPage({ params }: CompanyStamdataPageProps) {
  const session = await auth()
  if (!session) redirect('/login')

  // Layout already checks canAccessCompany
  const company = await prisma.company.findFirst({
    where: {
      id: params.id,
      organization_id: session.user.organizationId,
      deleted_at: null,
    },
  })

  if (!company) notFound()

  return <EditCompanyForm company={company} />
}
