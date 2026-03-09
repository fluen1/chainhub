'use server'

import { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canAccessCompany, canAccessSensitivity } from '@/lib/permissions'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import {
  createContractSchema,
  updateContractSchema,
  updateContractStatusSchema,
  addContractPartySchema,
  removeContractPartySchema,
  addContractRelationSchema,
  removeContractRelationSchema,
  listContractsSchema,
  getContractSchema,
  deleteContractSchema,
  requestUploadUrlSchema,
  confirmVersionUploadSchema,
  confirmAttachmentUploadSchema,
  deleteAttachmentSchema,
  deleteVersionSchema,
  getMinSensitivity,
  meetsMinimumSensitivity,
  isValidStatusTransition,
  isLag2Type,
} from '@/lib/validations/contract'
import { calculateRetentionDate } from '@/lib/contracts/retention'
import {
  isStorageConfigured,
  getStorageConfigurationGuide,
  generateStoragePath,
  getSignedUploadUrl,
  getSignedDownloadUrl,
} from '@/lib/storage'
import type {
  ActionResult,
  ContractWithRelations,
  ContractWithCounts,
  UploadUrlResponse,
} from '@/types/contract'
import type {
  Contract,
  ContractParty,
  ContractVersion,
  ContractAttachment,
  ContractRelation,
  SensitivityLevel,
} from '@prisma/client'

// ==================== OPRET KONTRAKT ====================

export async function createContract(
  input: z.infer<typeof createContractSchema>
): Promise<ActionResult<Contract>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = createContractSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { error: firstError?.message ?? 'Ugyldigt input' }
  }

  const data = parsed.data

  // Adgangstjek til selskab
  const hasCompanyAccess = await canAccessCompany(session.user.id, data.companyId)
  if (!hasCompanyAccess) return { error: 'Du har ikke adgang til dette selskab' }

  // Sensitivity-minimum tjek
  const minSensitivity = getMinSensitivity(data.systemType)
  if (!meetsMinimumSensitivity(data.sensitivity, minSensitivity)) {
    return {
      error: `Sensitivitetsniveauet for ${data.systemType} skal minimum være ${minSensitivity}`,
    }
  }

  // Sensitivity-adgangstjek
  const hasSensitivityAccess = await canAccessSensitivity(session.user.id, data.sensitivity)
  if (!hasSensitivityAccess) {
    return { error: 'Du har ikke adgang til dette sensitivitetsniveau' }
  }

  // Lag 2-type tjek — kræver chain_structure
  if (isLag2Type(data.systemType)) {
    const organization = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { chainStructure: true },
    })
    if (!organization?.chainStructure) {
      return {
        error:
          'Denne kontrakttype kræver kædestruktur. Aktivér kædestruktur i indstillinger for at bruge denne type.',
      }
    }
  }

  // Valider parent_contract_id tilhører organisationen
  if (data.parentContractId) {
    const parentContract = await prisma.contract.findUnique({
      where: {
        id: data.parentContractId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    })
    if (!parentContract) {
      return { error: 'Overordnet kontrakt ikke fundet i din organisation' }
    }
  }

  // Beregn must_retain_until (DEC-001)
  const mustRetainUntil = calculateRetentionDate(data.systemType, {
    signedDate: data.signedDate ? new Date(data.signedDate) : null,
    terminationDate: data.terminationDate ? new Date(data.terminationDate) : null,
    expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
  })

  try {
    const contract = await prisma.contract.create({
      data: {
        organizationId: session.user.organizationId,
        companyId: data.companyId,
        systemType: data.systemType,
        displayName: data.displayName,
        status: 'UDKAST',
        sensitivity: data.sensitivity,
        deadlineType: data.deadlineType,
        versionSource: data.versionSource,
        collectiveAgreement: data.collectiveAgreement ?? null,
        parentContractId: data.parentContractId ?? null,
        triggeredById: data.triggeredById ?? null,
        effectiveDate: data.effectiveDate ? new Date(data.effectiveDate) : null,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
        signedDate: data.signedDate ? new Date(data.signedDate) : null,
        noticePeriodDays: data.noticePeriodDays ?? null,
        terminationDate: data.terminationDate ? new Date(data.terminationDate) : null,
        anciennityStart: data.anciennityStart ? new Date(data.anciennityStart) : null,
        reminder90Days: data.reminder90Days,
        reminder30Days: data.reminder30Days,
        reminder7Days: data.reminder7Days,
        reminderRecipients: data.reminderRecipients,
        mustRetainUntil: mustRetainUntil,
        typeData: data.typeData ? (data.typeData as Prisma.InputJsonValue) : Prisma.JsonNull,
        notes: data.notes ?? null,
        createdBy: session.user.id,
      },
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'CREATE',
        resourceType: 'contract',
        resourceId: contract.id,
        sensitivity: data.sensitivity,
      },
    })

    revalidatePath(`/companies/${data.companyId}`)
    revalidatePath('/contracts')
    return { data: contract }
  } catch (error) {
    console.error('createContract error:', error)
    return { error: 'Kontrakten kunne ikke oprettes — prøv igen eller kontakt support' }
  }
}

// ==================== HENT KONTRAKT ====================

export async function getContract(
  input: z.infer<typeof getContractSchema>
): Promise<ActionResult<ContractWithRelations>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = getContractSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt kontrakt-ID' }

  const { contractId } = parsed.data

  try {
    // Hent kontrakt med basis-felter for adgangstjek
    const contractBase = await prisma.contract.findUnique({
      where: {
        id: contractId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
      select: {
        id: true,
        companyId: true,
        sensitivity: true,
      },
    })

    if (!contractBase) return { error: 'Kontrakten blev ikke fundet' }

    // Selskabsadgang
    const hasCompanyAccess = await canAccessCompany(session.user.id, contractBase.companyId)
    if (!hasCompanyAccess) return { error: 'Du har ikke adgang til dette selskab' }

    // Sensitivity-adgang
    const hasSensitivityAccess = await canAccessSensitivity(
      session.user.id,
      contractBase.sensitivity
    )
    if (!hasSensitivityAccess) {
      return { error: 'Du har ikke adgang til denne kontrakt — sensitivitetsniveauet er for højt' }
    }

    // Hent fuld kontrakt med relationer
    const contract = await prisma.contract.findUnique({
      where: {
        id: contractId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
      include: {
        company: true,
        parties: {
          include: { person: true },
          orderBy: { createdAt: 'asc' },
        },
        versions: {
          orderBy: { versionNumber: 'desc' },
        },
        attachments: {
          where: { deletedAt: null },
          orderBy: { uploadedAt: 'desc' },
        },
        relationsFrom: {
          include: { toContract: true },
        },
        relationsTo: {
          include: { fromContract: true },
        },
        parentContract: true,
        childContracts: {
          where: { deletedAt: null },
        },
        _count: {
          select: {
            parties: true,
            versions: true,
            attachments: true,
          },
        },
      },
    })

    if (!contract) return { error: 'Kontrakten blev ikke fundet' }

    // Opdater last_viewed_at
    await prisma.contract.update({
      where: { id: contractId },
      data: {
        lastViewedAt: new Date(),
        lastViewedBy: session.user.id,
      },
    })

    // Audit log — VIEW (kun for FORTROLIG og STRENGT_FORTROLIG — DEC-017)
    const sensitivityLevels: SensitivityLevel[] = ['FORTROLIG', 'STRENGT_FORTROLIG']
    if (sensitivityLevels.includes(contract.sensitivity)) {
      await prisma.auditLog.create({
        data: {
          organizationId: session.user.organizationId,
          userId: session.user.id,
          action: 'VIEW',
          resourceType: 'contract',
          resourceId: contract.id,
          sensitivity: contract.sensitivity,
        },
      })
    }

    return { data: contract as ContractWithRelations }
  } catch (error) {
    console.error('getContract error:', error)
    return { error: 'Kontrakten kunne ikke hentes — prøv igen' }
  }
}

// ==================== LIST KONTRAKTER ====================

export async function listContracts(
  input: z.input<typeof listContractsSchema> = {}
): Promise<ActionResult<{ contracts: ContractWithCounts[]; total: number }>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = listContractsSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt filter-input' }

  const { companyId, status, systemType, sensitivity, search, page, pageSize } = parsed.data

  // Adgangstjek til specifikt selskab
  if (companyId) {
    const hasAccess = await canAccessCompany(session.user.id, companyId)
    if (!hasAccess) return { error: 'Du har ikke adgang til dette selskab' }
  }

  // Bestem hvilke sensitivity-niveauer brugeren kan se
  const allLevels: SensitivityLevel[] = [
    'PUBLIC',
    'STANDARD',
    'INTERN',
    'FORTROLIG',
    'STRENGT_FORTROLIG',
  ]
  const accessibleLevels: SensitivityLevel[] = []
  for (const level of allLevels) {
    const hasAccess = await canAccessSensitivity(session.user.id, level)
    if (hasAccess) accessibleLevels.push(level)
  }

  // Byg where-clause
  const where: {
    organizationId: string
    deletedAt: null
    companyId?: string
    status?: typeof status
    systemType?: typeof systemType
    sensitivity?: { in: SensitivityLevel[] } | SensitivityLevel
    OR?: Array<{ displayName?: { contains: string; mode: 'insensitive' }; notes?: { contains: string; mode: 'insensitive' } }>
  } = {
    organizationId: session.user.organizationId,
    deletedAt: null,
    ...(companyId && { companyId }),
    ...(status && { status }),
    ...(systemType && { systemType }),
  }

  // Sensitivity filter — kun vis hvad brugeren har adgang til
  if (sensitivity) {
    // Tjek brugeren har adgang til det ønskede niveau
    if (!accessibleLevels.includes(sensitivity)) {
      return { error: 'Du har ikke adgang til dette sensitivitetsniveau' }
    }
    where.sensitivity = sensitivity
  } else {
    where.sensitivity = { in: accessibleLevels }
  }

  // Søgning
  if (search && search.trim()) {
    where.OR = [
      { displayName: { contains: search.trim(), mode: 'insensitive' } },
      { notes: { contains: search.trim(), mode: 'insensitive' } },
    ]
  }

  const skip = (page - 1) * pageSize

  try {
    const [contracts, total] = await Promise.all([
      prisma.contract.findMany({
        where,
        include: {
          company: {
            select: { id: true, name: true },
          },
          _count: {
            select: {
              parties: true,
              versions: true,
              attachments: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: pageSize,
        skip,
      }),
      prisma.contract.count({ where }),
    ])

    return { data: { contracts: contracts as ContractWithCounts[], total } }
  } catch (error) {
    console.error('listContracts error:', error)
    return { error: 'Kontrakter kunne ikke hentes — prøv igen' }
  }
}

// ==================== OPDATER KONTRAKT ====================

export async function updateContract(
  input: z.infer<typeof updateContractSchema>
): Promise<ActionResult<Contract>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = updateContractSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { error: firstError?.message ?? 'Ugyldigt input' }
  }

  const { contractId, ...updateData } = parsed.data

  try {
    // Hent eksisterende kontrakt
    const existing = await prisma.contract.findUnique({
      where: {
        id: contractId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    })

    if (!existing) return { error: 'Kontrakten blev ikke fundet' }

    // Adgangstjek
    const hasCompanyAccess = await canAccessCompany(session.user.id, existing.companyId)
    if (!hasCompanyAccess) return { error: 'Du har ikke adgang til dette selskab' }

    const hasSensitivityAccess = await canAccessSensitivity(
      session.user.id,
      existing.sensitivity
    )
    if (!hasSensitivityAccess) {
      return { error: 'Du har ikke adgang til denne kontrakt' }
    }

    // Sensitivity-minimum tjek ved ændring
    if (updateData.sensitivity !== undefined && updateData.sensitivity !== null) {
      const minSensitivity = getMinSensitivity(existing.systemType)
      if (!meetsMinimumSensitivity(updateData.sensitivity, minSensitivity)) {
        return {
          error: `Sensitivitetsniveauet for ${existing.systemType} skal minimum være ${minSensitivity}`,
        }
      }
      // Tjek at bruger har adgang til det nye niveau
      const hasNewSensAccess = await canAccessSensitivity(
        session.user.id,
        updateData.sensitivity
      )
      if (!hasNewSensAccess) {
        return { error: 'Du har ikke adgang til det valgte sensitivitetsniveau' }
      }
    }

    // Beregn ny must_retain_until ved dato-ændringer (DEC-001)
    const newSignedDate = updateData.signedDate !== undefined
      ? (updateData.signedDate ? new Date(updateData.signedDate) : null)
      : existing.signedDate
    const newTerminationDate = updateData.terminationDate !== undefined
      ? (updateData.terminationDate ? new Date(updateData.terminationDate) : null)
      : existing.terminationDate
    const newExpiryDate = updateData.expiryDate !== undefined
      ? (updateData.expiryDate ? new Date(updateData.expiryDate) : null)
      : existing.expiryDate

    const newRetentionDate = calculateRetentionDate(existing.systemType, {
      signedDate: newSignedDate,
      terminationDate: newTerminationDate,
      expiryDate: newExpiryDate,
    })

    // Brugeren kan forlænge men aldrig forkorte opbevaringspligten
    let mustRetainUntil = existing.mustRetainUntil
    if (newRetentionDate) {
      if (!mustRetainUntil || newRetentionDate > mustRetainUntil) {
        mustRetainUntil = newRetentionDate
      }
    }

    // Byg changes til audit log (DEC-017)
    const changes: Record<string, { old: unknown; new: unknown }> = {}
    for (const [key, value] of Object.entries(updateData)) {
      const existingValue = (existing as Record<string, unknown>)[key]
      if (value !== undefined && value !== existingValue) {
        changes[key] = { old: existingValue, new: value }
      }
    }

    const contract = await prisma.contract.update({
      where: {
        id: contractId,
        organizationId: session.user.organizationId,
      },
      data: {
        displayName: updateData.displayName,
        sensitivity: updateData.sensitivity ?? undefined,
        deadlineType: updateData.deadlineType ?? undefined,
        versionSource: updateData.versionSource ?? undefined,
        collectiveAgreement:
          updateData.collectiveAgreement !== undefined
            ? updateData.collectiveAgreement || null
            : undefined,
        parentContractId:
          updateData.parentContractId !== undefined
            ? updateData.parentContractId
            : undefined,
        triggeredById:
          updateData.triggeredById !== undefined ? updateData.triggeredById : undefined,
        effectiveDate:
          updateData.effectiveDate !== undefined
            ? updateData.effectiveDate
              ? new Date(updateData.effectiveDate)
              : null
            : undefined,
        expiryDate:
          updateData.expiryDate !== undefined
            ? updateData.expiryDate
              ? new Date(updateData.expiryDate)
              : null
            : undefined,
        signedDate:
          updateData.signedDate !== undefined
            ? updateData.signedDate
              ? new Date(updateData.signedDate)
              : null
            : undefined,
        noticePeriodDays:
          updateData.noticePeriodDays !== undefined ? updateData.noticePeriodDays : undefined,
        terminationDate:
          updateData.terminationDate !== undefined
            ? updateData.terminationDate
              ? new Date(updateData.terminationDate)
              : null
            : undefined,
        anciennityStart:
          updateData.anciennityStart !== undefined
            ? updateData.anciennityStart
              ? new Date(updateData.anciennityStart)
              : null
            : undefined,
        reminder90Days: updateData.reminder90Days ?? undefined,
        reminder30Days: updateData.reminder30Days ?? undefined,
        reminder7Days: updateData.reminder7Days ?? undefined,
        reminderRecipients: updateData.reminderRecipients ?? undefined,
        typeData:
          updateData.typeData !== undefined
            ? (updateData.typeData ? (updateData.typeData as Prisma.InputJsonValue) : Prisma.JsonNull)
            : undefined,
        notes:
          updateData.notes !== undefined ? updateData.notes || null : undefined,
        mustRetainUntil,
      },
    })

    // Audit log — med changes for FORTROLIG/STRENGT_FORTROLIG (DEC-017)
    const sensitivityLevels: SensitivityLevel[] = ['FORTROLIG', 'STRENGT_FORTROLIG']
    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'UPDATE',
        resourceType: 'contract',
        resourceId: contract.id,
        sensitivity: contract.sensitivity,
        changes:
          sensitivityLevels.includes(existing.sensitivity) &&
          Object.keys(changes).length > 0
            ? (JSON.parse(JSON.stringify(changes)) as Prisma.InputJsonValue)
            : undefined,
      },
    })

    revalidatePath(`/contracts/${contractId}`)
    revalidatePath(`/companies/${existing.companyId}`)
    return { data: contract }
  } catch (error) {
    console.error('updateContract error:', error)
    return { error: 'Kontrakten kunne ikke opdateres — prøv igen eller kontakt support' }
  }
}

// ==================== STATUS-FLOW ====================

export async function updateContractStatus(
  input: z.infer<typeof updateContractStatusSchema>
): Promise<ActionResult<Contract>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = updateContractStatusSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { error: firstError?.message ?? 'Ugyldigt input' }
  }

  const { contractId, newStatus, note } = parsed.data

  try {
    const existing = await prisma.contract.findUnique({
      where: {
        id: contractId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    })

    if (!existing) return { error: 'Kontrakten blev ikke fundet' }

    // Adgangstjek
    const hasCompanyAccess = await canAccessCompany(session.user.id, existing.companyId)
    if (!hasCompanyAccess) return { error: 'Du har ikke adgang til dette selskab' }

    const hasSensitivityAccess = await canAccessSensitivity(
      session.user.id,
      existing.sensitivity
    )
    if (!hasSensitivityAccess) {
      return { error: 'Du har ikke adgang til denne kontrakt' }
    }

    // Validér status-transition jf. spec
    if (!isValidStatusTransition(existing.status, newStatus)) {
      return {
        error: `Ugyldig statusændring: ${existing.status} → ${newStatus} er ikke tilladt. Gyldige næste statusser: ${([] as string[]).concat(
          existing.status === 'UDKAST' ? ['TIL_REVIEW'] :
          existing.status === 'TIL_REVIEW' ? ['TIL_UNDERSKRIFT', 'UDKAST'] :
          existing.status === 'TIL_UNDERSKRIFT' ? ['AKTIV', 'TIL_REVIEW'] :
          existing.status === 'AKTIV' ? ['UDLOEBET', 'OPSAGT', 'FORNYET', 'ARKIVERET'] :
          []
        ).join(', ')}`,
      }
    }

    const contract = await prisma.contract.update({
      where: {
        id: contractId,
        organizationId: session.user.organizationId,
      },
      data: {
        status: newStatus,
        ...(note && { notes: note }),
      },
    })

    // Audit log — altid ved statusændring
    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'UPDATE',
        resourceType: 'contract',
        resourceId: contract.id,
        sensitivity: contract.sensitivity,
        changes: {
          status: { old: existing.status, new: newStatus },
          ...(note && { note: { old: null, new: note } }),
        } as unknown as Prisma.InputJsonValue,
      },
    })

    revalidatePath(`/contracts/${contractId}`)
    revalidatePath(`/companies/${existing.companyId}`)
    return { data: contract }
  } catch (error) {
    console.error('updateContractStatus error:', error)
    return { error: 'Status kunne ikke opdateres — prøv igen eller kontakt support' }
  }
}

// ==================== SLET KONTRAKT ====================

export async function deleteContract(
  input: z.infer<typeof deleteContractSchema>
): Promise<ActionResult<{ id: string }>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = deleteContractSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt kontrakt-ID' }

  const { contractId } = parsed.data

  try {
    const existing = await prisma.contract.findUnique({
      where: {
        id: contractId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    })

    if (!existing) return { error: 'Kontrakten blev ikke fundet' }

    const hasCompanyAccess = await canAccessCompany(session.user.id, existing.companyId)
    if (!hasCompanyAccess) return { error: 'Du har ikke adgang til dette selskab' }

    const hasSensitivityAccess = await canAccessSensitivity(
      session.user.id,
      existing.sensitivity
    )
    if (!hasSensitivityAccess) {
      return { error: 'Du har ikke adgang til denne kontrakt' }
    }

    // Soft delete
    await prisma.contract.update({
      where: {
        id: contractId,
        organizationId: session.user.organizationId,
      },
      data: { deletedAt: new Date() },
    })

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'DELETE',
        resourceType: 'contract',
        resourceId: contractId,
        sensitivity: existing.sensitivity,
      },
    })

    revalidatePath('/contracts')
    revalidatePath(`/companies/${existing.companyId}`)
    return { data: { id: contractId } }
  } catch (error) {
    console.error('deleteContract error:', error)
    return { error: 'Kontrakten kunne ikke slettes — prøv igen eller kontakt support' }
  }
}

// ==================== PARTER ====================

export async function addContractParty(
  input: z.infer<typeof addContractPartySchema>
): Promise<ActionResult<ContractParty>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = addContractPartySchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { error: firstError?.message ?? 'Ugyldigt input' }
  }

  const { contractId, personId, isSigner, counterpartyName, roleInContract } = parsed.data

  try {
    const contract = await prisma.contract.findUnique({
      where: {
        id: contractId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    })

    if (!contract) return { error: 'Kontrakten blev ikke fundet' }

    const hasCompanyAccess = await canAccessCompany(session.user.id, contract.companyId)
    if (!hasCompanyAccess) return { error: 'Du har ikke adgang til dette selskab' }

    const hasSensitivityAccess = await canAccessSensitivity(
      session.user.id,
      contract.sensitivity
    )
    if (!hasSensitivityAccess) {
      return { error: 'Du har ikke adgang til denne kontrakt' }
    }

    // Valider at person tilhører organisationen
    if (personId) {
      const person = await prisma.person.findUnique({
        where: {
          id: personId,
          organizationId: session.user.organizationId,
          deletedAt: null,
        },
      })
      if (!person) return { error: 'Person ikke fundet i din organisation' }
    }

    const party = await prisma.contractParty.create({
      data: {
        organizationId: session.user.organizationId,
        contractId,
        personId: personId ?? null,
        isSigner: isSigner ?? false,
        counterpartyName: counterpartyName ?? null,
        roleInContract: roleInContract ?? null,
      },
    })

    revalidatePath(`/contracts/${contractId}`)
    return { data: party }
  } catch (error) {
    console.error('addContractParty error:', error)
    return { error: 'Part kunne ikke tilføjes — prøv igen' }
  }
}

export async function removeContractParty(
  input: z.infer<typeof removeContractPartySchema>
): Promise<ActionResult<{ id: string }>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = removeContractPartySchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  const { contractId, partyId } = parsed.data

  try {
    const contract = await prisma.contract.findUnique({
      where: {
        id: contractId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    })

    if (!contract) return { error: 'Kontrakten blev ikke fundet' }

    const hasCompanyAccess = await canAccessCompany(session.user.id, contract.companyId)
    if (!hasCompanyAccess) return { error: 'Du har ikke adgang til dette selskab' }

    // Verificer at parten tilhører kontrakten og organisationen
    const party = await prisma.contractParty.findFirst({
      where: {
        id: partyId,
        contractId,
        organizationId: session.user.organizationId,
      },
    })

    if (!party) return { error: 'Part ikke fundet' }

    await prisma.contractParty.delete({ where: { id: partyId } })

    revalidatePath(`/contracts/${contractId}`)
    return { data: { id: partyId } }
  } catch (error) {
    console.error('removeContractParty error:', error)
    return { error: 'Part kunne ikke fjernes — prøv igen' }
  }
}

// ==================== RELATIONER ====================

export async function addContractRelation(
  input: z.infer<typeof addContractRelationSchema>
): Promise<ActionResult<ContractRelation>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = addContractRelationSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { error: firstError?.message ?? 'Ugyldigt input' }
  }

  const { fromContractId, toContractId, relationType } = parsed.data

  if (fromContractId === toContractId) {
    return { error: 'En kontrakt kan ikke relatere til sig selv' }
  }

  try {
    // Tjek at begge kontrakter tilhører organisationen
    const [fromContract, toContract] = await Promise.all([
      prisma.contract.findUnique({
        where: {
          id: fromContractId,
          organizationId: session.user.organizationId,
          deletedAt: null,
        },
      }),
      prisma.contract.findUnique({
        where: {
          id: toContractId,
          organizationId: session.user.organizationId,
          deletedAt: null,
        },
      }),
    ])

    if (!fromContract) return { error: 'Kildekontrakt ikke fundet' }
    if (!toContract) return { error: 'Målkontrakt ikke fundet' }

    // Adgangstjek til begge kontrakter
    const [hasFromAccess, hasToAccess] = await Promise.all([
      canAccessCompany(session.user.id, fromContract.companyId),
      canAccessCompany(session.user.id, toContract.companyId),
    ])

    if (!hasFromAccess || !hasToAccess) {
      return { error: 'Du har ikke adgang til begge kontrakter' }
    }

    const relation = await prisma.contractRelation.create({
      data: {
        organizationId: session.user.organizationId,
        fromContractId,
        toContractId,
        relationType,
        createdBy: session.user.id,
      },
    })

    revalidatePath(`/contracts/${fromContractId}`)
    revalidatePath(`/contracts/${toContractId}`)
    return { data: relation }
  } catch (error) {
    // Unik constraint violation — relation eksisterer allerede
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return { error: 'Denne relation eksisterer allerede' }
    }
    console.error('addContractRelation error:', error)
    return { error: 'Relation kunne ikke oprettes — prøv igen' }
  }
}

export async function removeContractRelation(
  input: z.infer<typeof removeContractRelationSchema>
): Promise<ActionResult<{ id: string }>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = removeContractRelationSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  const { relationId } = parsed.data

  try {
    const relation = await prisma.contractRelation.findFirst({
      where: {
        id: relationId,
        organizationId: session.user.organizationId,
      },
    })

    if (!relation) return { error: 'Relation ikke fundet' }

    await prisma.contractRelation.delete({ where: { id: relationId } })

    revalidatePath(`/contracts/${relation.fromContractId}`)
    revalidatePath(`/contracts/${relation.toContractId}`)
    return { data: { id: relationId } }
  } catch (error) {
    console.error('removeContractRelation error:', error)
    return { error: 'Relation kunne ikke fjernes — prøv igen' }
  }
}

// ==================== FIL-UPLOAD (Cloudflare R2) ====================

export async function requestUploadUrl(
  input: z.infer<typeof requestUploadUrlSchema>
): Promise<ActionResult<UploadUrlResponse>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = requestUploadUrlSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { error: firstError?.message ?? 'Ugyldigt input' }
  }

  const { contractId, fileName, fileType, fileSizeBytes, uploadPurpose } = parsed.data

  // Tjek at R2 er konfigureret
  if (!isStorageConfigured()) {
    return {
      error: `Fil-upload er ikke tilgængeligt. ${getStorageConfigurationGuide()}`,
    }
  }

  try {
    const contract = await prisma.contract.findUnique({
      where: {
        id: contractId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    })

    if (!contract) return { error: 'Kontrakten blev ikke fundet' }

    const hasCompanyAccess = await canAccessCompany(session.user.id, contract.companyId)
    if (!hasCompanyAccess) return { error: 'Du har ikke adgang til dette selskab' }

    const hasSensitivityAccess = await canAccessSensitivity(
      session.user.id,
      contract.sensitivity
    )
    if (!hasSensitivityAccess) {
      return { error: 'Du har ikke adgang til denne kontrakt' }
    }

    // Generer unik fil-sti
    const resourceType = uploadPurpose === 'version' ? 'contracts' : 'attachments'
    const fileKey = generateStoragePath(
      session.user.organizationId,
      resourceType,
      contractId,
      fileName
    )

    const { uploadUrl, fileUrl } = await getSignedUploadUrl(fileKey, fileType)

    return { data: { uploadUrl, fileKey, fileUrl } }
  } catch (error) {
    console.error('requestUploadUrl error:', error)
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: 'Upload-URL kunne ikke genereres — prøv igen' }
  }
}

// ==================== VERSIONSSTYRING ====================

export async function confirmVersionUpload(
  input: z.infer<typeof confirmVersionUploadSchema>
): Promise<ActionResult<ContractVersion>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = confirmVersionUploadSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { error: firstError?.message ?? 'Ugyldigt input' }
  }

  const { contractId, fileKey, fileName, fileSizeBytes, changeType, changeNote, amendsClause } =
    parsed.data

  try {
    const contract = await prisma.contract.findUnique({
      where: {
        id: contractId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    })

    if (!contract) return { error: 'Kontrakten blev ikke fundet' }

    const hasCompanyAccess = await canAccessCompany(session.user.id, contract.companyId)
    if (!hasCompanyAccess) return { error: 'Du har ikke adgang til dette selskab' }

    const hasSensitivityAccess = await canAccessSensitivity(
      session.user.id,
      contract.sensitivity
    )
    if (!hasSensitivityAccess) {
      return { error: 'Du har ikke adgang til denne kontrakt' }
    }

    // Find næste version-nummer
    const latestVersion = await prisma.contractVersion.findFirst({
      where: {
        contractId,
        organizationId: session.user.organizationId,
      },
      orderBy: { versionNumber: 'desc' },
    })

    const nextVersionNumber = (latestVersion?.versionNumber ?? 0) + 1

    // Konstruér fil-URL (fileKey er den R2-sti der allerede er uploadet til)
    const fileUrl = fileKey.startsWith('http') ? fileKey : `r2://${fileKey}`

    // Brug transaktion til at opdatere isCurrent
    const [, newVersion] = await prisma.$transaction([
      // Sæt alle eksisterende versioner til ikke-current
      prisma.contractVersion.updateMany({
        where: {
          contractId,
          organizationId: session.user.organizationId,
        },
        data: { isCurrent: false },
      }),
      // Opret ny version
      prisma.contractVersion.create({
        data: {
          organizationId: session.user.organizationId,
          contractId,
          versionNumber: nextVersionNumber,
          fileUrl,
          fileName,
          fileSizeBytes,
          isCurrent: true,
          changeType,
          changeNote: changeNote ?? null,
          amendsClause: amendsClause ?? null,
          uploadedBy: session.user.id,
        },
      }),
    ])

    // DEC-013: Materiel ændring → automatisk status-reset til TIL_REVIEW
    if (changeType === 'MATERIEL' && contract.status === 'AKTIV') {
      await prisma.contract.update({
        where: { id: contractId },
        data: { status: 'TIL_REVIEW' },
      })

      await prisma.auditLog.create({
        data: {
          organizationId: session.user.organizationId,
          userId: session.user.id,
          action: 'UPDATE',
          resourceType: 'contract',
          resourceId: contractId,
          sensitivity: contract.sensitivity,
          changes: {
            status: { old: contract.status, new: 'TIL_REVIEW' },
            reason: { old: null, new: 'Materiel ændring kræver ny gennemgang' },
          } as unknown as Prisma.InputJsonValue,
        },
      })
    }

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'CREATE',
        resourceType: 'contract_version',
        resourceId: newVersion.id,
        sensitivity: contract.sensitivity,
      },
    })

    revalidatePath(`/contracts/${contractId}`)
    return { data: newVersion }
  } catch (error) {
    console.error('confirmVersionUpload error:', error)
    return { error: 'Versionen kunne ikke gemmes — prøv igen' }
  }
}

export async function deleteContractVersion(
  input: z.infer<typeof deleteVersionSchema>
): Promise<ActionResult<{ id: string }>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = deleteVersionSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  const { contractId, versionId } = parsed.data

  try {
    const version = await prisma.contractVersion.findFirst({
      where: {
        id: versionId,
        contractId,
        organizationId: session.user.organizationId,
      },
      include: {
        contract: true,
      },
    })

    if (!version) return { error: 'Version ikke fundet' }

    // Man kan ikke slette den eneste eller nuværende version
    if (version.isCurrent) {
      return { error: 'Den aktuelle version kan ikke slettes. Upload en ny version først.' }
    }

    const hasCompanyAccess = await canAccessCompany(
      session.user.id,
      version.contract.companyId
    )
    if (!hasCompanyAccess) return { error: 'Du har ikke adgang til dette selskab' }

    await prisma.contractVersion.delete({ where: { id: versionId } })

    revalidatePath(`/contracts/${contractId}`)
    return { data: { id: versionId } }
  } catch (error) {
    console.error('deleteContractVersion error:', error)
    return { error: 'Versionen kunne ikke slettes — prøv igen' }
  }
}

// ==================== BILAG ====================

export async function confirmAttachmentUpload(
  input: z.infer<typeof confirmAttachmentUploadSchema>
): Promise<ActionResult<ContractAttachment>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = confirmAttachmentUploadSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { error: firstError?.message ?? 'Ugyldigt input' }
  }

  const { contractId, fileKey, fileName, fileSizeBytes, description } = parsed.data

  try {
    const contract = await prisma.contract.findUnique({
      where: {
        id: contractId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    })

    if (!contract) return { error: 'Kontrakten blev ikke fundet' }

    const hasCompanyAccess = await canAccessCompany(session.user.id, contract.companyId)
    if (!hasCompanyAccess) return { error: 'Du har ikke adgang til dette selskab' }

    const hasSensitivityAccess = await canAccessSensitivity(
      session.user.id,
      contract.sensitivity
    )
    if (!hasSensitivityAccess) {
      return { error: 'Du har ikke adgang til denne kontrakt' }
    }

    const fileUrl = fileKey.startsWith('http') ? fileKey : `r2://${fileKey}`

    const attachment = await prisma.contractAttachment.create({
      data: {
        organizationId: session.user.organizationId,
        contractId,
        fileUrl,
        fileName,
        fileSizeBytes,
        description: description ?? null,
        uploadedBy: session.user.id,
      },
    })

    revalidatePath(`/contracts/${contractId}`)
    return { data: attachment }
  } catch (error) {
    console.error('confirmAttachmentUpload error:', error)
    return { error: 'Bilaget kunne ikke gemmes — prøv igen' }
  }
}

export async function deleteContractAttachment(
  input: z.infer<typeof deleteAttachmentSchema>
): Promise<ActionResult<{ id: string }>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = deleteAttachmentSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  const { contractId, attachmentId } = parsed.data

  try {
    const attachment = await prisma.contractAttachment.findFirst({
      where: {
        id: attachmentId,
        contractId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
      include: {
        contract: true,
      },
    })

    if (!attachment) return { error: 'Bilag ikke fundet' }

    const hasCompanyAccess = await canAccessCompany(
      session.user.id,
      attachment.contract.companyId
    )
    if (!hasCompanyAccess) return { error: 'Du har ikke adgang til dette selskab' }

    // Soft delete af bilag
    await prisma.contractAttachment.update({
      where: { id: attachmentId },
      data: { deletedAt: new Date() },
    })

    revalidatePath(`/contracts/${contractId}`)
    return { data: { id: attachmentId } }
  } catch (error) {
    console.error('deleteContractAttachment error:', error)
    return { error: 'Bilaget kunne ikke slettes — prøv igen' }
  }
}

// ==================== DOWNLOAD ====================

export async function getContractFileUrl(
  contractId: string,
  versionId: string
): Promise<ActionResult<{ url: string }>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  try {
    const version = await prisma.contractVersion.findFirst({
      where: {
        id: versionId,
        contractId,
        organizationId: session.user.organizationId,
      },
      include: {
        contract: true,
      },
    })

    if (!version) return { error: 'Version ikke fundet' }

    const hasCompanyAccess = await canAccessCompany(
      session.user.id,
      version.contract.companyId
    )
    if (!hasCompanyAccess) return { error: 'Du har ikke adgang til dette selskab' }

    const hasSensitivityAccess = await canAccessSensitivity(
      session.user.id,
      version.contract.sensitivity
    )
    if (!hasSensitivityAccess) {
      return { error: 'Du har ikke adgang til denne fil' }
    }

    // Audit log — DOWNLOAD (DEC-017)
    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'DOWNLOAD',
        resourceType: 'contract_version',
        resourceId: version.id,
        sensitivity: version.contract.sensitivity,
      },
    })

    // Generer signed download URL
    const fileKey = version.fileUrl.replace('r2://', '')
    const url = await getSignedDownloadUrl(fileKey)

    return { data: { url } }
  } catch (error) {
    console.error('getContractFileUrl error:', error)
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: 'Download-URL kunne ikke genereres — prøv igen' }
  }
}