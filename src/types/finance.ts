import type { FinancialMetric, TimeEntry, MetricType, PeriodType, MetricSource } from '@prisma/client'

// ==================== FÆLLES ====================

export type ActionResult<T> =
  | { data: T; error?: never }
  | { error: string; data?: never }

// ==================== NØGLETAL ====================

export type FinancialMetricWithCompany = FinancialMetric & {
  company: {
    id: string
    name: string
  }
}

export type MetricsByPeriod = {
  periodYear: number
  periodType: PeriodType
  metrics: FinancialMetric[]
}

export interface FinancialOverview {
  companyId: string
  companyName: string
  latestYear: number | null
  metrics: FinancialMetric[]
}

// ==================== TIDSREGISTRERING ====================

export type TimeEntryWithUser = TimeEntry & {
  user?: {
    id: string
    name: string
    email: string
  }
}

export type TimeEntrySummary = {
  totalMinutes: number
  billableMinutes: number
  nonBillableMinutes: number
  entries: TimeEntryWithUser[]
}

// ==================== FAKTURAOVERSIGT ====================

export type InvoiceStatus = 'UDSTEDT' | 'BETALT' | 'FORFALDEN' | 'KREDITERET'

export interface Invoice {
  id: string
  organizationId: string
  companyId: string
  caseId: string | null
  invoiceNumber: string
  description: string
  amount: number
  currency: string
  invoiceDate: Date
  dueDate: Date | null
  status: InvoiceStatus
  notes: string | null
  createdAt: Date
  createdBy: string
  deletedAt: Date | null
}

export interface InvoiceWithCompany extends Invoice {
  company: {
    id: string
    name: string
  }
  case?: {
    id: string
    title: string
  } | null
}

export interface InvoiceSummary {
  totalAmount: number
  paidAmount: number
  outstandingAmount: number
  overdueAmount: number
  invoiceCount: number
}

// ==================== UDBYTTE ====================

export interface Dividend {
  id: string
  organizationId: string
  companyId: string
  amount: number
  currency: string
  dividendDate: Date
  notes: string | null
  createdAt: Date
  createdBy: string
}

export interface DividendWithCompany extends Dividend {
  company: {
    id: string
    name: string
  }
}

// ==================== LABEL-MAPS ====================

export const METRIC_TYPE_LABELS: Record<MetricType, string> = {
  OMSAETNING: 'Omsætning',
  EBITDA: 'EBITDA',
  RESULTAT: 'Resultat',
  LIKVIDITET: 'Likviditet',
  EGENKAPITAL: 'Egenkapital',
  ANDET: 'Andet (CUSTOM)',
}

export const PERIOD_TYPE_LABELS: Record<PeriodType, string> = {
  HELAAR: 'Helår',
  H1: 'H1 (første halvår)',
  H2: 'H2 (andet halvår)',
  Q1: 'Q1',
  Q2: 'Q2',
  Q3: 'Q3',
  Q4: 'Q4',
  MAANED: 'Måned',
}

export const METRIC_SOURCE_LABELS: Record<MetricSource, string> = {
  REVIDERET: 'Revideret',
  UREVIDERET: 'Urevideret',
  ESTIMAT: 'Estimat',
}

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  UDSTEDT: 'Udstedt',
  BETALT: 'Betalt',
  FORFALDEN: 'Forfalden',
  KREDITERET: 'Krediteret',
}