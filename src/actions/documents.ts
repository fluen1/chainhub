'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import {
  canAccessCompany,
  canAccessSensitivity,
  canAccessModule,
  canEdit,
  getMaxSensitivityLevel,
  getAccessibleCompanies,
} from '@/lib/permissions'
import { revalidatePath } from 'next/cache'
import {
  createDocumentSchema,
  updateDocumentSchema,
  listDocumentsFilterSchema,
  requestUploadUrlSchema,
  CreateDocumentInput,
  UpdateDocumentInput,
  ListDocumentsFilter,
  RequestUploadUrlInput,
} from '@/lib/validations/document'
import {
  isStorageConfigured,
  generateStoragePath,
  getSignedUploadUrl,
  getSignedDownloadUrl,
  deleteFile,
} from '@/lib/storage'
import {
  ActionResult,
  DocumentWithRelations,
  UploadUrlResponse,
  DownloadUrlResponse,
} from '@/types/document'
import { Document, SensitivityLevel, Prisma } from '@prisma/client'

// ==================== UPLOAD URL ====================

export async function requestUploadUrl(
  input: RequestUploadUrlInput
): Promise<ActionResult<UploadUrlResponse>> {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.organizationId) {
    return { error: 'Ikke autoriseret' }
  }

  // Tjek om storage er konfigureret
  if (!isStorageConfigured) {
    return { error: 'Filstorage er ikke konfigureret. Kontakt administrator.' }
  }

  // Validér input
  const parsed = requestUploadUrlSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || 'Ugyldigt input' }
  }

  // Moduladgang
  const canAccess = await canAccessModule(session.user.id, 'documents')
  if (!canAccess) {
    return { error: 'Du har ikke adgang til dokumentmodulet' }
  }

  // Redigeringsrettighed
  const canEditData = await canEdit(session.user.id)
  if (!canEditData) {
    return { error: 'Du har ikke rettigheder til at uploade dokumenter' }
  }

  try {
    // Generér unik sti
    const entityId = parsed.data.entityId || crypto.randomUUID()
    const storagePath = generateStoragePath(
      session.user.organizationId,
      parsed.data.entityType,
      entityId,
      parsed.data.fileName
    )

    // Generér signeret upload URL
    const uploadUrl = await getSignedUploadUrl(storagePath, parsed.data.fileType)

    const expiresAt = new Date(Date.now() + 3600 * 1000) // 1 time

    return {
      data: {
        uploadUrl,
        storagePath,
        expiresAt,
      },
    }
  } catch (error) {
    console.error('Fejl ved generering af upload URL:', error)
    return { error: 'Upload URL kunne ikke genereres — prøv igen' }
  }
}

// ==================== CREATE ====================

export async function createDocument(
  input: CreateDocumentInput
): Promise<ActionResult<Document>> {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.organizationId) {
    return { error: 'Ikke autoriseret' }
  }

  // Moduladgang
  const canAccess = await canAccessModule(session.user.id, 'documents')
  if (!canAccess) {
    return { error: 'Du har ikke adgang til dokumentmodulet' }
  }

  // Redigeringsrettighed
  const canEditData = await canEdit(session.user.id)
  if (!canEditData) {
    return { error: 'Du har ikke rettigheder til at oprette dokumenter' }
  }

  // Validér input
  const parsed = createDocumentSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || 'Ugyldigt input' }
  }

  // Bestem sensitivity baseret på tilknytninger
  let effectiveSensitivity: SensitivityLevel = parsed.data.sensitivity || 'STANDARD'

  // Tjek selskab hvis angivet
  if (parsed.data.companyId) {
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

    const hasCompanyAccess = await canAccessCompany(session.user.id, parsed.data.companyId)
    if (!hasCompanyAccess) {
      return { error: 'Du har ikke adgang til dette selskab' }
    }
  }

  // Tjek sag hvis angivet (arv sensitivity)
  if (parsed.data.caseId) {
    const caseRecord = await prisma.case.findFirst({
      where: {
        id: parsed.data.caseId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    })
    if (!caseRecord) {
      return { error: 'Sagen blev ikke fundet' }
    }

    // Arv sensitivity fra sag hvis højere
    const sensitivityOrder = ['PUBLIC', 'STANDARD', 'INTERN', 'FORTROLIG', 'STRENGT_FORTROLIG']
    const caseSensitivityIndex = sensitivityOrder.indexOf(caseRecord.sensitivity)
    const docSensitivityIndex = sensitivityOrder.indexOf(effectiveSensitivity)
    if (caseSensitivityIndex > docSensitivityIndex) {
      effectiveSensitivity = caseRecord.sensitivity
    }

    const hasSensitivityAccess = await canAccessSensitivity(session.user.id, caseRecord.sensitivity)
    if (!hasSensitivityAccess) {
      return { error: 'Du har ikke adgang til denne sag' }
    }
  }

  // Tjek kontrakt hvis angivet (arv sensitivity)
  if (parsed.data.contractId) {
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

    // Arv sensitivity fra kontrakt hvis højere
    const sensitivityOrder = ['PUBLIC', 'STANDARD', 'INTERN', 'FORTROLIG', 'STRENGT_FORTROLIG']
    const contractSensitivityIndex = sensitivityOrder.indexOf(contract.sensitivity)
    const docSensitivityIndex = sensitivityOrder.indexOf(effectiveSensitivity)
    if (contractSensitivityIndex > docSensitivityIndex) {
      effectiveSensitivity = contract.sensitivity
    }

    const hasSensitivityAccess = await canAccessSensitivity(session.user.id, contract.sensitivity)
    if (!hasSensitivityAccess) {
      return { error: 'Du har ikke adgang til denne kontrakt' }
    }

    const hasContractCompanyAccess = await canAccessCompany(session.user.id, contract.companyId)
    if (!hasContractCompanyAccess) {
      return { error: 'Du har ikke adgang til kontraktens selskab' }
    }
  }

  // Tjek om bruger kan oprette med denne sensitivity
  const canCreateWithSensitivity = await canAccessSensitivity(
    session.user.id,
    effectiveSensitivity
  )
  if (!canCreateWithSensitivity) {
    return {
      error: `Du har ikke rettigheder til at oprette dokumenter med sensitivitetsniveau ${effectiveSensitivity}`,
    }
  }

  try {
    const document = await prisma.document.create({
      data: {
        organizationId: session.user.organizationId,
        title: parsed.data.title,
        companyId: parsed.data.companyId,
        caseId: parsed.data.caseId,
        fileUrl: parsed.data.fileUrl,
        fileName: parsed.data.fileName,
        fileSizeBytes: parsed.data.fileSizeBytes,
        fileType: parsed.data.fileType,
        sensitivity: effectiveSensitivity,
        folderPath: parsed.data.folderPath,
        description: parsed.data.description,
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
        sensitivity: document.sensitivity,
      },
    })

    revalidatePath('/documents')
    if (parsed.data.companyId) {
      revalidatePath(`/companies/${parsed.data.companyId}`)
    }
    if (parsed.data.caseId) {
      revalidatePath(`/cases/${parsed.data.caseId}`)
    }

    return { data: document }
  } catch (error) {
    console.error('Fejl ved oprettelse af dokument:', error)
    return { error: 'Dokumentet kunne ikke oprettes — prøv igen' }
  }
}

// ==================== UPDATE ====================

export async function updateDocument(
  input: UpdateDocumentInput
): Promise<ActionResult<Document>> {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.organizationId) {
    return { error: 'Ikke autoriseret' }
  }

  const parsed = updateDocumentSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || 'Ugyldigt input' }
  }

  const { id, ...data } = parsed.data

  // Hent eksisterende dokument
  const existing = await prisma.document.findFirst({
    where: {
      id,
      organizationId: session.user.organizationId,
      deletedAt: null,
    },
  })

  if (!existing) {
    return { error: 'Dokumentet blev ikke fundet' }
  }

  // Sensitivity adgang
  const hasSensitivityAccess = await canAccessSensitivity(
    session.user.id,
    existing.sensitivity
  )
  if (!hasSensitivityAccess) {
    return { error: 'Du har ikke adgang til dette dokument' }
  }

  // Selskabsadgang hvis tilknyttet
  if (existing.companyId) {
    const hasCompanyAccess = await canAccessCompany(session.user.id, existing.companyId)
    if (!hasCompanyAccess) {
      return { error: 'Du har ikke adgang til dette dokument' }
    }
  }

  // Redigeringsrettighed
  const canEditData = await canEdit(session.user.id)
  if (!canEditData) {
    return { error: 'Du har ikke rettigheder til at redigere dokumenter' }
  }

  // Tjek ny sensitivity hvis ændret
  if (data.sensitivity && data.sensitivity !== existing.sensitivity) {
    const canAccessNewSensitivity = await canAccessSensitivity(
      session.user.id,
      data.sensitivity
    )
    if (!canAccessNewSensitivity) {
      return {
        error: `Du har ikke rettigheder til at sætte sensitivitetsniveau ${data.sensitivity}`,
      }
    }
  }

  // Tjek nyt selskab hvis ændret
  if (data.companyId && data.companyId !== existing.companyId) {
    const newCompany = await prisma.company.findFirst({
      where: {
        id: data.companyId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    })
    if (!newCompany) {
      return { error: 'Det nye selskab blev ikke fundet' }
    }

    const hasNewCompanyAccess = await canAccessCompany(session.user.id, data.companyId)
    if (!hasNewCompanyAccess) {
      return { error: 'Du har ikke adgang til det nye selskab' }
    }
  }

  // Tjek ny sag hvis ændret
  if (data.caseId && data.caseId !== existing.caseId) {
    const newCase = await prisma.case.findFirst({
      where: {
        id: data.caseId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    })
    if (!newCase) {
      return { error: 'Den nye sag blev ikke fundet' }
    }

    const hasCaseSensitivityAccess = await canAccessSensitivity(
      session.user.id,
      newCase.sensitivity
    )
    if (!hasCaseSensitivityAccess) {
      return { error: 'Du har ikke adgang til den nye sag' }
    }
  }

  try {
    const document = await prisma.document.update({
      where: { id },
      data,
    })

    // Audit log med ændringer for fortrolige dokumenter
    const shouldLogChanges =
      existing.sensitivity === 'STRENGT_FORTROLIG' ||
      existing.sensitivity === 'FORTROLIG'

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'UPDATE',
        resourceType: 'document',
        resourceId: document.id,
        sensitivity: document.sensitivity,
        changes: shouldLogChanges ? (data as object) : null,
      },
    })

    revalidatePath(`/documents/${id}`)
    revalidatePath('/documents')

    return { data: document }
  } catch (error) {
    console.error('Fejl ved opdatering af dokument:', error)
    return { error: 'Dokumentet kunne ikke opdateres — prøv igen' }
  }
}

// ==================== DELETE ====================

export async function deleteDocument(
  documentId: string
): Promise<ActionResult<{ success: true }>> {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.organizationId) {
    return { error: 'Ikke autoriseret' }
  }

  const existing = await prisma.document.findFirst({
    where: {
      id: documentId,
      organizationId: session.user.organizationId,
      deletedAt: null,
    },
  })

  if (!existing) {
    return { error: 'Dokumentet blev ikke fundet' }
  }

  const hasSensitivityAccess = await canAccessSensitivity(
    session.user.id,
    existing.sensitivity
  )
  if (!hasSensitivityAccess) {
    return { error: 'Du har ikke adgang til dette dokument' }
  }

  if (existing.companyId) {
    const hasCompanyAccess = await canAccessCompany(session.user.id, existing.companyId)
    if (!hasCompanyAccess) {
      return { error: 'Du har ikke adgang til dette dokument' }
    }
  }

  const canEditData = await canEdit(session.user.id)
  if (!canEditData) {
    return { error: 'Du har ikke rettigheder til at slette dokumenter' }
  }

  try {
    // Soft delete
    await prisma.document.update({
      where: { id: documentId },
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

    revalidatePath('/documents')

    return { data: { success: true } }
  } catch (error) {
    console.error('Fejl ved sletning af dokument:', error)
    return { error: 'Dokumentet kunne ikke slettes — prøv igen' }
  }
}

// ==================== GET ====================

export async function getDocument(
  documentId: string
): Promise<ActionResult<DocumentWithRelations>> {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.organizationId) {
    return { error: 'Ikke autoriseret' }
  }

  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      organizationId: session.user.organizationId,
      deletedAt: null,
    },
    include: {
      company: true,
      case: true,
    },
  })

  if (!document) {
    return { error: 'Dokumentet blev ikke fundet' }
  }

  // Sensitivity adgang
  const hasSensitivityAccess = await canAccessSensitivity(
    session.user.id,
    document.sensitivity
  )
  if (!hasSensitivityAccess) {
    return { error: 'Du har ikke adgang til dette dokument' }
  }

  // Selskabsadgang hvis tilknyttet
  if (document.companyId) {
    const hasCompanyAccess = await canAccessCompany(session.user.id, document.companyId)
    if (!hasCompanyAccess) {
      return { error: 'Du har ikke adgang til dette dokument' }
    }
  }

  // Opdater last viewed
  await prisma.document.update({
    where: { id: documentId },
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
      resourceType: 'document',
      resourceId: documentId,
      sensitivity: document.sensitivity,
    },
  })

  return { data: document }
}

// ==================== LIST ====================

export async function listDocuments(
  filter?: ListDocumentsFilter
): Promise<ActionResult<DocumentWithRelations[]>> {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.organizationId) {
    return { error: 'Ikke autoriseret' }
  }

  const canAccess = await canAccessModule(session.user.id, 'documents')
  if (!canAccess) {
    return { error: 'Du har ikke adgang til dokumentmodulet' }
  }

  // Validér filter
  const parsedFilter = listDocumentsFilterSchema.safeParse(filter || {})
  if (!parsedFilter.success) {
    return { error: 'Ugyldigt filter' }
  }

  const {
    companyId,
    caseId,
    contractId,
    sensitivity,
    fileType,
    folderPath,
    search,
    limit = 50,
    offset = 0,
  } = parsedFilter.data

  // Hent tilgængelige selskaber
  const accessibleCompanies = await getAccessibleCompanies(session.user.id)
  const accessibleCompanyIds = accessibleCompanies.map((c) => c.id)

  // Hent max sensitivity niveau
  const maxSensitivity = await getMaxSensitivityLevel(session.user.id)
  if (!maxSensitivity) {
    return { data: [] }
  }

  // Filtrer på sensitivity
  const sensitivityOrder = ['PUBLIC', 'STANDARD', 'INTERN', 'FORTROLIG', 'STRENGT_FORTROLIG']
  const sensitivityIndex = sensitivityOrder.indexOf(maxSensitivity)
  const allowedSensitivities = sensitivityOrder.slice(0, sensitivityIndex + 1) as SensitivityLevel[]

  // Byg where clause
  const where: Prisma.DocumentWhereInput = {
    organizationId: session.user.organizationId,
    deletedAt: null,
    sensitivity: sensitivity
      ? { in: allowedSensitivities.filter((s) => s === sensitivity) }
      : { in: allowedSensitivities },
  }

  // Filtrer på selskab
  if (companyId) {
    if (!accessibleCompanyIds.includes(companyId)) {
      return { data: [] }
    }
    where.companyId = companyId
  } else {
    // Vis kun dokumenter fra tilgængelige selskaber eller uden selskab
    where.OR = [
      { companyId: { in: accessibleCompanyIds } },
      { companyId: null },
    ]
  }

  if (caseId) {
    where.caseId = caseId
  }

  if (fileType) {
    where.fileType = fileType
  }

  if (folderPath) {
    where.folderPath = folderPath
  }

  if (search && search.trim()) {
    where.AND = [
      {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { fileName: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      },
    ]
  }

  try {
    const documents = await prisma.document.findMany({
      where,
      include: {
        company: true,
        case: true,
      },
      orderBy: { uploadedAt: 'desc' },
      take: limit,
      skip: offset,
    })

    return { data: documents }
  } catch (error) {
    console.error('Fejl ved hentning af dokumenter:', error)
    return { error: 'Dokumenterne kunne ikke hentes — prøv igen' }
  }
}

// ==================== DOWNLOAD URL ====================

export async function getDocumentDownloadUrl(
  documentId: string
): Promise<ActionResult<DownloadUrlResponse>> {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.organizationId) {
    return { error: 'Ikke autoriseret' }
  }

  // Tjek om storage er konfigureret
  if (!isStorageConfigured) {
    return { error: 'Filstorage er ikke konfigureret. Kontakt administrator.' }
  }

  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      organizationId: session.user.organizationId,
      deletedAt: null,
    },
  })

  if (!document) {
    return { error: 'Dokumentet blev ikke fundet' }
  }

  // canAccessSensitivity SKAL kaldes inden download returneres
  const hasSensitivityAccess = await canAccessSensitivity(
    session.user.id,
    document.sensitivity
  )
  if (!hasSensitivityAccess) {
    return { error: 'Du har ikke adgang til dette dokument' }
  }

  // Selskabsadgang hvis tilknyttet
  if (document.companyId) {
    const hasCompanyAccess = await canAccessCompany(session.user.id, document.companyId)
    if (!hasCompanyAccess) {
      return { error: 'Du har ikke adgang til dette dokument' }
    }
  }

  try {
    const downloadUrl = await getSignedDownloadUrl(
      document.fileUrl,
      3600,
      document.fileName
    )

    // Audit log for download
    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'DOWNLOAD',
        resourceType: 'document',
        resourceId: documentId,
        sensitivity: document.sensitivity,
      },
    })

    const expiresAt = new Date(Date.now() + 3600 * 1000)

    return {
      data: {
        downloadUrl,
        expiresAt,
      },
    }
  } catch (error) {
    console.error('Fejl ved generering af download URL:', error)
    return { error: 'Download URL kunne ikke genereres — prøv igen' }
  }
}

// ==================== PREVIEW URL ====================

export async function getDocumentPreviewUrl(
  documentId: string
): Promise<ActionResult<DownloadUrlResponse>> {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.organizationId) {
    return { error: 'Ikke autoriseret' }
  }

  // Tjek om storage er konfigureret
  if (!isStorageConfigured) {
    return { error: 'Filstorage er ikke konfigureret. Kontakt administrator.' }
  }

  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      organizationId: session.user.organizationId,
      deletedAt: null,
    },
  })

  if (!document) {
    return { error: 'Dokumentet blev ikke fundet' }
  }

  // canAccessSensitivity SKAL kaldes
  const hasSensitivityAccess = await canAccessSensitivity(
    session.user.id,
    document.sensitivity
  )
  if (!hasSensitivityAccess) {
    return { error: 'Du har ikke adgang til dette dokument' }
  }

  // Selskabsadgang hvis tilknyttet
  if (document.companyId) {
    const hasCompanyAccess = await canAccessCompany(session.user.id, document.companyId)
    if (!hasCompanyAccess) {
      return { error: 'Du har ikke adgang til dette dokument' }
    }
  }

  // Tjek om filen kan forhåndsvises
  const previewableTypes = ['application/pdf', 'image/png', 'image/jpeg']
  if (!previewableTypes.includes(document.fileType)) {
    return { error: 'Denne filtype kan ikke forhåndsvises' }
  }

  try {
    // Ingen ResponseContentDisposition for inline preview
    const previewUrl = await getSignedDownloadUrl(document.fileUrl, 3600)

    // Audit log for view
    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'VIEW',
        resourceType: 'document',
        resourceId: documentId,
        sensitivity: document.sensitivity,
      },
    })

    const expiresAt = new Date(Date.now() + 3600 * 1000)

    return {
      data: {
        downloadUrl: previewUrl,
        expiresAt,
      },
    }
  } catch (error) {
    console.error('Fejl ved generering af preview URL:', error)
    return { error: 'Preview URL kunne ikke genereres — prøv igen' }
  }
}