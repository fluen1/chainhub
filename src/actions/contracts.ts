'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import {
  canAccessCompany,
  canAccessSensitivity,
  canAccessModule,
  getAccessibleCompanies,
  getAllowedSensitivityLevels,
} from '@/lib/permissions'
import {
  createContractSchema,
  updateContractStatusSchema,
  SENSITIVITY_MINIMUM,
  meetsMinimumSensitivity,
  type CreateContractInput,
  type UpdateContractStatusInput,
  type ContractSystemTypeKey,
  type SensitivityLevelValue,
} from '@/lib/validations/contract'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/types/actions'
import type { Contract, ContractParty, ContractStatus, Prisma } from '@prisma/client'
import { captureError } from '@/lib/logger'
import {
  formatDate,
  getContractTypeLabel,
  getContractStatusLabel,
  getSensitivityLabel,
} from '@/lib/labels'
import { invalidateCompanyInsightsCache } from '@/lib/ai/invalidate-cache'
import { z } from 'zod'
import { zodSensitivityLevel, zodContractSystemType } from '@/lib/zod-enums'
import { parsePaginationParams } from '@/lib/pagination'
import { formatShortDate } from '@/lib/date-helpers'

// ────────────────────────────────────────────────────────────────────────────
// getContractsPaginated — server-side pagineret liste til /contracts
// Sensitivity-filteret flyttes ind i WHERE-klausulen (ikke post-fetch loop)
// ────────────────────────────────────────────────────────────────────────────

// JSON-nøgler i Contract.type_data der kan indeholde en monetær værdi
const VALUE_KEYS_KR_MD = ['monthly_rent', 'rent_amount', 'salary', 'monthly_salary']
const VALUE_KEYS_KR = ['amount', 'total', 'fixed_amount']

function extractContractValue(typeData: unknown): { value: string; unit: string } {
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

export interface ContractListRow {
  id: string
  displayName: string
  type: string
  systemType: string
  ai: boolean
  companyId: string
  selskab: string
  parter: string
  vaerdi: string
  unit: string
  effektiv: string
  effektivSort: number
  udlob: string
  udlobDays: number
  status: string
  rawStatus: string
  sensitivity: string
}

export interface ContractPaginationParams {
  page?: number
  pageSize?: number
  search?: string
  status?: string
  type?: string
  company?: string
}

// Status-label → DB-enum mapping (spejler STATUS_OPTS i contracts-list-b)
const STATUS_LABEL_MAP: Record<string, ContractStatus | 'UDLOBER_30D'> = {
  Aktiv: 'AKTIV',
  Udløbet: 'UDLOEBET',
  Opsagt: 'OPSAGT',
  'Udløber 30d': 'UDLOBER_30D',
}

export async function getContractsPaginated(
  params: ContractPaginationParams
): Promise<{ rows: ContractListRow[]; totalCount: number; page: number; pageSize: number }> {
  const session = await auth()
  if (!session) return { rows: [], totalCount: 0, page: 1, pageSize: 20 }

  const orgId = session.user.organizationId
  const userId = session.user.id
  const { page, skip, take } = parsePaginationParams(
    String(params.page ?? 1),
    params.pageSize ?? 20
  )

  const [companyIds, allowedSensitivityLevels] = await Promise.all([
    getAccessibleCompanies(userId, orgId),
    getAllowedSensitivityLevels(userId, orgId),
  ])

  const today = new Date()

  // Byg WHERE-klausulen
  const where: Prisma.ContractWhereInput = {
    organization_id: orgId,
    company_id: { in: companyIds },
    deleted_at: null,
    sensitivity: { in: allowedSensitivityLevels },
  }

  if (params.search?.trim()) {
    const q = params.search.trim()
    where.OR = [
      { display_name: { contains: q, mode: 'insensitive' } },
      { company: { name: { contains: q, mode: 'insensitive' } } },
    ]
  }

  // company-filter (ID fra URL)
  if (params.company && params.company !== 'Alle') {
    where.company_id = params.company
  }

  // Status-filter
  const statusParam = params.status && params.status !== 'Alle' ? params.status : null
  if (statusParam) {
    const mapped = STATUS_LABEL_MAP[statusParam]
    if (mapped === 'UDLOBER_30D') {
      // Udløber inden for 30 dage: status AKTIV + expiry_date between today og today+30d
      const in30 = new Date(today)
      in30.setDate(in30.getDate() + 30)
      where.status = 'AKTIV'
      where.expiry_date = { gte: today, lte: in30 }
    } else if (mapped) {
      where.status = mapped as ContractStatus
    }
  }

  // Hent matchende kontrakter + tæl + find AI-extractede kontrakt-IDs
  const [rawContracts, totalCount, aiContractIds] = await Promise.all([
    prisma.contract.findMany({
      where,
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
      skip,
      take,
    }),
    prisma.contract.count({ where }),
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
  ])

  const rows: ContractListRow[] = rawContracts.map((c) => {
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

    const { value, unit } = extractContractValue(c.type_data)

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
      effektiv: formatShortDate(c.effective_date) || '—',
      effektivSort: c.effective_date?.getTime() ?? 0,
      udlob,
      udlobDays,
      status: getContractStatusLabel(c.status),
      rawStatus: c.status,
      sensitivity: getSensitivityLabel(c.sensitivity).toUpperCase(),
    }
  })

  return { rows, totalCount, page, pageSize: take }
}

// Gyldige status-transitioner
const VALID_TRANSITIONS: Record<string, string[]> = {
  UDKAST: ['TIL_REVIEW', 'AKTIV'],
  TIL_REVIEW: ['UDKAST', 'TIL_UNDERSKRIFT', 'AKTIV'],
  TIL_UNDERSKRIFT: ['TIL_REVIEW', 'AKTIV'],
  AKTIV: ['UDLOEBET', 'OPSAGT', 'FORNYET'],
  UDLOEBET: ['FORNYET'],
  OPSAGT: [],
  FORNYET: [],
  ARKIVERET: [],
}

export async function createContract(input: CreateContractInput): Promise<ActionResult<Contract>> {
  const session = await auth()
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  const parsed = createContractSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Ugyldigt input' }

  const hasCompanyAccess = await canAccessCompany(
    session.user.id,
    parsed.data.companyId,
    session.user.organizationId
  )
  if (!hasCompanyAccess) return { error: 'Ingen adgang til dette selskab' }

  const hasSensitivityAccess = await canAccessSensitivity(
    session.user.id,
    parsed.data.sensitivity,
    session.user.organizationId
  )
  if (!hasSensitivityAccess) return { error: 'Du har ikke adgang til dette sensitivitetsniveau' }

  // Tjek minimum-sensitivitet for system_type
  const minimumSensitivity = SENSITIVITY_MINIMUM[parsed.data.systemType as ContractSystemTypeKey]
  if (minimumSensitivity) {
    if (
      !meetsMinimumSensitivity(parsed.data.sensitivity, minimumSensitivity as SensitivityLevelValue)
    ) {
      return {
        error: `${parsed.data.displayName || parsed.data.systemType} kræver minimum sensitivitetsniveau ${minimumSensitivity}`,
      }
    }
  }

  try {
    const contract = await prisma.contract.create({
      data: {
        organization_id: session.user.organizationId,
        company_id: parsed.data.companyId,
        system_type: parsed.data.systemType,
        display_name: parsed.data.displayName,
        sensitivity: parsed.data.sensitivity,
        status: parsed.data.status ?? 'UDKAST',
        effective_date: parsed.data.effectiveDate ? new Date(parsed.data.effectiveDate) : null,
        expiry_date: parsed.data.expiryDate ? new Date(parsed.data.expiryDate) : null,
        notice_period_days: parsed.data.noticePeriodDays ?? null,
        notes: parsed.data.notes || null,
        reminder_90_days: parsed.data.reminder90Days ?? true,
        reminder_30_days: parsed.data.reminder30Days ?? true,
        reminder_7_days: parsed.data.reminder7Days ?? true,
        parent_contract_id: parsed.data.parentContractId || null,
        created_by: session.user.id,
      },
    })

    // Audit log for sensitive contracts
    if (
      parsed.data.sensitivity === 'STRENGT_FORTROLIG' ||
      parsed.data.sensitivity === 'FORTROLIG'
    ) {
      await prisma.auditLog.create({
        data: {
          organization_id: session.user.organizationId,
          user_id: session.user.id,
          action: 'CREATE',
          resource_type: 'contract',
          resource_id: contract.id,
          sensitivity: parsed.data.sensitivity,
        },
      })
    }

    if (contract.company_id) await invalidateCompanyInsightsCache(contract.company_id)

    revalidatePath('/contracts')
    revalidatePath(`/companies/${parsed.data.companyId}/contracts`)
    return { data: contract }
  } catch (err) {
    captureError(err, {
      namespace: 'action:createContract',
      extra: {
        companyId: parsed.data.companyId,
        systemType: parsed.data.systemType,
      },
    })
    return { error: 'Kontrakten kunne ikke oprettes — prøv igen' }
  }
}

export async function updateContractStatus(
  input: UpdateContractStatusInput
): Promise<ActionResult<Contract>> {
  const session = await auth()
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  const parsed = updateContractStatusSchema.safeParse(input)
  if (!parsed.success) return { error: 'Udfyld alle påkrævede felter og prøv igen.' }

  const contract = await prisma.contract.findFirst({
    where: {
      id: parsed.data.contractId,
      organization_id: session.user.organizationId,
      deleted_at: null,
    },
  })
  if (!contract) return { error: 'Kontrakt ikke fundet' }

  const hasSensitivityAccess = await canAccessSensitivity(
    session.user.id,
    contract.sensitivity,
    session.user.organizationId
  )
  if (!hasSensitivityAccess) return { error: 'Ingen adgang til denne kontrakt' }

  // Valider transition
  const validNext = VALID_TRANSITIONS[contract.status] ?? []
  if (!validNext.includes(parsed.data.status)) {
    return {
      error: `Ugyldig statusændring: ${contract.status} → ${parsed.data.status}`,
    }
  }

  try {
    const updated = await prisma.contract.update({
      where: { id: parsed.data.contractId },
      data: {
        status: parsed.data.status,
        ...(parsed.data.status === 'OPSAGT' ? { termination_date: new Date() } : {}),
        notes: parsed.data.note
          ? `${contract.notes ?? ''}\n[${formatDate(new Date())}] ${parsed.data.note}`.trim()
          : contract.notes,
      },
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        organization_id: session.user.organizationId,
        user_id: session.user.id,
        action: 'UPDATE',
        resource_type: 'contract',
        resource_id: contract.id,
        sensitivity: contract.sensitivity,
        changes: { oldStatus: contract.status, newStatus: parsed.data.status },
      },
    })

    if (contract.company_id) await invalidateCompanyInsightsCache(contract.company_id)

    revalidatePath('/contracts')
    revalidatePath(`/contracts/${parsed.data.contractId}`)
    revalidatePath(`/companies/${contract.company_id}/contracts`)
    return { data: updated }
  } catch (err) {
    captureError(err, {
      namespace: 'action:updateContractStatus',
      extra: { contractId: parsed.data.contractId, newStatus: parsed.data.status },
    })
    return { error: 'Status kunne ikke opdateres — prøv igen' }
  }
}

export async function deleteContract(contractId: string): Promise<ActionResult<void>> {
  const session = await auth()
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  const hasAccess = await canAccessModule(session.user.id, 'settings', session.user.organizationId)
  if (!hasAccess)
    return { error: 'Du har ikke adgang til denne funktion. Kontakt din administrator.' }

  const contract = await prisma.contract.findFirst({
    where: {
      id: contractId,
      organization_id: session.user.organizationId,
      deleted_at: null,
    },
  })
  if (!contract) return { error: 'Kontrakt ikke fundet' }

  // Kun UDKAST kan slettes
  if (contract.status !== 'UDKAST') {
    return { error: 'Kun kladde-kontrakter kan slettes. Opsig aktive kontrakter i stedet.' }
  }

  try {
    await prisma.contract.update({
      where: { id: contractId },
      data: { deleted_at: new Date() },
    })

    if (contract.company_id) await invalidateCompanyInsightsCache(contract.company_id)

    revalidatePath('/contracts')
    revalidatePath(`/companies/${contract.company_id}/contracts`)
    return { data: undefined }
  } catch (err) {
    captureError(err, {
      namespace: 'action:deleteContract',
      extra: { contractId },
    })
    return { error: 'Kontrakten kunne ikke slettes — prøv igen' }
  }
}

// ─── updateContract ───────────────────────────────────────────────────────────

const updateContractSchema = z.object({
  contractId: z.string().min(1),
  displayName: z.string().min(1, 'Kontraktnavn er påkrævet').max(255).optional(),
  sensitivity: zodSensitivityLevel.optional(),
  systemType: zodContractSystemType.optional(),
  expiryDate: z.string().optional().or(z.literal('')),
  effectiveDate: z.string().optional().or(z.literal('')),
  contractValue: z.coerce.number().nonnegative().optional().or(z.literal('')),
  notes: z.string().optional(),
})

export type UpdateContractInput = z.infer<typeof updateContractSchema>

export async function updateContract(input: UpdateContractInput): Promise<ActionResult<Contract>> {
  const session = await auth()
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  const parsed = updateContractSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Ugyldigt input' }

  const contract = await prisma.contract.findFirst({
    where: {
      id: parsed.data.contractId,
      organization_id: session.user.organizationId,
      deleted_at: null,
    },
  })
  if (!contract) return { error: 'Kontrakt ikke fundet' }

  const hasCompanyAccess = await canAccessCompany(
    session.user.id,
    contract.company_id,
    session.user.organizationId
  )
  if (!hasCompanyAccess) return { error: 'Ingen adgang til dette selskab' }

  const targetSensitivity = parsed.data.sensitivity ?? contract.sensitivity
  const hasSensitivityAccess = await canAccessSensitivity(
    session.user.id,
    targetSensitivity,
    session.user.organizationId
  )
  if (!hasSensitivityAccess) return { error: 'Du har ikke adgang til dette sensitivitetsniveau' }

  try {
    const updated = await prisma.contract.update({
      where: { id: parsed.data.contractId },
      data: {
        ...(parsed.data.displayName ? { display_name: parsed.data.displayName } : {}),
        ...(parsed.data.sensitivity ? { sensitivity: parsed.data.sensitivity } : {}),
        ...(parsed.data.systemType ? { system_type: parsed.data.systemType } : {}),
        ...(parsed.data.expiryDate !== undefined
          ? { expiry_date: parsed.data.expiryDate ? new Date(parsed.data.expiryDate) : null }
          : {}),
        ...(parsed.data.effectiveDate !== undefined
          ? {
              effective_date: parsed.data.effectiveDate
                ? new Date(parsed.data.effectiveDate)
                : null,
            }
          : {}),
        ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes || null } : {}),
      },
    })

    await prisma.auditLog.create({
      data: {
        organization_id: session.user.organizationId,
        user_id: session.user.id,
        action: 'UPDATE',
        resource_type: 'contract',
        resource_id: contract.id,
        sensitivity: targetSensitivity,
      },
    })

    if (contract.company_id) await invalidateCompanyInsightsCache(contract.company_id)

    revalidatePath('/contracts')
    revalidatePath(`/contracts/${parsed.data.contractId}`)
    revalidatePath(`/companies/${contract.company_id}/contracts`)
    return { data: updated }
  } catch (err) {
    captureError(err, {
      namespace: 'action:updateContract',
      extra: { contractId: parsed.data.contractId },
    })
    return { error: 'Kontrakten kunne ikke opdateres — prøv igen' }
  }
}

// ─── addContractParty ─────────────────────────────────────────────────────────

const addContractPartySchema = z.object({
  contractId: z.string().min(1),
  personId: z.string().min(1).optional(),
  counterpartyName: z.string().max(255).optional(),
  roleInContract: z.string().max(100).optional(),
  isSigner: z.boolean().optional(),
})

export type AddContractPartyInput = z.infer<typeof addContractPartySchema>

export async function addContractParty(
  input: AddContractPartyInput
): Promise<ActionResult<ContractParty>> {
  const session = await auth()
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  const parsed = addContractPartySchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Ugyldigt input' }

  if (!parsed.data.personId && !parsed.data.counterpartyName) {
    return { error: 'Angiv enten en person eller et ekstern navn' }
  }

  const hasModuleAccess = await canAccessModule(
    session.user.id,
    'contracts',
    session.user.organizationId
  )
  if (!hasModuleAccess) return { error: 'Ingen adgang til kontrakter' }

  const contract = await prisma.contract.findFirst({
    where: {
      id: parsed.data.contractId,
      organization_id: session.user.organizationId,
      deleted_at: null,
    },
  })
  if (!contract) return { error: 'Kontrakt ikke fundet' }

  const hasCompanyAccess = await canAccessCompany(
    session.user.id,
    contract.company_id,
    session.user.organizationId
  )
  if (!hasCompanyAccess) return { error: 'Ingen adgang til dette selskab' }

  const hasSensitivityAccess = await canAccessSensitivity(
    session.user.id,
    contract.sensitivity,
    session.user.organizationId
  )
  if (!hasSensitivityAccess) return { error: 'Ingen adgang til denne kontrakt' }

  try {
    const party = await prisma.contractParty.create({
      data: {
        organization_id: session.user.organizationId,
        contract_id: parsed.data.contractId,
        person_id: parsed.data.personId ?? null,
        counterparty_name: parsed.data.counterpartyName ?? null,
        role_in_contract: parsed.data.roleInContract ?? null,
        is_signer: parsed.data.isSigner ?? false,
      },
    })

    await prisma.auditLog.create({
      data: {
        organization_id: session.user.organizationId,
        user_id: session.user.id,
        action: 'CREATE',
        resource_type: 'contract_party',
        resource_id: party.id,
        sensitivity: contract.sensitivity,
        changes: { contractId: parsed.data.contractId },
      },
    })

    revalidatePath(`/contracts/${parsed.data.contractId}`)
    return { data: party }
  } catch (err) {
    captureError(err, {
      namespace: 'action:addContractParty',
      extra: { contractId: parsed.data.contractId },
    })
    return { error: 'Parten kunne ikke tilføjes — prøv igen' }
  }
}

export async function getContractList(options: {
  companyId?: string
  organizationId: string
  userId: string
  page?: number
  pageSize?: number
  expiresWithinDays?: number
}): Promise<ActionResult<{ contracts: Contract[]; total: number }>> {
  const session = await auth()
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  const page = options.page ?? 1
  const pageSize = Math.min(options.pageSize ?? 25, 100)
  const skip = (page - 1) * pageSize

  const baseWhere = {
    organization_id: options.organizationId,
    deleted_at: null,
    ...(options.companyId ? { company_id: options.companyId } : {}),
    ...(options.expiresWithinDays
      ? {
          expiry_date: {
            not: null,
            lte: new Date(Date.now() + options.expiresWithinDays * 24 * 60 * 60 * 1000),
            gte: new Date(),
          },
        }
      : {}),
  }

  try {
    const [contracts, total] = await Promise.all([
      prisma.contract.findMany({
        where: baseWhere,
        orderBy: { expiry_date: 'asc' },
        skip,
        take: pageSize,
      }),
      prisma.contract.count({ where: baseWhere }),
    ])

    // Filter contracts brugeren ikke har sensitivity-adgang til
    const filteredContracts: Contract[] = []
    for (const contract of contracts) {
      const hasAccess = await canAccessSensitivity(
        options.userId,
        contract.sensitivity,
        options.organizationId
      )
      if (hasAccess) filteredContracts.push(contract)
    }

    return { data: { contracts: filteredContracts, total } }
  } catch (err) {
    captureError(err, {
      namespace: 'action:getContractList',
      extra: { userId: options.userId, organizationId: options.organizationId },
    })
    return { error: 'Kontraktliste kunne ikke hentes' }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Page-data queries (flyt Prisma-kald ud af page.tsx)
// ─────────────────────────────────────────────────────────────────────────────

export type RawContractDetail = Awaited<ReturnType<typeof getRawContractDetail>>

async function getRawContractDetail(contractId: string, orgId: string) {
  return prisma.contract.findFirst({
    where: {
      id: contractId,
      organization_id: orgId,
      deleted_at: null,
    },
    include: {
      company: { select: { id: true, name: true } },
      parties: {
        include: {
          person: { select: { id: true, first_name: true, last_name: true } },
        },
      },
      versions: { orderBy: { version_number: 'desc' }, take: 10 },
    },
  })
}

export interface ContractDetailPageData {
  contract: NonNullable<RawContractDetail>
  cases: Array<{
    id: string
    title: string
    case_number: string | null
    status: string
    created_at: Date
  }>
  tasks: Array<{
    id: string
    title: string
    due_date: Date | null
    status: string
  }>
  documents: Array<{
    id: string
    file_name: string
    uploaded_at: Date
  }>
  extraction: {
    extracted_fields: unknown
    pipeline_checkpoint: unknown
    updated_at: Date
    document: { file_name: string } | null
  } | null
  uploaderMap: Map<string, string>
  persons: Array<{
    id: string
    first_name: string
    last_name: string
    email: string | null
  }>
}

export async function getContractDetailPageData(
  contractId: string
): Promise<ContractDetailPageData | null> {
  const session = await auth()
  if (!session) return null

  const orgId = session.user.organizationId

  const hasModuleAccess = await canAccessModule(session.user.id, 'contracts', orgId)
  if (!hasModuleAccess) return null

  const contract = await getRawContractDetail(contractId, orgId)
  if (!contract) return null

  const canAccess = await canAccessCompany(session.user.id, contract.company_id, orgId)
  if (!canAccess) return null

  const hasSensitivity = await canAccessSensitivity(session.user.id, contract.sensitivity, orgId)
  if (!hasSensitivity) return null

  // Audit-log for følsomme kontrakter
  if (contract.sensitivity === 'STRENGT_FORTROLIG' || contract.sensitivity === 'FORTROLIG') {
    await prisma.auditLog.create({
      data: {
        organization_id: orgId,
        user_id: session.user.id,
        action: 'VIEW',
        resource_type: 'contract',
        resource_id: contract.id,
        sensitivity: contract.sensitivity,
      },
    })
    await prisma.contract.update({
      where: { id: contract.id },
      data: { last_viewed_at: new Date(), last_viewed_by: session.user.id },
    })
  }

  const uploaderIds = Array.from(new Set(contract.versions.map((v) => v.uploaded_by)))

  const [cases, tasks, documents, extraction, uploaders, persons] = await Promise.all([
    prisma.case.findMany({
      where: {
        organization_id: orgId,
        deleted_at: null,
        case_contracts: { some: { contract_id: contract.id } },
      },
      orderBy: { updated_at: 'desc' },
      take: 5,
      select: { id: true, title: true, case_number: true, status: true, created_at: true },
    }),
    prisma.task.findMany({
      where: {
        organization_id: orgId,
        deleted_at: null,
        OR: [{ contract_id: contract.id }, { company_id: contract.company_id }],
        status: { not: 'LUKKET' },
      },
      orderBy: { due_date: 'asc' },
      take: 5,
      select: { id: true, title: true, due_date: true, status: true },
    }),
    prisma.document.findMany({
      where: {
        organization_id: orgId,
        company_id: contract.company_id,
        deleted_at: null,
      },
      orderBy: { uploaded_at: 'desc' },
      take: 5,
      select: { id: true, file_name: true, uploaded_at: true },
    }),
    prisma.documentExtraction.findFirst({
      where: {
        organization_id: orgId,
        document: {
          organization_id: orgId,
          contract_id: contract.id,
          deleted_at: null,
        },
      },
      orderBy: { created_at: 'desc' },
      select: {
        extracted_fields: true,
        pipeline_checkpoint: true,
        updated_at: true,
        document: { select: { file_name: true } },
      },
    }),
    uploaderIds.length > 0
      ? prisma.user.findMany({
          where: { id: { in: uploaderIds } },
          select: { id: true, name: true, email: true },
        })
      : Promise.resolve([]),
    prisma.person.findMany({
      where: { organization_id: orgId, deleted_at: null },
      orderBy: { last_name: 'asc' },
      take: 200,
      select: { id: true, first_name: true, last_name: true, email: true },
    }),
  ])

  const uploaderMap = new Map(uploaders.map((u) => [u.id, u.name ?? u.email ?? 'Ukendt']))

  return { contract, cases, tasks, documents, extraction, uploaderMap, persons }
}

export async function getContractDisplayName(contractId: string): Promise<string> {
  const session = await auth()
  if (!session) return 'Kontrakt'
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, organization_id: session.user.organizationId, deleted_at: null },
    select: { display_name: true },
  })
  return contract?.display_name ?? 'Kontrakt'
}
