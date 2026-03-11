import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { canAccessCompany } from '@/lib/permissions'
import { AddCompanyPersonForm } from '@/components/companies/AddCompanyPersonForm'
import { CompanyPersonList } from '@/components/companies/CompanyPersonList'

interface Props {
  params: { id: string }
}

// Governance-roller der IKKE er ansatte
const GOVERNANCE_ROLES = ['direktoer', 'bestyrelsesformand', 'bestyrelsesmedlem', 'tegningsberettiget', 'revisor']

const ROLE_LABELS: Record<string, string> = {
  ansat: 'Ansat',
  funktionaer: 'Funktionær',
  'ikke-funktionaer': 'Ikke-funktionær',
  vikar: 'Vikar',
  leder: 'Leder/nøglemedarbejder',
}

export default async function CompanyEmployeesPage({ params }: Props) {
  const session = await auth()
  if (!session) redirect('/login')

  const hasAccess = await canAccessCompany(session.user.id, params.id)
  if (!hasAccess) notFound()

  const companyPersons = await prisma.companyPerson.findMany({
    where: {
      organization_id: session.user.organizationId,
      company_id: params.id,
      role: { notIn: GOVERNANCE_ROLES },
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Ansatte</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Medarbejdere og personaleregister
          </p>
        </div>
        <AddCompanyPersonForm
          companyId={params.id}
          roleOptions={[
            ...Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label })),
            { value: 'custom', label: 'Anden stilling (fritekst)' },
          ]}
          formTitle="Tilføj ansat"
          showEmploymentType={true}
        />
      </div>

      <CompanyPersonList
        persons={activePersons}
        title={`Aktive ansatte (${activePersons.length})`}
        showActions={true}
        roleLabels={ROLE_LABELS}
      />

      {historicPersons.length > 0 && (
        <CompanyPersonList
          persons={historicPersons}
          title={`Fratrådte (${historicPersons.length})`}
          showActions={false}
          roleLabels={ROLE_LABELS}
        />
      )}
    </div>
  )
}
