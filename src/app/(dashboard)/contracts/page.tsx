import type { Metadata } from 'next'
import { auth } from '@/lib/auth'

export const metadata: Metadata = { title: 'Kontrakter' }
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getAccessibleCompanies, canAccessModule, canAccessSensitivity } from '@/lib/permissions'
import ContractsClient from './contracts-client'
import type { ContractItem, CompanyItem } from './contracts-client'
import { getContractCategory, CONTRACT_CATEGORY_LABELS, type ContractCategory } from '@/lib/labels'

// ---------------------------------------------------------------
// Kort kategori-label til brug i UI (matcher proto-designets chips)
// ---------------------------------------------------------------
const SHORT_CATEGORY_LABELS: Record<ContractCategory, string> = {
  EJERSKAB_OG_SELSKABSRET: 'Ejerskab',
  ANSAETTELSE_OG_PERSONALE: 'Ansættelse',
  LOKALER_OG_UDSTYR: 'Lokaler',
  KOMMERCIELLE_AFTALER: 'Kommercielle',
  FORSIKRING_OG_GOVERNANCE: 'Forsikring',
  STRUKTURAFTALER: 'Strukturaftaler',
}

function getShortCategoryLabel(systemType: string): string {
  const category = getContractCategory(systemType)
  return SHORT_CATEGORY_LABELS[category] ?? CONTRACT_CATEGORY_LABELS[category] ?? systemType
}

// ---------------------------------------------------------------
// Server Component
// ---------------------------------------------------------------
export default async function ContractsPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const hasAccess = await canAccessModule(session.user.id, 'contracts')
  if (!hasAccess) redirect('/dashboard')

  const orgId = session.user.organizationId
  const companyIds = await getAccessibleCompanies(session.user.id, orgId)

  if (companyIds.length === 0) {
    return <ContractsClient contracts={[]} companies={[]} />
  }

  // Hent kontrakter + selskaber parallelt
  const [rawContracts, rawCompanies] = await Promise.all([
    prisma.contract.findMany({
      where: {
        organization_id: orgId,
        company_id: { in: companyIds },
        deleted_at: null,
      },
      include: {
        company: { select: { id: true, name: true } },
      },
      orderBy: { expiry_date: 'asc' },
    }),
    prisma.company.findMany({
      where: {
        organization_id: orgId,
        id: { in: companyIds },
        deleted_at: null,
      },
      select: { id: true, name: true, city: true },
      orderBy: { name: 'asc' },
    }),
  ])

  // Filtrer efter sensitivitet
  const accessibleContracts = await Promise.all(
    rawContracts.map(async (contract) => {
      const ok = await canAccessSensitivity(session.user.id, contract.sensitivity)
      return ok ? contract : null
    })
  ).then((results) => results.filter(Boolean) as typeof rawContracts)

  // Map til serialiserbare klient-typer
  const now = Date.now()

  const contracts: ContractItem[] = accessibleContracts.map((c) => {
    const expiryMs = c.expiry_date ? new Date(c.expiry_date).getTime() : null
    const daysUntilExpiry = expiryMs != null
      ? Math.ceil((expiryMs - now) / (1000 * 60 * 60 * 24))
      : null

    return {
      id: c.id,
      displayName: c.display_name,
      companyId: c.company.id,
      companyName: c.company.name,
      systemType: c.system_type,
      categoryLabel: getShortCategoryLabel(c.system_type),
      status: c.status,
      expiryDate: c.expiry_date?.toISOString() ?? null,
      daysUntilExpiry,
    }
  })

  const companies: CompanyItem[] = rawCompanies.map((c) => ({
    id: c.id,
    name: c.name,
    city: c.city,
  }))

  return <ContractsClient contracts={contracts} companies={companies} />
}
