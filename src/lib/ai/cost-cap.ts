import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/logger'

const log = createLogger('ai-cost-cap')

export interface CostCapCheckResult {
  allowed: boolean
  reason?: string
}

export interface CostCapStatus {
  capUsd: number | null
  currentUsd: number
  percentage: number
  threshold: 'none' | '50-info' | '75-warn' | '90-alert' | 'exceeded'
}

/**
 * Tjekker om organisation har nået månedlig cost-cap. Bruges FØR hver AI-kald.
 * Returnerer {allowed: false} hvis capped — AI-kald bør afvises med brugervenlig besked.
 */
export async function checkCostCap(organizationId: string): Promise<CostCapCheckResult> {
  const status = await getCostCapStatus(organizationId)
  if (status.capUsd === null) return { allowed: true }
  if (status.currentUsd >= status.capUsd) {
    log.warn(
      { orgId: organizationId, current: status.currentUsd, cap: status.capUsd },
      'AI cost cap exceeded — blocking call'
    )
    return { allowed: false, reason: 'Månedlig AI-cap er nået — kontakt admin' }
  }
  return { allowed: true }
}

/**
 * Returnerer detaljeret status for cap-brug. Bruges af dashboard + soft-alerts.
 */
export async function getCostCapStatus(organizationId: string): Promise<CostCapStatus> {
  const settings = await prisma.organizationAISettings.findUnique({
    where: { organization_id: organizationId },
  })
  const capUsd = settings?.monthly_cost_cap_usd ? Number(settings.monthly_cost_cap_usd) : null

  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const agg = await prisma.aIUsageLog.aggregate({
    where: { organization_id: organizationId, created_at: { gte: monthStart } },
    _sum: { cost_usd: true },
  })
  const currentUsd = Number(agg._sum.cost_usd ?? 0)

  if (capUsd === null) {
    return { capUsd: null, currentUsd, percentage: 0, threshold: 'none' }
  }

  const percentage = Math.round((currentUsd / capUsd) * 100)
  const threshold: CostCapStatus['threshold'] =
    percentage >= 100
      ? 'exceeded'
      : percentage >= 90
        ? '90-alert'
        : percentage >= 75
          ? '75-warn'
          : percentage >= 50
            ? '50-info'
            : 'none'

  return { capUsd, currentUsd, percentage, threshold }
}
