import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { canAccessCompany, canAccessSensitivity } from '@/lib/permissions'
import { AddOwnerForm } from '@/components/companies/AddOwnerForm'
import { OwnershipList } from '@/components/companies/OwnershipList'

interface Props {
  params: { id: string }
}

export default async function CompanyOwnershipPage({ params }: Props) {
  const session = await auth()
  if (!session) redirect('/login')

  const hasAccess = await canAccessCompany(session.user.id, params.id)
  if (!hasAccess) notFound()

  // Ejerskab er STRENGT_FORTROLIG
  const hasSensitivityAccess = await canAccessSensitivity(session.user.id, 'STRENGT_FORTROLIG')

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

  // Aktive og historiske ejere
  const activeOwnerships = ownerships.filter((o) => !o.end_date)
  const historicOwnerships = ownerships.filter((o) => o.end_date)

  // Beregn total ejerandel
  const totalPct = activeOwnerships.reduce((sum, o) => sum + Number(o.ownership_pct), 0)
  const pctWarning = activeOwnerships.length > 0 && Math.abs(totalPct - 100) > 0.01

  if (!hasSensitivityAccess) {
    return (
      <div className="rounded-lg border bg-white p-6 shadow-sm text-center">
        <p className="text-sm text-gray-500">
          Du har ikke adgang til ejerskabsoplysninger. Kræver GROUP_OWNER, GROUP_ADMIN eller GROUP_LEGAL.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header + tilføj ejer */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Ejerskab</h2>
          <p className="text-sm text-gray-500 mt-0.5">Registrerede ejere og ejerandele</p>
        </div>
        <AddOwnerForm companyId={params.id} />
      </div>

      {/* Ejerandel-advarsel */}
      {pctWarning && (
        <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3">
          <p className="text-sm text-yellow-800">
            ⚠️ Samlet ejerandel er {totalPct.toFixed(2)}% — forventet 100%
          </p>
        </div>
      )}

      {/* Aktive ejere */}
      <OwnershipList
        ownerships={activeOwnerships}
        title={`Aktive ejere (${activeOwnerships.length})`}
        showActions={true}
      />

      {/* Historiske ejere */}
      {historicOwnerships.length > 0 && (
        <OwnershipList
          ownerships={historicOwnerships}
          title={`Tidligere ejere (${historicOwnerships.length})`}
          showActions={false}
        />
      )}
    </div>
  )
}
