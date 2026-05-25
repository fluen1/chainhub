'use server'

import { z } from 'zod'
import { auth } from '@/lib/auth'
import { canAccessModule } from '@/lib/permissions'
import { recordAuditEvent } from '@/lib/audit'
import { captureError } from '@/lib/logger'
import type { ActionResult } from '@/types/actions'
import type { ExportableEntity } from '@/lib/export/entities'

const exportableEntityValues = [
  'companies',
  'contracts',
  'cases',
  'tasks',
  'persons',
  'visits',
] as const
const prepareExportSchema = z.object({
  entity: z.enum(exportableEntityValues),
})

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

  const parsed = prepareExportSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  const canExport = await canAccessModule(session.user.id, 'export', session.user.organizationId)
  if (!canExport) return { error: 'Du har ikke adgang til at eksportere data' }

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
