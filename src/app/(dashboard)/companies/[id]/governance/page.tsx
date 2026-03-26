import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { AddCompanyPersonForm } from '@/components/companies/AddCompanyPersonForm'
import { EmployeeList } from '@/components/companies/EmployeeList'
import { AlertTriangle } from 'lucide-react'
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

  // Layout already checks canAccessCompany
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

  const vacantWarning = vacantRoles.length > 0 ? (
    <div className="flex items-center gap-3 rounded-lg bg-red-50 px-4 py-2 text-sm font-medium text-red-700">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>Vakante roller: {vacantRoles.map((r) => getCompanyPersonRoleLabel(r)).join(', ')}</span>
    </div>
  ) : null

  return (
    <EmployeeList
      activePersons={activePersons}
      historicPersons={historicPersons}
      activeLabel="Aktive roller"
      historicLabel="Tidligere roller"
      emptyMessage="Ingen governance-roller registreret"
      emptySubMessage="Tilføj direktør, bestyrelsesmedlemmer eller tegningsberettigede."
      entityName={{ singular: 'rolle', plural: 'roller' }}
      warningBanner={vacantWarning}
      addButton={
        <AddCompanyPersonForm
          companyId={params.id}
          roleOptions={Object.entries(GOVERNANCE_ROLE_LABELS).map(([value, label]) => ({ value, label }))}
          formTitle="Tilføj governance-rolle"
        />
      }
    />
  )
}
