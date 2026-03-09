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
} from '@prisma/client'
import type { SensitivityLevel } from '@/lib/validations/contract'

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
  const hasSensitivityAccess = await canAccessSensitivity(
    session.user.id,
    data.sensitivity as SensitivityLevel
  )
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
    const parent = await prisma.contract.findFirst({
      where: {
        id: data.parentContractId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    })
    if (!parent) return { error: 'Overordnet kontrakt ikke fundet' }
  }

  // Auto-beregn retention hvis aktiveret
  let mustRetainUntil: Date | null = null
  if (data.autoRetain) {
    const baseDate =
      data.terminationDate
        ? new Date(data.terminationDate)
        : data.endDate
          ? new Date(data.endDate)
          : data.signedDate
            ? new Date(data.signedDate)
            : new Date()
    mustRetainUntil = calculateRetentionDate(data.systemType, baseDate)
  } else if (data.mustRetainUntil) {
    mustRetainUntil = new Date(data.mustRetainUntil)
  }

  try {
    const contract = await prisma.contract.create({
      data: {
        organizationId: session.user.organizationId,
        companyId: data.companyId,
        systemType: data.systemType as any,
        displayName: data.displayName,
        status: 'UDKAST' as any,
        sensitivity: data.sensitivity as any,
        deadlineType: data.deadlineType as any,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        signedDate: data.signedDate ? new Date(data.signedDate) : null,
        terminationDate: data.terminationDate ? new Date(data.terminationDate) : null,
        terminationNoticeDays: data.terminationNoticeDays ?? null,
        mustRetainUntil,
        parentContractId: data.parentContractId ?? null,
        triggeredById: data.triggeredById ?? null,
        versionSource: data.versionSource ? (data.versionSource as any) : null,
        notes: data.notes ?? null,
        counterpartyName: data.counterpartyName ?? null,
        counterpartyOrgNumber: data.counterpartyOrgNumber ?? null,
        counterpartyContactName: data.counterpartyContactName ?? null,
        counterpartyContactEmail: data.counterpartyContactEmail ?? null,
        createdBy: session.user.id,
      },
    })

    revalidatePath('/contracts')
    revalidatePath(`/companies/${data.companyId}`)
    return { data: contract }
  } catch (error) {
    console.error('createContract error:', error)
    return { error: 'Kunne ikke oprette kontrakt' }
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

  const data = parsed.data

  const existing = await prisma.contract.findFirst({
    where: {
      id: data.contractId,
      organizationId: session.user.organizationId,
      deletedAt: null,
    },
  })
  if (!existing) return { error: 'Kontrakt ikke fundet' }

  const hasCompanyAccess = await canAccessCompany(session.user.id, existing.companyId)
  if (!hasCompanyAccess) return { error: 'Du har ikke adgang til dette selskab' }

  // Sensitivity-tjek hvis den ændres
  if (data.sensitivity) {
    const minSensitivity = getMinSensitivity(existing.systemType as any)
    if (!meetsMinimumSensitivity(data.sensitivity, minSensitivity)) {
      return {
        error: `Sensitivitetsniveauet for denne kontrakttype skal minimum være ${minSensitivity}`,
      }
    }
    const hasSensitivityAccess = await canAccessSensitivity(
      session.user.id,
      data.sensitivity as SensitivityLevel
    )
    if (!hasSensitivityAccess) {
      return { error: 'Du har ikke adgang til dette sensitivitetsniveau' }
    }
  }

  try {
    const contract = await prisma.contract.update({
      where: { id: data.contractId },
      data: {
        ...(data.displayName !== undefined && { displayName: data.displayName }),
        ...(data.sensitivity !== undefined && { sensitivity: data.sensitivity as any }),
        ...(data.deadlineType !== undefined && { deadlineType: data.deadlineType as any }),
        ...(data.startDate !== undefined && {
          startDate: data.startDate ? new Date(data.startDate) : null,
        }),
        ...(data.endDate !== undefined && {
          endDate: data.endDate ? new Date(data.endDate) : null,
        }),
        ...(data.signedDate !== undefined && {
          signedDate: data.signedDate ? new Date(data.signedDate) : null,
        }),
        ...(data.terminationDate !== undefined && {
          terminationDate: data.terminationDate ? new Date(data.terminationDate) : null,
        }),
        ...(data.terminationNoticeDays !== undefined && {
          terminationNoticeDays: data.terminationNoticeDays,
        }),
        ...(data.mustRetainUntil !== undefined && {
          mustRetainUntil: data.mustRetainUntil ? new Date(data.mustRetainUntil) : null,
        }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.counterpartyName !== undefined && { counterpartyName: data.counterpartyName }),
        ...(data.counterpartyOrgNumber !== undefined && {
          counterpartyOrgNumber: data.counterpartyOrgNumber,
        }),
        ...(data.counterpartyContactName !== undefined && {
          counterpartyContactName: data.counterpartyContactName,
        }),
        ...(data.counterpartyContactEmail !== undefined && {
          counterpartyContactEmail: data.counterpartyContactEmail,
        }),
        updatedAt: new Date(),
      },
    })

    revalidatePath('/contracts')
    revalidatePath(`/contracts/${data.contractId}`)
    return { data: contract }
  } catch (error) {
    console.error('updateContract error:', error)
    return { error: 'Kunne ikke opdatere kontrakt' }
  }
}

// ==================== OPDATER STATUS ====================

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

  const data = parsed.data

  const existing = await prisma.contract.findFirst({
    where: {
      id: data.contractId,
      organizationId: session.user.organizationId,
      deletedAt: null,
    },
  })
  if (!existing) return { error: 'Kontrakt ikke fundet' }

  const hasCompanyAccess = await canAccessCompany(session.user.id, existing.companyId)
  if (!hasCompanyAccess) return { error: 'Du har ikke adgang til dette selskab' }

  if (!isValidStatusTransition(existing.status as any, data.newStatus)) {
    return {
      error: `Ugyldig status-transition fra ${existing.status} til ${data.newStatus}`,
    }
  }

  try {
    const contract = await prisma.contract.update({
      where: { id: data.contractId },
      data: {
        status: data.newStatus as any,
        updatedAt: new Date(),
      },
    })

    revalidatePath('/contracts')
    revalidatePath(`/contracts/${data.contractId}`)
    return { data: contract }
  } catch (error) {
    console.error('updateContractStatus error:', error)
    return { error: 'Kunne ikke opdatere status' }
  }
}

// ==================== HENT KONTRAKTER (LISTE) ====================

export async function listContracts(
  input: z.infer<typeof listContractsSchema>
): Promise<ActionResult<{ contracts: ContractWithCounts[]; total: number }>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = listContractsSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { error: firstError?.message ?? 'Ugyldigt input' }
  }

  const data = parsed.data
  const skip = (data.page - 1) * data.pageSize

  // Adgangstjek til selskab hvis angivet
  if (data.companyId) {
    const hasAccess = await canAccessCompany(session.user.id, data.companyId)
    if (!hasAccess) return { error: 'Du har ikke adgang til dette selskab' }
  }

  const where: Prisma.ContractWhereInput = {
    organizationId: session.user.organizationId,
    deletedAt: null,
    ...(data.companyId && { companyId: data.companyId }),
    ...(data.status && { status: data.status as any }),
    ...(data.systemType && { systemType: data.systemType as any }),
    ...(data.sensitivity && { sensitivity: data.sensitivity as any }),
    ...(data.search && {
      OR: [
        { displayName: { contains: data.search, mode: 'insensitive' } },
        { counterpartyName: { contains: data.search, mode: 'insensitive' } },
        { notes: { contains: data.search, mode: 'insensitive' } },
      ],
    }),
  }

  try {
    const [contracts, total] = await Promise.all([
      prisma.contract.findMany({
        where,
        include: {
          company: { select: { id: true, name: true } },
          _count: {
            select: {
              parties: true,
              versions: true,
              attachments: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: data.pageSize,
      }),
      prisma.contract.count({ where }),
    ])

    return { data: { contracts: contracts as unknown as ContractWithCounts[], total } }
  } catch (error) {
    console.error('listContracts error:', error)
    return { error: 'Kunne ikke hente kontrakter' }
  }
}

// ==================== HENT ENKELT KONTRAKT ====================

export async function getContract(
  input: z.infer<typeof getContractSchema>
): Promise<ActionResult<ContractWithRelations>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = getContractSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  const { contractId } = parsed.data

  try {
    const contract = await prisma.contract.findFirst({
      where: {
        id: contractId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
      include: {
        company: true,
        parties: {
          where: { deletedAt: null },
          include: { person: true },
        },
        versions: {
          orderBy: { versionNumber: 'desc' },
        },
        attachments: {
          where: { deletedAt: null },
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

    if (!contract) return { error: 'Kontrakt ikke fundet' }

    const hasAccess = await canAccessCompany(session.user.id, contract.companyId)
    if (!hasAccess) return { error: 'Du har ikke adgang til denne kontrakt' }

    return { data: contract as unknown as ContractWithRelations }
  } catch (error) {
    console.error('getContract error:', error)
    return { error: 'Kunne ikke hente kontrakt' }
  }
}

// ==================== SLET KONTRAKT (soft delete) ====================

export async function deleteContract(
  input: z.infer<typeof deleteContractSchema>
): Promise<ActionResult<{ deleted: boolean }>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = deleteContractSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  const { contractId } = parsed.data

  const existing = await prisma.contract.findFirst({
    where: {
      id: contractId,
      organizationId: session.user.organizationId,
      deletedAt: null,
    },
  })
  if (!existing) return { error: 'Kontrakt ikke fundet' }

  const hasAccess = await canAccessCompany(session.user.id, existing.companyId)
  if (!hasAccess) return { error: 'Du har ikke adgang til denne kontrakt' }

  if (existing.status === 'AKTIV') {
    return { error: 'Aktive kontrakter kan ikke slettes. Opsig kontrakten først.' }
  }

  try {
    await prisma.contract.update({
      where: { id: contractId },
      data: { deletedAt: new Date() },
    })

    revalidatePath('/contracts')
    revalidatePath(`/companies/${existing.companyId}`)
    return { data: { deleted: true } }
  } catch (error) {
    console.error('deleteContract error:', error)
    return { error: 'Kunne ikke slette kontrakt' }
  }
}

// ==================== TILFØJ PART ====================

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

  const data = parsed.data

  const contract = await prisma.contract.findFirst({
    where: {
      id: data.contractId,
      organizationId: session.user.organizationId,
      deletedAt: null,
    },
  })
  if (!contract) return { error: 'Kontrakt ikke fundet' }

  const hasAccess = await canAccessCompany(session.user.id, contract.companyId)
  if (!hasAccess) return { error: 'Du har ikke adgang til denne kontrakt' }

  try {
    const party = await prisma.contractParty.create({
      data: {
        contractId: data.contractId,
        organizationId: session.user.organizationId,
        personId: data.personId ?? null,
        isSigner: data.isSigner,
        counterpartyName: data.counterpartyName ?? null,
        roleInContract: data.roleInContract ?? null,
      },
    })

    revalidatePath(`/contracts/${data.contractId}`)
    return { data: party }
  } catch (error) {
    console.error('addContractParty error:', error)
    return { error: 'Kunne ikke tilføje part' }
  }
}

// ==================== FJERN PART ====================

export async function removeContractParty(
  input: z.infer<typeof removeContractPartySchema>
): Promise<ActionResult<{ removed: boolean }>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = removeContractPartySchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  const { partyId } = parsed.data

  const party = await prisma.contractParty.findFirst({
    where: {
      id: partyId,
      organizationId: session.user.organizationId,
      deletedAt: null,
    },
  })
  if (!party) return { error: 'Part ikke fundet' }

  const contract = await prisma.contract.findFirst({
    where: { id: party.contractId, deletedAt: null },
  })
  if (!contract) return { error: 'Kontrakt ikke fundet' }

  const hasAccess = await canAccessCompany(session.user.id, contract.companyId)
  if (!hasAccess) return { error: 'Du har ikke adgang til denne kontrakt' }

  try {
    await prisma.contractParty.update({
      where: { id: partyId },
      data: { deletedAt: new Date() },
    })

    revalidatePath(`/contracts/${party.contractId}`)
    return { data: { removed: true } }
  } catch (error) {
    console.error('removeContractParty error:', error)
    return { error: 'Kunne ikke fjerne part' }
  }
}

// ==================== TILFØJ RELATION ====================

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

  const data = parsed.data

  // Begge kontrakter skal tilhøre organisationen
  const [from, to] = await Promise.all([
    prisma.contract.findFirst({
      where: { id: data.fromContractId, organizationId: session.user.organizationId, deletedAt: null },
    }),
    prisma.contract.findFirst({
      where: { id: data.toContractId, organizationId: session.user.organizationId, deletedAt: null },
    }),
  ])

  if (!from || !to) return { error: 'En eller begge kontrakter ikke fundet' }

  const [hasFromAccess, hasToAccess] = await Promise.all([
    canAccessCompany(session.user.id, from.companyId),
    canAccessCompany(session.user.id, to.companyId),
  ])
  if (!hasFromAccess || !hasToAccess) {
    return { error: 'Du har ikke adgang til begge kontrakter' }
  }

  try {
    const relation = await prisma.contractRelation.create({
      data: {
        fromContractId: data.fromContractId,
        toContractId: data.toContractId,
        relationType: data.relationType as any,
        organizationId: session.user.organizationId,
        createdBy: session.user.id,
      },
    })

    revalidatePath(`/contracts/${data.fromContractId}`)
    revalidatePath(`/contracts/${data.toContractId}`)
    return { data: relation }
  } catch (error) {
    console.error('addContractRelation error:', error)
    return { error: 'Kunne ikke tilføje relation' }
  }
}

// ==================== FJERN RELATION ====================

export async function removeContractRelation(
  input: z.infer<typeof removeContractRelationSchema>
): Promise<ActionResult<{ removed: boolean }>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = removeContractRelationSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  const { relationId } = parsed.data

  const relation = await prisma.contractRelation.findFirst({
    where: { id: relationId, organizationId: session.user.organizationId },
  })
  if (!relation) return { error: 'Relation ikke fundet' }

  try {
    await prisma.contractRelation.delete({ where: { id: relationId } })

    revalidatePath(`/contracts/${relation.fromContractId}`)
    revalidatePath(`/contracts/${relation.toContractId}`)
    return { data: { removed: true } }
  } catch (error) {
    console.error('removeContractRelation error:', error)
    return { error: 'Kunne ikke fjerne relation' }
  }
}

// ==================== REQUEST UPLOAD URL ====================

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

  const data = parsed.data

  if (!isStorageConfigured()) {
    return { error: getStorageConfigurationGuide() }
  }

  const contract = await prisma.contract.findFirst({
    where: {
      id: data.contractId,
      organizationId: session.user.organizationId,
      deletedAt: null,
    },
  })
  if (!contract) return { error: 'Kontrakt ikke fundet' }

  const hasAccess = await canAccessCompany(session.user.id, contract.companyId)
  if (!hasAccess) return { error: 'Du har ikke adgang til denne kontrakt' }

  try {
    const storagePath = generateStoragePath({
      organizationId: session.user.organizationId,
      companyId: contract.companyId,
      module: 'contracts',
      entityId: data.contractId,
      fileName: data.fileName,
      purpose: data.uploadPurpose,
    })

    const { uploadUrl, fileKey } = await getSignedUploadUrl(storagePath, data.mimeType)
    const fileUrl = await getSignedDownloadUrl(fileKey)

    return { data: { uploadUrl, fileKey, fileUrl } }
  } catch (error) {
    console.error('requestUploadUrl error:', error)
    return { error: 'Kunne ikke generere upload URL' }
  }
}

// ==================== BEKRÆFT VERSION UPLOAD ====================

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

  const data = parsed.data

  const contract = await prisma.contract.findFirst({
    where: {
      id: data.contractId,
      organizationId: session.user.organizationId,
      deletedAt: null,
    },
  })
  if (!contract) return { error: 'Kontrakt ikke fundet' }

  const hasAccess = await canAccessCompany(session.user.id, contract.companyId)
  if (!hasAccess) return { error: 'Du har ikke adgang til denne kontrakt' }

  try {
    const version = await prisma.contractVersion.create({
      data: {
        contractId: data.contractId,
        organizationId: session.user.organizationId,
        fileKey: data.fileKey,
        fileName: data.fileName,
        fileSizeBytes: data.fileSizeBytes,
        changeType: data.changeType as any,
        changeNote: data.changeNote ?? null,
        amendsClause: data.amendsClause ?? null,
        versionNumber: data.versionNumber,
        uploadedBy: session.user.id,
      },
    })

    revalidatePath(`/contracts/${data.contractId}`)
    return { data: version }
  } catch (error) {
    console.error('confirmVersionUpload error:', error)
    return { error: 'Kunne ikke registrere version' }
  }
}

// ==================== BEKRÆFT ATTACHMENT UPLOAD ====================

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

  const data = parsed.data

  const contract = await prisma.contract.findFirst({
    where: {
      id: data.contractId,
      organizationId: session.user.organizationId,
      deletedAt: null,
    },
  })
  if (!contract) return { error: 'Kontrakt ikke fundet' }

  const hasAccess = await canAccessCompany(session.user.id, contract.companyId)
  if (!hasAccess) return { error: 'Du har ikke adgang til denne kontrakt' }

  try {
    const attachment = await prisma.contractAttachment.create({
      data: {
        contractId: data.contractId,
        organizationId: session.user.organizationId,
        fileKey: data.fileKey,
        fileName: data.fileName,
        fileSizeBytes: data.fileSizeBytes,
        mimeType: data.mimeType ?? null,
        description: data.description ?? null,
        uploadedBy: session.user.id,
      },
    })

    revalidatePath(`/contracts/${data.contractId}`)
    return { data: attachment }
  } catch (error) {
    console.error('confirmAttachmentUpload error:', error)
    return { error: 'Kunne ikke registrere bilag' }
  }
}

// ==================== SLET BILAG ====================

export async function deleteAttachment(
  input: z.infer<typeof deleteAttachmentSchema>
): Promise<ActionResult<{ deleted: boolean }>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = deleteAttachmentSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  const { attachmentId } = parsed.data

  const attachment = await prisma.contractAttachment.findFirst({
    where: {
      id: attachmentId,
      organizationId: session.user.organizationId,
      deletedAt: null,
    },
  })
  if (!attachment) return { error: 'Bilag ikke fundet' }

  const contract = await prisma.contract.findFirst({
    where: { id: attachment.contractId, deletedAt: null },
  })
  if (!contract) return { error: 'Kontrakt ikke fundet' }

  const hasAccess = await canAccessCompany(session.user.id, contract.companyId)
  if (!hasAccess) return { error: 'Du har ikke adgang til dette bilag' }

  try {
    await prisma.contractAttachment.update({
      where: { id: attachmentId },
      data: { deletedAt: new Date() },
    })

    revalidatePath(`/contracts/${attachment.contractId}`)
    return { data: { deleted: true } }
  } catch (error) {
    console.error('deleteAttachment error:', error)
    return { error: 'Kunne ikke slette bilag' }
  }
}

// ==================== SLET VERSION ====================

export async function deleteVersion(
  input: z.infer<typeof deleteVersionSchema>
): Promise<ActionResult<{ deleted: boolean }>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = deleteVersionSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  const { versionId } = parsed.data

  const version = await prisma.contractVersion.findFirst({
    where: {
      id: versionId,
      organizationId: session.user.organizationId,
    },
  })
  if (!version) return { error: 'Version ikke fundet' }

  const contract = await prisma.contract.findFirst({
    where: { id: version.contractId, deletedAt: null },
  })
  if (!contract) return { error: 'Kontrakt ikke fundet' }

  const hasAccess = await canAccessCompany(session.user.id, contract.companyId)
  if (!hasAccess) return { error: 'Du har ikke adgang til denne version' }

  // Tillad ikke sletning af den eneste version
  const versionCount = await prisma.contractVersion.count({
    where: { contractId: version.contractId },
  })
  if (versionCount <= 1) {
    return { error: 'Kan ikke slette den eneste version af en kontrakt' }
  }

  try {
    await prisma.contractVersion.delete({ where: { id: versionId } })

    revalidatePath(`/contracts/${version.contractId}`)
    return { data: { deleted: true } }
  } catch (error) {
    console.error('deleteVersion error:', error)
    return { error: 'Kunne ikke slette version' }
  }
}