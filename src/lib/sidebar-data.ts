/**
 * sidebar-data.ts — Henter live counts og bruger-info til sidebar
 * Kaldes fra dashboard layout — Server Component
 * BA-04 | Sprint 7
 */

import { unstable_cache } from 'next/cache'
import { cache } from 'react'
import { prisma } from '@/lib/db'
import { getUserRoleLabel, getUserRoleStyle } from '@/lib/labels'
import { getAccessibleCompanies } from '@/lib/permissions'
import type { SidebarBadge } from '@/types/ui'

export interface SidebarData {
  companiesCount: number
  contractsCount: number
  casesCount: number
  tasksCount: number
  overdueTasksCount: number
  expiringContractsCount: number
  omsaetningTotal: number
  personsCount: number
  documentsCount: number
  visitsCount: number
  userRole: string
  userRoleLabel: string
  userRoleStyle: string
  recentCompanies: Array<{ id: string; name: string }>
}

// --- Intern cache-nøgle: counts pr. org + companyIds (60s TTL, bust via 'sidebar'-tag) ---
const getCachedSidebarCounts = unstable_cache(
  async (orgId: string, companyIds: string[]) => {
    const today = new Date()
    const thirtyDayEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    const whereCompanies = {
      organization_id: orgId,
      id: { in: companyIds },
      deleted_at: null as null,
    }

    const [
      companiesCount,
      contractsCount,
      casesCount,
      tasksCount,
      overdueTasksCount,
      expiringContractsCount,
      financialMetrics,
      personsCount,
      documentsCount,
      visitsCount,
      recentCompanies,
    ] = await Promise.all([
      prisma.company.count({ where: whereCompanies }),
      companyIds.length > 0
        ? prisma.contract.count({
            where: {
              organization_id: orgId,
              company_id: { in: companyIds },
              deleted_at: null,
            },
          })
        : Promise.resolve(0),
      companyIds.length > 0
        ? prisma.case.count({
            where: {
              organization_id: orgId,
              deleted_at: null,
              status: { in: ['NY', 'AKTIV', 'AFVENTER_EKSTERN', 'AFVENTER_KLIENT'] },
              case_companies: { some: { company_id: { in: companyIds } } },
            },
          })
        : Promise.resolve(0),
      prisma.task.count({
        where: {
          organization_id: orgId,
          deleted_at: null,
          status: { not: 'LUKKET' },
          OR: [{ company_id: { in: companyIds } }, { company_id: null }],
        },
      }),
      prisma.task.count({
        where: {
          organization_id: orgId,
          deleted_at: null,
          status: { not: 'LUKKET' },
          due_date: { lt: today },
          OR: [{ company_id: { in: companyIds } }, { company_id: null }],
        },
      }),
      companyIds.length > 0
        ? prisma.contract.count({
            where: {
              organization_id: orgId,
              company_id: { in: companyIds },
              deleted_at: null,
              status: 'AKTIV',
              expiry_date: { not: null, gte: today, lte: thirtyDayEnd },
            },
          })
        : Promise.resolve(0),
      companyIds.length > 0
        ? prisma.financialMetric.findMany({
            where: {
              organization_id: orgId,
              company_id: { in: companyIds },
              period_type: 'HELAAR',
              metric_type: 'OMSAETNING',
            },
            orderBy: { period_year: 'desc' },
            take: companyIds.length,
            select: { value: true, company_id: true, period_year: true },
          })
        : Promise.resolve([]),
      prisma.person.count({
        where: {
          organization_id: orgId,
          deleted_at: null,
          OR: [
            { company_persons: { some: { company_id: { in: companyIds } } } },
            { company_persons: { none: {} } },
          ],
        },
      }),
      prisma.document.count({
        where: {
          organization_id: orgId,
          deleted_at: null,
          OR: [{ company_id: { in: companyIds } }, { company_id: null }],
        },
      }),
      prisma.visit.count({
        where: {
          organization_id: orgId,
          deleted_at: null,
          status: 'PLANLAGT',
        },
      }),
      companyIds.length > 0
        ? prisma.company.findMany({
            where: whereCompanies,
            orderBy: { updated_at: 'desc' },
            take: 3,
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
    ])

    // Filtrer til seneste år pr. selskab (data sorteret desc)
    let omsaetningTotal = 0
    const seenCompanies = new Set<string>()
    for (const fm of financialMetrics) {
      if (seenCompanies.has(fm.company_id)) continue
      seenCompanies.add(fm.company_id)
      omsaetningTotal += Number(fm.value)
    }

    return {
      companiesCount,
      contractsCount,
      casesCount,
      tasksCount,
      overdueTasksCount,
      expiringContractsCount,
      omsaetningTotal,
      personsCount,
      documentsCount,
      visitsCount,
      recentCompanies,
    }
  },
  ['sidebar-counts'],
  { revalidate: 60, tags: ['sidebar'] }
)

export const getSidebarData = cache(
  async (
    userId: string,
    organizationId: string,
    preloadedCompanyIds?: string[]
  ): Promise<SidebarData> => {
    const [companyIds, roleAssignments] = await Promise.all([
      preloadedCompanyIds !== undefined
        ? Promise.resolve(preloadedCompanyIds)
        : getAccessibleCompanies(userId, organizationId),
      prisma.userRoleAssignment.findMany({
        where: { user_id: userId },
        select: { role: true },
        take: 1,
      }),
    ])

    const primaryRole = roleAssignments[0]?.role ?? 'GROUP_READONLY'
    const counts = await getCachedSidebarCounts(organizationId, companyIds)

    return {
      ...counts,
      userRole: primaryRole,
      userRoleLabel: getUserRoleLabel(primaryRole),
      userRoleStyle: getUserRoleStyle(primaryRole),
    }
  }
)

/**
 * Adapter: transformer SidebarData counts → AppSidebarProps.badges record.
 */
export function buildSidebarBadges(data: SidebarData): Record<string, SidebarBadge | null> {
  return {
    dashboard: null,
    calendar: data.visitsCount > 0 ? { count: data.visitsCount, urgency: 'neutral' } : null,
    portfolio: data.companiesCount > 0 ? { count: data.companiesCount, urgency: 'neutral' } : null,
    contracts: data.contractsCount > 0 ? { count: data.contractsCount, urgency: 'neutral' } : null,
    cases: data.casesCount > 0 ? { count: data.casesCount, urgency: 'neutral' } : null,
    tasks:
      data.overdueTasksCount > 0
        ? { count: data.overdueTasksCount, urgency: 'critical' }
        : data.tasksCount > 0
          ? { count: data.tasksCount, urgency: 'neutral' }
          : null,
    documents: data.documentsCount > 0 ? { count: data.documentsCount, urgency: 'neutral' } : null,
    persons: data.personsCount > 0 ? { count: data.personsCount, urgency: 'neutral' } : null,
  }
}
