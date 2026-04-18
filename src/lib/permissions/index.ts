import { prisma } from '@/lib/db'
import { type SensitivityLevel, type UserRole } from '@prisma/client'

// Sensitivity hierarchy — higher index = more sensitive
const SENSITIVITY_ORDER: SensitivityLevel[] = [
  'PUBLIC',
  'STANDARD',
  'INTERN',
  'FORTROLIG',
  'STRENGT_FORTROLIG',
]

// Roles that can see STRENGT_FORTROLIG
const STRENGT_FORTROLIG_ROLES: UserRole[] = ['GROUP_OWNER', 'GROUP_ADMIN', 'GROUP_LEGAL']

// Roles that can see FORTROLIG
const FORTROLIG_ROLES: UserRole[] = [
  ...STRENGT_FORTROLIG_ROLES,
  'GROUP_FINANCE',
  'GROUP_READONLY',
  'COMPANY_MANAGER',
]

// Group-level roles (scope: ALL)
const GROUP_ROLES: UserRole[] = [
  'GROUP_OWNER',
  'GROUP_ADMIN',
  'GROUP_LEGAL',
  'GROUP_FINANCE',
  'GROUP_READONLY',
]

async function getUserRoles(userId: string): Promise<
  Array<{
    role: UserRole
    scope: string
    company_ids: string[]
  }>
> {
  const assignments = await prisma.userRoleAssignment.findMany({
    where: { user_id: userId },
    select: { role: true, scope: true, company_ids: true },
  })
  return assignments
}

export async function canAccessCompany(userId: string, companyId: string): Promise<boolean> {
  const roles = await getUserRoles(userId)

  for (const assignment of roles) {
    // Group-level roles with ALL scope can access everything
    if (GROUP_ROLES.includes(assignment.role) && assignment.scope === 'ALL') {
      return true
    }
    // ASSIGNED scope — check if companyId is in list
    if (assignment.scope === 'ASSIGNED' && assignment.company_ids.includes(companyId)) {
      return true
    }
    // OWN scope — check if companyId is in list
    if (assignment.scope === 'OWN' && assignment.company_ids.includes(companyId)) {
      return true
    }
  }

  return false
}

export async function canAccessSensitivity(
  userId: string,
  level: SensitivityLevel
): Promise<boolean> {
  const roles = await getUserRoles(userId)
  const userRoles = roles.map((r) => r.role)

  // STRENGT_FORTROLIG — only specific group roles
  if (level === 'STRENGT_FORTROLIG') {
    return userRoles.some((r) => STRENGT_FORTROLIG_ROLES.includes(r))
  }

  // FORTROLIG — group roles + COMPANY_MANAGER
  if (level === 'FORTROLIG') {
    return userRoles.some((r) => FORTROLIG_ROLES.includes(r))
  }

  // INTERN, STANDARD, PUBLIC — all authenticated users with company access
  return true
}

export async function getAccessibleCompanies(
  userId: string,
  organizationId: string
): Promise<string[]> {
  const roles = await getUserRoles(userId)

  // If any role has ALL scope, return all companies
  for (const assignment of roles) {
    if (assignment.scope === 'ALL') {
      const companies = await prisma.company.findMany({
        where: { organization_id: organizationId, deleted_at: null },
        select: { id: true },
      })
      return companies.map((c) => c.id)
    }
  }

  // Otherwise, collect assigned company IDs
  const companyIds = new Set<string>()
  for (const assignment of roles) {
    for (const cid of assignment.company_ids) {
      companyIds.add(cid)
    }
  }

  return Array.from(companyIds)
}

export async function canAccessModule(userId: string, module: string): Promise<boolean> {
  const roles = await getUserRoles(userId)
  const userRoles = roles.map((r) => r.role)

  switch (module) {
    case 'settings':
    case 'user_management':
      return userRoles.some((r) => r === 'GROUP_OWNER' || r === 'GROUP_ADMIN')
    case 'billing':
      return userRoles.includes('GROUP_OWNER')
    case 'finance':
      return userRoles.some(
        (r) =>
          r === 'GROUP_OWNER' ||
          r === 'GROUP_ADMIN' ||
          r === 'GROUP_FINANCE' ||
          r === 'GROUP_READONLY' ||
          r === 'COMPANY_MANAGER'
      )
    case 'cases':
    case 'contracts':
      return userRoles.some(
        (r) =>
          r === 'GROUP_OWNER' ||
          r === 'GROUP_ADMIN' ||
          r === 'GROUP_LEGAL' ||
          r === 'GROUP_READONLY' ||
          r === 'COMPANY_MANAGER' ||
          r === 'COMPANY_LEGAL' ||
          r === 'COMPANY_READONLY'
      )
    default:
      return true // companies, tasks, persons, documents — all authenticated
  }
}

export function getSensitivityIndex(level: SensitivityLevel): number {
  return SENSITIVITY_ORDER.indexOf(level)
}

export function meetsMinimumSensitivity(
  actual: SensitivityLevel,
  minimum: SensitivityLevel
): boolean {
  return getSensitivityIndex(actual) >= getSensitivityIndex(minimum)
}
