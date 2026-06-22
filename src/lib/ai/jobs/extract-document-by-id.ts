import { extractDocument } from '@/lib/ai/jobs/extract-document'
import type { ExtractDocumentResult } from '@/lib/ai/jobs/extract-document'
import { createLogger } from '@/lib/ai/logger'
import { prisma } from '@/lib/db'
import { getStorageProvider } from '@/lib/storage'

const log = createLogger('extract-document-by-id')

/**
 * Wrapper omkring {@link extractDocument} til cron-poller-arkitekturen:
 * slår dokumentet op, rekonstruerer storage-key, henter fil-bufferen fra
 * storage og kalder den eksisterende extraction-pipeline.
 *
 * Rør IKKE extractDocument-kernen — den er idempotent og gater selv på
 * feature-flag/plan/cost-cap.
 */
export async function extractDocumentById(documentId: string): Promise<ExtractDocumentResult> {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      organization_id: true,
      file_name: true,
      deleted_at: true,
    },
  })

  if (!document) {
    throw new Error(`Dokument ${documentId} ikke fundet`)
  }
  if (document.deleted_at) {
    throw new Error(`Dokument ${documentId} er slettet`)
  }

  // Rekonstruér storage-key NØJAGTIGT som upload-ruten gør:
  // `${orgId}/${documentId}/${sanitizedFileName}` (se src/app/api/upload/route.ts).
  // Bruger IKKE Document.file_url (R2 presigned URL udløber efter 24t).
  const sanitizedFileName = document.file_name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const key = `${document.organization_id}/${document.id}/${sanitizedFileName}`

  const storage = getStorageProvider()
  const buffer = await storage.download(key)
  if (!buffer) {
    throw new Error(`Fil ikke fundet i storage for dokument ${documentId} (key: ${key})`)
  }

  log.info({ document_id: documentId, key }, 'Henter fil fra storage og starter extraction')

  return extractDocument({
    document_id: document.id,
    organization_id: document.organization_id,
    file_buffer_base64: buffer.toString('base64'),
    filename: document.file_name,
  })
}
