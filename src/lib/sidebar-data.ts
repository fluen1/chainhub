/**
 * sidebar-data.ts — Henter live counts og bruger-info til sidebar
 * Kaldes fra dashboard layout — Server Component
 * BA-04 | Sprint 7
 */

import { prisma } from '@/lib/db'
import { getAccessibleCompanies } from '@/lib/permissions'
import { getUserRoleLabel, getUserRoleStyle } from '@/lib/labels'
import type { SidebarBadge } from '@/types/ui'

export interface SidebarData {
  companiesCount: number
  contractsCount: number
  casesCount: number
  tasksCount: number
  overdueTasksCount: number
  personsCount: number
  documentsCount: number
  visitsCount: number
  userRole: string
  userRoleLabel: string
  userRoleStyle: string
  recentCompanies: Array<{ id: string; name: string }>
}

export async function getSidebarData(
  userId: string,
  organizationId: string
): Promise<SidebarData> {
  const [companyIds, roleAssignments] = await Promise.all([
    getAccessibleCompanies(userId, organizationId),
    prisma.userRoleAssignment.findMany({
      where: { user_id: userId },
      select: { role: true },
      take: 1,
    }),
  ])

  const today = new Date()
  const primaryRole = roleAssignments[0]?.role ?? 'GROUP_READONLY'

  const whereCompanies = {
    organization_id: organizationId,
    id: { in: companyIds },
    deleted_at: null as null,
  }

  const [
    companiesCount,
    contractsCount,
    casesCount,
    tasksData,
    personsCount,
    documentsCount,
    visitsCount,
    recentCompanies,
  ] = await Promise.all([
    prisma.company.count({ where: whereCompanies }),
    companyIds.length > 0
      ? prisma.contract.count({
          where: {
            organization_id: organizationId,
            company_id: { in: companyIds },
            deleted_at: null,
          },
        })
      : Promise.resolve(0),
    companyIds.length > 0
      ? prisma.case.count({
          where: {
            organization_id: organizationId,
            deleted_at: null,
            status: { in: ['NY', 'AKTIV', 'AFVENTER_EKSTERN', 'AFVENTER_KLIENT'] },
          },
        })
      : Promise.resolve(0),
    prisma.task.findMany({
      where: {
        organization_id: organizationId,
        deleted_at: null,
        status: { not: 'LUKKET' },
      },
      select: { id: true, due_date: true },
    }),
    prisma.person.count({
      where: { organization_id: organizationId, deleted_at: null },
    }),
    prisma.document.count({
      where: { organization_id: organizationId, deleted_at: null },
    }),
    prisma.visit.count({
      where: {
        organization_id: organizationId,
        deleted_at: null,
        status: 'PLANLAGT',
      },
    }),
    // Senest opdaterede selskaber (proxy for "senest besøgte" — ingen tracking endnu)
    companyIds.length > 0
      ? prisma.company.findMany({
          where: whereCompanies,
          orderBy: { updated_at: 'desc' },
          take: 3,
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ])

  const overdueTasksCount = tasksData.filter(
    (t) => t.due_date && new Date(t.due_date) < today
  ).length

  return {
    companiesCount,
    contractsCount,
    casesCount,
    tasksCount: tasksData.length,
    overdueTasksCount,
    personsCount,
    documentsCount,
    visitsCount,
    userRole: primaryRole,
    userRoleLabel: getUserRoleLabel(primaryRole),
    userRoleStyle: getUserRoleStyle(primaryRole),
    recentCompanies,
  }
}

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
    tasks: data.overdueTasksCount > 0
      ? { count: data.overdueTasksCount, urgency: 'critical' }
      : data.tasksCount > 0 ? { count: data.tasksCount, urgency: 'neutral' } : null,
    documents: data.documentsCount > 0 ? { count: data.documentsCount, urgency: 'neutral' } : null,
    persons: data.personsCount > 0 ? { count: data.personsCount, urgency: 'neutral' } : null,
  }
}
