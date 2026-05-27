'use server'

import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { captureError } from '@/lib/logger'
import { canAccessModule } from '@/lib/permissions'
import type { ActionResult } from '@/types/actions'

// ────────────────────────────────────────────────────────────────────────────
// Typer
// ────────────────────────────────────────────────────────────────────────────

export interface AlertItem {
  id: string
  severity: 'CRITICAL' | 'WARNING' | 'INFO'
  category: 'DEADLINE' | 'MISSING' | 'RISK' | 'COMPLIANCE'
  entityType: string
  entityId: string
  entityName: string
  message: string
  details: Record<string, unknown> | null
  createdAt: Date
}

export interface AlertStats {
  critical: number
  warning: number
  info: number
  total: number
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function mapAlert(a: {
  id: string
  severity: 'CRITICAL' | 'WARNING' | 'INFO'
  category: 'DEADLINE' | 'MISSING' | 'RISK' | 'COMPLIANCE'
  entity_type: string
  entity_id: string
  entity_name: string
  message: string
  details: unknown
  created_at: Date
}): AlertItem {
  return {
    id: a.id,
    severity: a.severity,
    category: a.category,
    entityType: a.entity_type,
    entityId: a.entity_id,
    entityName: a.entity_name,
    message: a.message,
    details: a.details != null ? (a.details as Record<string, unknown>) : null,
    createdAt: a.created_at,
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Actions
// ────────────────────────────────────────────────────────────────────────────

/**
 * Henter aktive (ikke-afviste) advarsler for organisationen.
 * Sorteret: CRITICAL → WARNING → INFO, derefter nyeste først.
 */
export async function getActiveAlerts(limit?: number): Promise<ActionResult<AlertItem[]>> {
  const session = await auth()
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  const hasModuleAccess = await canAccessModule(
    session.user.id,
    'companies',
    session.user.organizationId
  )
  if (!hasModuleAccess) return { error: 'Ingen adgang til dette modul' }

  try {
    const rows = await prisma.alert.findMany({
      where: {
        organization_id: session.user.organizationId,
        dismissed_at: null,
      },
      orderBy: [{ severity: 'asc' }, { created_at: 'desc' }],
      ...(limit != null ? { take: limit } : {}),
      select: {
        id: true,
        severity: true,
        category: true,
        entity_type: true,
        entity_id: true,
        entity_name: true,
        message: true,
        details: true,
        created_at: true,
      },
    })

    return { data: rows.map(mapAlert) }
  } catch (err) {
    captureError(err, { namespace: 'action:alerts', extra: { limit } })
    return { error: 'Noget gik galt — prøv igen.' }
  }
}

/**
 * Afviser en advarsel (soft dismiss).
 */
export async function dismissAlert(alertId: string): Promise<ActionResult<{ id: string }>> {
  const session = await auth()
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  const hasModuleAccess = await canAccessModule(
    session.user.id,
    'companies',
    session.user.organizationId
  )
  if (!hasModuleAccess) return { error: 'Ingen adgang til dette modul' }

  if (!alertId || typeof alertId !== 'string') {
    return { error: 'Ugyldigt alert-id' }
  }

  // Kontrollér at advarslen tilhører brugerens organisation
  const existing = await prisma.alert.findFirst({
    where: {
      id: alertId,
      organization_id: session.user.organizationId,
    },
    select: { id: true, dismissed_at: true },
  })

  if (!existing) return { error: 'Advarslen blev ikke fundet' }
  if (existing.dismissed_at != null) return { error: 'Advarslen er allerede afvist' }

  try {
    await prisma.alert.update({
      where: { id: alertId },
      data: {
        dismissed_at: new Date(),
        dismissed_by: session.user.id,
      },
    })

    revalidatePath('/dashboard')
    revalidateTag('alerts', {})
    return { data: { id: alertId } }
  } catch (err) {
    captureError(err, { namespace: 'action:alerts', extra: { alertId } })
    return { error: 'Noget gik galt — prøv igen.' }
  }
}

// Cache-nøgle inkluderer orgId. TTL 60s: stats ændres kun ved dismiss/ny scan.
const fetchAlertStats = unstable_cache(
  async (orgId: string) => {
    return prisma.alert.groupBy({
      by: ['severity'],
      where: {
        organization_id: orgId,
        dismissed_at: null,
      },
      _count: { id: true },
    })
  },
  ['alert-stats'],
  { revalidate: 60, tags: ['alerts'] }
)

/**
 * Returnerer en optælling af aktive advarsler per alvorlighed.
 */
export async function getAlertStats(): Promise<ActionResult<AlertStats>> {
  const session = await auth()
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  const hasModuleAccess = await canAccessModule(
    session.user.id,
    'companies',
    session.user.organizationId
  )
  if (!hasModuleAccess) return { error: 'Ingen adgang til dette modul' }

  try {
    const groups = await fetchAlertStats(session.user.organizationId)

    const stats: AlertStats = { critical: 0, warning: 0, info: 0, total: 0 }
    for (const g of groups) {
      const count = g._count.id
      if (g.severity === 'CRITICAL') stats.critical = count
      else if (g.severity === 'WARNING') stats.warning = count
      else if (g.severity === 'INFO') stats.info = count
      stats.total += count
    }

    return { data: stats }
  } catch (err) {
    captureError(err, { namespace: 'action:alerts', extra: {} })
    return { error: 'Noget gik galt — prøv igen.' }
  }
}
