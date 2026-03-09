'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canAccessCompany, canAccessSensitivity } from '@/lib/permissions'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import {
  createCaseSchema,
  updateCaseSchema,
  updateCaseStatusSchema,
  deleteCaseSchema,
  getCaseSchema,
  listCasesSchema,
  addCaseCompanySchema,
  removeCaseCompanySchema,
  addCaseContractSchema,
  removeCaseContractSchema,
  addCasePersonSchema,
  removeCasePersonSchema,
  updateCasePersonRoleSchema,
  createTaskSchema,
  updateTaskSchema,
  deleteTaskSchema,
  listTasksSchema,
  createDeadlineSchema,
  updateDeadlineSchema,
  deleteDeadlineSchema,
  listDeadlinesSchema,
  createTimeEntrySchema,
  listTimeEntriesSchema,
} from '@/lib/validations/case'
import { isValidCaseStatusTransition, VALID_CASE_STATUS_TRANSITIONS } from '@/types/case'
import { getEmailSyncStatus } from '@/lib/email/microsoft-graph'
import type {
  ActionResult,
  CaseWithRelations,
  CaseWithCounts,
  TaskWithAssignee,
  DeadlineWithCase,
  EmailSyncStatus,
} from '@/types/case'
import type {
  Case,
  Task,
  Deadline,
  CaseCompany,
  CaseContract,
  CasePerson,
  TimeEntry,
  SensitivityLevel,
  Prisma,
} from '@prisma/client'

// ==================== HJÆLPEFUNKTIONER ====================

/**
 * Verificerer adgang til en sag — tjekker organization_id, sensitivity og company-adgang
 * Returnerer sagen hvis adgang er givet, ellers en fejl
 */
async function verifyCaseAccess(
  caseId: string,
  userId: string,
  organizationId: string
): Promise<
  | { ok: true; case: { id: string; sensitivity: SensitivityLevel; caseCompanies: { companyId: string }[] } }
  | { ok: false; error: string }
> {
  const caseBase = await prisma.case.findUnique({
    where: {
      id: caseId,
      organizationId,
      deletedAt: null,
    },
    select: {
      id: true,
      sensitivity: true,
      caseCompanies: {
        select: { companyId: true },
      },
    },
  })

  if (!caseBase) {
    return { ok: false, error: 'Sagen blev ikke fundet' }
  }

  // Sensitivity-tjek — for alt over INTERN
  if (caseBase.sensitivity !== 'PUBLIC' && caseBase.sensitivity !== 'STANDARD' && caseBase.sensitivity !== 'INTERN') {
    const hasSensitivityAccess = await canAccessSensitivity(userId, caseBase.sensitivity)
    if (!hasSensitivityAccess) {
      return { ok: false, error: 'Du har ikke adgang til denne sag — sensitivitetsniveauet er for højt' }
    }
  }

  // Selskabsadgang — tjek mindst ét tilknyttet selskab
  if (caseBase.caseCompanies.length > 0) {
    let hasAnyCompanyAccess = false
    for (const { companyId } of caseBase.caseCompanies) {
      const hasAccess = await canAccessCompany(userId, companyId)
      if (hasAccess) {
        hasAnyCompanyAccess = true
        break
      }
    }
    if (!hasAnyCompanyAccess) {
      return { ok: false, error: 'Du har ikke adgang til nogen af de selskaber, der er tilknyttet denne sag' }
    }
  }

  return { ok: true, case: caseBase }
}

// ==================== OPRET SAG ====================

export async function createCase(
  input: z.infer<typeof createCaseSchema>
): Promise<ActionResult<Case>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = createCaseSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { error: firstError?.message ?? 'Ugyldigt input' }
  }

  const data = parsed.data

  // Sensitivity-adgangstjek
  const hasSensitivityAccess = await canAccessSensitivity(session.user.id, data.sensitivity)
  if (!hasSensitivityAccess) {
    return { error: 'Du har ikke adgang til det valgte sensitivitetsniveau' }
  }

  // Validér at alle selskaber tilhører organisationen og at bruger har adgang
  for (const companyId of data.companyIds) {
    const company = await prisma.company.findUnique({
      where: {
        id: companyId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    })
    if (!company) {
      return { error: `Selskab med ID ${companyId} blev ikke fundet i din organisation` }
    }
    const hasAccess = await canAccessCompany(session.user.id, companyId)
    if (!hasAccess) {
      return { error: `Du har ikke adgang til selskab: ${company.name}` }
    }
  }

  // Validér at alle kontrakter tilhører organisationen
  for (const contractId of data.contractIds) {
    const contract = await prisma.contract.findUnique({
      where: {
        id: contractId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    })
    if (!contract) {
      return { error: `Kontrakt med ID ${contractId} blev ikke fundet i din organisation` }
    }
  }

  // Validér at alle personer tilhører organisationen
  for (const { personId } of data.personIds) {
    const person = await prisma.person.findUnique({
      where: {
        id: personId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    })
    if (!person) {
      return { error: `Person med ID ${personId} blev ikke fundet i din organisation` }
    }
  }

  // Validér responsible_id tilhører organisationen
  if (data.responsibleId) {
    const responsible = await prisma.user.findUnique({
      where: {
        id: data.responsibleId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    })
    if (!responsible) {
      return { error: 'Den ansvarlige bruger blev ikke fundet i din organisation' }
    }
  }

  try {
    const caseRecord = await prisma.case.create({
      data: {
        organizationId: session.user.organizationId,
        title: data.title,
        caseType: data.caseType,
        caseSubtype: data.caseSubtype ?? null,
        status: 'NY',
        sensitivity: data.sensitivity,
        description: data.description ?? null,
        responsibleId: data.responsibleId ?? null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        createdBy: session.user.id,
        // Opret junction-records
        caseCompanies: {
          create: data.companyIds.map((companyId) => ({
            organizationId: session.user.organizationId,
            companyId,
            createdBy: session.user.id,
          })),
        },
        caseContracts: {
          create: data.contractIds.map((contractId) => ({
            organizationId: session.user.organizationId,
            contractId,
            createdBy: session.user.id,
          })),
        },
        casePersons: {
          create: data.personIds.map(({ personId, role }) => ({
            organizationId: session.user.organizationId,
            personId,
            role: role ?? null,
            createdBy: session.user.id,
          })),
        },
      },
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'CREATE',
        resourceType: 'case',
        resourceId: caseRecord.id,
        sensitivity: data.sensitivity,
      },
    })

    revalidatePath('/cases')
    return { data: caseRecord }
  } catch (error) {
    console.error('createCase error:', error)
    return { error: 'Sagen kunne ikke oprettes — prøv igen eller kontakt support' }
  }
}

// ==================== HENT SAG ====================

export async function getCase(
  input: z.infer<typeof getCaseSchema>
): Promise<ActionResult<CaseWithRelations>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = getCaseSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt sags-ID' }

  const { caseId } = parsed.data

  const accessResult = await verifyCaseAccess(
    caseId,
    session.user.id,
    session.user.organizationId
  )
  if (!accessResult.ok) return { error: accessResult.error }

  try {
    const caseRecord = await prisma.case.findUnique({
      where: {
        id: caseId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
      include: {
        caseCompanies: {
          include: { company: true },
        },
        caseContracts: {
          include: {
            contract: {
              include: { company: true },
            },
          },
        },
        casePersons: {
          include: { person: true },
        },
        tasks: {
          where: { deletedAt: null },
          include: {
            assignee: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        deadlines: {
          where: { deletedAt: null },
          orderBy: { dueDate: 'asc' },
        },
        documents: {
          where: { deletedAt: null },
          orderBy: { uploadedAt: 'desc' },
        },
        _count: {
          select: {
            tasks: true,
            deadlines: true,
            documents: true,
            timeEntries: true,
            caseCompanies: true,
            caseContracts: true,
            casePersons: true,
          },
        },
      },
    })

    if (!caseRecord) return { error: 'Sagen blev ikke fundet' }

    // Audit log for FORTROLIG+ (DEC-017)
    const sensitivelevels: SensitivityLevel[] = ['FORTROLIG', 'STRENGT_FORTROLIG']
    if (sensitivelevels.includes(caseRecord.sensitivity)) {
      await prisma.auditLog.create({
        data: {
          organizationId: session.user.organizationId,
          userId: session.user.id,
          action: 'VIEW',
          resourceType: 'case',
          resourceId: caseRecord.id,
          sensitivity: caseRecord.sensitivity,
        },
      })
    }

    return { data: caseRecord as CaseWithRelations }
  } catch (error) {
    console.error('getCase error:', error)
    return { error: 'Sagen kunne ikke hentes — prøv igen' }
  }
}

// ==================== LIST SAGER ====================

export async function listCases(
  input: z.infer<typeof listCasesSchema> = {
    page: 1,
    pageSize: 25,
    sortBy: 'updatedAt',
    sortDir: 'desc',
    includeCompleted: false,
  } as z.infer<typeof listCasesSchema>
): Promise<ActionResult<{ cases: CaseWithCounts[]; total: number }>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = listCasesSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt filter-input' }

  const {
    status,
    caseType,
    sensitivity,
    responsibleId,
    companyId,
    search,
    page,
    pageSize,
    sortBy,
    sortDir,
  } = parsed.data

  // Bestem tilgængelige sensitivity-niveauer for brugeren
  const allLevels: SensitivityLevel[] = ['PUBLIC', 'STANDARD', 'INTERN', 'FORTROLIG', 'STRENGT_FORTROLIG']
  const accessibleLevels: SensitivityLevel[] = []
  for (const level of allLevels) {
    const hasAccess = await canAccessSensitivity(session.user.id, level)
    if (hasAccess) accessibleLevels.push(level)
  }

  // Byg where-clause — typesikkert
  const where: Prisma.CaseWhereInput = {
    organizationId: session.user.organizationId,
    deletedAt: null,
    ...(status && { status }),
    ...(caseType && { caseType }),
    ...(responsibleId && { responsibleId }),
  }

  // Sensitivity filter
  if (sensitivity) {
    if (!accessibleLevels.includes(sensitivity)) {
      return { error: 'Du har ikke adgang til dette sensitivitetsniveau' }
    }
    where.sensitivity = sensitivity
  } else {
    where.sensitivity = { in: accessibleLevels }
  }

  // Selskabsfilter via junction-tabel
  if (companyId) {
    const hasAccess = await canAccessCompany(session.user.id, companyId)
    if (!hasAccess) return { error: 'Du har ikke adgang til dette selskab' }

    where.caseCompanies = {
      some: {
        companyId,
        organizationId: session.user.organizationId,
      },
    }
  }

  // Søgning
  if (search && search.trim()) {
    where.OR = [
      { title: { contains: search.trim(), mode: 'insensitive' } },
      { description: { contains: search.trim(), mode: 'insensitive' } },
    ]
  }

  const skip = (page - 1) * pageSize

  // Sortering
  const orderBy: Prisma.CaseOrderByWithRelationInput = {
    [sortBy]: sortDir,
  }

  try {
    const [cases, total] = await Promise.all([
      prisma.case.findMany({
        where,
        include: {
          caseCompanies: {
            include: {
              company: {
                select: { id: true, name: true },
              },
            },
          },
          _count: {
            select: {
              tasks: true,
              deadlines: true,
              documents: true,
              caseCompanies: true,
              caseContracts: true,
              casePersons: true,
            },
          },
        },
        orderBy,
        take: pageSize,
        skip,
      }),
      prisma.case.count({ where }),
    ])

    return { data: { cases: cases as CaseWithCounts[], total } }
  } catch (error) {
    console.error('listCases error:', error)
    return { error: 'Sager kunne ikke hentes — prøv igen' }
  }
}

// ==================== OPDATER SAG ====================

export async function updateCase(
  input: z.infer<typeof updateCaseSchema>
): Promise<ActionResult<Case>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = updateCaseSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { error: firstError?.message ?? 'Ugyldigt input' }
  }

  const { caseId, ...updateData } = parsed.data

  const accessResult = await verifyCaseAccess(
    caseId,
    session.user.id,
    session.user.organizationId
  )
  if (!accessResult.ok) return { error: accessResult.error }

  // Sensitivity-tjek ved ændring
  if (updateData.sensitivity !== undefined && updateData.sensitivity !== null) {
    const hasSensitivityAccess = await canAccessSensitivity(
      session.user.id,
      updateData.sensitivity
    )
    if (!hasSensitivityAccess) {
      return { error: 'Du har ikke adgang til det valgte sensitivitetsniveau' }
    }
  }

  // Validér responsible_id
  if (updateData.responsibleId) {
    const responsible = await prisma.user.findUnique({
      where: {
        id: updateData.responsibleId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    })
    if (!responsible) {
      return { error: 'Den ansvarlige bruger blev ikke fundet i din organisation' }
    }
  }

  try {
    const existing = await prisma.case.findUnique({
      where: {
        id: caseId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    })
    if (!existing) return { error: 'Sagen blev ikke fundet' }

    // Byg changes til audit log (DEC-017)
    const changes: Record<string, { old: unknown; new: unknown }> = {}
    for (const [key, value] of Object.entries(updateData)) {
      if (value !== undefined) {
        const existingValue = (existing as Record<string, unknown>)[key]
        if (value !== existingValue) {
          changes[key] = { old: existingValue, new: value }
        }
      }
    }

    const updated = await prisma.case.update({
      where: {
        id: caseId,
        organizationId: session.user.organizationId,
      },
      data: {
        title: updateData.title,
        caseType: updateData.caseType ?? undefined,
        caseSubtype:
          updateData.caseSubtype !== undefined ? updateData.caseSubtype : undefined,
        sensitivity: updateData.sensitivity ?? undefined,
        description:
          updateData.description !== undefined ? updateData.description || null : undefined,
        responsibleId:
          updateData.responsibleId !== undefined
            ? updateData.responsibleId || null
            : undefined,
        dueDate:
          updateData.dueDate !== undefined
            ? updateData.dueDate
              ? new Date(updateData.dueDate)
              : null
            : undefined,
      },
    })

    // Audit log
    const sensitiveLevels: SensitivityLevel[] = ['FORTROLIG', 'STRENGT_FORTROLIG']
    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'UPDATE',
        resourceType: 'case',
        resourceId: caseId,
        sensitivity: updated.sensitivity,
        changes:
          sensitiveLevels.includes(existing.sensitivity) && Object.keys(changes).length > 0
            ? (JSON.parse(JSON.stringify(changes)) as any)
            : undefined,
      },
    })

    revalidatePath(`/cases/${caseId}`)
    revalidatePath('/cases')
    return { data: updated }
  } catch (error) {
    console.error('updateCase error:', error)
    return { error: 'Sagen kunne ikke opdateres — prøv igen eller kontakt support' }
  }
}

// ==================== STATUS-FLOW ====================

export async function updateCaseStatus(
  input: z.infer<typeof updateCaseStatusSchema>
): Promise<ActionResult<Case>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = updateCaseStatusSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { error: firstError?.message ?? 'Ugyldigt input' }
  }

  const { caseId, newStatus, note } = parsed.data

  const accessResult = await verifyCaseAccess(
    caseId,
    session.user.id,
    session.user.organizationId
  )
  if (!accessResult.ok) return { error: accessResult.error }

  try {
    const existing = await prisma.case.findUnique({
      where: {
        id: caseId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    })
    if (!existing) return { error: 'Sagen blev ikke fundet' }

    // Validér status-transition jf. spec
    // NY → AKTIV → AFVENTER_EKSTERN | AFVENTER_KLIENT → LUKKET | ARKIVERET
    if (!isValidCaseStatusTransition(existing.status, newStatus)) {
      const validNext = VALID_CASE_STATUS_TRANSITIONS[existing.status]
      const validNextStr =
        validNext.length > 0
          ? validNext.join(', ')
          : 'ingen (sagen er i sin endelige status)'
      return {
        error: `Ugyldig statusændring: ${existing.status} → ${newStatus} er ikke tilladt. Gyldige næste statusser: ${validNextStr}`,
      }
    }

    const closedAt =
      newStatus === 'LUKKET' || newStatus === 'ARKIVERET' ? new Date() : null

    const updated = await prisma.case.update({
      where: {
        id: caseId,
        organizationId: session.user.organizationId,
      },
      data: {
        status: newStatus,
        ...(closedAt && !existing.closedAt ? { closedAt } : {}),
      },
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'UPDATE',
        resourceType: 'case',
        resourceId: caseId,
        sensitivity: updated.sensitivity,
        changes: {
          status: { old: existing.status, new: newStatus },
          ...(note ? { note: { old: null, new: note } } : {}),
        },
      },
    })

    revalidatePath(`/cases/${caseId}`)
    revalidatePath('/cases')
    return { data: updated }
  } catch (error) {
    console.error('updateCaseStatus error:', error)
    return { error: 'Status kunne ikke opdateres — prøv igen eller kontakt support' }
  }
}

// ==================== SLET SAG ====================

export async function deleteCase(
  input: z.infer<typeof deleteCaseSchema>
): Promise<ActionResult<{ id: string }>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = deleteCaseSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt sags-ID' }

  const { caseId } = parsed.data

  const accessResult = await verifyCaseAccess(
    caseId,
    session.user.id,
    session.user.organizationId
  )
  if (!accessResult.ok) return { error: accessResult.error }

  try {
    // Soft delete
    await prisma.case.update({
      where: {
        id: caseId,
        organizationId: session.user.organizationId,
      },
      data: { deletedAt: new Date() },
    })

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'DELETE',
        resourceType: 'case',
        resourceId: caseId,
        sensitivity: accessResult.case.sensitivity,
      },
    })

    revalidatePath('/cases')
    return { data: { id: caseId } }
  } catch (error) {
    console.error('deleteCase error:', error)
    return { error: 'Sagen kunne ikke slettes — prøv igen eller kontakt support' }
  }
}

// ==================== TILKNYTNINGER — SELSKABER ====================

export async function addCaseCompany(
  input: z.infer<typeof addCaseCompanySchema>
): Promise<ActionResult<CaseCompany>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = addCaseCompanySchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { error: firstError?.message ?? 'Ugyldigt input' }
  }

  const { caseId, companyId } = parsed.data

  const accessResult = await verifyCaseAccess(
    caseId,
    session.user.id,
    session.user.organizationId
  )
  if (!accessResult.ok) return { error: accessResult.error }

  // Tjek adgang til det nye selskab
  const hasCompanyAccess = await canAccessCompany(session.user.id, companyId)
  if (!hasCompanyAccess) {
    return { error: 'Du har ikke adgang til dette selskab' }
  }

  // Validér selskab tilhører organisationen
  const company = await prisma.company.findUnique({
    where: {
      id: companyId,
      organizationId: session.user.organizationId,
      deletedAt: null,
    },
  })
  if (!company) return { error: 'Selskabet blev ikke fundet i din organisation' }

  try {
    // Tjek at tilknytning ikke allerede eksisterer
    const existing = await prisma.caseCompany.findUnique({
      where: { caseId_companyId: { caseId, companyId } },
    })
    if (existing) return { error: 'Selskabet er allerede tilknyttet denne sag' }

    const caseCompany = await prisma.caseCompany.create({
      data: {
        organizationId: session.user.organizationId,
        caseId,
        companyId,
        createdBy: session.user.id,
      },
    })

    revalidatePath(`/cases/${caseId}`)
    return { data: caseCompany }
  } catch (error) {
    console.error('addCaseCompany error:', error)
    return { error: 'Selskabet kunne ikke tilknyttes — prøv igen' }
  }
}

export async function removeCaseCompany(
  input: z.infer<typeof removeCaseCompanySchema>
): Promise<ActionResult<{ caseId: string; companyId: string }>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = removeCaseCompanySchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  const { caseId, companyId } = parsed.data

  const accessResult = await verifyCaseAccess(
    caseId,
    session.user.id,
    session.user.organizationId
  )
  if (!accessResult.ok) return { error: accessResult.error }

  try {
    const existing = await prisma.caseCompany.findUnique({
      where: {
        caseId_companyId: { caseId, companyId },
      },
    })
    if (!existing) return { error: 'Selskabstilknytning ikke fundet' }
    if (existing.organizationId !== session.user.organizationId) {
      return { error: 'Du har ikke adgang til denne tilknytning' }
    }

    await prisma.caseCompany.delete({
      where: { caseId_companyId: { caseId, companyId } },
    })

    revalidatePath(`/cases/${caseId}`)
    return { data: { caseId, companyId } }
  } catch (error) {
    console.error('removeCaseCompany error:', error)
    return { error: 'Selskabstilknytning kunne ikke fjernes — prøv igen' }
  }
}

// ==================== TILKNYTNINGER — KONTRAKTER ====================

export async function addCaseContract(
  input: z.infer<typeof addCaseContractSchema>
): Promise<ActionResult<CaseContract>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = addCaseContractSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { error: firstError?.message ?? 'Ugyldigt input' }
  }

  const { caseId, contractId } = parsed.data

  const accessResult = await verifyCaseAccess(
    caseId,
    session.user.id,
    session.user.organizationId
  )
  if (!accessResult.ok) return { error: accessResult.error }

  // Validér kontrakt tilhører organisationen og tjek sensitivity + company-adgang
  const contract = await prisma.contract.findUnique({
    where: {
      id: contractId,
      organizationId: session.user.organizationId,
      deletedAt: null,
    },
  })
  if (!contract) return { error: 'Kontrakten blev ikke fundet i din organisation' }

  const hasCompanyAccess = await canAccessCompany(session.user.id, contract.companyId)
  if (!hasCompanyAccess) {
    return { error: 'Du har ikke adgang til det selskab, kontrakten tilhører' }
  }

  const hasSensitivityAccess = await canAccessSensitivity(session.user.id, contract.sensitivity)
  if (!hasSensitivityAccess) {
    return { error: 'Du har ikke adgang til kontraktens sensitivitetsniveau' }
  }

  try {
    const existing = await prisma.caseContract.findUnique({
      where: { caseId_contractId: { caseId, contractId } },
    })
    if (existing) return { error: 'Kontrakten er allerede tilknyttet denne sag' }

    const caseContract = await prisma.caseContract.create({
      data: {
        organizationId: session.user.organizationId,
        caseId,
        contractId,
        createdBy: session.user.id,
      },
    })

    revalidatePath(`/cases/${caseId}`)
    return { data: caseContract }
  } catch (error) {
    console.error('addCaseContract error:', error)
    return { error: 'Kontrakten kunne ikke tilknyttes — prøv igen' }
  }
}

export async function removeCaseContract(
  input: z.infer<typeof removeCaseContractSchema>
): Promise<ActionResult<{ caseId: string; contractId: string }>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = removeCaseContractSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  const { caseId, contractId } = parsed.data

  const accessResult = await verifyCaseAccess(
    caseId,
    session.user.id,
    session.user.organizationId
  )
  if (!accessResult.ok) return { error: accessResult.error }

  try {
    const existing = await prisma.caseContract.findUnique({
      where: {
        caseId_contractId: { caseId, contractId },
      },
    })
    if (!existing) return { error: 'Kontrakttilknytning ikke fundet' }
    if (existing.organizationId !== session.user.organizationId) {
      return { error: 'Du har ikke adgang til denne tilknytning' }
    }

    await prisma.caseContract.delete({
      where: { caseId_contractId: { caseId, contractId } },
    })

    revalidatePath(`/cases/${caseId}`)
    return { data: { caseId, contractId } }
  } catch (error) {
    console.error('removeCaseContract error:', error)
    return { error: 'Kontrakttilknytning kunne ikke fjernes — prøv igen' }
  }
}

// ==================== TILKNYTNINGER — PERSONER ====================

export async function addCasePerson(
  input: z.infer<typeof addCasePersonSchema>
): Promise<ActionResult<CasePerson>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = addCasePersonSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { error: firstError?.message ?? 'Ugyldigt input' }
  }

  const { caseId, personId, role } = parsed.data

  const accessResult = await verifyCaseAccess(
    caseId,
    session.user.id,
    session.user.organizationId
  )
  if (!accessResult.ok) return { error: accessResult.error }

  // Validér person tilhører organisationen
  const person = await prisma.person.findUnique({
    where: {
      id: personId,
      organizationId: session.user.organizationId,
      deletedAt: null,
    },
  })
  if (!person) return { error: 'Personen blev ikke fundet i din organisation' }

  try {
    const existing = await prisma.casePerson.findUnique({
      where: { caseId_personId: { caseId, personId } },
    })
    if (existing) return { error: 'Personen er allerede tilknyttet denne sag' }

    const casePerson = await prisma.casePerson.create({
      data: {
        organizationId: session.user.organizationId,
        caseId,
        personId,
        role: role ?? null,
        createdBy: session.user.id,
      },
    })

    revalidatePath(`/cases/${caseId}`)
    return { data: casePerson }
  } catch (error) {
    console.error('addCasePerson error:', error)
    return { error: 'Personen kunne ikke tilknyttes — prøv igen' }
  }
}

export async function removeCasePerson(
  input: z.infer<typeof removeCasePersonSchema>
): Promise<ActionResult<{ caseId: string; personId: string }>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = removeCasePersonSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  const { caseId, personId } = parsed.data

  const accessResult = await verifyCaseAccess(
    caseId,
    session.user.id,
    session.user.organizationId
  )
  if (!accessResult.ok) return { error: accessResult.error }

  try {
    const existing = await prisma.casePerson.findUnique({
      where: { caseId_personId: { caseId, personId } },
    })
    if (!existing) return { error: 'Persontilknytning ikke fundet' }
    if (existing.organizationId !== session.user.organizationId) {
      return { error: 'Du har ikke adgang til denne tilknytning' }
    }

    await prisma.casePerson.delete({
      where: { caseId_personId: { caseId, personId } },
    })

    revalidatePath(`/cases/${caseId}`)
    return { data: { caseId, personId } }
  } catch (error) {
    console.error('removeCasePerson error:', error)
    return { error: 'Persontilknytning kunne ikke fjernes — prøv igen' }
  }
}

export async function updateCasePersonRole(
  input: z.infer<typeof updateCasePersonRoleSchema>
): Promise<ActionResult<CasePerson>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = updateCasePersonRoleSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  const { caseId, personId, role } = parsed.data

  const accessResult = await verifyCaseAccess(
    caseId,
    session.user.id,
    session.user.organizationId
  )
  if (!accessResult.ok) return { error: accessResult.error }

  try {
    const existing = await prisma.casePerson.findUnique({
      where: { caseId_personId: { caseId, personId } },
    })
    if (!existing) return { error: 'Persontilknytning ikke fundet' }
    if (existing.organizationId !== session.user.organizationId) {
      return { error: 'Du har ikke adgang til denne tilknytning' }
    }

    const updated = await prisma.casePerson.update({
      where: { caseId_personId: { caseId, personId } },
      data: { role: role ?? null },
    })

    revalidatePath(`/cases/${caseId}`)
    return { data: updated }
  } catch (error) {
    console.error('updateCasePersonRole error:', error)
    return { error: 'Personens rolle kunne ikke opdateres — prøv igen' }
  }
}

// ==================== OPGAVER ====================

export async function createTask(
  input: z.infer<typeof createTaskSchema>
): Promise<ActionResult<Task>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = createTaskSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { error: firstError?.message ?? 'Ugyldigt input' }
  }

  const { caseId, title, description, assignedTo, dueDate } = parsed.data

  const accessResult = await verifyCaseAccess(
    caseId,
    session.user.id,
    session.user.organizationId
  )
  if (!accessResult.ok) return { error: accessResult.error }

  // Validér assigned_to tilhører organisationen
  if (assignedTo) {
    const assignee = await prisma.user.findUnique({
      where: {
        id: assignedTo,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    })
    if (!assignee) return { error: 'Den tildelte bruger blev ikke fundet i din organisation' }
  }

  try {
    const task = await prisma.task.create({
      data: {
        organizationId: session.user.organizationId,
        caseId,
        title,
        description: description ?? null,
        status: 'NY',
        assignedTo: assignedTo ?? null,
        dueDate: dueDate ? new Date(dueDate) : null,
        createdBy: session.user.id,
      },
    })

    revalidatePath(`/cases/${caseId}`)
    return { data: task }
  } catch (error) {
    console.error('createTask error:', error)
    return { error: 'Opgaven kunne ikke oprettes — prøv igen eller kontakt support' }
  }
}

export async function updateTask(
  input: z.infer<typeof updateTaskSchema>
): Promise<ActionResult<Task>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = updateTaskSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { error: firstError?.message ?? 'Ugyldigt input' }
  }

  const { taskId, caseId, ...updateData } = parsed.data

  const accessResult = await verifyCaseAccess(
    caseId,
    session.user.id,
    session.user.organizationId
  )
  if (!accessResult.ok) return { error: accessResult.error }

  // Validér assigned_to
  if (updateData.assignedTo) {
    const assignee = await prisma.user.findUnique({
      where: {
        id: updateData.assignedTo,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    })
    if (!assignee) return { error: 'Den tildelte bruger blev ikke fundet i din organisation' }
  }

  try {
    const existing = await prisma.task.findFirst({
      where: {
        id: taskId,
        caseId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    })
    if (!existing) return { error: 'Opgaven blev ikke fundet' }

    const updated = await prisma.task.update({
      where: { id: taskId },
      data: {
        title: updateData.title,
        description:
          updateData.description !== undefined ? updateData.description || null : undefined,
        status: updateData.status ?? undefined,
        assignedTo:
          updateData.assignedTo !== undefined ? updateData.assignedTo || null : undefined,
        dueDate:
          updateData.dueDate !== undefined
            ? updateData.dueDate
              ? new Date(updateData.dueDate)
              : null
            : undefined,
      },
    })

    revalidatePath(`/cases/${caseId}`)
    return { data: updated }
  } catch (error) {
    console.error('updateTask error:', error)
    return { error: 'Opgaven kunne ikke opdateres — prøv igen' }
  }
}

export async function deleteTask(
  input: z.infer<typeof deleteTaskSchema>
): Promise<ActionResult<{ id: string }>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = deleteTaskSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  const { taskId, caseId } = parsed.data

  const accessResult = await verifyCaseAccess(
    caseId,
    session.user.id,
    session.user.organizationId
  )
  if (!accessResult.ok) return { error: accessResult.error }

  try {
    const existing = await prisma.task.findFirst({
      where: {
        id: taskId,
        caseId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    })
    if (!existing) return { error: 'Opgaven blev ikke fundet' }

    // Soft delete
    await prisma.task.update({
      where: { id: taskId },
      data: { deletedAt: new Date() },
    })

    revalidatePath(`/cases/${caseId}`)
    return { data: { id: taskId } }
  } catch (error) {
    console.error('deleteTask error:', error)
    return { error: 'Opgaven kunne ikke slettes — prøv igen' }
  }
}

export async function listTasks(
  input: z.infer<typeof listTasksSchema>
): Promise<ActionResult<TaskWithAssignee[]>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = listTasksSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  const { caseId, status, assignedTo } = parsed.data

  const accessResult = await verifyCaseAccess(
    caseId,
    session.user.id,
    session.user.organizationId
  )
  if (!accessResult.ok) return { error: accessResult.error }

  try {
    const tasks = await prisma.task.findMany({
      where: {
        caseId,
        organizationId: session.user.organizationId,
        deletedAt: null,
        ...(status && { status }),
        ...(assignedTo && { assignedTo }),
      },
      include: {
        assignee: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
    })

    return { data: tasks as TaskWithAssignee[] }
  } catch (error) {
    console.error('listTasks error:', error)
    return { error: 'Opgaver kunne ikke hentes — prøv igen' }
  }
}

// ==================== FRISTER ====================

export async function createDeadline(
  input: z.infer<typeof createDeadlineSchema>
): Promise<ActionResult<Deadline>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = createDeadlineSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { error: firstError?.message ?? 'Ugyldigt input' }
  }

  const { caseId, title, dueDate, priority, assignedTo, note, adviseDaysBefore } = parsed.data

  const accessResult = await verifyCaseAccess(
    caseId,
    session.user.id,
    session.user.organizationId
  )
  if (!accessResult.ok) return { error: accessResult.error }

  // Validér assignedTo
  if (assignedTo) {
    const assignee = await prisma.user.findUnique({
      where: {
        id: assignedTo,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    })
    if (!assignee) return { error: 'Den ansvarlige bruger blev ikke fundet i din organisation' }
  }

  try {
    const deadline = await prisma.deadline.create({
      data: {
        organizationId: session.user.organizationId,
        caseId,
        title,
        dueDate: new Date(dueDate),
        priority,
        assignedTo: assignedTo ?? null,
        note: note ?? null,
        adviseDaysBefore,
        createdBy: session.user.id,
      },
    })

    revalidatePath(`/cases/${caseId}`)
    return { data: deadline }
  } catch (error) {
    console.error('createDeadline error:', error)
    return { error: 'Fristen kunne ikke oprettes — prøv igen eller kontakt support' }
  }
}

export async function updateDeadline(
  input: z.infer<typeof updateDeadlineSchema>
): Promise<ActionResult<Deadline>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = updateDeadlineSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { error: firstError?.message ?? 'Ugyldigt input' }
  }

  const { deadlineId, caseId, ...updateData } = parsed.data

  const accessResult = await verifyCaseAccess(
    caseId,
    session.user.id,
    session.user.organizationId
  )
  if (!accessResult.ok) return { error: accessResult.error }

  // Validér assignedTo
  if (updateData.assignedTo) {
    const assignee = await prisma.user.findUnique({
      where: {
        id: updateData.assignedTo,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    })
    if (!assignee) return { error: 'Den ansvarlige bruger blev ikke fundet i din organisation' }
  }

  try {
    const existing = await prisma.deadline.findFirst({
      where: {
        id: deadlineId,
        caseId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    })
    if (!existing) return { error: 'Fristen blev ikke fundet' }

    const updated = await prisma.deadline.update({
      where: { id: deadlineId },
      data: {
        title: updateData.title,
        dueDate: updateData.dueDate ? new Date(updateData.dueDate) : undefined,
        priority: updateData.priority ?? undefined,
        assignedTo:
          updateData.assignedTo !== undefined ? updateData.assignedTo || null : undefined,
        note:
          updateData.note !== undefined ? updateData.note || null : undefined,
        adviseDaysBefore: updateData.adviseDaysBefore ?? undefined,
        completedAt:
          updateData.completedAt !== undefined
            ? updateData.completedAt
              ? new Date(updateData.completedAt)
              : null
            : undefined,
      },
    })

    revalidatePath(`/cases/${caseId}`)
    return { data: updated }
  } catch (error) {
    console.error('updateDeadline error:', error)
    return { error: 'Fristen kunne ikke opdateres — prøv igen' }
  }
}

export async function deleteDeadline(
  input: z.infer<typeof deleteDeadlineSchema>
): Promise<ActionResult<{ id: string }>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = deleteDeadlineSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  const { deadlineId, caseId } = parsed.data

  const accessResult = await verifyCaseAccess(
    caseId,
    session.user.id,
    session.user.organizationId
  )
  if (!accessResult.ok) return { error: accessResult.error }

  try {
    const existing = await prisma.deadline.findFirst({
      where: {
        id: deadlineId,
        caseId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    })
    if (!existing) return { error: 'Fristen blev ikke fundet' }

    // Soft delete
    await prisma.deadline.update({
      where: { id: deadlineId },
      data: { deletedAt: new Date() },
    })

    revalidatePath(`/cases/${caseId}`)
    return { data: { id: deadlineId } }
  } catch (error) {
    console.error('deleteDeadline error:', error)
    return { error: 'Fristen kunne ikke slettes — prøv igen' }
  }
}

export async function listDeadlines(
  input: z.infer<typeof listDeadlinesSchema>
): Promise<ActionResult<Deadline[]>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = listDeadlinesSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  const { caseId, includeCompleted } = parsed.data

  const accessResult = await verifyCaseAccess(
    caseId,
    session.user.id,
    session.user.organizationId
  )
  if (!accessResult.ok) return { error: accessResult.error }

  try {
    const deadlines = await prisma.deadline.findMany({
      where: {
        caseId,
        organizationId: session.user.organizationId,
        deletedAt: null,
        ...(!includeCompleted ? { completedAt: null } : {}),
      },
      orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }],
    })

    return { data: deadlines }
  } catch (error) {
    console.error('listDeadlines error:', error)
    return { error: 'Frister kunne ikke hentes — prøv igen' }
  }
}

// ==================== TIDSREGISTRERING ====================

export async function createTimeEntry(
  input: z.infer<typeof createTimeEntrySchema>
): Promise<ActionResult<TimeEntry>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = createTimeEntrySchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { error: firstError?.message ?? 'Ugyldigt input' }
  }

  const { caseId, description, minutes, date, billable, hourlyRate } = parsed.data

  const accessResult = await verifyCaseAccess(
    caseId,
    session.user.id,
    session.user.organizationId
  )
  if (!accessResult.ok) return { error: accessResult.error }

  try {
    const timeEntry = await prisma.timeEntry.create({
      data: {
        organizationId: session.user.organizationId,
        caseId,
        userId: session.user.id,
        description: description ?? null,
        minutes,
        date: new Date(date),
        billable,
        hourlyRate: hourlyRate ?? null,
      },
    })

    revalidatePath(`/cases/${caseId}`)
    return { data: timeEntry }
  } catch (error) {
    console.error('createTimeEntry error:', error)
    return { error: 'Tidsregistrering kunne ikke gemmes — prøv igen' }
  }
}

export async function listTimeEntries(
  input: z.infer<typeof listTimeEntriesSchema>
): Promise<ActionResult<{ entries: TimeEntry[]; totalMinutes: number; total: number }>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = listTimeEntriesSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  const { caseId, page, pageSize } = parsed.data

  const accessResult = await verifyCaseAccess(
    caseId,
    session.user.id,
    session.user.organizationId
  )
  if (!accessResult.ok) return { error: accessResult.error }

  const skip = (page - 1) * pageSize

  try {
    const [entries, total, aggregate] = await Promise.all([
      prisma.timeEntry.findMany({
        where: {
          caseId,
          organizationId: session.user.organizationId,
        },
        orderBy: { date: 'desc' },
        take: pageSize,
        skip,
      }),
      prisma.timeEntry.count({
        where: {
          caseId,
          organizationId: session.user.organizationId,
        },
      }),
      prisma.timeEntry.aggregate({
        where: {
          caseId,
          organizationId: session.user.organizationId,
        },
        _sum: { minutes: true },
      }),
    ])

    return {
      data: {
        entries,
        totalMinutes: aggregate._sum.minutes ?? 0,
        total,
      },
    }
  } catch (error) {
    console.error('listTimeEntries error:', error)
    return { error: 'Tidsregistreringer kunne ikke hentes — prøv igen' }
  }
}

// ==================== EMAIL SYNC ====================

export async function getCaseEmailSyncStatus(
  input: z.infer<typeof getCaseSchema>
): Promise<ActionResult<ReturnType<typeof getEmailSyncStatus>>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const parsed = getCaseSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt sags-ID' }

  const { caseId } = parsed.data

  const accessResult = await verifyCaseAccess(
    caseId,
    session.user.id,
    session.user.organizationId
  )
  if (!accessResult.ok) return { error: accessResult.error }

  return { data: getEmailSyncStatus(caseId) }
}