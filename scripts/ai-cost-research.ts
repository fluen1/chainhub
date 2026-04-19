/**
 * AI-cost-research: Assist bruger med at måle reel AI-forbrug.
 *
 * Kør: npx tsx scripts/ai-cost-research.ts
 * Kræver: DATABASE_URL/DIRECT_URL + valid Prisma client.
 *
 * Scriptet kører IKKE AI-kald — det læser kun eksisterende AIUsageLog og
 * rapporterer aggregater + statistik. Efter manuel browsing af
 * /companies/[id] (som trigger insights-generering) kan dette script
 * køres igen for at verificere logging og se målte tal.
 */

import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

import { prisma } from '../src/lib/db'
import { createLogger } from '../src/lib/ai/logger'

const log = createLogger('cost-research')

async function main() {
  log.info('AI cost research — inspect AIUsageLog')

  const org = await prisma.organization.findFirst({ orderBy: { created_at: 'asc' } })
  if (!org) {
    log.error('No organization found — run prisma db seed first')
    process.exit(1)
  }
  log.info({ orgId: org.id, name: org.name }, 'Using organization')

  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

  const [total, byFeature, byModel, recent] = await Promise.all([
    prisma.aIUsageLog.aggregate({
      where: { organization_id: org.id, created_at: { gte: monthStart } },
      _sum: { cost_usd: true, input_tokens: true, output_tokens: true },
      _count: true,
    }),
    prisma.aIUsageLog.groupBy({
      by: ['feature'],
      where: { organization_id: org.id, created_at: { gte: monthStart } },
      _sum: { cost_usd: true, input_tokens: true, output_tokens: true },
      _count: true,
    }),
    prisma.aIUsageLog.groupBy({
      by: ['model'],
      where: { organization_id: org.id, created_at: { gte: monthStart } },
      _sum: { cost_usd: true },
      _count: true,
    }),
    prisma.aIUsageLog.findMany({
      where: { organization_id: org.id },
      orderBy: { created_at: 'desc' },
      take: 10,
    }),
  ])

  log.info(
    {
      calls: total._count,
      totalCostUsd: Number(total._sum.cost_usd ?? 0),
      totalInputTokens: total._sum.input_tokens ?? 0,
      totalOutputTokens: total._sum.output_tokens ?? 0,
    },
    'Månedligt total'
  )

  log.info('Pr. feature:')
  byFeature.forEach((row) => {
    const avg = row._count > 0 ? Number(row._sum.cost_usd ?? 0) / row._count : 0
    log.info(
      {
        feature: row.feature,
        calls: row._count,
        totalCostUsd: Number(row._sum.cost_usd ?? 0),
        avgCostPerCall: avg,
        totalInputTokens: row._sum.input_tokens ?? 0,
        totalOutputTokens: row._sum.output_tokens ?? 0,
      },
      `  ${row.feature}`
    )
  })

  log.info('Pr. model:')
  byModel.forEach((row) => {
    log.info(
      { model: row.model, calls: row._count, totalCostUsd: Number(row._sum.cost_usd ?? 0) },
      `  ${row.model}`
    )
  })

  log.info(`Seneste ${recent.length} kald:`)
  recent.forEach((r) => {
    log.info(
      {
        feature: r.feature,
        model: r.model,
        cost: Number(r.cost_usd),
        resource: `${r.resource_type ?? 'unknown'}:${r.resource_id ?? 'unknown'}`,
        createdAt: r.created_at.toISOString(),
      },
      `  ${r.id.slice(0, 8)}`
    )
  })

  if (total._count === 0) {
    log.info(
      '\nIngen forbrug registreret endnu.\n' +
        'For at måle real-world forbrug:\n' +
        '  1. Sæt AI_EXTRACTION_ENABLED=true i .env.local\n' +
        '  2. Opret OrganizationAISettings for denne org med ai_mode=LIVE\n' +
        '  3. Browse 5-10 gange til /companies/[id] med forskellige selskaber\n' +
        '  4. Genkør dette script — eller browse /settings/ai-usage\n'
    )
  }

  await prisma.$disconnect()
}

main().catch((err) => {
  log.error({ err: err instanceof Error ? err.message : String(err) }, 'Research script failed')
  process.exit(1)
})
