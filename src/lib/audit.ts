import { prisma } from '@/lib/db'
import { captureError } from '@/lib/logger'
import type { SensitivityLevel } from '@prisma/client'

export interface AuditEventInput {
  organizationId: string
  userId: string
  action: string
  resourceType: string
  resourceId: string
  sensitivity?: SensitivityLevel
  changes?: Record<string, unknown>
  ipAddress?: string
}

/**
 * Skriv en AuditLog-entry. Fejl her må ALDRIG blokere den primære
 * operation — logges til Sentry og fortsætter. Brug i enhver action
 * der laver state-ændring på følsomme entiteter (Contract, Case,
 * Ownership, CompanyPerson m.fl.).
 *
 * @example
 * await recordAuditEvent({
 *   organizationId: session.user.organizationId,
 *   userId: session.user.id,
 *   action: 'STATUS_CHANGE',
 *   resourceType: 'case',
 *   resourceId: caseId,
 *   changes: { oldStatus: 'NY', newStatus: 'AKTIV' },
 * })
 */
export async function recordAuditEvent(input: AuditEventInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        organization_id: input.organizationId,
        user_id: input.userId,
        action: input.action,
        resource_type: input.resourceType,
        resource_id: input.resourceId,
        sensitivity: input.sensitivity,
        changes: input.changes as never,
        ip_address: input.ipAddress,
      },
    })
  } catch (err) {
    captureError(err, {
      namespace: 'audit',
      extra: {
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
      },
    })
  }
}
