'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { 
  canAccessCompany, 
  canAccessSensitivity, 
  canAccessModule, 
  canEdit,
  getMaxSensitivityLevel,
} from '@/lib/permissions'
import { revalidatePath } from 'next/cache'
import {
  createContractSchema,
  updateContractSchema,
  updateContractStatusSchema,
  createContractPartySchema,
  updateContractPartySchema,
  createContractVersionSchema,
  createContractAttachmentSchema,
  createContractRelationSchema,
  listContractsFilterSchema,
  CreateContractInput,
  UpdateContractInput,
  UpdateContractStatusInput,
  CreateContractPartyInput,
  UpdateContractPartyInput,
  CreateContractVersionInput,
  CreateContractAttachmentInput,
  CreateContractRelationInput,
  ListContractsFilter,
  getMinSensitivity,
  meetsMinimumSensitivity,
  isValidStatusTransition,
  VALID_STATUS_TRANSITIONS,
} from '@/lib/validations/contract'
import { calculateRetentionDate } from '@/lib/contracts/retention'
import {
  ActionResult,
  ContractWithRelations,
  ContractWithCounts,
  ContractPartyWithPerson,
} from '@/types/contract'
import {
  Contract,
  ContractParty,
  ContractVersion,
  ContractAttachment,
  ContractRelation,
  ContractStatus,
  SensitivityLevel,
  Prisma,
} from '@prisma/client'

// ==================== KONTRAKTER ====================

export async function createContract(
  input: CreateContractInput
): Promise<ActionResult<Contract>> {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.organizationId) {
    return { error: 'Ikke autoriseret' }
  }

  // Moduladgang
  const canAccess = await canAccessModule(session.user.id, 'contracts')
  if (!canAccess) {
    return { error: 'Du har ikke adgang til kontraktmodulet' }
  }

  // Redigeringsrettighed
  const canEditData = await canEdit(session.user.id)
  if (!canEditData) {
    return { error: 'Du har ikke rettigheder til at oprette kontrakter' }
  }

  // Validér input
  const parsed = createContractSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || 'Ugyldigt input' }
  }

  // Adgang til selskab
  const hasCompanyAccess = await canAccessCompany(session.user.id, parsed.data.companyId)
  if (!hasCompanyAccess) {
    return { error: 'Du har ikke adgang til dette selskab' }
  }

  // Verificer selskab eksisterer
  const company = await prisma.company.findFirst({
    where: {
      id: parsed.data.companyId,
      organizationId: session.user.organizationId,
      deletedAt: null,
    },
  })
  if (!company) {
    return { error: 'Selskabet blev ikke fundet' }
  }

  // Sensitivity-minimum check
  const minSensitivity = getMinSensitivity(parsed.data.systemType)
  const providedSensitivity = parsed.data.sensitivity || 'STANDARD'
  
  if (!meetsMinimumSensitivity(providedSensitivity, minSensitivity)) {
    return { 
      error: `Sensitivitet for ${parsed.data.systemType} skal minimum være ${minSensitivity}` 
    }
  }

  // Tjek om bruger kan oprette med denne sensitivity
  const canCreateWithSensitivity = await canAccessSensitivity(
    session.user.id,
    providedSensitivity
  )
  if (!canCreateWithSensitivity) {
    return { 
      error: `Du har ikke rettigheder til at oprette kontrakter med sensitivitetsniveau ${providedSensitivity}` 
    }
  }

  // Verificer parent contract hvis angivet
  if (parsed.data.parentContractId) {
    const parentContract = await prisma.contract.findFirst({
      where: {
        id: parsed.data.parentContractId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    })
    if (!parentContract) {
      return { error: 'Den overordnede kontrakt blev ikke fundet' }
    }
  }

  // Beregn retention date
  const mustRetainUntil = calculateRetentionDate(
    parsed.data.systemType,
    parsed.data.signedDate || null,
    parsed.data.terminationDate || null,
    parsed.data.mustRetainUntil || null
  )

  try {
    const contract = await prisma.contract.create({
      data: {
        organizationId: session.user.organizationId,
        companyId: parsed.data.companyId,
        systemType: parsed.data.systemType,
        displayName: parsed.data.displayName,
        status: 'UDKAST',
        sensitivity: providedSensitivity,
        deadlineType: parsed.data.deadlineType || 'INGEN',
        versionSource: parsed.data.versionSource || 'CUSTOM',
        collectiveAgreement: parsed.data.collectiveAgreement,
        parentContractId: parsed.data.parentContractId,
        triggeredById: parsed.data.triggeredById,
        effectiveDate: parsed.data.effectiveDate,
        expiryDate: parsed.data.expiryDate,
        signedDate: parsed.data.signedDate,
        noticePeriodDays: parsed.data.noticePeriodDays,
        terminationDate: parsed.data.terminationDate,
        anciennityStart: parsed.data.anciennityStart,
        reminder90Days: parsed.data.reminder90Days ?? true,
        reminder30Days: parsed.data.reminder30Days ?? true,
        reminder7Days: parsed.data.reminder7Days ?? true,
        reminderRecipients: parsed.data.reminderRecipients || [],
        mustRetainUntil,
        typeData: parsed.data.typeData || {},
        notes: parsed.data.notes,
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
        sensitivity: contract.sensitivity,
      },
    })

    revalidatePath(`/companies/${parsed.data.companyId}`)
    revalidatePath('/contracts')
    
    return { data: contract }
  } catch (error) {
    console.error('Fejl ved oprettelse af kontrakt:', error)
    return { error: 'Kontrakten kunne ikke oprettes — prøv igen' }
  }
}

export async function updateContract(
  input: UpdateContractInput
): Promise<ActionResult<Contract>> {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.organizationId) {
    return { error: 'Ikke autoriseret' }
  }

  const parsed = updateContractSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || 'Ugyldigt input' }
  }

  const { id, ...data } = parsed.data

  // Hent eksisterende kontrakt
  const existing = await prisma.contract.findFirst({
    where: {
      id,
      organizationId: session.user.organizationId,
      deletedAt: null,
    },
  })

  if (!existing) {
    return { error: 'Kontrakten blev ikke fundet' }
  }

  // Adgang til selskab
  const hasCompanyAccess = await canAccessCompany(session.user.id, existing.companyId)
  if (!hasCompanyAccess) {
    return { error: 'Du har ikke adgang til denne kontrakt' }
  }

  // Sensitivity adgang
  const hasSensitivityAccess = await canAccessSensitivity(
    session.user.id,
    existing.sensitivity
  )
  if (!hasSensitivityAccess) {
    return { error: 'Du har ikke adgang til denne kontrakt' }
  }

  // Redigeringsrettighed
  const canEditData = await canEdit(session.user.id)
  if (!canEditData) {
    return { error: 'Du har ikke rettigheder til at redigere kontrakter' }
  }

  // Hvis sensitivity ændres, tjek at det stadig opfylder minimum
  if (data.sensitivity) {
    const minSensitivity = getMinSensitivity(existing.systemType)
    if (!meetsMinimumSensitivity(data.sensitivity, minSensitivity)) {
      return { 
        error: `Sensitivitet for ${existing.systemType} skal minimum være ${minSensitivity}` 
      }
    }

    // Tjek at bruger har adgang til den nye sensitivity
    const canAccessNewSensitivity = await canAccessSensitivity(
      session.user.id,
      data.sensitivity
    )
    if (!canAccessNewSensitivity) {
      return { 
        error: `Du har ikke rettigheder til at sætte sensitivitetsniveau ${data.sensitivity}` 
      }
    }
  }

  // Genberegn retention hvis relevante datoer ændres
  let mustRetainUntil = existing.mustRetainUntil
  if (data.signedDate !== undefined || data.terminationDate !== undefined) {
    mustRetainUntil = calculateRetentionDate(
      existing.systemType,
      data.signedDate ?? existing.signedDate,
      data.terminationDate ?? existing.terminationDate,
      data.mustRetainUntil ?? existing.mustRetainUntil
    )
  }

  try {
    const contract = await prisma.contract.update({
      where: { id },
      data: {
        ...data,
        mustRetainUntil,
      },
    })

    // Audit log med ændringer for fortrolige kontrakter
    const shouldLogChanges = 
      existing.sensitivity === 'STRENGT_FORTROLIG' || 
      existing.sensitivity === 'FORTROLIG'

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'UPDATE',
        resourceType: 'contract',
        resourceId: contract.id,
        sensitivity: contract.sensitivity,
        changes: shouldLogChanges ? (data as object) : null,
      },
    })

    revalidatePath(`/contracts/${id}`)
    revalidatePath(`/companies/${existing.companyId}`)
    revalidatePath('/contracts')

    return { data: contract }
  } catch (error) {
    console.error('Fejl ved opdatering af kontrakt:', error)
    return { error: 'Kontrakten kunne ikke opdateres — prøv igen' }
  }
}

export async function updateContractStatus(
  input: UpdateContractStatusInput
): Promise<ActionResult<Contract>> {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.organizationId) {
    return { error: 'Ikke autoriseret' }
  }

  const parsed = updateContractStatusSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || 'Ugyldigt input' }
  }

  const { id, status: newStatus } = parsed.data

  // Hent eksisterende kontrakt
  const existing = await prisma.contract.findFirst({
    where: {
      id,
      organizationId: session.user.organizationId,
      deletedAt: null,
    },
  })

  if (!existing) {
    return { error: 'Kontrakten blev ikke fundet' }
  }

  // Adgang til selskab
  const hasCompanyAccess = await canAccessCompany(session.user.id, existing.companyId)
  if (!hasCompanyAccess) {
    return { error: 'Du har ikke adgang til denne kontrakt' }
  }

  // Sensitivity adgang
  const hasSensitivityAccess = await canAccessSensitivity(
    session.user.id,
    existing.sensitivity
  )
  if (!hasSensitivityAccess) {
    return { error: 'Du har ikke adgang til denne kontrakt' }
  }

  // Redigeringsrettighed
  const canEditData = await canEdit(session.user.id)
  if (!canEditData) {
    return { error: 'Du har ikke rettigheder til at ændre kontraktstatus' }
  }

  // Validér status-transition
  if (!isValidStatusTransition(existing.status, newStatus)) {
    const validTransitions = VALID_STATUS_TRANSITIONS[existing.status]
    return { 
      error: `Ugyldig statusændring. Fra ${existing.status} kan du skifte til: ${validTransitions.join(', ') || 'ingen'}` 
    }
  }

  try {
    const contract = await prisma.contract.update({
      where: { id },
      data: { status: newStatus },
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'UPDATE',
        resourceType: 'contract',
        resourceId: contract.id,
        sensitivity: contract.sensitivity,
        changes: { status: { from: existing.status, to: newStatus } },
      },
    })

    revalidatePath(`/contracts/${id}`)
    revalidatePath(`/companies/${existing.companyId}`)
    revalidatePath('/contracts')

    return { data: contract }
  } catch (error) {
    console.error('Fejl ved statusændring:', error)
    return { error: 'Status kunne ikke ændres — prøv igen' }
  }
}

export async function deleteContract(
  contractId: string
): Promise<ActionResult<{ success: true }>> {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.organizationId) {
    return { error: 'Ikke autoriseret' }
  }

  const existing = await prisma.contract.findFirst({
    where: {
      id: contractId,
      organizationId: session.user.organizationId,
      deletedAt: null,
    },
  })

  if (!existing) {
    return { error: 'Kontrakten blev ikke fundet' }
  }

  const hasCompanyAccess = await canAccessCompany(session.user.id, existing.companyId)
  if (!hasCompanyAccess) {
    return { error: 'Du har ikke adgang til denne kontrakt' }
  }

  const hasSensitivityAccess = await canAccessSensitivity(
    session.user.id,
    existing.sensitivity
  )
  if (!hasSensitivityAccess) {
    return { error: 'Du har ikke adgang til denne kontrakt' }
  }

  const canEditData = await canEdit(session.user.id)
  if (!canEditData) {
    return { error: 'Du har ikke rettigheder til at slette kontrakter' }
  }

  try {
    // Soft delete
    await prisma.contract.update({
      where: { id: contractId },
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

    revalidatePath(`/companies/${existing.companyId}`)
    revalidatePath('/contracts')

    return { data: { success: true } }
  } catch (error) {
    console.error('Fejl ved sletning af kontrakt:', error)
    return { error: 'Kontrakten kunne ikke slettes — prøv igen' }
  }
}

export async function getContract(
  contractId: string
): Promise<ActionResult<ContractWithRelations>> {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.organizationId) {
    return { error: 'Ikke autoriseret' }
  }

  const contract = await prisma.contract.findFirst({
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
    },
  })

  if (!contract) {
    return { error: 'Kontrakten blev ikke fundet' }
  }

  // Adgang til selskab
  const hasCompanyAccess = await canAccessCompany(session.user.id, contract.companyId)
  if (!hasCompanyAccess) {
    return { error: 'Du har ikke adgang til denne kontrakt' }
  }

  // Sensitivity adgang
  const hasSensitivityAccess = await canAccessSensitivity(
    session.user.id,
    contract.sensitivity
  )
  if (!hasSensitivityAccess) {
    return { error: 'Du har ikke adgang til denne kontrakt' }
  }

  // Opdater last viewed
  await prisma.contract.update({
    where: { id: contractId },
    data: {
      lastViewedAt: new Date(),
      lastViewedBy: session.user.id,
    },
  })

  // Audit log
  await prisma.auditLog.create({
    data: {
      organizationId: session.user.organizationId,
      userId: session.user.id,
      action: 'VIEW',
      resourceType: 'contract',
      resourceId: contractId,
      sensitivity: contract.sensitivity,
    },
  })

  return { data: contract }
}

export async function listContracts(
  filter?: ListContractsFilter
): Promise<ActionResult<ContractWithCounts[]>> {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.organizationId) {
    return { error: 'Ikke autoriseret' }
  }

  const canAccess = await canAccessModule(session.user.id, 'contracts')
  if (!canAccess) {
    return { error: 'Du har ikke adgang til kontraktmodulet' }
  }

  // Validér filter
  const parsedFilter = listContractsFilterSchema.safeParse(filter || {})
  if (!parsedFilter.success) {
    return { error: 'Ugyldigt filter' }
  }

  const { companyId, systemType, status, sensitivity, search, limit = 50, offset = 0 } = parsedFilter.data

  // Hent tilgængelige selskaber
  const { getAccessibleCompanies } = await import('@/lib/permissions')
  const accessibleCompanies = await getAccessibleCompanies(session.user.id)
  
  if (accessibleCompanies.length === 0) {
    return { data: [] }
  }

  const accessibleCompanyIds = accessibleCompanies.map((c) => c.id)

  // Hent max sensitivity niveau for brugeren
  const maxSensitivity = await getMaxSensitivityLevel(session.user.id)
  if (!maxSensitivity) {
    return { data: [] }
  }

  // Byg where clause
  const where: Prisma.ContractWhereInput = {
    organizationId: session.user.organizationId,
    deletedAt: null,
    companyId: companyId 
      ? { in: accessibleCompanyIds.filter(id => id === companyId) }
      : { in: accessibleCompanyIds },
  }

  // Filtrer på sensitivity baseret på brugerens max niveau
  const sensitivityIndex = ['PUBLIC', 'STANDARD', 'INTERN', 'FORTROLIG', 'STRENGT_FORTROLIG'].indexOf(maxSensitivity)
  const allowedSensitivities = ['PUBLIC', 'STANDARD', 'INTERN', 'FORTROLIG', 'STRENGT_FORTROLIG'].slice(0, sensitivityIndex + 1) as SensitivityLevel[]
  
  where.sensitivity = sensitivity 
    ? { in: allowedSensitivities.filter(s => s === sensitivity) }
    : { in: allowedSensitivities }

  if (systemType) {
    where.systemType = systemType
  }

  if (status) {
    where.status = status
  }

  if (search && search.trim()) {
    where.OR = [
      { displayName: { contains: search, mode: 'insensitive' } },
      { notes: { contains: search, mode: 'insensitive' } },
    ]
  }

  try {
    const contracts = await prisma.contract.findMany({
      where,
      include: {
        company: true,
        _count: {
          select: {
            parties: true,
            versions: true,
            attachments: { where: { deletedAt: null } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      skip: offset,
    })

    return { data: contracts }
  } catch (error) {
    console.error('Fejl ved hentning af kontrakter:', error)
    return { error: 'Kontrakterne kunne ikke hentes — prøv igen' }
  }
}

// ==================== PARTER ====================

export async function addContractParty(
  input: CreateContractPartyInput
): Promise<ActionResult<ContractParty>> {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.organizationId) {
    return { error: 'Ikke autoriseret' }
  }

  const parsed = createContractPartySchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || 'Ugyldigt input' }
  }

  // Hent kontrakt
  const contract = await prisma.contract.findFirst({
    where: {
      id: parsed.data.contractId,
      organizationId: session.user.organizationId,
      deletedAt: null,
    },
  })

  if (!contract) {
    return { error: 'Kontrakten blev ikke fundet' }
  }

  const hasCompanyAccess = await canAccessCompany(session.user.id, contract.companyId)
  if (!hasCompanyAccess) {
    return { error: 'Du har ikke adgang til denne kontrakt' }
  }

  const hasSensitivityAccess = await canAccessSensitivity(
    session.user.id,
    contract.sensitivity
  )
  if (!hasSensitivityAccess) {
    return { error: 'Du har ikke adgang til denne kontrakt' }
  }

  const canEditData = await canEdit(session.user.id)
  if (!canEditData) {
    return { error: 'Du har ikke rettigheder til at tilføje parter' }
  }

  // Verificer person hvis angivet
  if (parsed.data.personId) {
    const person = await prisma.person.findFirst({
      where: {
        id: parsed.data.personId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    })
    if (!person) {
      return { error: 'Personen blev ikke fundet' }
    }
  }

  try {
    const party = await prisma.contractParty.create({
      data: {
        organizationId: session.user.organizationId,
        contractId: parsed.data.contractId,
        personId: parsed.data.personId,
        isSigner: parsed.data.isSigner || false,
        counterpartyName: parsed.data.counterpartyName,
        roleInContract: parsed.data.roleInContract,
      },
    })

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'CREATE',
        resourceType: 'contract_party',
        resourceId: party.id,
      },
    })

    revalidatePath(`/contracts/${parsed.data.contractId}`)
    return { data: party }
  } catch (error) {
    console.error('Fejl ved tilføjelse af part:', error)
    return { error: 'Parten kunne ikke tilføjes — prøv igen' }
  }
}

export async function updateContractParty(
  input: UpdateContractPartyInput
): Promise<ActionResult<ContractParty>> {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.organizationId) {
    return { error: 'Ikke autoriseret' }
  }

  const parsed = updateContractPartySchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || 'Ugyldigt input' }
  }

  const { id, ...data } = parsed.data

  // Hent eksisterende part med kontrakt
  const existing = await prisma.contractParty.findFirst({
    where: {
      id,
      organizationId: session.user.organizationId,
    },
    include: { contract: true },
  })

  if (!existing) {
    return { error: 'Parten blev ikke fundet' }
  }

  const hasCompanyAccess = await canAccessCompany(session.user.id, existing.contract.companyId)
  if (!hasCompanyAccess) {
    return { error: 'Du har ikke adgang til denne kontrakt' }
  }

  const hasSensitivityAccess = await canAccessSensitivity(
    session.user.id,
    existing.contract.sensitivity
  )
  if (!hasSensitivityAccess) {
    return { error: 'Du har ikke adgang til denne kontrakt' }
  }

  const canEditData = await canEdit(session.user.id)
  if (!canEditData) {
    return { error: 'Du har ikke rettigheder til at redigere parter' }
  }

  try {
    const party = await prisma.contractParty.update({
      where: { id },
      data,
    })

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'UPDATE',
        resourceType: 'contract_party',
        resourceId: party.id,
        changes: data as object,
      },
    })

    revalidatePath(`/contracts/${existing.contractId}`)
    return { data: party }
  } catch (error) {
    console.error('Fejl ved opdatering af part:', error)
    return { error: 'Parten kunne ikke opdateres — prøv igen' }
  }
}

export async function removeContractParty(
  partyId: string
): Promise<ActionResult<{ success: true }>> {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.organizationId) {
    return { error: 'Ikke autoriseret' }
  }

  const existing = await prisma.contractParty.findFirst({
    where: {
      id: partyId,
      organizationId: session.user.organizationId,
    },
    include: { contract: true },
  })

  if (!existing) {
    return { error: 'Parten blev ikke fundet' }
  }

  const hasCompanyAccess = await canAccessCompany(session.user.id, existing.contract.companyId)
  if (!hasCompanyAccess) {
    return { error: 'Du har ikke adgang til denne kontrakt' }
  }

  const hasSensitivityAccess = await canAccessSensitivity(
    session.user.id,
    existing.contract.sensitivity
  )
  if (!hasSensitivityAccess) {
    return { error: 'Du har ikke adgang til denne kontrakt' }
  }

  const canEditData = await canEdit(session.user.id)
  if (!canEditData) {
    return { error: 'Du har ikke rettigheder til at fjerne parter' }
  }

  try {
    await prisma.contractParty.delete({
      where: { id: partyId },
    })

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'DELETE',
        resourceType: 'contract_party',
        resourceId: partyId,
      },
    })

    revalidatePath(`/contracts/${existing.contractId}`)
    return { data: { success: true } }
  } catch (error) {
    console.error('Fejl ved fjernelse af part:', error)
    return { error: 'Parten kunne ikke fjernes — prøv igen' }
  }
}

export async function listContractParties(
  contractId: string
): Promise<ActionResult<ContractPartyWithPerson[]>> {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.organizationId) {
    return { error: 'Ikke autoriseret' }
  }

  const contract = await prisma.contract.findFirst({
    where: {
      id: contractId,
      organizationId: session.user.organizationId,
      deletedAt: null,
    },
  })

  if (!contract) {
    return { error: 'Kontrakten blev ikke fundet' }
  }

  const hasCompanyAccess = await canAccessCompany(session.user.id, contract.companyId)
  if (!hasCompanyAccess) {
    return { error: 'Du har ikke adgang til denne kontrakt' }
  }

  const hasSensitivityAccess = await canAccessSensitivity(
    session.user.id,
    contract.sensitivity
  )
  if (!hasSensitivityAccess) {
    return { error: 'Du har ikke adgang til denne kontrakt' }
  }

  try {
    const parties = await prisma.contractParty.findMany({
      where: {
        contractId,
        organizationId: session.user.organizationId,
      },
      include: { person: true },
      orderBy: { createdAt: 'asc' },
    })

    return { data: parties }
  } catch (error) {
    console.error('Fejl ved hentning af parter:', error)
    return { error: 'Parter kunne ikke hentes — prøv igen' }
  }
}

// ==================== VERSIONER ====================

export async function addContractVersion(
  input: CreateContractVersionInput
): Promise<ActionResult<ContractVersion>> {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.organizationId) {
    return { error: 'Ikke autoriseret' }
  }

  const parsed = createContractVersionSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || 'Ugyldigt input' }
  }

  const contract = await prisma.contract.findFirst({
    where: {
      id: parsed.data.contractId,
      organizationId: session.user.organizationId,
      deletedAt: null,
    },
  })

  if (!contract) {
    return { error: 'Kontrakten blev ikke fundet' }
  }

  const hasCompanyAccess = await canAccessCompany(session.user.id, contract.companyId)
  if (!hasCompanyAccess) {
    return { error: 'Du har ikke adgang til denne kontrakt' }
  }

  const hasSensitivityAccess = await canAccessSensitivity(
    session.user.id,
    contract.sensitivity
  )
  if (!hasSensitivityAccess) {
    return { error: 'Du har ikke adgang til denne kontrakt' }
  }

  const canEditData = await canEdit(session.user.id)
  if (!canEditData) {
    return { error: 'Du har ikke rettigheder til at uploade versioner' }
  }

  try {
    // Hent næste versionsnummer
    const lastVersion = await prisma.contractVersion.findFirst({
      where: {
        contractId: parsed.data.contractId,
        organizationId: session.user.organizationId,
      },
      orderBy: { versionNumber: 'desc' },
    })

    const versionNumber = (lastVersion?.versionNumber || 0) + 1

    // Sæt alle andre versioner til ikke-current
    if (parsed.data.isCurrent !== false) {
      await prisma.contractVersion.updateMany({
        where: {
          contractId: parsed.data.contractId,
          organizationId: session.user.organizationId,
        },
        data: { isCurrent: false },
      })
    }

    const version = await prisma.contractVersion.create({
      data: {
        organizationId: session.user.organizationId,
        contractId: parsed.data.contractId,
        versionNumber,
        fileUrl: parsed.data.fileUrl,
        fileName: parsed.data.fileName,
        fileSizeBytes: parsed.data.fileSizeBytes,
        isCurrent: parsed.data.isCurrent !== false,
        changeType: parsed.data.changeType || 'REDAKTIONEL',
        changeNote: parsed.data.changeNote,
        amendsClause: parsed.data.amendsClause,
        uploadedBy: session.user.id,
      },
    })

    // Hvis det er en materiel ændring, resæt status til TIL_REVIEW (hvis aktiv)
    if (parsed.data.changeType === 'MATERIEL' && contract.status === 'AKTIV') {
      await prisma.contract.update({
        where: { id: parsed.data.contractId },
        data: { status: 'TIL_REVIEW' },
      })
    }

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'CREATE',
        resourceType: 'contract_version',
        resourceId: version.id,
        sensitivity: contract.sensitivity,
      },
    })

    revalidatePath(`/contracts/${parsed.data.contractId}`)
    return { data: version }
  } catch (error) {
    console.error('Fejl ved upload af version:', error)
    return { error: 'Versionen kunne ikke uploades — prøv igen' }
  }
}

export async function listContractVersions(
  contractId: string
): Promise<ActionResult<ContractVersion[]>> {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.organizationId) {
    return { error: 'Ikke autoriseret' }
  }

  const contract = await prisma.contract.findFirst({
    where: {
      id: contractId,
      organizationId: session.user.organizationId,
      deletedAt: null,
    },
  })

  if (!contract) {
    return { error: 'Kontrakten blev ikke fundet' }
  }

  const hasCompanyAccess = await canAccessCompany(session.user.id, contract.companyId)
  if (!hasCompanyAccess) {
    return { error: 'Du har ikke adgang til denne kontrakt' }
  }

  const hasSensitivityAccess = await canAccessSensitivity(
    session.user.id,
    contract.sensitivity
  )
  if (!hasSensitivityAccess) {
    return { error: 'Du har ikke adgang til denne kontrakt' }
  }

  try {
    const versions = await prisma.contractVersion.findMany({
      where: {
        contractId,
        organizationId: session.user.organizationId,
      },
      orderBy: { versionNumber: 'desc' },
    })

    return { data: versions }
  } catch (error) {
    console.error('Fejl ved hentning af versioner:', error)
    return { error: 'Versioner kunne ikke hentes — prøv igen' }
  }
}

// ==================== BILAG ====================

export async function addContractAttachment(
  input: CreateContractAttachmentInput
): Promise<ActionResult<ContractAttachment>> {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.organizationId) {
    return { error: 'Ikke autoriseret' }
  }

  const parsed = createContractAttachmentSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || 'Ugyldigt input' }
  }

  const contract = await prisma.contract.findFirst({
    where: {
      id: parsed.data.contractId,
      organizationId: session.user.organizationId,
      deletedAt: null,
    },
  })

  if (!contract) {
    return { error: 'Kontrakten blev ikke fundet' }
  }

  const hasCompanyAccess = await canAccessCompany(session.user.id, contract.companyId)
  if (!hasCompanyAccess) {
    return { error: 'Du har ikke adgang til denne kontrakt' }
  }

  const hasSensitivityAccess = await canAccessSensitivity(
    session.user.id,
    contract.sensitivity
  )
  if (!hasSensitivityAccess) {
    return { error: 'Du har ikke adgang til denne kontrakt' }
  }

  const canEditData = await canEdit(session.user.id)
  if (!canEditData) {
    return { error: 'Du har ikke rettigheder til at uploade bilag' }
  }

  try {
    const attachment = await prisma.contractAttachment.create({
      data: {
        organizationId: session.user.organizationId,
        contractId: parsed.data.contractId,
        fileUrl: parsed.data.fileUrl,
        fileName: parsed.data.fileName,
        fileSizeBytes: parsed.data.fileSizeBytes,
        description: parsed.data.description,
        uploadedBy: session.user.id,
      },
    })

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'CREATE',
        resourceType: 'contract_attachment',
        resourceId: attachment.id,
        sensitivity: contract.sensitivity,
      },
    })

    revalidatePath(`/contracts/${parsed.data.contractId}`)
    return { data: attachment }
  } catch (error) {
    console.error('Fejl ved upload af bilag:', error)
    return { error: 'Bilaget kunne ikke uploades — prøv igen' }
  }
}

export async function deleteContractAttachment(
  attachmentId: string
): Promise<ActionResult<{ success: true }>> {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.organizationId) {
    return { error: 'Ikke autoriseret' }
  }

  const existing = await prisma.contractAttachment.findFirst({
    where: {
      id: attachmentId,
      organizationId: session.user.organizationId,
      deletedAt: null,
    },
    include: { contract: true },
  })

  if (!existing) {
    return { error: 'Bilaget blev ikke fundet' }
  }

  const hasCompanyAccess = await canAccessCompany(session.user.id, existing.contract.companyId)
  if (!hasCompanyAccess) {
    return { error: 'Du har ikke adgang til denne kontrakt' }
  }

  const hasSensitivityAccess = await canAccessSensitivity(
    session.user.id,
    existing.contract.sensitivity
  )
  if (!hasSensitivityAccess) {
    return { error: 'Du har ikke adgang til denne kontrakt' }
  }

  const canEditData = await canEdit(session.user.id)
  if (!canEditData) {
    return { error: 'Du har ikke rettigheder til at slette bilag' }
  }

  try {
    // Soft delete
    await prisma.contractAttachment.update({
      where: { id: attachmentId },
      data: { deletedAt: new Date() },
    })

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'DELETE',
        resourceType: 'contract_attachment',
        resourceId: attachmentId,
        sensitivity: existing.contract.sensitivity,
      },
    })

    revalidatePath(`/contracts/${existing.contractId}`)
    return { data: { success: true } }
  } catch (error) {
    console.error('Fejl ved sletning af bilag:', error)
    return { error: 'Bilaget kunne ikke slettes — prøv igen' }
  }
}

export async function listContractAttachments(
  contractId: string
): Promise<ActionResult<ContractAttachment[]>> {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.organizationId) {
    return { error: 'Ikke autoriseret' }
  }

  const contract = await prisma.contract.findFirst({
    where: {
      id: contractId,
      organizationId: session.user.organizationId,
      deletedAt: null,
    },
  })

  if (!contract) {
    return { error: 'Kontrakten blev ikke fundet' }
  }

  const hasCompanyAccess = await canAccessCompany(session.user.id, contract.companyId)
  if (!hasCompanyAccess) {
    return { error: 'Du har ikke adgang til denne kontrakt' }
  }

  const hasSensitivityAccess = await canAccessSensitivity(
    session.user.id,
    contract.sensitivity
  )
  if (!hasSensitivityAccess) {
    return { error: 'Du har ikke adgang til denne kontrakt' }
  }

  try {
    const attachments = await prisma.contractAttachment.findMany({
      where: {
        contractId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
      orderBy: { uploadedAt: 'desc' },
    })

    return { data: attachments }
  } catch (error) {
    console.error('Fejl ved hentning af bilag:', error)
    return { error: 'Bilag kunne ikke hentes — prøv igen' }
  }
}

// ==================== RELATIONER ====================

export async function addContractRelation(
  input: CreateContractRelationInput
): Promise<ActionResult<ContractRelation>> {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.organizationId) {
    return { error: 'Ikke autoriseret' }
  }

  const parsed = createContractRelationSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || 'Ugyldigt input' }
  }

  // Hent begge kontrakter
  const [fromContract, toContract] = await Promise.all([
    prisma.contract.findFirst({
      where: {
        id: parsed.data.fromContractId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    }),
    prisma.contract.findFirst({
      where: {
        id: parsed.data.toContractId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    }),
  ])

  if (!fromContract) {
    return { error: 'Fra-kontrakten blev ikke fundet' }
  }

  if (!toContract) {
    return { error: 'Til-kontrakten blev ikke fundet' }
  }

  // Tjek adgang til begge
  const [hasFromAccess, hasToAccess] = await Promise.all([
    canAccessCompany(session.user.id, fromContract.companyId),
    canAccessCompany(session.user.id, toContract.companyId),
  ])

  if (!hasFromAccess || !hasToAccess) {
    return { error: 'Du har ikke adgang til begge kontrakter' }
  }

  const [hasFromSensitivity, hasToSensitivity] = await Promise.all([
    canAccessSensitivity(session.user.id, fromContract.sensitivity),
    canAccessSensitivity(session.user.id, toContract.sensitivity),
  ])

  if (!hasFromSensitivity || !hasToSensitivity) {
    return { error: 'Du har ikke adgang til begge kontrakter' }
  }

  const canEditData = await canEdit(session.user.id)
  if (!canEditData) {
    return { error: 'Du har ikke rettigheder til at oprette relationer' }
  }

  // Tjek at relationen ikke allerede eksisterer
  const existingRelation = await prisma.contractRelation.findFirst({
    where: {
      fromContractId: parsed.data.fromContractId,
      toContractId: parsed.data.toContractId,
      relationType: parsed.data.relationType,
      organizationId: session.user.organizationId,
    },
  })

  if (existingRelation) {
    return { error: 'Denne relation eksisterer allerede' }
  }

  try {
    const relation = await prisma.contractRelation.create({
      data: {
        organizationId: session.user.organizationId,
        fromContractId: parsed.data.fromContractId,
        toContractId: parsed.data.toContractId,
        relationType: parsed.data.relationType,
        createdBy: session.user.id,
      },
    })

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'CREATE',
        resourceType: 'contract_relation',
        resourceId: relation.id,
      },
    })

    revalidatePath(`/contracts/${parsed.data.fromContractId}`)
    revalidatePath(`/contracts/${parsed.data.toContractId}`)
    return { data: relation }
  } catch (error) {
    console.error('Fejl ved oprettelse af relation:', error)
    return { error: 'Relationen kunne ikke oprettes — prøv igen' }
  }
}

export async function deleteContractRelation(
  relationId: string
): Promise<ActionResult<{ success: true }>> {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.organizationId) {
    return { error: 'Ikke autoriseret' }
  }

  const existing = await prisma.contractRelation.findFirst({
    where: {
      id: relationId,
      organizationId: session.user.organizationId,
    },
    include: {
      fromContract: true,
      toContract: true,
    },
  })

  if (!existing) {
    return { error: 'Relationen blev ikke fundet' }
  }

  const hasFromAccess = await canAccessCompany(session.user.id, existing.fromContract.companyId)
  if (!hasFromAccess) {
    return { error: 'Du har ikke adgang til denne relation' }
  }

  const canEditData = await canEdit(session.user.id)
  if (!canEditData) {
    return { error: 'Du har ikke rettigheder til at slette relationer' }
  }

  try {
    await prisma.contractRelation.delete({
      where: { id: relationId },
    })

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'DELETE',
        resourceType: 'contract_relation',
        resourceId: relationId,
      },
    })

    revalidatePath(`/contracts/${existing.fromContractId}`)
    revalidatePath(`/contracts/${existing.toContractId}`)
    return { data: { success: true } }
  } catch (error) {
    console.error('Fejl ved sletning af relation:', error)
    return { error: 'Relationen kunne ikke slettes — prøv igen' }
  }
}

// ==================== AKTIVITETSLOG ====================

export async function getContractActivityLog(
  contractId: string,
  limit: number = 50
): Promise<ActionResult<any[]>> {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.organizationId) {
    return { error: 'Ikke autoriseret' }
  }

  const contract = await prisma.contract.findFirst({
    where: {
      id: contractId,
      organizationId: session.user.organizationId,
      deletedAt: null,
    },
  })

  if (!contract) {
    return { error: 'Kontrakten blev ikke fundet' }
  }

  const hasCompanyAccess = await canAccessCompany(session.user.id, contract.companyId)
  if (!hasCompanyAccess) {
    return { error: 'Du har ikke adgang til denne kontrakt' }
  }

  const hasSensitivityAccess = await canAccessSensitivity(
    session.user.id,
    contract.sensitivity
  )
  if (!hasSensitivityAccess) {
    return { error: 'Du har ikke adgang til denne kontrakt' }
  }

  try {
    const activities = await prisma.auditLog.findMany({
      where: {
        organizationId: session.user.organizationId,
        OR: [
          { resourceId: contractId, resourceType: 'contract' },
          { resourceType: { in: ['contract_party', 'contract_version', 'contract_attachment', 'contract_relation'] } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return { data: activities }
  } catch (error) {
    console.error('Fejl ved hentning af aktivitetslog:', error)
    return { error: 'Aktivitetslog kunne ikke hentes — prøv igen' }
  }
}