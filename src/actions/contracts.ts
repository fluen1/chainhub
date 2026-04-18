'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canAccessCompany, canAccessSensitivity, canAccessModule } from '@/lib/permissions'
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
import type { Contract } from '@prisma/client'
import { captureError } from '@/lib/logger'

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
  if (!session) return { error: 'Ikke autoriseret' }

  const parsed = createContractSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Ugyldigt input' }

  const hasCompanyAccess = await canAccessCompany(session.user.id, parsed.data.companyId)
  if (!hasCompanyAccess) return { error: 'Ingen adgang til dette selskab' }

  const hasSensitivityAccess = await canAccessSensitivity(session.user.id, parsed.data.sensitivity)
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
        system_type: parsed.data.systemType as never,
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
  if (!session) return { error: 'Ikke autoriseret' }

  const parsed = updateContractStatusSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  const contract = await prisma.contract.findFirst({
    where: {
      id: parsed.data.contractId,
      organization_id: session.user.organizationId,
      deleted_at: null,
    },
  })
  if (!contract) return { error: 'Kontrakt ikke fundet' }

  const hasSensitivityAccess = await canAccessSensitivity(session.user.id, contract.sensitivity)
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
          ? `${contract.notes ?? ''}\n[${new Date().toLocaleDateString('da-DK')}] ${parsed.data.note}`.trim()
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
  if (!session) return { error: 'Ikke autoriseret' }

  const hasAccess = await canAccessModule(session.user.id, 'settings')
  if (!hasAccess) return { error: 'Ingen adgang' }

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

export async function getContractList(options: {
  companyId?: string
  organizationId: string
  userId: string
  page?: number
  pageSize?: number
  expiresWithinDays?: number
}): Promise<ActionResult<{ contracts: Contract[]; total: number }>> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

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
      const hasAccess = await canAccessSensitivity(options.userId, contract.sensitivity)
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
