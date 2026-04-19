'use server'

import { auth } from '@/lib/auth'
import { canAccessModule } from '@/lib/permissions'
import { recordAuditEvent } from '@/lib/audit'
import { captureError } from '@/lib/logger'
import type { ActionResult } from '@/types/actions'
import type { ExportableEntity } from '@/lib/export/entities'

export interface PrepareExportInput {
  entity: ExportableEntity
}

/**
 * Forbereder en CSV-eksport: validerer session + admin-adgang,
 * skriver audit-log og returnerer download-URL til klienten.
 *
 * Selve CSV-genereringen sker i API-routen `/api/export/[entity]`.
 */
export async function prepareExport(
  input: PrepareExportInput
): Promise<ActionResult<{ downloadUrl: string }>> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  const canExport = await canAccessModule(session.user.id, 'settings')
  if (!canExport) return { error: 'Kun admin kan eksportere data' }

  try {
    await recordAuditEvent({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      action: 'EXPORT',
      resourceType: input.entity,
      resourceId: 'bulk',
      sensitivity: 'INTERN',
      changes: { entity: input.entity },
    })
    return { data: { downloadUrl: `/api/export/${input.entity}` } }
  } catch (err) {
    captureError(err, {
      namespace: 'action:prepareExport',
      extra: { entity: input.entity },
    })
    return { error: 'Eksport kunne ikke forberedes' }
  }
}
