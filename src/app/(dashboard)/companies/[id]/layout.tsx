import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { canAccessCompany } from '@/lib/permissions'
import { CompanyTabs } from '@/components/companies/CompanyTabs'
import { CompanyStatusBadge } from '@/components/companies/CompanyStatusBadge'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface CompanyLayoutProps {
  children: React.ReactNode
  params: { id: string }
}

export default async function CompanyLayout({ children, params }: CompanyLayoutProps) {
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
    select: {
      id: true,
      name: true,
      cvr: true,
      company_type: true,
      status: true,
    },
  })

  if (!company) notFound()

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link
          href="/companies"
          className="mt-1 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          aria-label="Tilbage til selskaber"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-gray-900 truncate">{company.name}</h1>
            <CompanyStatusBadge status={company.status} />
          </div>
          <p className="mt-0.5 text-sm text-gray-400">
            {company.cvr ?? ''}
            {company.company_type ? ` · ${company.company_type}` : ''}
          </p>
        </div>
      </div>

      {/* Faner */}
      <CompanyTabs companyId={params.id} />

      {/* Indhold */}
      <div>{children}</div>
    </div>
  )
}
