// API route til fil-upload URL generering
// Bruges af klienten til at hente en pre-signed upload URL til Cloudflare R2

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canAccessCompany, canAccessSensitivity } from '@/lib/permissions'
import {
  isStorageConfigured,
  getStorageConfigurationGuide,
  generateStoragePath,
  getSignedUploadUrl,
} from '@/lib/storage'
import { z } from 'zod'

const requestSchema = z.object({
  contractId: z.string().uuid(),
  fileName: z.string().min(1).max(255),
  fileType: z.string().min(1).max(100),
  fileSizeBytes: z.number().int().min(1).max(104857600),
  uploadPurpose: z.enum(['version', 'attachment']),
})

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: 'Ikke autoriseret' }, { status: 401 })
  }

  // Tjek R2 konfiguration
  if (!isStorageConfigured()) {
    return Response.json(
      {
        error: 'Fil-upload er ikke tilgængeligt',
        guide: getStorageConfigurationGuide(),
      },
      { status: 503 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Ugyldigt request body' }, { status: 400 })
  }

  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: 'Ugyldigt input', details: parsed.error.errors },
      { status: 400 }
    )
  }

  const { contractId, fileName, fileType, fileSizeBytes, uploadPurpose } = parsed.data

  try {
    const contract = await prisma.contract.findUnique({
      where: {
        id: contractId,
        organizationId: session.user.organizationId,
        deletedAt: null,
      },
    })

    if (!contract) {
      return Response.json({ error: 'Kontrakten blev ikke fundet' }, { status: 404 })
    }

    const hasCompanyAccess = await canAccessCompany(session.user.id, contract.companyId)
    if (!hasCompanyAccess) {
      return Response.json(
        { error: 'Du har ikke adgang til dette selskab' },
        { status: 403 }
      )
    }

    const hasSensitivityAccess = await canAccessSensitivity(
      session.user.id,
      contract.sensitivity
    )
    if (!hasSensitivityAccess) {
      return Response.json({ error: 'Du har ikke adgang til denne kontrakt' }, { status: 403 })
    }

    const resourceType = uploadPurpose === 'version' ? 'contracts' : 'attachments'
    const fileKey = generateStoragePath(
      session.user.organizationId,
      resourceType,
      contractId,
      fileName
    )

    const { uploadUrl, fileUrl } = await getSignedUploadUrl(fileKey, fileType)

    return Response.json({ uploadUrl, fileKey, fileUrl })
  } catch (error) {
    console.error('upload-url route error:', error)
    if (error instanceof Error) {
      return Response.json({ error: error.message }, { status: 500 })
    }
    return Response.json({ error: 'Intern serverfejl' }, { status: 500 })
  }
}