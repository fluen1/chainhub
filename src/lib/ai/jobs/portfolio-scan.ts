import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { createLogger } from '@/lib/ai/logger'

const log = createLogger('portfolio-scan')

// ────────────────────────────────────────────────────────────────────────────
// Typer
// ────────────────────────────────────────────────────────────────────────────

export interface ScanResult {
  inserted: number
  deleted: number
  organizationId: string
}

type AlertSeverity = 'CRITICAL' | 'WARNING' | 'INFO'
type AlertCategory = 'DEADLINE' | 'MISSING' | 'RISK' | 'COMPLIANCE'

interface AlertData {
  organization_id: string
  severity: AlertSeverity
  category: AlertCategory
  entity_type: string
  entity_id: string
  entity_name: string
  message: string
  details?: Record<string, unknown>
}

// ────────────────────────────────────────────────────────────────────────────
// Regelbaseret porteføljescanning — ingen LLM
// ────────────────────────────────────────────────────────────────────────────

/**
 * Kører porteføljescanning for én organisation.
 *
 * Regler:
 * 1. DEADLINE — kontrakter med expiry_date inden for 30 dage
 *    - ≤7 dage: CRITICAL, >7 dage: WARNING
 * 2. MISSING — selskaber uden EJERAFTALE eller VEDTAEGTER (INFO)
 * 3. COMPLIANCE — opgaver med due_date < nu (ikke AFSLUTTET/ANNULLERET)
 *    - >14 dage forfaldne: CRITICAL, ellers: WARNING
 */
export async function runPortfolioScan(organizationId: string): Promise<ScanResult> {
  log.info({ organizationId }, 'Starter porteføljescanning')

  const now = new Date()
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const staleThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  // 1. Slet gamle ikke-afviste alerts (>24h gamle)
  const deleted = await prisma.alert.deleteMany({
    where: {
      organization_id: organizationId,
      dismissed_at: null,
      created_at: { lt: staleThreshold },
    },
  })

  const alerts: AlertData[] = []

  // ── Regel 1: Kontrakter der udløber inden for 30 dage ───────────────────

  const expiringContracts = await prisma.contract.findMany({
    where: {
      organization_id: organizationId,
      deleted_at: null,
      status: { in: ['AKTIV', 'FORNYET'] },
      expiry_date: { gte: now, lte: in30Days },
    },
    select: {
      id: true,
      display_name: true,
      expiry_date: true,
      company: { select: { name: true } },
    },
  })

  for (const contract of expiringContracts) {
    if (!contract.expiry_date) continue
    const daysLeft = Math.ceil(
      (contract.expiry_date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    )
    const severity: AlertSeverity = daysLeft <= 7 ? 'CRITICAL' : 'WARNING'
    const companyName = contract.company.name

    alerts.push({
      organization_id: organizationId,
      severity,
      category: 'DEADLINE',
      entity_type: 'contract',
      entity_id: contract.id,
      entity_name: contract.display_name,
      message:
        daysLeft <= 7
          ? `Kontrakten "${contract.display_name}" (${companyName}) udløber om ${daysLeft} dag${daysLeft === 1 ? '' : 'e'}`
          : `Kontrakten "${contract.display_name}" (${companyName}) udløber inden for 30 dage`,
      details: { daysLeft, companyName, expiryDate: contract.expiry_date.toISOString() },
    })
  }

  // ── Regel 2: Selskaber uden EJERAFTALE eller VEDTAEGTER ─────────────────

  const companies = await prisma.company.findMany({
    where: {
      organization_id: organizationId,
      deleted_at: null,
    },
    select: {
      id: true,
      name: true,
      contracts: {
        where: {
          deleted_at: null,
          system_type: { in: ['EJERAFTALE', 'VEDTAEGTER'] },
        },
        select: { system_type: true },
      },
    },
  })

  for (const company of companies) {
    const types = company.contracts.map((c) => c.system_type)
    const missingEjeraftale = !types.includes('EJERAFTALE')
    const missingVedtaegter = !types.includes('VEDTAEGTER')

    if (missingEjeraftale) {
      alerts.push({
        organization_id: organizationId,
        severity: 'INFO',
        category: 'MISSING',
        entity_type: 'company',
        entity_id: company.id,
        entity_name: company.name,
        message: `Selskabet "${company.name}" mangler en ejeraftale`,
        details: { missingDocType: 'EJERAFTALE' },
      })
    }

    if (missingVedtaegter) {
      alerts.push({
        organization_id: organizationId,
        severity: 'INFO',
        category: 'MISSING',
        entity_type: 'company',
        entity_id: company.id,
        entity_name: company.name,
        message: `Selskabet "${company.name}" mangler vedtægter`,
        details: { missingDocType: 'VEDTAEGTER' },
      })
    }
  }

  // ── Regel 3: Forfaldne opgaver ───────────────────────────────────────────

  const overdueTasks = await prisma.task.findMany({
    where: {
      organization_id: organizationId,
      deleted_at: null,
      due_date: { lt: now },
      status: { notIn: ['LUKKET'] },
    },
    select: {
      id: true,
      title: true,
      due_date: true,
    },
  })

  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

  for (const task of overdueTasks) {
    if (!task.due_date) continue
    const daysOverdue = Math.floor(
      (now.getTime() - task.due_date.getTime()) / (1000 * 60 * 60 * 24)
    )
    const severity: AlertSeverity = task.due_date < fourteenDaysAgo ? 'CRITICAL' : 'WARNING'

    alerts.push({
      organization_id: organizationId,
      severity,
      category: 'COMPLIANCE',
      entity_type: 'task',
      entity_id: task.id,
      entity_name: task.title,
      message:
        severity === 'CRITICAL'
          ? `Opgaven "${task.title}" er ${daysOverdue} dage forfalden`
          : `Opgaven "${task.title}" er forfalden`,
      details: { daysOverdue, dueDate: task.due_date.toISOString() },
    })
  }

  // ── Bulk insert ──────────────────────────────────────────────────────────

  if (alerts.length > 0) {
    await prisma.alert.createMany({
      data: alerts.map((a) => ({
        organization_id: a.organization_id,
        severity: a.severity,
        category: a.category,
        entity_type: a.entity_type,
        entity_id: a.entity_id,
        entity_name: a.entity_name,
        message: a.message,
        details: a.details != null ? (a.details as Prisma.InputJsonValue) : Prisma.JsonNull,
      })),
    })
  }

  log.info(
    { organizationId, inserted: alerts.length, deleted: deleted.count },
    'Porteføljescanning færdig'
  )

  return {
    inserted: alerts.length,
    deleted: deleted.count,
    organizationId,
  }
}
