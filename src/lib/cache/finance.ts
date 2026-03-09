/**
 * Finance Cache Helpers
 * BA-09 (Performance-agent) — Sprint 5
 *
 * Nøgletal ændrer sig sjældent (typisk kvartalsvis/årligt).
 * Cache med 1-times TTL — invalideres eksplicit ved mutation.
 *
 * Cache-nøgle-format (DEC-019/CACHING.md princip 5):
 *   finance:metrics:{organizationId}:{companyId}
 *   finance:overview:{organizationId}:{companyId}
 *
 * ALDRIG: cache uden organizationId (tenant-isolation-brud).
 */

import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/db'
import type { FinancialMetric } from '@prisma/client'
import type { FinancialMetricWithCompany } from '@/types/finance'

// ==================== CACHE TAG HJÆLPERE ====================

/**
 * Returnerer cache-tags for et selskabs finansielle data.
 * Bruges til både cache-oprettelse og invalidering.
 */
export function getFinanceCacheTags(organizationId: string, companyId: string): string[] {
  return [
    `finance:${organizationId}:${companyId}`,
    `finance:${organizationId}`,
    `dashboard:${organizationId}`, // Dashboard viser nøgletal — invalider også det
  ]
}

/**
 * Invalider alle finance-caches for et selskab.
 * SKAL kaldes ved: createFinancialMetric, updateFinancialMetric, deleteFinancialMetric.
 */
export async function invalidateFinanceCache(
  organizationId: string,
  companyId: string
): Promise<void> {
  const { revalidateTag } = await import('next/cache')
  // Invalider selskabs-specifik cache
  revalidateTag(`finance:${organizationId}:${companyId}`)
}

/**
 * Invalider alle finance-caches for en organisation.
 * SKAL kaldes ved: bulk-operationer eller plan-ændringer.
 */
export async function invalidateAllFinanceCache(organizationId: string): Promise<void> {
  const { revalidateTag } = await import('next/cache')
  revalidateTag(`finance:${organizationId}`)
}

// ==================== CACHED QUERIES ====================

/**
 * getCachedFinancialMetrics — cached liste af nøgletal.
 *
 * TTL: 3600 sekunder (1 time).
 * Nøgletal for et givet selskab/år ændrer sig ikke hyppigt.
 * Invalideres eksplicit ved mutation i finance.ts server actions.
 *
 * @param organizationId - PÅKRÆVET for tenant-isolation
 * @param companyId - Filtrerer til specifikt selskab
 * @param periodYear - Valgfrit årsfilter
 * @param metricType - Valgfrit typefilter
 * @param page - Sidenummer (1-baseret)
 * @param pageSize - Antal per side (max 100)
 */
export function getCachedFinancialMetrics(
  organizationId: string,
  companyId: string,
  periodYear?: number,
  metricType?: string,
  page: number = 1,
  pageSize: number = 20
): Promise<{ metrics: FinancialMetric[]; total: number; hasMore: boolean }> {
  // Cache-nøgle inkluderer alle parametre for korrekt cache-invalidering
  const cacheKey = [
    `finance-metrics`,
    organizationId,
    companyId,
    periodYear?.toString() ?? 'all',
    metricType ?? 'all',
    `page-${page}`,
    `size-${pageSize}`,
  ].join('-')

  return unstable_cache(
    async () => {
      const skip = (page - 1) * pageSize
      const where = {
        organizationId,
        companyId,
        ...(periodYear !== undefined ? { periodYear } : {}),
        ...(metricType !== undefined ? { metricType: metricType as never } : {}),
      }

      // Paralleliser count og data-query
      const [total, metrics] = await Promise.all([
        prisma.financialMetric.count({ where }),
        prisma.financialMetric.findMany({
          where,
          orderBy: [{ periodYear: 'desc' }, { periodType: 'asc' }, { metricType: 'asc' }],
          take: pageSize,
          skip,
        }),
      ])

      return {
        metrics,
        total,
        hasMore: skip + metrics.length < total,
      }
    },
    [cacheKey],
    {
      revalidate: 3600, // 1 time — nøgletal ændrer sig sjældent
      tags: getFinanceCacheTags(organizationId, companyId),
    }
  )()
}

/**
 * getCachedFinancialOverview — cached overblik for et selskab.
 *
 * TTL: 3600 sekunder (1 time).
 * Inkluderer metrics + tilgængelige år.
 * Bruges på company-detail-siden og dashboard.
 */
export function getCachedFinancialOverview(
  organizationId: string,
  companyId: string
): Promise<{
  metrics: FinancialMetricWithCompany[]
  availableYears: number[]
}> {
  const cacheKey = `finance-overview-${organizationId}-${companyId}`

  return unstable_cache(
    async () => {
      const metrics = await prisma.financialMetric.findMany({
        where: { organizationId, companyId },
        include: {
          company: { select: { id: true, name: true } },
        },
        orderBy: [{ periodYear: 'desc' }, { metricType: 'asc' }],
      })

      const availableYears = [...new Set(metrics.map((m) => m.periodYear))].sort(
        (a, b) => b - a
      )

      return {
        metrics: metrics as FinancialMetricWithCompany[],
        availableYears,
      }
    },
    [cacheKey],
    {
      revalidate: 3600,
      tags: getFinanceCacheTags(organizationId, companyId),
    }
  )()
}

/**
 * getCachedLatestMetricsByType — hurtig lookup af seneste nøgletal per type.
 *
 * TTL: 3600 sekunder.
 * Bruges til dashboard-widget og company-kort.
 * Returnerer kun HELAAR-metrics for seneste tilgængelige år per type.
 */
export function getCachedLatestMetricsByType(
  organizationId: string,
  companyId: string
): Promise<Record<string, { value: number; year: number; source: string }>> {
  const cacheKey = `finance-latest-${organizationId}-${companyId}`

  return unstable_cache(
    async () => {
      // Bruger $queryRaw med DISTINCT ON for at hente seneste per type effektivt
      const { Prisma } = await import('@prisma/client')
      const rows = await prisma.$queryRaw<
        Array<{
          metric_type: string
          value: string
          period_year: number
          source: string
        }>
      >(
        Prisma.sql`
          SELECT DISTINCT ON (metric_type)
            metric_type,
            value::text AS value,
            period_year,
            source
          FROM financial_metrics
          WHERE organization_id = ${organizationId}
            AND company_id = ${companyId}
            AND period_type = 'HELAAR'
          ORDER BY metric_type, period_year DESC
        `
      )

      return Object.fromEntries(
        rows.map((r) => [
          r.metric_type,
          {
            value: parseFloat(r.value),
            year: r.period_year,
            source: r.source,
          },
        ])
      )
    },
    [cacheKey],
    {
      revalidate: 3600,
      tags: getFinanceCacheTags(organizationId, companyId),
    }
  )()
}