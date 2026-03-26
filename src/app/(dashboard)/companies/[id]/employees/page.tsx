import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { AddCompanyPersonForm } from '@/components/companies/AddCompanyPersonForm'
import { EmployeeList } from '@/components/companies/EmployeeList'
import { COMPANY_PERSON_ROLE_LABELS, GOVERNANCE_ROLES, EMPLOYEE_ROLES } from '@/lib/labels'

interface Props {
  params: { id: string }
}

const EMPLOYEE_ROLE_LABELS: Record<string, string> = Object.fromEntries(
  EMPLOYEE_ROLES.map((r) => [r, COMPANY_PERSON_ROLE_LABELS[r]])
)

export default async function CompanyEmployeesPage({ params }: Props) {
  const session = await auth()
  if (!session) redirect('/login')

  // Layout already checks canAccessCompany
  const companyPersons = await prisma.companyPerson.findMany({
    where: {
      organization_id: session.user.organizationId,
      company_id: params.id,
      role: { notIn: [...GOVERNANCE_ROLES] },
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
    <EmployeeList
      activePersons={activePersons}
      historicPersons={historicPersons}
      addButton={
        <AddCompanyPersonForm
          companyId={params.id}
          roleOptions={[
            ...Object.entries(EMPLOYEE_ROLE_LABELS).map(([value, label]) => ({ value, label })),
            { value: 'custom', label: 'Anden stilling (fritekst)' },
          ]}
          formTitle="Tilføj ansat"
          showEmploymentType={true}
        />
      }
    />
  )
}
