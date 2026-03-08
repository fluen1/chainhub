'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canAccessCompany, canAccessSensitivity, canAccessModule } from '@/lib/permissions'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import {
  confirmDocumentUploadSchema,
  listDocumentsSchema,
  getDocumentSchema,
  updateDocumentSchema,
  deleteDocumentSchema,
  requestDocumentUploadUrlSchema,
  getDownloadUrlSchema,
} from '@/lib/validations/document'
import {
  isStorageConfigured,
  getStorageConfigurationGuide,
  generateStoragePath,
  getSignedUploadUrl,
  getSignedDownloadUrl,
} from '@/lib/storage'
import type { ActionResult, DocumentWithRelations, DocumentListResult, DocumentUploadUrlResponse } from '@/types/document'
import type { Document, SensitivityLevel } from '@prisma/client'

// ==================== REQUEST UPLOAD URL ====================

export async function requestDocumentUploadUrl(
  input: z.infer<typeof requestDocumentUploadUrlSchema>
): Promise<ActionResult<DocumentUploadUrlResponse>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  // Moduladgang
  const hasModuleAccess = await canAccessModule(session.user.id, 'documents')
  if (!hasModuleAccess) return { error: 'Du har ikke adgang til dokumentmodulet' }

  const parsed = requestDocumentUploadUrlSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { error: firstError?.message ?? 'Ugyldigt input' }
  }

  const { fileName, fileType, fileSizeBytes, companyId, caseId } = parsed.data

  // Mock-tilstand hvis R2 ikke er konfigureret
  if (!isStorageConfigured()) {
    return {
      error: `Fil-upload er ikke tilgængeligt. ${getStorageConfigurationGuide()}`,
    }
  }

  // Valider tilknytning — mindst et af companyId/caseId skal angives
  if (!companyId && !caseId) {
    return { error: 'Dokumentet skal tilknyttes et selskab eller en sag' }
  }

  // Tjek adgang til selskab
  if (companyId) {
    const hasAccess = await canAccessCompany(session.user.id, companyId)
    if (!hasAccess) return { error: 'Du har ikke adgang til dette selskab' }
  }

  // Tjek at sag tilhører organisationen
  if (caseId) {
    const caseRecord = await prisma.case.findUnique({
      where: {
        id: caseId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    })
    if (!caseRecord) return { error: 'Sagen blev ikke fundet' }
  }

  try {
    const resourceId = companyId ?? caseId ?? 'general'
    const fileKey = generateStoragePath(
      session.user.organizationId,
      'documents',
      resourceId,
      fileName
    )

    const { uploadUrl, fileUrl } = await getSignedUploadUrl(fileKey, fileType)

    return { data: { uploadUrl, fileKey, fileUrl } }
  } catch (error) {
    console.error('requestDocumentUploadUrl error:', error)
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: 'Upload-URL kunne ikke genereres — prøv igen' }
  }
}

// ==================== BEKRÆFT UPLOAD ====================

export async function confirmDocumentUpload(
  input: z.infer<typeof confirmDocumentUploadSchema>
): Promise<ActionResult<Document>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const hasModuleAccess = await canAccessModule(session.user.id, 'documents')
  if (!hasModuleAccess) return { error: 'Du har ikke adgang til dokumentmodulet' }

  const parsed = confirmDocumentUploadSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { error: firstError?.message ?? 'Ugyldigt input' }
  }

  const {
    title,
    fileKey,
    fileName,
    fileType,
    fileSizeBytes,
    companyId,
    caseId,
    sensitivity,
    folderPath,
    description,
  } = parsed.data

  if (!companyId && !caseId) {
    return { error: 'Dokumentet skal tilknyttes et selskab eller en sag' }
  }

  // Sensitivity-adgangstjek
  const hasSensitivityAccess = await canAccessSensitivity(session.user.id, sensitivity)
  if (!hasSensitivityAccess) {
    return { error: 'Du har ikke adgang til dette sensitivitetsniveau' }
  }

  // Tjek selskabsadgang
  if (companyId) {
    const hasAccess = await canAccessCompany(session.user.id, companyId)
    if (!hasAccess) return { error: 'Du har ikke adgang til dette selskab' }
  }

  // Tjek sagsadgang
  if (caseId) {
    const caseRecord = await prisma.case.findUnique({
      where: {
        id: caseId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    })
    if (!caseRecord) return { error: 'Sagen blev ikke fundet' }

    // Dokumentet arver sagens sensitivity hvis det er højere
    const sensitivityHierarchy: SensitivityLevel[] = [
      'PUBLIC',
      'STANDARD',
      'INTERN',
      'FORTROLIG',
      'STRENGT_FORTROLIG',
    ]
    const caseSensIdx = sensitivityHierarchy.indexOf(caseRecord.sensitivity)
    const docSensIdx = sensitivityHierarchy.indexOf(sensitivity)
    if (caseSensIdx > docSensIdx) {
      // Dokumentet skal mindst have sagens sensitivity
      const inheritedSensitivity = caseRecord.sensitivity
      const canAccessInherited = await canAccessSensitivity(session.user.id, inheritedSensitivity)
      if (!canAccessInherited) {
        return {
          error: `Du har ikke adgang til dette sensitivitetsniveau. Sagen er markeret som ${caseRecord.sensitivity}`,
        }
      }
    }
  }

  try {
    // Afgør effektiv sensitivity (arv fra sag/selskab — højeste vinder)
    let effectiveSensitivity = sensitivity

    if (caseId) {
      const caseRecord = await prisma.case.findUnique({
        where: { id: caseId },
        select: { sensitivity: true },
      })
      if (caseRecord) {
        const sensitivityHierarchy: SensitivityLevel[] = [
          'PUBLIC', 'STANDARD', 'INTERN', 'FORTROLIG', 'STRENGT_FORTROLIG',
        ]
        const caseIdx = sensitivityHierarchy.indexOf(caseRecord.sensitivity)
        const docIdx = sensitivityHierarchy.indexOf(sensitivity)
        if (caseIdx > docIdx) {
          effectiveSensitivity = caseRecord.sensitivity
        }
      }
    }

    const fileUrl = fileKey.startsWith('http') ? fileKey : `r2://${fileKey}`

    const document = await prisma.document.create({
      data: {
        organizationId: session.user.organizationId,
        companyId: companyId ?? null,
        caseId: caseId ?? null,
        title,
        fileUrl,
        fileName,
        fileSizeBytes,
        fileType,
        sensitivity: effectiveSensitivity,
        folderPath: folderPath ?? null,
        description: description ?? null,
        uploadedBy: session.user.id,
      },
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'CREATE',
        resourceType: 'document',
        resourceId: document.id,
        sensitivity: effectiveSensitivity,
      },
    })

    if (companyId) revalidatePath(`/companies/${companyId}`)
    if (caseId) revalidatePath(`/cases/${caseId}`)
    revalidatePath('/documents')

    return { data: document }
  } catch (error) {
    console.error('confirmDocumentUpload error:', error)
    return { error: 'Dokumentet kunne ikke gemmes — prøv igen eller kontakt support' }
  }
}

// ==================== LIST DOKUMENTER ====================

export async function listDocuments(
  input: z.infer<typeof listDocumentsSchema> = {}
): Promise<ActionResult<DocumentListResult>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const hasModuleAccess = await canAccessModule(session.user.id, 'documents')
  if (!hasModuleAccess) return { error: 'Du har ikke adgang til dokumentmodulet' }

  const parsed = listDocumentsSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt filter-input' }

  const { companyId, caseId, sensitivity, fileType, search, folderPath, page, pageSize } =
    parsed.data

  // Tjek adgang til specifikt selskab
  if (companyId) {
    const hasAccess = await canAccessCompany(session.user.id, companyId)
    if (!hasAccess) return { error: 'Du har ikke adgang til dette selskab' }
  }

  // Bestem tilgængelige sensitivity-niveauer
  const allLevels: SensitivityLevel[] = [
    'PUBLIC', 'STANDARD', 'INTERN', 'FORTROLIG', 'STRENGT_FORTROLIG',
  ]
  const accessibleLevels: SensitivityLevel[] = []
  for (const level of allLevels) {
    const hasAccess = await canAccessSensitivity(session.user.id, level)
    if (hasAccess) accessibleLevels.push(level)
  }

  // Byg where-clause
  type WhereClause = {
    organizationId: string
    deletedAt: null
    companyId?: string
    caseId?: string
    fileType?: string
    folderPath?: string
    sensitivity?: { in: SensitivityLevel[] } | SensitivityLevel
    OR?: Array<{ title?: { contains: string; mode: 'insensitive' }; fileName?: { contains: string; mode: 'insensitive' }; description?: { contains: string; mode: 'insensitive' } }>
  }

  const where: WhereClause = {
    organizationId: session.user.organizationId,
    deletedAt: null,
    ...(companyId && { companyId }),
    ...(caseId && { caseId }),
    ...(fileType && { fileType }),
    ...(folderPath !== undefined && { folderPath }),
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

  // Søgning
  if (search?.trim()) {
    where.OR = [
      { title: { contains: search.trim(), mode: 'insensitive' } },
      { fileName: { contains: search.trim(), mode: 'insensitive' } },
      { description: { contains: search.trim(), mode: 'insensitive' } },
    ]
  }

  const skip = (page - 1) * pageSize

  try {
    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        include: {
          company: { select: { id: true, name: true } },
          case: { select: { id: true, title: true } },
        },
        orderBy: { uploadedAt: 'desc' },
        take: pageSize,
        skip,
      }),
      prisma.document.count({ where }),
    ])

    return {
      data: {
        documents: documents as DocumentWithRelations[],
        total,
        page,
        pageSize,
      },
    }
  } catch (error) {
    console.error('listDocuments error:', error)
    return { error: 'Dokumenter kunne ikke hentes — prøv igen' }
  }
}

// ==================== HENT DOKUMENT ====================

export async function getDocument(
  input: z.infer<typeof getDocumentSchema>
): Promise<ActionResult<DocumentWithRelations>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const hasModuleAccess = await canAccessModule(session.user.id, 'documents')
  if (!hasModuleAccess) return { error: 'Du har ikke adgang til dokumentmodulet' }

  const parsed = getDocumentSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt dokument-ID' }

  const { documentId } = parsed.data

  try {
    const doc = await prisma.document.findUnique({
      where: {
        id: documentId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
      include: {
        company: { select: { id: true, name: true } },
        case: { select: { id: true, title: true } },
      },
    })

    if (!doc) return { error: 'Dokumentet blev ikke fundet' }

    // Sensitivity-tjek ALTID inden returnering
    const hasSensitivityAccess = await canAccessSensitivity(session.user.id, doc.sensitivity)
    if (!hasSensitivityAccess) {
      return { error: 'Du har ikke adgang til dette dokument — sensitivitetsniveauet er for højt' }
    }

    // Selskabsadgang
    if (doc.companyId) {
      const hasAccess = await canAccessCompany(session.user.id, doc.companyId)
      if (!hasAccess) return { error: 'Du har ikke adgang til dette dokument' }
    }

    // Opdater last_viewed_at
    await prisma.document.update({
      where: { id: documentId },
      data: {
        lastViewedAt: new Date(),
        lastViewedBy: session.user.id,
      },
    })

    // Audit log — VIEW for FORTROLIG og STRENGT_FORTROLIG
    const auditLevels: SensitivityLevel[] = ['FORTROLIG', 'STRENGT_FORTROLIG']
    if (auditLevels.includes(doc.sensitivity)) {
      await prisma.auditLog.create({
        data: {
          organizationId: session.user.organizationId,
          userId: session.user.id,
          action: 'VIEW',
          resourceType: 'document',
          resourceId: doc.id,
          sensitivity: doc.sensitivity,
        },
      })
    }

    return { data: doc as DocumentWithRelations }
  } catch (error) {
    console.error('getDocument error:', error)
    return { error: 'Dokumentet kunne ikke hentes — prøv igen' }
  }
}

// ==================== DOWNLOAD URL ====================

export async function getDocumentDownloadUrl(
  input: z.infer<typeof getDownloadUrlSchema>
): Promise<ActionResult<{ url: string; fileName: string }>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const hasModuleAccess = await canAccessModule(session.user.id, 'documents')
  if (!hasModuleAccess) return { error: 'Du har ikke adgang til dokumentmodulet' }

  const parsed = getDownloadUrlSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt dokument-ID' }

  const { documentId } = parsed.data

  try {
    const doc = await prisma.document.findUnique({
      where: {
        id: documentId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    })

    if (!doc) return { error: 'Dokumentet blev ikke fundet' }

    // ALTID: canAccessSensitivity INDEN download returneres
    const hasSensitivityAccess = await canAccessSensitivity(session.user.id, doc.sensitivity)
    if (!hasSensitivityAccess) {
      return { error: 'Du har ikke adgang til at downloade dette dokument' }
    }

    // Selskabsadgang
    if (doc.companyId) {
      const hasAccess = await canAccessCompany(session.user.id, doc.companyId)
      if (!hasAccess) return { error: 'Du har ikke adgang til dette dokument' }
    }

    if (!isStorageConfigured()) {
      return { error: 'Download er ikke tilgængeligt — storage er ikke konfigureret' }
    }

    // Generer signeret download-URL
    const fileKey = doc.fileUrl.replace(/^r2:\/\//, '')
    const url = await getSignedDownloadUrl(fileKey)

    // Audit log — DOWNLOAD altid
    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'DOWNLOAD',
        resourceType: 'document',
        resourceId: doc.id,
        sensitivity: doc.sensitivity,
      },
    })

    return { data: { url, fileName: doc.fileName } }
  } catch (error) {
    console.error('getDocumentDownloadUrl error:', error)
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: 'Download-URL kunne ikke genereres — prøv igen' }
  }
}

// ==================== OPDATER DOKUMENT ====================

export async function updateDocument(
  input: z.infer<typeof updateDocumentSchema>
): Promise<ActionResult<Document>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const hasModuleAccess = await canAccessModule(session.user.id, 'documents')
  if (!hasModuleAccess) return { error: 'Du har ikke adgang til dokumentmodulet' }

  const parsed = updateDocumentSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { error: firstError?.message ?? 'Ugyldigt input' }
  }

  const { documentId, ...updateData } = parsed.data

  try {
    const existing = await prisma.document.findUnique({
      where: {
        id: documentId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    })

    if (!existing) return { error: 'Dokumentet blev ikke fundet' }

    // Sensitivity-tjek på eksisterende dokument
    const hasSensitivityAccess = await canAccessSensitivity(session.user.id, existing.sensitivity)
    if (!hasSensitivityAccess) {
      return { error: 'Du har ikke adgang til dette dokument' }
    }

    // Selskabsadgang
    if (existing.companyId) {
      const hasAccess = await canAccessCompany(session.user.id, existing.companyId)
      if (!hasAccess) return { error: 'Du har ikke adgang til dette dokument' }
    }

    // Tjek nyt sensitivity-niveau
    if (updateData.sensitivity) {
      const hasNewAccess = await canAccessSensitivity(session.user.id, updateData.sensitivity)
      if (!hasNewAccess) {
        return { error: 'Du har ikke adgang til det valgte sensitivitetsniveau' }
      }
    }

    // Tjek ny selskabsadgang
    if (updateData.companyId) {
      const hasNewCompanyAccess = await canAccessCompany(session.user.id, updateData.companyId)
      if (!hasNewCompanyAccess) {
        return { error: 'Du har ikke adgang til det valgte selskab' }
      }
    }

    const document = await prisma.document.update({
      where: {
        id: documentId,
        organizationId: session.user.organizationId,
      },
      data: {
        title: updateData.title ?? undefined,
        description: updateData.description !== undefined ? updateData.description : undefined,
        folderPath: updateData.folderPath !== undefined ? updateData.folderPath : undefined,
        sensitivity: updateData.sensitivity ?? undefined,
        companyId: updateData.companyId !== undefined ? updateData.companyId : undefined,
        caseId: updateData.caseId !== undefined ? updateData.caseId : undefined,
      },
    })

    // Audit log for sensitive dokumenter
    const auditLevels: SensitivityLevel[] = ['FORTROLIG', 'STRENGT_FORTROLIG']
    if (auditLevels.includes(existing.sensitivity)) {
      await prisma.auditLog.create({
        data: {
          organizationId: session.user.organizationId,
          userId: session.user.id,
          action: 'UPDATE',
          resourceType: 'document',
          resourceId: document.id,
          sensitivity: document.sensitivity,
        },
      })
    }

    if (existing.companyId) revalidatePath(`/companies/${existing.companyId}`)
    if (existing.caseId) revalidatePath(`/cases/${existing.caseId}`)
    revalidatePath('/documents')
    revalidatePath(`/documents/${documentId}`)

    return { data: document }
  } catch (error) {
    console.error('updateDocument error:', error)
    return { error: 'Dokumentet kunne ikke opdateres — prøv igen' }
  }
}

// ==================== SLET DOKUMENT ====================

export async function deleteDocument(
  input: z.infer<typeof deleteDocumentSchema>
): Promise<ActionResult<{ id: string }>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const hasModuleAccess = await canAccessModule(session.user.id, 'documents')
  if (!hasModuleAccess) return { error: 'Du har ikke adgang til dokumentmodulet' }

  const parsed = deleteDocumentSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt dokument-ID' }

  const { documentId } = parsed.data

  try {
    const existing = await prisma.document.findUnique({
      where: {
        id: documentId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    })

    if (!existing) return { error: 'Dokumentet blev ikke fundet' }

    // Sensitivity-tjek inden sletning
    const hasSensitivityAccess = await canAccessSensitivity(session.user.id, existing.sensitivity)
    if (!hasSensitivityAccess) {
      return { error: 'Du har ikke adgang til at slette dette dokument' }
    }

    // Selskabsadgang
    if (existing.companyId) {
      const hasAccess = await canAccessCompany(session.user.id, existing.companyId)
      if (!hasAccess) return { error: 'Du har ikke adgang til dette dokument' }
    }

    // Soft delete
    await prisma.document.update({
      where: {
        id: documentId,
        organizationId: session.user.organizationId,
      },
      data: { deletedAt: new Date() },
    })

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'DELETE',
        resourceType: 'document',
        resourceId: documentId,
        sensitivity: existing.sensitivity,
      },
    })

    if (existing.companyId) revalidatePath(`/companies/${existing.companyId}`)
    if (existing.caseId) revalidatePath(`/cases/${existing.caseId}`)
    revalidatePath('/documents')

    return { data: { id: documentId } }
  } catch (error) {
    console.error('deleteDocument error:', error)
    return { error: 'Dokumentet kunne ikke slettes — prøv igen' }
  }
}