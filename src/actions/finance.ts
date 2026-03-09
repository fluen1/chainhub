'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canAccessCompany, canAccessSensitivity, canAccessModule } from '@/lib/permissions'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { MetricType, PeriodType } from '@prisma/client'
import {
  createFinancialMetricSchema,
  updateFinancialMetricSchema,
  deleteFinancialMetricSchema,
  listFinancialMetricsSchema,
  createTimeEntrySchema,
  updateTimeEntrySchema,
  deleteTimeEntrySchema,
  listTimeEntriesSchema,
  createInvoiceSchema,
  updateInvoiceSchema,
  deleteInvoiceSchema,
  listInvoicesSchema,
  createDividendSchema,
  updateDividendSchema,
  deleteDividendSchema,
  listDividendsSchema,
} from '@/lib/validations/finance'
import {
  getCachedFinancialMetrics,
  getCachedFinancialOverview,
  invalidateFinanceCache,
} from '@/lib/cache/finance'
import type {
  ActionResult,
  FinancialMetricWithCompany,
  TimeEntryWithUser,
  TimeEntrySummary,
  InvoiceWithCompany,
  InvoiceSummary,
  DividendWithCompany,
} from '@/types/finance'
import type { FinancialMetric, TimeEntry } from '@prisma/client'

// ==================== PAGINATION-KONSTANTER ====================

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100

// ==================== INTERNE HJÆLPERE ====================

/**
 * Tjekker om den aktuelle bruger har adgang til økonomi-data (FORTROLIG minimum).
 * SKAL kaldes på ALLE finance-queries.
 */
async function requireFinanceAccess(userId: string): Promise<string | null> {
  const hasModule = await canAccessModule(userId, 'finance')
  if (!hasModule) return 'Du har ikke adgang til økonomi-modulet'

  const hasSensitivity = await canAccessSensitivity(userId, 'FORTROLIG')
  if (!hasSensitivity) return 'Du har ikke adgang til fortrolige økonomidata'

  return null
}

// ==================== NØGLETAL ====================

export async function createFinancialMetric(
  input: z.infer<typeof createFinancialMetricSchema>
): Promise<ActionResult<FinancialMetric>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const accessError = await requireFinanceAccess(session.user.id)
  if (accessError) return { error: accessError }

  const parsed = createFinancialMetricSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { error: firstError?.message ?? 'Ugyldigt input' }
  }

  const { companyId, metricType, periodType, periodYear, value, currency, source, notes } =
    parsed.data

  const hasAccess = await canAccessCompany(session.user.id, companyId)
  if (!hasAccess) return { error: 'Du har ikke adgang til dette selskab' }

  const company = await prisma.company.findUnique({
    where: { id: companyId, organizationId: session.user.organizationId, deletedAt: null },
    select: { id: true, name: true },
  })
  if (!company) return { error: 'Selskabet blev ikke fundet' }

  try {
    const metric = await prisma.financialMetric.create({
      data: {
        organizationId: session.user.organizationId,
        companyId,
        metricType,
        periodType,
        periodYear,
        value,
        currency,
        source,
        notes: notes ?? null,
        createdBy: session.user.id,
      },
    })

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'CREATE',
        resourceType: 'financial_metric',
        resourceId: metric.id,
        sensitivity: 'FORTROLIG',
      },
    })

    // Invalider finance-cache for dette selskab
    await invalidateFinanceCache(session.user.organizationId, companyId)

    revalidatePath(`/companies/${companyId}/finance`)
    revalidatePath('/finance')
    return { data: metric }
  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      return {
        error:
          'Der findes allerede et nøgletal af denne type for den valgte periode og det valgte selskab',
      }
    }
    console.error('createFinancialMetric error:', error)
    return { error: 'Nøgletal kunne ikke gemmes — prøv igen eller kontakt support' }
  }
}

export async function updateFinancialMetric(
  input: z.infer<typeof updateFinancialMetricSchema>
): Promise<ActionResult<FinancialMetric>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const accessError = await requireFinanceAccess(session.user.id)
  if (accessError) return { error: accessError }

  const parsed = updateFinancialMetricSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { error: firstError?.message ?? 'Ugyldigt input' }
  }

  const { metricId, companyId, value, source, notes } = parsed.data

  const hasAccess = await canAccessCompany(session.user.id, companyId)
  if (!hasAccess) return { error: 'Du har ikke adgang til dette selskab' }

  try {
    const existing = await prisma.financialMetric.findFirst({
      where: {
        id: metricId,
        companyId,
        organizationId: session.user.organizationId,
      },
    })
    if (!existing) return { error: 'Nøgletallet blev ikke fundet' }

    const updated = await prisma.financialMetric.update({
      where: { id: metricId },
      data: {
        value: value !== undefined ? value : undefined,
        source: source ?? undefined,
        notes: notes !== undefined ? notes ?? null : undefined,
      },
    })

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'UPDATE',
        resourceType: 'financial_metric',
        resourceId: metricId,
        sensitivity: 'FORTROLIG',
        changes: { value, source, notes },
      },
    })

    // Invalider finance-cache for dette selskab
    await invalidateFinanceCache(session.user.organizationId, companyId)

    revalidatePath(`/companies/${companyId}/finance`)
    revalidatePath('/finance')
    return { data: updated }
  } catch (error) {
    console.error('updateFinancialMetric error:', error)
    return { error: 'Nøgletallet kunne ikke opdateres — prøv igen' }
  }
}

export async function deleteFinancialMetric(
  input: z.infer<typeof deleteFinancialMetricSchema>
): Promise<ActionResult<{ id: string }>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const accessError = await requireFinanceAccess(session.user.id)
  if (accessError) return { error: accessError }

  const parsed = deleteFinancialMetricSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  const { metricId, companyId } = parsed.data

  const hasAccess = await canAccessCompany(session.user.id, companyId)
  if (!hasAccess) return { error: 'Du har ikke adgang til dette selskab' }

  try {
    const existing = await prisma.financialMetric.findFirst({
      where: {
        id: metricId,
        companyId,
        organizationId: session.user.organizationId,
      },
    })
    if (!existing) return { error: 'Nøgletallet blev ikke fundet' }

    await prisma.financialMetric.delete({ where: { id: metricId } })

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'DELETE',
        resourceType: 'financial_metric',
        resourceId: metricId,
        sensitivity: 'FORTROLIG',
      },
    })

    // Invalider finance-cache for dette selskab
    await invalidateFinanceCache(session.user.organizationId, companyId)

    revalidatePath(`/companies/${companyId}/finance`)
    revalidatePath('/finance')
    return { data: { id: metricId } }
  } catch (error) {
    console.error('deleteFinancialMetric error:', error)
    return { error: 'Nøgletallet kunne ikke slettes — prøv igen' }
  }
}

/**
 * listFinancialMetrics — med pagination og caching.
 *
 * Sprint 5 ændringer:
 * - Tilføjet page + pageSize pagination (MANGLEDE i Sprint 4)
 * - Bruger getCachedFinancialMetrics() — TTL 1 time
 * - Returnerer { metrics, total, hasMore, page, pageSize }
 */
export async function listFinancialMetrics(
  input: z.infer<typeof listFinancialMetricsSchema>
): Promise<
  ActionResult<{
    metrics: FinancialMetric[]
    total: number
    hasMore: boolean
    page: number
    pageSize: number
  }>
> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const accessError = await requireFinanceAccess(session.user.id)
  if (accessError) return { error: accessError }

  const parsed = listFinancialMetricsSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  const { companyId, periodYear, metricType } = parsed.data

  // Pagination-parametre — brug defaults hvis ikke angivet
  const page = Math.max(1, (input as { page?: number }).page ?? 1)
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, (input as { pageSize?: number }).pageSize ?? DEFAULT_PAGE_SIZE)
  )

  const hasAccess = await canAccessCompany(session.user.id, companyId)
  if (!hasAccess) return { error: 'Du har ikke adgang til dette selskab' }

  try {
    // Brug cached query — ingen direkte Prisma-kald her
    const result = await getCachedFinancialMetrics(
      session.user.organizationId,
      companyId,
      periodYear,
      metricType,
      page,
      pageSize
    )

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'VIEW',
        resourceType: 'financial_metric',
        resourceId: companyId,
        sensitivity: 'FORTROLIG',
      },
    })

    return {
      data: {
        metrics: result.metrics,
        total: result.total,
        hasMore: result.hasMore,
        page,
        pageSize,
      },
    }
  } catch (error) {
    console.error('listFinancialMetrics error:', error)
    return { error: 'Nøgletal kunne ikke hentes — prøv igen' }
  }
}

/**
 * getFinancialOverview — med caching.
 *
 * Sprint 5 ændringer:
 * - Bruger getCachedFinancialOverview() — TTL 1 time
 * - Invalider ved mutation via invalidateFinanceCache()
 */
export async function getFinancialOverview(
  companyId: string
): Promise<
  ActionResult<{
    metrics: FinancialMetricWithCompany[]
    availableYears: number[]
  }>
> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const accessError = await requireFinanceAccess(session.user.id)
  if (accessError) return { error: accessError }

  const companyIdParsed = z.string().uuid().safeParse(companyId)
  if (!companyIdParsed.success) return { error: 'Ugyldigt selskabs-ID' }

  const hasAccess = await canAccessCompany(session.user.id, companyId)
  if (!hasAccess) return { error: 'Du har ikke adgang til dette selskab' }

  try {
    // Brug cached overview — ingen direkte Prisma-kald
    const result = await getCachedFinancialOverview(session.user.organizationId, companyId)

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'VIEW',
        resourceType: 'financial_overview',
        resourceId: companyId,
        sensitivity: 'FORTROLIG',
      },
    })

    return { data: result }
  } catch (error) {
    console.error('getFinancialOverview error:', error)
    return { error: 'Økonomi-overblik kunne ikke hentes — prøv igen' }
  }
}

// ==================== TIDSREGISTRERING ====================

export async function createTimeEntry(
  input: z.infer<typeof createTimeEntrySchema>
): Promise<ActionResult<TimeEntry>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const accessError = await requireFinanceAccess(session.user.id)
  if (accessError) return { error: accessError }

  const parsed = createTimeEntrySchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { error: firstError?.message ?? 'Ugyldigt input' }
  }

  const { caseId, description, minutes, date, billable, hourlyRate } = parsed.data

  const caseRecord = await prisma.case.findUnique({
    where: {
      id: caseId,
      organizationId: session.user.organizationId,
      deletedAt: null,
    },
    select: { id: true, title: true },
  })
  if (!caseRecord) return { error: 'Sagen blev ikke fundet' }

  try {
    const entry = await prisma.timeEntry.create({
      data: {
        organizationId: session.user.organizationId,
        caseId,
        userId: session.user.id,
        description: description ?? null,
        minutes,
        date: new Date(date),
        billable,
        hourlyRate: hourlyRate ?? null,
      },
    })

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'CREATE',
        resourceType: 'time_entry',
        resourceId: entry.id,
        sensitivity: 'FORTROLIG',
      },
    })

    revalidatePath(`/cases/${caseId}`)
    revalidatePath('/finance/time')
    return { data: entry }
  } catch (error) {
    console.error('createTimeEntry error:', error)
    return { error: 'Tidsregistrering kunne ikke gemmes — prøv igen eller kontakt support' }
  }
}

export async function updateTimeEntry(
  input: z.infer<typeof updateTimeEntrySchema>
): Promise<ActionResult<TimeEntry>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const accessError = await requireFinanceAccess(session.user.id)
  if (accessError) return { error: accessError }

  const parsed = updateTimeEntrySchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { error: firstError?.message ?? 'Ugyldigt input' }
  }

  const { timeEntryId, caseId, description, minutes, date, billable, hourlyRate } = parsed.data

  try {
    const existing = await prisma.timeEntry.findFirst({
      where: {
        id: timeEntryId,
        caseId,
        organizationId: session.user.organizationId,
      },
    })
    if (!existing) return { error: 'Tidsregistreringen blev ikke fundet' }

    if (existing.userId !== session.user.id) {
      const hasAdmin = await canAccessSensitivity(session.user.id, 'STRENGT_FORTROLIG')
      if (!hasAdmin) {
        return { error: 'Du kan kun redigere dine egne tidsregistreringer' }
      }
    }

    const updated = await prisma.timeEntry.update({
      where: { id: timeEntryId },
      data: {
        description: description !== undefined ? description ?? null : undefined,
        minutes: minutes ?? undefined,
        date: date ? new Date(date) : undefined,
        billable: billable ?? undefined,
        hourlyRate: hourlyRate !== undefined ? hourlyRate : undefined,
      },
    })

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'UPDATE',
        resourceType: 'time_entry',
        resourceId: timeEntryId,
        sensitivity: 'FORTROLIG',
        changes: { description, minutes, date, billable, hourlyRate },
      },
    })

    revalidatePath(`/cases/${caseId}`)
    revalidatePath('/finance/time')
    return { data: updated }
  } catch (error) {
    console.error('updateTimeEntry error:', error)
    return { error: 'Tidsregistrering kunne ikke opdateres — prøv igen' }
  }
}

export async function deleteTimeEntry(
  input: z.infer<typeof deleteTimeEntrySchema>
): Promise<ActionResult<{ id: string }>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const accessError = await requireFinanceAccess(session.user.id)
  if (accessError) return { error: accessError }

  const parsed = deleteTimeEntrySchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  const { timeEntryId, caseId } = parsed.data

  try {
    const existing = await prisma.timeEntry.findFirst({
      where: {
        id: timeEntryId,
        caseId,
        organizationId: session.user.organizationId,
      },
    })
    if (!existing) return { error: 'Tidsregistreringen blev ikke fundet' }

    if (existing.userId !== session.user.id) {
      const hasAdmin = await canAccessSensitivity(session.user.id, 'STRENGT_FORTROLIG')
      if (!hasAdmin) {
        return { error: 'Du kan kun slette dine egne tidsregistreringer' }
      }
    }

    await prisma.timeEntry.delete({ where: { id: timeEntryId } })

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'DELETE',
        resourceType: 'time_entry',
        resourceId: timeEntryId,
        sensitivity: 'FORTROLIG',
      },
    })

    revalidatePath(`/cases/${caseId}`)
    revalidatePath('/finance/time')
    return { data: { id: timeEntryId } }
  } catch (error) {
    console.error('deleteTimeEntry error:', error)
    return { error: 'Tidsregistrering kunne ikke slettes — prøv igen' }
  }
}

export async function listTimeEntries(
  input: z.infer<typeof listTimeEntriesSchema>
): Promise<ActionResult<TimeEntrySummary>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const accessError = await requireFinanceAccess(session.user.id)
  if (accessError) return { error: accessError }

  const parsed = listTimeEntriesSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  const { caseId, fromDate, toDate } = parsed.data

  // Pagination
  const page = Math.max(1, (input as { page?: number }).page ?? 1)
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, (input as { pageSize?: number }).pageSize ?? DEFAULT_PAGE_SIZE)
  )

  const caseRecord = await prisma.case.findUnique({
    where: {
      id: caseId,
      organizationId: session.user.organizationId,
      deletedAt: null,
    },
    select: { id: true },
  })
  if (!caseRecord) return { error: 'Sagen blev ikke fundet' }

  try {
    const where = {
      organizationId: session.user.organizationId,
      caseId,
      ...(fromDate || toDate
        ? {
            date: {
              ...(fromDate ? { gte: new Date(fromDate) } : {}),
              ...(toDate ? { lte: new Date(toDate) } : {}),
            },
          }
        : {}),
    }

    // Paralleliser count og data-query
    const [total, entries] = await Promise.all([
      prisma.timeEntry.count({ where }),
      prisma.timeEntry.findMany({
        where,
        orderBy: { date: 'desc' },
        take: pageSize,
        skip: (page - 1) * pageSize,
      }),
    ])

    const totalMinutes = entries.reduce((sum, e) => sum + e.minutes, 0)
    const billableMinutes = entries
      .filter((e) => e.billable)
      .reduce((sum, e) => sum + e.minutes, 0)

    return {
      data: {
        totalMinutes,
        billableMinutes,
        nonBillableMinutes: totalMinutes - billableMinutes,
        entries: entries as TimeEntryWithUser[],
        // Pagination metadata
        total,
        hasMore: (page - 1) * pageSize + entries.length < total,
        page,
        pageSize,
      },
    }
  } catch (error) {
    console.error('listTimeEntries error:', error)
    return { error: 'Tidsregistreringer kunne ikke hentes — prøv igen' }
  }
}

// ==================== FAKTURAOVERSIGT ====================

function parseInvoiceFromNotes(metric: FinancialMetric): InvoiceWithCompany | null {
  try {
    if (!metric.notes) return null
    const data = JSON.parse(metric.notes) as {
      __type: string
      invoiceNumber: string
      description: string
      dueDate: string | null
      status: string
      caseId: string | null
      companyName: string
    }
    if (data.__type !== 'INVOICE') return null
    return {
      id: metric.id,
      organizationId: metric.organizationId,
      companyId: metric.companyId,
      caseId: data.caseId,
      invoiceNumber: data.invoiceNumber,
      description: data.description,
      amount: Number(metric.value),
      currency: metric.currency,
      invoiceDate: metric.createdAt,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      status: data.status as 'UDSTEDT' | 'BETALT' | 'FORFALDEN' | 'KREDITERET',
      notes: null,
      createdAt: metric.createdAt,
      createdBy: metric.createdBy,
      deletedAt: null,
      company: { id: metric.companyId, name: data.companyName },
    }
  } catch {
    return null
  }
}

export async function createInvoice(
  input: z.infer<typeof createInvoiceSchema>
): Promise<ActionResult<InvoiceWithCompany>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const accessError = await requireFinanceAccess(session.user.id)
  if (accessError) return { error: accessError }

  const parsed = createInvoiceSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { error: firstError?.message ?? 'Ugyldigt input' }
  }

  const {
    companyId,
    caseId,
    invoiceNumber,
    description,
    amount,
    currency,
    invoiceDate,
    dueDate,
    status,
    notes,
  } = parsed.data

  const hasAccess = await canAccessCompany(session.user.id, companyId)
  if (!hasAccess) return { error: 'Du har ikke adgang til dette selskab' }

  const company = await prisma.company.findUnique({
    where: { id: companyId, organizationId: session.user.organizationId, deletedAt: null },
    select: { id: true, name: true },
  })
  if (!company) return { error: 'Selskabet blev ikke fundet' }

  const invoicePeriodYear = new Date(invoiceDate).getFullYear()

  try {
    const invoiceNotes = JSON.stringify({
      __type: 'INVOICE',
      invoiceNumber,
      description,
      dueDate: dueDate ?? null,
      status,
      caseId: caseId ?? null,
      companyName: company.name,
      userNotes: notes ?? null,
    })

    const metric = await prisma.financialMetric.create({
      data: {
        organizationId: session.user.organizationId,
        companyId,
        metricType: MetricType.ANDET,
        periodType: PeriodType.HELAAR,
        periodYear: invoicePeriodYear,
        value: amount,
        currency,
        source: 'UREVIDERET',
        notes: invoiceNotes,
        createdBy: session.user.id,
      },
    })

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'CREATE',
        resourceType: 'invoice',
        resourceId: metric.id,
        sensitivity: 'FORTROLIG',
      },
    })

    await invalidateFinanceCache(session.user.organizationId, companyId)
    revalidatePath(`/companies/${companyId}/finance`)
    revalidatePath('/finance/invoices')

    const invoice = parseInvoiceFromNotes(metric)
    if (!invoice) return { error: 'Faktura kunne ikke oprettes — prøv igen' }
    return { data: invoice }
  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      return { error: 'En faktura med det samme nummer eksisterer allerede for dette år' }
    }
    console.error('createInvoice error:', error)
    return { error: 'Faktura kunne ikke gemmes — prøv igen eller kontakt support' }
  }
}

export async function updateInvoice(
  input: z.infer<typeof updateInvoiceSchema>
): Promise<ActionResult<InvoiceWithCompany>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const accessError = await requireFinanceAccess(session.user.id)
  if (accessError) return { error: accessError }

  const parsed = updateInvoiceSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { error: firstError?.message ?? 'Ugyldigt input' }
  }

  const { invoiceId, companyId, status, notes, dueDate } = parsed.data

  const hasAccess = await canAccessCompany(session.user.id, companyId)
  if (!hasAccess) return { error: 'Du har ikke adgang til dette selskab' }

  try {
    const existing = await prisma.financialMetric.findFirst({
      where: {
        id: invoiceId,
        companyId,
        organizationId: session.user.organizationId,
        metricType: MetricType.ANDET,
      },
    })
    if (!existing) return { error: 'Faktura ikke fundet' }

    const currentData = existing.notes ? JSON.parse(existing.notes) : {}
    if (currentData.__type !== 'INVOICE') return { error: 'Faktura ikke fundet' }

    const updatedNotes = JSON.stringify({
      ...currentData,
      status: status ?? currentData.status,
      dueDate: dueDate !== undefined ? dueDate : currentData.dueDate,
      userNotes: notes !== undefined ? notes : currentData.userNotes,
    })

    const updated = await prisma.financialMetric.update({
      where: { id: invoiceId },
      data: { notes: updatedNotes },
    })

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'UPDATE',
        resourceType: 'invoice',
        resourceId: invoiceId,
        sensitivity: 'FORTROLIG',
        changes: { status, notes, dueDate },
      },
    })

    await invalidateFinanceCache(session.user.organizationId, companyId)
    revalidatePath(`/companies/${companyId}/finance`)
    revalidatePath('/finance/invoices')

    const invoice = parseInvoiceFromNotes(updated)
    if (!invoice) return { error: 'Faktura kunne ikke opdateres' }
    return { data: invoice }
  } catch (error) {
    console.error('updateInvoice error:', error)
    return { error: 'Faktura kunne ikke opdateres — prøv igen' }
  }
}

export async function deleteInvoice(
  input: z.infer<typeof deleteInvoiceSchema>
): Promise<ActionResult<{ id: string }>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const accessError = await requireFinanceAccess(session.user.id)
  if (accessError) return { error: accessError }

  const parsed = deleteInvoiceSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  const { invoiceId, companyId } = parsed.data

  const hasAccess = await canAccessCompany(session.user.id, companyId)
  if (!hasAccess) return { error: 'Du har ikke adgang til dette selskab' }

  try {
    const existing = await prisma.financialMetric.findFirst({
      where: {
        id: invoiceId,
        companyId,
        organizationId: session.user.organizationId,
        metricType: MetricType.ANDET,
      },
    })
    if (!existing) return { error: 'Faktura ikke fundet' }

    const currentData = existing.notes ? JSON.parse(existing.notes) : {}
    if (currentData.__type !== 'INVOICE') return { error: 'Faktura ikke fundet' }

    await prisma.financialMetric.delete({ where: { id: invoiceId } })

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'DELETE',
        resourceType: 'invoice',
        resourceId: invoiceId,
        sensitivity: 'FORTROLIG',
      },
    })

    await invalidateFinanceCache(session.user.organizationId, companyId)
    revalidatePath(`/companies/${companyId}/finance`)
    revalidatePath('/finance/invoices')
    return { data: { id: invoiceId } }
  } catch (error) {
    console.error('deleteInvoice error:', error)
    return { error: 'Faktura kunne ikke slettes — prøv igen' }
  }
}

/**
 * listInvoices — med pagination (allerede i original, bevaret + forbedret).
 */
export async function listInvoices(
  input: z.infer<typeof listInvoicesSchema>
): Promise<ActionResult<{ invoices: InvoiceWithCompany[]; summary: InvoiceSummary }>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const accessError = await requireFinanceAccess(session.user.id)
  if (accessError) return { error: accessError }

  const parsed = listInvoicesSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  const { companyId, status, limit, offset } = parsed.data

  // Enforcer max page-size
  const take = Math.min(limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)
  const skip = offset ?? 0

  if (companyId) {
    const hasAccess = await canAccessCompany(session.user.id, companyId)
    if (!hasAccess) return { error: 'Du har ikke adgang til dette selskab' }
  }

  try {
    const metrics = await prisma.financialMetric.findMany({
      where: {
        organizationId: session.user.organizationId,
        metricType: MetricType.ANDET,
        ...(companyId ? { companyId } : {}),
        notes: { contains: '"__type":"INVOICE"' },
      },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    })

    const invoices = metrics
      .map(parseInvoiceFromNotes)
      .filter((inv): inv is InvoiceWithCompany => inv !== null)
      .filter((inv) => !status || inv.status === status)

    const summary: InvoiceSummary = {
      totalAmount: invoices.reduce((sum, inv) => sum + inv.amount, 0),
      paidAmount: invoices
        .filter((inv) => inv.status === 'BETALT')
        .reduce((sum, inv) => sum + inv.amount, 0),
      outstandingAmount: invoices
        .filter((inv) => inv.status === 'UDSTEDT')
        .reduce((sum, inv) => sum + inv.amount, 0),
      overdueAmount: invoices
        .filter((inv) => inv.status === 'FORFALDEN')
        .reduce((sum, inv) => sum + inv.amount, 0),
      invoiceCount: invoices.length,
    }

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'VIEW',
        resourceType: 'invoice',
        resourceId: companyId ?? session.user.organizationId,
        sensitivity: 'FORTROLIG',
      },
    })

    return { data: { invoices, summary } }
  } catch (error) {
    console.error('listInvoices error:', error)
    return { error: 'Fakturaer kunne ikke hentes — prøv igen' }
  }
}

// ==================== UDBYTTENOTERING ====================

function parseDividendFromNotes(metric: FinancialMetric): DividendWithCompany | null {
  try {
    if (!metric.notes) return null
    const data = JSON.parse(metric.notes) as {
      __type: string
      dividendDate: string
      companyName: string
      userNotes: string | null
    }
    if (data.__type !== 'DIVIDEND') return null
    return {
      id: metric.id,
      organizationId: metric.organizationId,
      companyId: metric.companyId,
      amount: Number(metric.value),
      currency: metric.currency,
      dividendDate: new Date(data.dividendDate),
      notes: data.userNotes,
      createdAt: metric.createdAt,
      createdBy: metric.createdBy,
      company: { id: metric.companyId, name: data.companyName },
    }
  } catch {
    return null
  }
}

export async function createDividend(
  input: z.infer<typeof createDividendSchema>
): Promise<ActionResult<DividendWithCompany>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const accessError = await requireFinanceAccess(session.user.id)
  if (accessError) return { error: accessError }

  const parsed = createDividendSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { error: firstError?.message ?? 'Ugyldigt input' }
  }

  const { companyId, amount, currency, dividendDate, notes } = parsed.data

  const hasAccess = await canAccessCompany(session.user.id, companyId)
  if (!hasAccess) return { error: 'Du har ikke adgang til dette selskab' }

  const company = await prisma.company.findUnique({
    where: { id: companyId, organizationId: session.user.organizationId, deletedAt: null },
    select: { id: true, name: true },
  })
  if (!company) return { error: 'Selskabet blev ikke fundet' }

  const dividendYear = new Date(dividendDate).getFullYear()

  try {
    const dividendNotes = JSON.stringify({
      __type: 'DIVIDEND',
      dividendDate,
      companyName: company.name,
      userNotes: notes ?? null,
    })

    const metric = await prisma.financialMetric.create({
      data: {
        organizationId: session.user.organizationId,
        companyId,
        metricType: MetricType.ANDET,
        periodType: PeriodType.HELAAR,
        periodYear: dividendYear,
        value: amount,
        currency,
        source: 'UREVIDERET',
        notes: dividendNotes,
        createdBy: session.user.id,
      },
    })

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'CREATE',
        resourceType: 'dividend',
        resourceId: metric.id,
        sensitivity: 'FORTROLIG',
      },
    })

    await invalidateFinanceCache(session.user.organizationId, companyId)
    revalidatePath(`/companies/${companyId}/finance`)
    revalidatePath('/finance/dividends')

    const dividend = parseDividendFromNotes(metric)
    if (!dividend) return { error: 'Udbytte kunne ikke oprettes — prøv igen' }
    return { data: dividend }
  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      return { error: 'Der er allerede registreret udbytte for dette selskab og år' }
    }
    console.error('createDividend error:', error)
    return { error: 'Udbytte kunne ikke gemmes — prøv igen eller kontakt support' }
  }
}

export async function updateDividend(
  input: z.infer<typeof updateDividendSchema>
): Promise<ActionResult<DividendWithCompany>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const accessError = await requireFinanceAccess(session.user.id)
  if (accessError) return { error: accessError }

  const parsed = updateDividendSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { error: firstError?.message ?? 'Ugyldigt input' }
  }

  const { dividendId, companyId, amount, dividendDate, notes } = parsed.data

  const hasAccess = await canAccessCompany(session.user.id, companyId)
  if (!hasAccess) return { error: 'Du har ikke adgang til dette selskab' }

  try {
    const existing = await prisma.financialMetric.findFirst({
      where: {
        id: dividendId,
        companyId,
        organizationId: session.user.organizationId,
        metricType: MetricType.ANDET,
      },
    })
    if (!existing) return { error: 'Udbytteotering ikke fundet' }

    const currentData = existing.notes ? JSON.parse(existing.notes) : {}
    if (currentData.__type !== 'DIVIDEND') return { error: 'Udbytteotering ikke fundet' }

    const updatedNotes = JSON.stringify({
      ...currentData,
      dividendDate: dividendDate ?? currentData.dividendDate,
      userNotes: notes !== undefined ? notes : currentData.userNotes,
    })

    const updated = await prisma.financialMetric.update({
      where: { id: dividendId },
      data: {
        value: amount !== undefined ? amount : undefined,
        notes: updatedNotes,
      },
    })

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'UPDATE',
        resourceType: 'dividend',
        resourceId: dividendId,
        sensitivity: 'FORTROLIG',
        changes: { amount, dividendDate, notes },
      },
    })

    await invalidateFinanceCache(session.user.organizationId, companyId)
    revalidatePath(`/companies/${companyId}/finance`)
    revalidatePath('/finance/dividends')

    const dividend = parseDividendFromNotes(updated)
    if (!dividend) return { error: 'Udbytte kunne ikke opdateres' }
    return { data: dividend }
  } catch (error) {
    console.error('updateDividend error:', error)
    return { error: 'Udbytte kunne ikke opdateres — prøv igen' }
  }
}

export async function deleteDividend(
  input: z.infer<typeof deleteDividendSchema>
): Promise<ActionResult<{ id: string }>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const accessError = await requireFinanceAccess(session.user.id)
  if (accessError) return { error: accessError }

  const parsed = deleteDividendSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  const { dividendId, companyId } = parsed.data

  const hasAccess = await canAccessCompany(session.user.id, companyId)
  if (!hasAccess) return { error: 'Du har ikke adgang til dette selskab' }

  try {
    const existing = await prisma.financialMetric.findFirst({
      where: {
        id: dividendId,
        companyId,
        organizationId: session.user.organizationId,
        metricType: MetricType.ANDET,
      },
    })
    if (!existing) return { error: 'Udbytteotering ikke fundet' }

    const currentData = existing.notes ? JSON.parse(existing.notes) : {}
    if (currentData.__type !== 'DIVIDEND') return { error: 'Udbytteotering ikke fundet' }

    await prisma.financialMetric.delete({ where: { id: dividendId } })

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'DELETE',
        resourceType: 'dividend',
        resourceId: dividendId,
        sensitivity: 'FORTROLIG',
      },
    })

    await invalidateFinanceCache(session.user.organizationId, companyId)
    revalidatePath(`/companies/${companyId}/finance`)
    revalidatePath('/finance/dividends')
    return { data: { id: dividendId } }
  } catch (error) {
    console.error('deleteDividend error:', error)
    return { error: 'Udbytte kunne ikke slettes — prøv igen' }
  }
}

/**
 * listDividends — med pagination.
 *
 * Sprint 5 ændring: Tilføjet page + pageSize (MANGLEDE i Sprint 4).
 */
export async function listDividends(
  input: z.infer<typeof listDividendsSchema>
): Promise<
  ActionResult<{
    dividends: DividendWithCompany[]
    total: number
    hasMore: boolean
    page: number
    pageSize: number
  }>
> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const accessError = await requireFinanceAccess(session.user.id)
  if (accessError) return { error: accessError }

  const parsed = listDividendsSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  const { companyId, fromYear, toYear } = parsed.data

  const page = Math.max(1, (input as { page?: number }).page ?? 1)
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, (input as { pageSize?: number }).pageSize ?? DEFAULT_PAGE_SIZE)
  )

  const hasAccess = await canAccessCompany(session.user.id, companyId)
  if (!hasAccess) return { error: 'Du har ikke adgang til dette selskab' }

  try {
    const where = {
      organizationId: session.user.organizationId,
      companyId,
      metricType: MetricType.ANDET,
      notes: { contains: '"__type":"DIVIDEND"' },
      ...(fromYear || toYear
        ? {
            periodYear: {
              ...(fromYear ? { gte: fromYear } : {}),
              ...(toYear ? { lte: toYear } : {}),
            },
          }
        : {}),
    }

    const [total, metrics] = await Promise.all([
      prisma.financialMetric.count({ where }),
      prisma.financialMetric.findMany({
        where,
        orderBy: { periodYear: 'desc' },
        take: pageSize,
        skip: (page - 1) * pageSize,
      }),
    ])

    const dividends = metrics
      .map(parseDividendFromNotes)
      .filter((d): d is DividendWithCompany => d !== null)

    await prisma.auditLog.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        action: 'VIEW',
        resourceType: 'dividend',
        resourceId: companyId,
        sensitivity: 'FORTROLIG',
      },
    })

    return {
      data: {
        dividends,
        total,
        hasMore: (page - 1) * pageSize + dividends.length < total,
        page,
        pageSize,
      },
    }
  } catch (error) {
    console.error('listDividends error:', error)
    return { error: 'Udbytteoteringer kunne ikke hentes — prøv igen' }
  }
}