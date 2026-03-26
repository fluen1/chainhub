import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { canAccessSensitivity } from '@/lib/permissions'
import { ContractList } from '@/components/contracts/ContractList'

interface Props {
  params: { id: string }
}

export default async function CompanyContractsPage({ params }: Props) {
  const session = await auth()
  if (!session) redirect('/login')

  // Layout already checks canAccessCompany
  const allContracts = await prisma.contract.findMany({
    where: {
      organization_id: session.user.organizationId,
      company_id: params.id,
      deleted_at: null,
    },
    orderBy: [{ expiry_date: 'asc' }, { created_at: 'desc' }],
    select: {
      id: true,
      display_name: true,
      system_type: true,
      status: true,
      sensitivity: true,
      expiry_date: true,
    },
  })

  // Filtrer baseret på sensitivity-adgang
  const contracts = await Promise.all(
    allContracts.map(async (contract) => {
      const hasSens = await canAccessSensitivity(session.user.id, contract.sensitivity)
      return hasSens ? contract : null
    })
  ).then((results) => results.filter(Boolean) as typeof allContracts)

  return (
    <ContractList
      contracts={contracts}
      companyId={params.id}
    />
  )
}
