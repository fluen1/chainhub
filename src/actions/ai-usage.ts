'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canAccessModule } from '@/lib/permissions'
import { getCostCapStatus } from '@/lib/ai/cost-cap'
import { captureError } from '@/lib/logger'
import type { ActionResult } from '@/types/actions'

// ────────────────────────────────────────────────────────────────────────────
// Settings-side AI-usage widget
// ────────────────────────────────────────────────────────────────────────────

export interface SettingsAIUsage {
  /** Antal extraction-kald denne måned */
  used: number
  /** Månedlig kvota (antal extractions) */
  max: number
  /** 0–100 — clamped */
  percent: number
  /** USD-based threshold fra cost-cap spec */
  threshold: 'none' | '50-info' | '75-warn' | '90-alert' | 'exceeded'
  /** Faktisk cost-cap i USD (til visning) */
  capUsd: number
  /** Forbrug i USD denne måned */
  currentUsd: number
}

/**
 * Henter AI-usage til settings-sidens widget. Kombinerer extraction-count
 * (brugte kald) med cost-cap status (tærskler).
 *
 * Max extractions: Hentes fra OrganizationAISettings.rate_limit_per_day.
 * TODO Plus-tier-mapping når tier-model er aktiveret — indtil da bruges
 * rate_limit_per_day som månedlig proxy (default 1000).
 */
export async function getSettingsAIUsage(organizationId: string): Promise<SettingsAIUsage> {
  try {
    const now = new Date()
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

    // Hent settings én gang — undgår redundant findUnique da getCostCapStatus også kalder den.
    // extractionCount og aiSettings hentes parallelt med getCostCapStatus.
    const [capStatus, extractionCount, aiSettings] = await Promise.all([
      getCostCapStatus(organizationId),
      prisma.aIUsageLog.count({
        where: {
          organization_id: organizationId,
          feature: 'extraction',
          created_at: { gte: monthStart },
        },
      }),
      // rate_limit_per_day er ikke eksponeret af getCostCapStatus, så vi henter det her.
      // TODO: Refaktorér getCostCapStatus til at returnere fuld settings-model (næste sprint)
      prisma.organizationAISettings.findUnique({
        where: { organization_id: organizationId },
        select: { rate_limit_per_day: true },
      }),
    ])

    // TODO Plus-tier-mapping når tier-model er aktiveret
    const max = aiSettings?.rate_limit_per_day ?? 1000
    const percent = max > 0 ? Math.min(100, Math.round((extractionCount / max) * 100)) : 0

    return {
      used: extractionCount,
      max,
      percent,
      threshold: capStatus.threshold,
      capUsd: capStatus.capUsd,
      currentUsd: capStatus.currentUsd,
    }
  } catch (err) {
    captureError(err, { namespace: 'action:getSettingsAIUsage', extra: { organizationId } })
    // Fail-safe: returner tomme tal frem for at crashe siden
    return { used: 0, max: 1000, percent: 0, threshold: 'none', capUsd: 50, currentUsd: 0 }
  }
}

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

  const hasAccess = await canAccessModule(
    session.user.id,
    'user_management',
    session.user.organizationId
  )
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
