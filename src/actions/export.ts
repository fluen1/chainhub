'use server'

import { z } from 'zod'
import { recordAuditEvent } from '@/lib/audit'
import { auth } from '@/lib/auth'
import { fetchEntityForExport, type ExportableEntity } from '@/lib/export/entities'
import { captureError } from '@/lib/logger'
import { canAccessModule } from '@/lib/permissions'
import type { ActionResult } from '@/types/actions'

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

export interface ExportPreviewData {
  columns: string[]
  rows: Array<Record<string, string | number | null>>
  totalCount: number
  downloadUrl: string
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

const PREVIEW_ROWS = 50

/**
 * Henter preview-data (op til 50 rækker) for en eksport-entity.
 * Returnerer kolonnenavne (headers), formatterede rækker og total antal rækker.
 * Bruges til ExportPreviewModal inden brugeren downloader CSV.
 */
export async function getExportPreview(
  input: PrepareExportInput
): Promise<ActionResult<ExportPreviewData>> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  const parsed = prepareExportSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  const canExport = await canAccessModule(session.user.id, 'export', session.user.organizationId)
  if (!canExport) return { error: 'Du har ikke adgang til at eksportere data' }

  try {
    const { columns, rows } = await fetchEntityForExport(input.entity, {
      organizationId: session.user.organizationId,
    })

    const totalCount = rows.length
    const previewRows = rows.slice(0, PREVIEW_ROWS)

    // Formattér rækker til simple streng/tal-værdier til tabel-visning
    const formattedRows: Array<Record<string, string | number | null>> = previewRows.map((row) => {
      const out: Record<string, string | number | null> = {}
      for (const col of columns) {
        const rawValue = row[col.key as string]
        if (rawValue === null || rawValue === undefined) {
          out[col.header] = null
        } else if (col.format) {
          out[col.header] = col.format(rawValue, row)
        } else if (rawValue instanceof Date) {
          out[col.header] = rawValue.toISOString().slice(0, 10)
        } else if (typeof rawValue === 'number') {
          out[col.header] = rawValue
        } else {
          out[col.header] = String(rawValue)
        }
      }
      return out
    })

    return {
      data: {
        columns: columns.map((c) => c.header),
        rows: formattedRows,
        totalCount,
        downloadUrl: `/api/export/${input.entity}`,
      },
    }
  } catch (err) {
    captureError(err, {
      namespace: 'action:getExportPreview',
      extra: { entity: input.entity },
    })
    return { error: 'Preview kunne ikke hentes' }
  }
}
