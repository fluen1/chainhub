'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canAccessModule } from '@/lib/permissions'
import { getCostCapStatus } from '@/lib/ai/cost-cap'
import { captureError } from '@/lib/logger'
import type { ActionResult } from '@/types/actions'

export interface AIUsageDashboardData {
  totalCostUsd: number
  capUsd: number
  percentage: number
  threshold: string
  byFeature: Array<{ feature: string; costUsd: number }>
  byModel: Array<{ model: string; costUsd: number }>
  recent: Array<{
    id: string
    feature: string
    model: string
    costUsd: number
    createdAt: Date
    resourceType: string | null
    resourceId: string | null
  }>
}

export async function getAIUsageDashboard(): Promise<ActionResult<AIUsageDashboardData>> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  const hasAccess = await canAccessModule(session.user.id, 'user_management')
  if (!hasAccess) return { error: 'Kun admin har adgang til AI-forbrug' }

  try {
    const orgId = session.user.organizationId
    const now = new Date()
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

    const [capStatus, byFeatureRaw, byModelRaw, recent] = await Promise.all([
      getCostCapStatus(orgId),
      prisma.aIUsageLog.groupBy({
        by: ['feature'],
        where: { organization_id: orgId, created_at: { gte: monthStart } },
        _sum: { cost_usd: true },
      }),
      prisma.aIUsageLog.groupBy({
        by: ['model'],
        where: { organization_id: orgId, created_at: { gte: monthStart } },
        _sum: { cost_usd: true },
      }),
      prisma.aIUsageLog.findMany({
        where: { organization_id: orgId },
        orderBy: { created_at: 'desc' },
        take: 25,
      }),
    ])

    return {
      data: {
        totalCostUsd: capStatus.currentUsd,
        capUsd: capStatus.capUsd,
        percentage: capStatus.percentage,
        threshold: capStatus.threshold,
        byFeature: byFeatureRaw.map((r) => ({
          feature: r.feature,
          costUsd: Number(r._sum.cost_usd ?? 0),
        })),
        byModel: byModelRaw.map((r) => ({
          model: r.model,
          costUsd: Number(r._sum.cost_usd ?? 0),
        })),
        recent: recent.map((r) => ({
          id: r.id,
          feature: r.feature,
          model: r.model,
          costUsd: Number(r.cost_usd),
          createdAt: r.created_at,
          resourceType: r.resource_type,
          resourceId: r.resource_id,
        })),
      },
    }
  } catch (err) {
    captureError(err, { namespace: 'action:getAIUsageDashboard' })
    return { error: 'Kunne ikke hente AI-forbrug — prøv igen' }
  }
}
