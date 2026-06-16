import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import type { ExtractDocumentPayload } from '@/lib/ai/jobs/extract-document'
import { createLogger } from '@/lib/ai/logger'
import { createQueue, JOB_NAMES } from '@/lib/ai/queue'
import { checkUploadRateLimit } from '@/lib/ai/rate-limit'
import { recordAuditEvent } from '@/lib/audit'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canAccessCompany } from '@/lib/permissions'
import { getStorageProvider } from '@/lib/storage'

const log = createLogger('api:upload')

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
]

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Ikke autoriseret' }, { status: 401 })
  }

  // Rate-limit: 10 uploads/min per org — blokerer bulk-upload-storm mod Anthropic.
  const rateCheck = checkUploadRateLimit(session.user.organizationId)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      {
        error: 'For mange uploads — prøv igen senere',
        retry_after_ms: rateCheck.retryAfterMs,
      },
      { status: 429 }
    )
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const companyId = formData.get('companyId') as string | null
  const caseId = formData.get('caseId') as string | null
  const contractId = formData.get('contractId') as string | null
  const title = formData.get('title') as string | null

  if (!file) {
    return NextResponse.json({ error: 'Ingen fil valgt' }, { status: 400 })
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'Filen er for stor (max 10 MB)' }, { status: 400 })
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'Filtypen er ikke tilladt (PDF, DOCX, PNG, JPG)' },
      { status: 400 }
    )
  }

  // Permission check if company specified
  if (companyId) {
    const hasAccess = await canAccessCompany(
      session.user.id,
      companyId,
      session.user.organizationId
    )
    if (!hasAccess) {
      return NextResponse.json({ error: 'Ingen adgang til dette selskab' }, { status: 403 })
    }
  }

  // Tenant-verifikation: caseId og contractId skal tilhøre brugerens organisation
  // Forhindrer IDOR: bruger kan ikke knytte dokument til anden orgs sag/kontrakt
  if (caseId) {
    const validCase = await prisma.case.findFirst({
      where: { id: caseId, organization_id: session.user.organizationId, deleted_at: null },
      select: { id: true },
    })
    if (!validCase) {
      return NextResponse.json({ error: 'Sag ikke fundet' }, { status: 403 })
    }
  }
  if (contractId) {
    const validContract = await prisma.contract.findFirst({
      where: {
        id: contractId,
        organization_id: session.user.organizationId,
        deleted_at: null,
      },
      select: { id: true },
    })
    if (!validContract) {
      return NextResponse.json({ error: 'Kontrakt ikke fundet' }, { status: 403 })
    }
  }

  const documentId = randomUUID()
  const orgId = session.user.organizationId
  const storage = getStorageProvider()
  // Brug documentId i storage-key i stedet for rå filnavn (forhindrer path traversal)
  const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const key = `${orgId}/${documentId}/${sanitizedFileName}`

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  await storage.upload({
    key,
    buffer,
    contentType: file.type,
  })

  const fileUrl = await storage.getDownloadUrl(key)

  // Save to database
  const document = await prisma.document.create({
    data: {
      id: documentId,
      organization_id: orgId,
      company_id: companyId || null,
      case_id: caseId || null,
      title: title || file.name,
      file_url: fileUrl,
      file_name: file.name,
      file_size_bytes: file.size,
      file_type: file.type,
      uploaded_by: session.user.id,
    },
  })

  // Enqueue AI extraction for alle uploads (entity-matching + field extraction)
  // Fail-silent: upload må ikke fejle hvis pg-boss er nede.
  try {
    const { isAIEnabled } = await import('@/lib/ai/feature-flags')
    const aiEnabled = await isAIEnabled(orgId, 'extraction')

    if (aiEnabled) {
      const boss = await createQueue()
      // pg-boss v10+ kræver at queue eksisterer før send.
      // createQueue på manager er idempotent (CREATE IF NOT EXISTS-semantik via SQL plan).
      try {
        await boss.createQueue(JOB_NAMES.EXTRACT_DOCUMENT)
      } catch (createErr) {
        // Ignorér hvis queue allerede eksisterer — det er det forventede efter første kald
        log.debug(
          {
            queue: JOB_NAMES.EXTRACT_DOCUMENT,
            err: createErr instanceof Error ? createErr.message : String(createErr),
          },
          'createQueue returned error (likely already exists) — continuing'
        )
      }

      const payload: ExtractDocumentPayload = {
        document_id: documentId,
        organization_id: orgId,
        file_buffer_base64: buffer.toString('base64'),
        filename: file.name,
      }
      await boss.send(JOB_NAMES.EXTRACT_DOCUMENT, payload, {
        retryLimit: 2,
        retryDelay: 60, // seconds
      })
      log.info({ document_id: documentId }, 'Extraction job queued')
    }
  } catch (err) {
    // Non-blocking — upload succeeds even if enqueue fails
    log.warn(
      {
        document_id: documentId,
        err: err instanceof Error ? err.message : String(err),
      },
      'Failed to enqueue extraction job'
    )
  }

  // Audit: log upload-hændelse
  await recordAuditEvent({
    organizationId: orgId,
    userId: session.user.id,
    action: 'UPLOAD',
    resourceType: 'DOCUMENT',
    resourceId: document.id,
    resourceCompanyId: companyId ?? undefined,
    sensitivity: 'INTERN',
  })

  return NextResponse.json({ data: document })
}
