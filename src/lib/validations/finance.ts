import { z } from 'zod'
import { MetricType, PeriodType, MetricSource } from '@prisma/client'

// ==================== NØGLETAL ====================

export const createFinancialMetricSchema = z.object({
  companyId: z.string().uuid('Ugyldigt selskabs-ID'),
  metricType: z.nativeEnum(MetricType, {
    errorMap: () => ({ message: 'Ugyldig metrisk type' }),
  }),
  periodType: z.nativeEnum(PeriodType, {
    errorMap: () => ({ message: 'Ugyldig periodeType' }),
  }),
  periodYear: z
    .number()
    .int()
    .min(2000, 'År skal være 2000 eller senere')
    .max(2100, 'År skal være 2100 eller tidligere'),
  value: z
    .number()
    .min(-999_999_999_999, 'Værdien er for lav')
    .max(999_999_999_999, 'Værdien er for høj'),
  currency: z.string().length(3, 'Valuta skal være 3 bogstaver').default('DKK'),
  source: z.nativeEnum(MetricSource, {
    errorMap: () => ({ message: 'Ugyldig kilde' }),
  }),
  notes: z.string().max(2000, 'Noter må maks. være 2000 tegn').optional(),
})

export const updateFinancialMetricSchema = z.object({
  metricId: z.string().uuid('Ugyldigt nøgletal-ID'),
  companyId: z.string().uuid('Ugyldigt selskabs-ID'),
  value: z
    .number()
    .min(-999_999_999_999, 'Værdien er for lav')
    .max(999_999_999_999, 'Værdien er for høj')
    .optional(),
  source: z
    .nativeEnum(MetricSource, {
      errorMap: () => ({ message: 'Ugyldig kilde' }),
    })
    .optional(),
  notes: z.string().max(2000, 'Noter må maks. være 2000 tegn').optional(),
})

export const deleteFinancialMetricSchema = z.object({
  metricId: z.string().uuid('Ugyldigt nøgletal-ID'),
  companyId: z.string().uuid('Ugyldigt selskabs-ID'),
})

export const listFinancialMetricsSchema = z.object({
  companyId: z.string().uuid('Ugyldigt selskabs-ID'),
  periodYear: z.number().int().optional(),
  metricType: z.nativeEnum(MetricType).optional(),
})

// ==================== TIDSREGISTRERING ====================

export const createTimeEntrySchema = z.object({
  caseId: z.string().uuid('Ugyldig sags-ID'),
  description: z.string().max(500, 'Beskrivelse må maks. være 500 tegn').optional(),
  minutes: z
    .number()
    .int()
    .min(1, 'Mindst 1 minut')
    .max(1440, 'Maks. 1440 minutter (24 timer) pr. registrering'),
  date: z.string().refine((d) => !isNaN(Date.parse(d)), { message: 'Ugyldig dato' }),
  billable: z.boolean().default(true),
  hourlyRate: z.number().int().min(0).max(100_000).optional(),
})

export const updateTimeEntrySchema = z.object({
  timeEntryId: z.string().uuid('Ugyldigt tidsregistrerings-ID'),
  caseId: z.string().uuid('Ugyldig sags-ID'),
  description: z.string().max(500).optional(),
  minutes: z.number().int().min(1).max(1440).optional(),
  date: z
    .string()
    .refine((d) => !isNaN(Date.parse(d)), { message: 'Ugyldig dato' })
    .optional(),
  billable: z.boolean().optional(),
  hourlyRate: z.number().int().min(0).max(100_000).optional().nullable(),
})

export const deleteTimeEntrySchema = z.object({
  timeEntryId: z.string().uuid('Ugyldigt tidsregistrerings-ID'),
  caseId: z.string().uuid('Ugyldig sags-ID'),
})

export const listTimeEntriesSchema = z.object({
  caseId: z.string().uuid('Ugyldig sags-ID'),
  fromDate: z
    .string()
    .refine((d) => !isNaN(Date.parse(d)), { message: 'Ugyldig fra-dato' })
    .optional(),
  toDate: z
    .string()
    .refine((d) => !isNaN(Date.parse(d)), { message: 'Ugyldig til-dato' })
    .optional(),
})

// ==================== FAKTURAOVERSIGT (intern) ====================

export const createInvoiceSchema = z.object({
  companyId: z.string().uuid('Ugyldigt selskabs-ID'),
  caseId: z.string().uuid().optional(),
  invoiceNumber: z.string().min(1).max(100, 'Fakturanummer må maks. være 100 tegn'),
  description: z.string().min(1, 'Beskrivelse er påkrævet').max(1000),
  amount: z.number().min(0, 'Beløb skal være positivt').max(999_999_999_999),
  currency: z.string().length(3).default('DKK'),
  invoiceDate: z.string().refine((d) => !isNaN(Date.parse(d)), { message: 'Ugyldig fakturadato' }),
  dueDate: z
    .string()
    .refine((d) => !isNaN(Date.parse(d)), { message: 'Ugyldig forfaldsdato' })
    .optional(),
  status: z.enum(['UDSTEDT', 'BETALT', 'FORFALDEN', 'KREDITERET']).default('UDSTEDT'),
  notes: z.string().max(2000).optional(),
})

export const updateInvoiceSchema = z.object({
  invoiceId: z.string().uuid('Ugyldigt faktura-ID'),
  companyId: z.string().uuid('Ugyldigt selskabs-ID'),
  status: z.enum(['UDSTEDT', 'BETALT', 'FORFALDEN', 'KREDITERET']).optional(),
  notes: z.string().max(2000).optional(),
  dueDate: z
    .string()
    .refine((d) => !isNaN(Date.parse(d)), { message: 'Ugyldig forfaldsdato' })
    .optional()
    .nullable(),
})

export const deleteInvoiceSchema = z.object({
  invoiceId: z.string().uuid('Ugyldigt faktura-ID'),
  companyId: z.string().uuid('Ugyldigt selskabs-ID'),
})

export const listInvoicesSchema = z.object({
  companyId: z.string().uuid('Ugyldigt selskabs-ID').optional(),
  status: z.enum(['UDSTEDT', 'BETALT', 'FORFALDEN', 'KREDITERET']).optional(),
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
})

// ==================== UDBYTTENOTERING ====================

export const createDividendSchema = z.object({
  companyId: z.string().uuid('Ugyldigt selskabs-ID'),
  amount: z.number().min(0, 'Beløb skal være positivt').max(999_999_999_999),
  currency: z.string().length(3).default('DKK'),
  dividendDate: z
    .string()
    .refine((d) => !isNaN(Date.parse(d)), { message: 'Ugyldig udbyttedato' }),
  notes: z.string().max(2000).optional(),
})

export const updateDividendSchema = z.object({
  dividendId: z.string().uuid('Ugyldigt udbytte-ID'),
  companyId: z.string().uuid('Ugyldigt selskabs-ID'),
  amount: z.number().min(0).max(999_999_999_999).optional(),
  dividendDate: z
    .string()
    .refine((d) => !isNaN(Date.parse(d)), { message: 'Ugyldig udbyttedato' })
    .optional(),
  notes: z.string().max(2000).optional(),
})

export const deleteDividendSchema = z.object({
  dividendId: z.string().uuid('Ugyldigt udbytte-ID'),
  companyId: z.string().uuid('Ugyldigt selskabs-ID'),
})

export const listDividendsSchema = z.object({
  companyId: z.string().uuid('Ugyldigt selskabs-ID'),
  fromYear: z.number().int().optional(),
  toYear: z.number().int().optional(),
})