'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canAccessCompany, canAccessModule } from '@/lib/permissions'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/types/actions'
import { captureError } from '@/lib/logger'
import { zodMetricType, zodPeriodType, zodMetricSource } from '@/lib/zod-enums'

const upsertMetricSchema = z.object({
  companyId: z.string().min(1, 'Selskab mangler'),
  metricType: zodMetricType,
  periodType: zodPeriodType,
  periodYear: z.coerce.number().int().min(1990).max(2100),
  value: z.coerce.number(),
  currency: z.string().default('DKK'),
  source: zodMetricSource.default('UREVIDERET'),
  notes: z.string().optional(),
})

export async function upsertFinancialMetric(
  input: z.infer<typeof upsertMetricSchema>
): Promise<ActionResult<unknown>> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  const parsed = upsertMetricSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Ugyldigt input' }

  const hasFinance = await canAccessModule(session.user.id, 'finance')
  if (!hasFinance) return { error: 'Ingen adgang til økonomi-modulet' }

  const hasCompany = await canAccessCompany(session.user.id, parsed.data.companyId)
  if (!hasCompany) return { error: 'Ingen adgang til dette selskab' }

  try {
    const metric = await prisma.financialMetric.upsert({
      where: {
        organization_id_company_id_metric_type_period_type_period_year: {
          organization_id: session.user.organizationId,
          company_id: parsed.data.companyId,
          metric_type: parsed.data.metricType,
          period_type: parsed.data.periodType,
          period_year: parsed.data.periodYear,
        },
      },
      update: {
        value: parsed.data.value,
        source: parsed.data.source,
        notes: parsed.data.notes || null,
      },
      create: {
        organization_id: session.user.organizationId,
        company_id: parsed.data.companyId,
        metric_type: parsed.data.metricType,
        period_type: parsed.data.periodType,
        period_year: parsed.data.periodYear,
        value: parsed.data.value,
        currency: parsed.data.currency,
        source: parsed.data.source,
        notes: parsed.data.notes || null,
        created_by: session.user.id,
      },
    })

    revalidatePath(`/companies/${parsed.data.companyId}/finance`)
    return { data: metric }
  } catch (err) {
    captureError(err, {
      namespace: 'action:upsertFinancialMetric',
      extra: {
        companyId: parsed.data.companyId,
        metricType: parsed.data.metricType,
        periodYear: parsed.data.periodYear,
      },
    })
    return { error: 'Nøgletallet kunne ikke gemmes — prøv igen' }
  }
}

const dividendSchema = z.object({
  companyId: z.string().uuid(),
  periodYear: z.coerce.number().int().min(1990),
  amount: z.coerce.number().positive(),
  decidedAt: z.string(),
  note: z.string().optional(),
})

export async function createDividendRecord(
  input: z.infer<typeof dividendSchema>
): Promise<ActionResult<unknown>> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  const parsed = dividendSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  const hasFinance = await canAccessModule(session.user.id, 'finance')
  if (!hasFinance) return { error: 'Ingen adgang til økonomi-modulet' }

  const hasCompany = await canAccessCompany(session.user.id, parsed.data.companyId)
  if (!hasCompany) return { error: 'Ingen adgang til dette selskab' }

  try {
    // Gemmes som FinancialMetric med type EBITDA indtil DividendRecord-tabel er tilgængelig
    // BUILD-CLARIFICATION: DATABASE-SCHEMA.md nævner udbytte som nøgletal i FinancialMetric
    // Vi bruger en JSONB-note i FinancialMetric til udbyttebeløbet
    const metric = await prisma.financialMetric.create({
      data: {
        organization_id: session.user.organizationId,
        company_id: parsed.data.companyId,
        metric_type: 'ANDET_METRIC',
        period_type: 'HELAAR',
        period_year: parsed.data.periodYear,
        value: parsed.data.amount,
        currency: 'DKK',
        source: 'REVIDERET',
        notes: `UDBYTTE ${parsed.data.decidedAt}${parsed.data.note ? `: ${parsed.data.note}` : ''}`,
        created_by: session.user.id,
      },
    })

    revalidatePath(`/companies/${parsed.data.companyId}/finance`)
    return { data: metric }
  } catch (err) {
    captureError(err, {
      namespace: 'action:createDividendRecord',
      extra: { companyId: parsed.data.companyId, periodYear: parsed.data.periodYear },
    })
    return { error: 'Udbytteregistreringen kunne ikke gemmes — prøv igen' }
  }
}
