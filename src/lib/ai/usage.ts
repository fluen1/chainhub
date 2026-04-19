import { prisma } from '@/lib/db'
import { captureError, createLogger } from '@/lib/logger'

const log = createLogger('ai-usage')

export type AIFeature =
  | 'extraction'
  | 'insights'
  | 'portfolio_insights'
  | 'search_ai'
  | 'calendar_events'

export interface RecordUsageInput {
  organizationId: string
  feature: AIFeature
  model: string
  provider: 'anthropic' | 'bedrock'
  inputTokens: number
  outputTokens: number
  costUsd: number
  resourceType?: string
  resourceId?: string
  cached?: boolean
}

/**
 * Logger AI-forbrug til AIUsageLog-tabellen. Bruges fra alle AI-jobs
 * efter en model-kald. Sluger DB-fejl stille via captureError — et fejlet
 * log må ikke bringe AI-flowet ned.
 */
export async function recordAIUsage(input: RecordUsageInput): Promise<void> {
  try {
    await prisma.aIUsageLog.create({
      data: {
        organization_id: input.organizationId,
        feature: input.feature,
        model: input.model,
        provider: input.provider,
        input_tokens: input.inputTokens,
        output_tokens: input.outputTokens,
        cost_usd: input.costUsd,
        resource_type: input.resourceType ?? null,
        resource_id: input.resourceId ?? null,
        cached: input.cached ?? false,
      },
    })
  } catch (err) {
    captureError(err, {
      namespace: 'ai:usage:record',
      extra: { organizationId: input.organizationId, feature: input.feature },
    })
    log.warn({ orgId: input.organizationId }, 'AI usage log failed (non-fatal)')
  }
}

export interface MonthlyUsage {
  totalCostUsd: number
  byFeature: Array<{ feature: string; costUsd: number }>
}

/**
 * Aggregerer AI-forbrug for en organisation for indeværende kalendermåned (UTC).
 * Bruges i /settings/ai-usage dashboard.
 */
export async function getMonthlyUsage(organizationId: string): Promise<MonthlyUsage> {
  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

  const [totalAgg, featureAgg] = await Promise.all([
    prisma.aIUsageLog.aggregate({
      where: { organization_id: organizationId, created_at: { gte: monthStart } },
      _sum: { cost_usd: true },
    }),
    prisma.aIUsageLog.groupBy({
      by: ['feature'],
      where: { organization_id: organizationId, created_at: { gte: monthStart } },
      _sum: { cost_usd: true },
    }),
  ])

  return {
    totalCostUsd: Number(totalAgg._sum.cost_usd ?? 0),
    byFeature: featureAgg.map((row) => ({
      feature: row.feature,
      costUsd: Number(row._sum.cost_usd ?? 0),
    })),
  }
}
