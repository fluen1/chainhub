import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { canAccessSensitivity } from '@/lib/permissions'
import { AddOwnerForm } from '@/components/companies/AddOwnerForm'
import { OwnershipListNew } from '@/components/companies/OwnershipListNew'

interface Props {
  params: { id: string }
}

export default async function CompanyOwnershipPage({ params }: Props) {
  const session = await auth()
  if (!session) redirect('/login')

  // Ejerskab er STRENGT_FORTROLIG
  const hasSensitivityAccess = await canAccessSensitivity(session.user.id, 'STRENGT_FORTROLIG')

  if (!hasSensitivityAccess) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 py-16 text-center">
        <p className="text-sm text-gray-500">
          Du har ikke adgang til ejerskabsoplysninger. Kræver GROUP_OWNER, GROUP_ADMIN eller GROUP_LEGAL.
        </p>
      </div>
    )
  }

  // Layout already checks canAccessCompany
  const ownerships = await prisma.ownership.findMany({
    where: {
      organization_id: session.user.organizationId,
      company_id: params.id,
    },
    include: {
      owner_person: {
        select: { id: true, first_name: true, last_name: true, email: true },
      },
    },
    orderBy: { effective_date: 'desc' },
  })

  const activeOwnerships = ownerships.filter((o) => !o.end_date)
  const historicOwnerships = ownerships.filter((o) => o.end_date)

  const totalPct = activeOwnerships.reduce((sum, o) => sum + Number(o.ownership_pct), 0)
  const pctWarning = activeOwnerships.length > 0 && Math.abs(totalPct - 100) > 0.01

  return (
    <OwnershipListNew
      activeOwnerships={activeOwnerships}
      historicOwnerships={historicOwnerships}
      totalPct={totalPct}
      pctWarning={pctWarning}
      addButton={<AddOwnerForm companyId={params.id} />}
    />
  )
}
