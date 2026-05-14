import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getAccessibleCompanies, canAccessModule, canAccessSensitivity } from '@/lib/permissions'
import { getContractTypeLabel, getSensitivityLabel } from '@/lib/labels'
import { ContractsListB, type ContractRow } from './contracts-list-b'

export const metadata: Metadata = { title: 'Kontrakter' }

// ────────────────────────────────────────────────────────────────────────────
// /contracts (liste) — B-stil port.
// Server fetcher data + flag for AI-extraction. Klient håndterer filter/sort/view.
// ────────────────────────────────────────────────────────────────────────────

// Common JSON-nøgler i Contract.type_data der kan optræde som "værdi".
const VALUE_KEYS_KR_MD = ['monthly_rent', 'rent_amount', 'salary', 'monthly_salary']
const VALUE_KEYS_KR = ['amount', 'total', 'fixed_amount']

function extractValue(typeData: unknown): { value: string; unit: string } {
  if (!typeData || typeof typeData !== 'object') return { value: '—', unit: '' }
  const td = typeData as Record<string, unknown>
  for (const k of VALUE_KEYS_KR_MD) {
    const v = td[k]
    if (typeof v === 'number') return { value: v.toLocaleString('da-DK'), unit: 'kr/md' }
    if (typeof v === 'string' && v.length > 0) return { value: v, unit: 'kr/md' }
  }
  for (const k of VALUE_KEYS_KR) {
    const v = td[k]
    if (typeof v === 'number') return { value: v.toLocaleString('da-DK'), unit: 'kr' }
    if (typeof v === 'string' && v.length > 0) return { value: v, unit: 'kr' }
  }
  return { value: '—', unit: '' }
}

function formatShortDate(d: Date | null): string {
  if (!d) return '—'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yy = String(d.getFullYear()).slice(-2)
  return `${dd}.${mm}.${yy}`
}

function statusLabel(status: string): string {
  if (status === 'AKTIV') return 'Aktiv'
  if (status === 'UDLOEBET') return 'Udløbet'
  if (status === 'OPSAGT') return 'Opsagt'
  if (status === 'UDKAST') return 'Udkast'
  return status
}

export default async function ContractsPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const hasAccess = await canAccessModule(session.user.id, 'contracts')
  if (!hasAccess) redirect('/dashboard')

  const orgId = session.user.organizationId
  const companyIds = await getAccessibleCompanies(session.user.id, orgId)

  if (companyIds.length === 0) {
    return <ContractsListB contracts={[]} totalContracts={0} />
  }

  const today = new Date()

  const [rawContracts, aiContractIds, totalCount] = await Promise.all([
    prisma.contract.findMany({
      where: {
        organization_id: orgId,
        company_id: { in: companyIds },
        deleted_at: null,
      },
      include: {
        company: { select: { id: true, name: true } },
        parties: {
          take: 2,
          include: {
            person: { select: { first_name: true, last_name: true } },
          },
        },
      },
      orderBy: { expiry_date: 'asc' },
    }),
    // Contract-IDs der har mindst ét dokument med extraction
    prisma.document
      .findMany({
        where: {
          organization_id: orgId,
          deleted_at: null,
          contract_id: { not: null },
          extraction: { isNot: null },
        },
        select: { contract_id: true },
      })
      .then((rows) => new Set(rows.map((r) => r.contract_id).filter((id): id is string => !!id))),
    prisma.contract.count({
      where: {
        organization_id: orgId,
        company_id: { in: companyIds },
        deleted_at: null,
      },
    }),
  ])

  // Filtrer efter sensitivitet
  const accessibleContracts = await Promise.all(
    rawContracts.map(async (c) => {
      const ok = await canAccessSensitivity(session.user.id, c.sensitivity)
      return ok ? c : null
    })
  ).then((results) => results.filter((c): c is (typeof rawContracts)[number] => c !== null))

  // Byg rows
  const rows: ContractRow[] = accessibleContracts.map((c) => {
    const expMs = c.expiry_date?.getTime() ?? null
    const udlobDays =
      expMs != null ? Math.ceil((expMs - today.getTime()) / (1000 * 60 * 60 * 24)) : 9999
    let udlob: string
    if (expMs == null) udlob = '—'
    else if (udlobDays < 0) udlob = 'Udl.'
    else if (udlobDays > 365) udlob = `${Math.round(udlobDays / 30)}m`
    else udlob = `${udlobDays}d`

    const partyNames = c.parties
      .slice(0, 2)
      .map((p) =>
        p.person ? `${p.person.first_name} ${p.person.last_name}` : (p.counterparty_name ?? 'Part')
      )
    const parter = partyNames.length > 0 ? partyNames.join(' + ') : '—'

    const { value, unit } = extractValue(c.type_data)

    return {
      id: c.id,
      displayName: c.display_name,
      type: getContractTypeLabel(c.system_type),
      systemType: c.system_type,
      ai: aiContractIds.has(c.id),
      companyId: c.company.id,
      selskab: c.company.name,
      parter,
      vaerdi: value,
      unit,
      effektiv: formatShortDate(c.effective_date),
      effektivSort: c.effective_date?.getTime() ?? 0,
      udlob,
      udlobDays,
      status: statusLabel(c.status),
      rawStatus: c.status,
      sensitivity: getSensitivityLabel(c.sensitivity).toUpperCase(),
    }
  })

  return <ContractsListB contracts={rows} totalContracts={totalCount} />
}
