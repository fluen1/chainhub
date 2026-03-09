import { prisma } from '@/lib/db'
import { differenceInDays, addDays, startOfDay } from 'date-fns'

export interface DeadlineCheckResult {
  contractId: string
  displayName: string
  organizationId: string
  companyId: string
  daysUntil: number
  deadlineType: 'expiry' | 'absolute' | 'operational'
  deadline: Date
}

export interface DeadlineSummary {
  critical: DeadlineCheckResult[]   // <= 7 dage
  urgent: DeadlineCheckResult[]     // 8-30 dage
  upcoming: DeadlineCheckResult[]   // 31-90 dage
  total: number
}

/**
 * Henter alle kontrakter med kommende deadlines for en organisation
 */
export async function getUpcomingDeadlines(
  organizationId: string,
  horizonDays = 90
): Promise<DeadlineSummary> {
  const today = startOfDay(new Date())
  const horizon = addDays(today, horizonDays)

  const contracts = await prisma.contract.findMany({
    where: {
      organizationId,
      deletedAt: null,
      status: {
        in: ['UDKAST', 'TIL_REVIEW', 'TIL_UNDERSKRIFT', 'AKTIV'],
      },
      OR: [
        {
          expiryDate: {
            not: null,
            gte: today,
            lte: horizon,
          },
        },
        {
          absoluteDeadline: {
            not: null,
            gte: today,
            lte: horizon,
          },
        },
        {
          operationalDeadline: {
            not: null,
            gte: today,
            lte: horizon,
          },
        },
      ],
    },
    select: {
      id: true,
      displayName: true,
      organizationId: true,
      companyId: true,
      expiryDate: true,
      absoluteDeadline: true,
      operationalDeadline: true,
      deadlineType: true,
    },
  })

  const results: DeadlineCheckResult[] = []

  for (const contract of contracts) {
    // Udløbsdato
    if (contract.expiryDate) {
      const daysUntil = differenceInDays(contract.expiryDate, today)
      if (daysUntil >= 0 && daysUntil <= horizonDays) {
        results.push({
          contractId: contract.id,
          displayName: contract.displayName,
          organizationId: contract.organizationId,
          companyId: contract.companyId,
          daysUntil,
          deadlineType: 'expiry',
          deadline: contract.expiryDate,
        })
      }
    }

    // Absolut deadline
    if (contract.absoluteDeadline && contract.deadlineType === 'ABSOLUT') {
      const daysUntil = differenceInDays(contract.absoluteDeadline, today)
      if (daysUntil >= 0 && daysUntil <= horizonDays) {
        results.push({
          contractId: contract.id,
          displayName: contract.displayName,
          organizationId: contract.organizationId,
          companyId: contract.companyId,
          daysUntil,
          deadlineType: 'absolute',
          deadline: contract.absoluteDeadline,
        })
      }
    }

    // Operationel deadline
    if (contract.operationalDeadline && contract.deadlineType === 'OPERATIONEL') {
      const daysUntil = differenceInDays(contract.operationalDeadline, today)
      if (daysUntil >= 0 && daysUntil <= horizonDays) {
        results.push({
          contractId: contract.id,
          displayName: contract.displayName,
          organizationId: contract.organizationId,
          companyId: contract.companyId,
          daysUntil,
          deadlineType: 'operational',
          deadline: contract.operationalDeadline,
        })
      }
    }
  }

  // Dedupliker — behold den med kortest daysUntil per kontrakt
  const seen = new Map<string, DeadlineCheckResult>()
  for (const r of results) {
    const existing = seen.get(r.contractId)
    if (!existing || r.daysUntil < existing.daysUntil) {
      seen.set(r.contractId, r)
    }
  }

  const deduped = Array.from(seen.values()).sort((a, b) => a.daysUntil - b.daysUntil)

  return {
    critical: deduped.filter((r) => r.daysUntil <= 7),
    urgent: deduped.filter((r) => r.daysUntil >= 8 && r.daysUntil <= 30),
    upcoming: deduped.filter((r) => r.daysUntil >= 31),
    total: deduped.length,
  }
}

/**
 * Henter deadlines for et specifikt selskab
 */
export async function getCompanyDeadlines(
  organizationId: string,
  companyId: string,
  horizonDays = 90
): Promise<DeadlineSummary> {
  const today = startOfDay(new Date())
  const horizon = addDays(today, horizonDays)

  const contracts = await prisma.contract.findMany({
    where: {
      organizationId,
      companyId,
      deletedAt: null,
      status: {
        in: ['UDKAST', 'TIL_REVIEW', 'TIL_UNDERSKRIFT', 'AKTIV'],
      },
      OR: [
        {
          expiryDate: {
            not: null,
            gte: today,
            lte: horizon,
          },
        },
        {
          absoluteDeadline: {
            not: null,
            gte: today,
            lte: horizon,
          },
        },
        {
          operationalDeadline: {
            not: null,
            gte: today,
            lte: horizon,
          },
        },
      ],
    },
    select: {
      id: true,
      displayName: true,
      organizationId: true,
      companyId: true,
      expiryDate: true,
      absoluteDeadline: true,
      operationalDeadline: true,
      deadlineType: true,
    },
  })

  const results: DeadlineCheckResult[] = []

  for (const contract of contracts) {
    if (contract.expiryDate) {
      const daysUntil = differenceInDays(contract.expiryDate, today)
      if (daysUntil >= 0 && daysUntil <= horizonDays) {
        results.push({
          contractId: contract.id,
          displayName: contract.displayName,
          organizationId: contract.organizationId,
          companyId: contract.companyId,
          daysUntil,
          deadlineType: 'expiry',
          deadline: contract.expiryDate,
        })
      }
    }

    if (contract.absoluteDeadline && contract.deadlineType === 'ABSOLUT') {
      const daysUntil = differenceInDays(contract.absoluteDeadline, today)
      if (daysUntil >= 0 && daysUntil <= horizonDays) {
        results.push({
          contractId: contract.id,
          displayName: contract.displayName,
          organizationId: contract.organizationId,
          companyId: contract.companyId,
          daysUntil,
          deadlineType: 'absolute',
          deadline: contract.absoluteDeadline,
        })
      }
    }

    if (contract.operationalDeadline && contract.deadlineType === 'OPERATIONEL') {
      const daysUntil = differenceInDays(contract.operationalDeadline, today)
      if (daysUntil >= 0 && daysUntil <= horizonDays) {
        results.push({
          contractId: contract.id,
          displayName: contract.displayName,
          organizationId: contract.organizationId,
          companyId: contract.companyId,
          daysUntil,
          deadlineType: 'operational',
          deadline: contract.operationalDeadline,
        })
      }
    }
  }

  const seen = new Map<string, DeadlineCheckResult>()
  for (const r of results) {
    const existing = seen.get(r.contractId)
    if (!existing || r.daysUntil < existing.daysUntil) {
      seen.set(r.contractId, r)
    }
  }

  const deduped = Array.from(seen.values()).sort((a, b) => a.daysUntil - b.daysUntil)

  return {
    critical: deduped.filter((r) => r.daysUntil <= 7),
    urgent: deduped.filter((r) => r.daysUntil >= 8 && r.daysUntil <= 30),
    upcoming: deduped.filter((r) => r.daysUntil >= 31),
    total: deduped.length,
  }
}