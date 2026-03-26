import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { canAccessCompany } from '@/lib/permissions'
import { AddCompanyPersonForm } from '@/components/companies/AddCompanyPersonForm'
import { CompanyPersonList } from '@/components/companies/CompanyPersonList'
import { COMPANY_PERSON_ROLE_LABELS, GOVERNANCE_ROLES, getCompanyPersonRoleLabel } from '@/lib/labels'

interface Props {
  params: { id: string }
}

const GOVERNANCE_ROLE_LABELS: Record<string, string> = Object.fromEntries(
  GOVERNANCE_ROLES.map((r) => [r, COMPANY_PERSON_ROLE_LABELS[r]])
)

export default async function CompanyGovernancePage({ params }: Props) {
  const session = await auth()
  if (!session) redirect('/login')

  const hasAccess = await canAccessCompany(session.user.id, params.id)
  if (!hasAccess) notFound()

  const companyPersons = await prisma.companyPerson.findMany({
    where: {
      organization_id: session.user.organizationId,
      company_id: params.id,
      role: { in: [...GOVERNANCE_ROLES] },
    },
    include: {
      person: {
        select: { id: true, first_name: true, last_name: true, email: true },
      },
    },
    orderBy: [{ end_date: 'asc' }, { start_date: 'desc' }],
  })

  const activePersons = companyPersons.filter((cp) => !cp.end_date)
  const historicPersons = companyPersons.filter((cp) => cp.end_date)

  // Check for vakante roller
  const presentRoles = new Set(activePersons.map((cp) => cp.role))
  const vacantRoles = ['direktoer'].filter((r) => !presentRoles.has(r))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Governance</h2>
          <p className="text-sm text-gray-500 mt-0.5">Direktør, bestyrelse og tegningsberettigede</p>
        </div>
        <AddCompanyPersonForm
          companyId={params.id}
          roleOptions={Object.entries(GOVERNANCE_ROLE_LABELS).map(([value, label]) => ({ value, label }))}
          formTitle="Tilføj governance-rolle"
        />
      </div>

      {/* Vakante roller advarsel */}
      {vacantRoles.length > 0 && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3">
          <p className="text-sm text-red-800">
            ⚠️ Vakante roller: {vacantRoles.map((r) => getCompanyPersonRoleLabel(r)).join(', ')}
          </p>
        </div>
      )}

      <CompanyPersonList
        persons={activePersons}
        title={`Aktive roller (${activePersons.length})`}
        showActions={true}
        roleLabels={GOVERNANCE_ROLE_LABELS}
      />

      {historicPersons.length > 0 && (
        <CompanyPersonList
          persons={historicPersons}
          title={`Tidligere roller (${historicPersons.length})`}
          showActions={false}
          roleLabels={GOVERNANCE_ROLE_LABELS}
        />
      )}
    </div>
  )
}
