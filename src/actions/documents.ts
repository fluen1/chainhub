'use server'

import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canAccessCompany } from '@/lib/permissions'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/types/actions'

// Løs UUID-validering: accepterer alle 8-4-4-4-12 hex-formater inkl. nil-UUIDs (seed-data)
const uuidSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)

export async function deleteDocument(documentId: string): Promise<ActionResult<void>> {
  const session = await auth()
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  if (!uuidSchema.safeParse(documentId).success) return { error: 'Ugyldigt input' }

  const doc = await prisma.document.findFirst({
    where: {
      id: documentId,
      organization_id: session.user.organizationId,
      deleted_at: null,
    },
  })
  if (!doc) return { error: 'Dokument ikke fundet' }

  if (doc.company_id) {
    const hasAccess = await canAccessCompany(
      session.user.id,
      doc.company_id,
      session.user.organizationId
    )
    if (!hasAccess) return { error: 'Ingen adgang til dette dokument' }
  }

  await prisma.document.update({
    where: { id: documentId },
    data: { deleted_at: new Date() },
  })

  revalidatePath('/documents')
  if (doc.company_id) revalidatePath(`/companies/${doc.company_id}/documents`)
  return { data: undefined }
}
