'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { recordAuditEvent } from '@/lib/audit'
import { auth } from '@/lib/auth'
import { gdprDeletePerson } from '@/lib/export/gdpr'
import { captureError } from '@/lib/logger'
import { canAccessModule } from '@/lib/permissions'
import type { ActionResult } from '@/types/actions'

// Løs UUID-validering: accepterer alle 8-4-4-4-12 hex-formater inkl. nil-UUIDs (seed-data)
const uuidSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)

/**
 * GDPR Article 15 — Right of access.
 * Validerer admin-adgang, skriver audit-log og returnerer download-URL.
 * Selve JSON-bundlen streames fra `/api/export/gdpr/[personId]`.
 */
export async function prepareGdprExport(
  personId: string
): Promise<ActionResult<{ downloadUrl: string }>> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  if (!uuidSchema.safeParse(personId).success) return { error: 'Ugyldigt input' }

  const hasAccess = await canAccessModule(session.user.id, 'settings', session.user.organizationId)
  if (!hasAccess) return { error: 'Kun admin kan håndtere GDPR-eksport' }

  try {
    await recordAuditEvent({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      action: 'GDPR_EXPORT',
      resourceType: 'person',
      resourceId: personId,
      sensitivity: 'FORTROLIG',
      changes: { reason: 'Article 15 request' },
    })
    return { data: { downloadUrl: `/api/export/gdpr/${personId}` } }
  } catch (err) {
    captureError(err, { namespace: 'action:prepareGdprExport' })
    return { error: 'GDPR-eksport kunne ikke forberedes' }
  }
}

/**
 * GDPR Article 17 — Right to erasure.
 * Pseudonymiserer person + nedlægger/sletter alle relationer.
 * Audit-logges som STRENGT_FORTROLIG. Uomkørbar.
 */
export async function executeGdprDelete(
  personId: string
): Promise<ActionResult<{ personUpdated: number; total: number }>> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  if (!uuidSchema.safeParse(personId).success) return { error: 'Ugyldigt input' }

  const hasAccess = await canAccessModule(session.user.id, 'settings', session.user.organizationId)
  if (!hasAccess) return { error: 'Kun admin kan slette persondata' }

  try {
    const result = await gdprDeletePerson(personId, session.user.organizationId)
    if (!result.deleted) return { error: 'Person ikke fundet' }

    await recordAuditEvent({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      action: 'GDPR_DELETE',
      resourceType: 'person',
      resourceId: personId,
      sensitivity: 'STRENGT_FORTROLIG',
      changes: {
        reason: 'Article 17 request',
        summary: result.summary,
      },
    })

    revalidatePath(`/persons/${personId}`)
    revalidatePath('/persons')

    const total =
      result.summary.companyPersonsEnded +
      result.summary.ownershipsEnded +
      result.summary.contractPartiesDeleted +
      result.summary.casePersonsDeleted

    return { data: { personUpdated: result.summary.personUpdated, total } }
  } catch (err) {
    captureError(err, { namespace: 'action:executeGdprDelete' })
    return { error: 'GDPR-sletning fejlede' }
  }
}
