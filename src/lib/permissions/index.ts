import { prisma } from '@/lib/db'
import { SensitivityLevel, UserRole, UserScope } from '@prisma/client'

export type ModuleType =
  | 'companies'
  | 'contracts'
  | 'cases'
  | 'tasks'
  | 'persons'
  | 'documents'
  | 'finance'
  | 'settings'
  | 'user_management'

// Sensitivitets-hierarki (lavest til højest)
const SENSITIVITY_HIERARCHY: SensitivityLevel[] = [
  'PUBLIC',
  'STANDARD',
  'INTERN',
  'FORTROLIG',
  'STRENGT_FORTROLIG',
]

// Hvilke roller kan se hvilke sensitivitetsniveauer
const ROLE_SENSITIVITY_ACCESS: Record<UserRole, SensitivityLevel[]> = {
  GROUP_OWNER: ['PUBLIC', 'STANDARD', 'INTERN', 'FORTROLIG', 'STRENGT_FORTROLIG'],
  GROUP_ADMIN: ['PUBLIC', 'STANDARD', 'INTERN', 'FORTROLIG', 'STRENGT_FORTROLIG'],
  GROUP_LEGAL: ['PUBLIC', 'STANDARD', 'INTERN', 'FORTROLIG', 'STRENGT_FORTROLIG'],
  GROUP_FINANCE: ['PUBLIC', 'STANDARD', 'INTERN', 'FORTROLIG'],
  GROUP_READONLY: ['PUBLIC', 'STANDARD', 'INTERN', 'FORTROLIG'],
  COMPANY_MANAGER: ['PUBLIC', 'STANDARD', 'INTERN', 'FORTROLIG'],
  COMPANY_LEGAL: ['PUBLIC', 'STANDARD', 'INTERN'],
  COMPANY_READONLY: ['PUBLIC', 'STANDARD', 'INTERN'],
}

// Hvilke roller har adgang til hvilke moduler
const ROLE_MODULE_ACCESS: Record<UserRole, ModuleType[]> = {
  GROUP_OWNER: [
    'companies',
    'contracts',
    'cases',
    'tasks',
    'persons',
    'documents',
    'finance',
    'settings',
    'user_management',
  ],
  GROUP_ADMIN: [
    'companies',
    'contracts',
    'cases',
    'tasks',
    'persons',
    'documents',
    'finance',
    'settings',
    'user_management',
  ],
  GROUP_LEGAL: [
    'companies',
    'contracts',
    'cases',
    'tasks',
    'persons',
    'documents',
    'settings',
  ],
  GROUP_FINANCE: [
    'companies',
    'tasks',
    'persons',
    'documents',
    'finance',
    'settings',
  ],
  GROUP_READONLY: [
    'companies',
    'contracts',
    'cases',
    'tasks',
    'persons',
    'documents',
    'finance',
  ],
  COMPANY_MANAGER: [
    'companies',
    'contracts',
    'cases',
    'tasks',
    'persons',
    'documents',
    'finance',
  ],
  COMPANY_LEGAL: [
    'companies',
    'contracts',
    'cases',
    'tasks',
    'persons',
    'documents',
  ],
  COMPANY_READONLY: [
    'companies',
    'contracts',
    'cases',
    'tasks',
    'persons',
    'documents',
  ],
}

// Hent brugers roller
async function getUserRoleAssignments(userId: string) {
  return prisma.userRoleAssignment.findMany({
    where: { userId },
  })
}

/**
 * Tjekker om en bruger har adgang til et specifikt selskab
 */
export async function canAccessCompany(
  userId: string,
  companyId: string
): Promise<boolean> {
  const roles = await getUserRoleAssignments(userId)

  if (roles.length === 0) {
    return false
  }

  for (const roleAssignment of roles) {
    // GROUP_* roller med scope ALL har adgang til alle selskaber
    if (
      roleAssignment.scope === 'ALL' &&
      roleAssignment.role.startsWith('GROUP_')
    ) {
      return true
    }

    // ASSIGNED scope - tjek om companyId er i listen
    if (roleAssignment.scope === 'ASSIGNED') {
      if (roleAssignment.companyIds.includes(companyId)) {
        return true
      }
    }

    // OWN scope - tjek om companyId matcher (kun ét selskab)
    if (roleAssignment.scope === 'OWN') {
      if (
        roleAssignment.companyIds.length === 1 &&
        roleAssignment.companyIds[0] === companyId
      ) {
        return true
      }
    }
  }

  return false
}

/**
 * Tjekker om en bruger har adgang til et specifikt sensitivitetsniveau
 */
export async function canAccessSensitivity(
  userId: string,
  level: SensitivityLevel
): Promise<boolean> {
  const roles = await getUserRoleAssignments(userId)

  if (roles.length === 0) {
    return false
  }

  // Tjek om mindst én af brugerens roller giver adgang til dette niveau
  for (const roleAssignment of roles) {
    const allowedLevels = ROLE_SENSITIVITY_ACCESS[roleAssignment.role]
    if (allowedLevels.includes(level)) {
      return true
    }
  }

  return false
}

/**
 * Tjekker om en bruger har adgang til et specifikt modul
 */
export async function canAccessModule(
  userId: string,
  module: ModuleType
): Promise<boolean> {
  const roles = await getUserRoleAssignments(userId)

  if (roles.length === 0) {
    return false
  }

  // Tjek om mindst én af brugerens roller giver adgang til dette modul
  for (const roleAssignment of roles) {
    const allowedModules = ROLE_MODULE_ACCESS[roleAssignment.role]
    if (allowedModules.includes(module)) {
      return true
    }
  }

  return false
}

/**
 * Returnerer alle selskaber som brugeren har adgang til
 */
export async function getAccessibleCompanies(userId: string) {
  const roles = await getUserRoleAssignments(userId)

  if (roles.length === 0) {
    return []
  }

  // Hent brugerens organization ID
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  })

  if (!user) {
    return []
  }

  // Saml alle tilgængelige company IDs
  const accessibleCompanyIds = new Set<string>()
  let hasAllAccess = false

  for (const roleAssignment of roles) {
    if (
      roleAssignment.scope === 'ALL' &&
      roleAssignment.role.startsWith('GROUP_')
    ) {
      hasAllAccess = true
      break
    }

    if (roleAssignment.scope === 'ASSIGNED' || roleAssignment.scope === 'OWN') {
      roleAssignment.companyIds.forEach((id) => accessibleCompanyIds.add(id))
    }
  }

  // Hvis brugeren har adgang til alle, hent alle selskaber
  if (hasAllAccess) {
    return prisma.company.findMany({
      where: {
        organizationId: user.organizationId,
        deletedAt: null,
      },
      orderBy: { name: 'asc' },
    })
  }

  // Ellers hent kun de specifikke selskaber
  if (accessibleCompanyIds.size === 0) {
    return []
  }

  return prisma.company.findMany({
    where: {
      id: { in: Array.from(accessibleCompanyIds) },
      organizationId: user.organizationId,
      deletedAt: null,
    },
    orderBy: { name: 'asc' },
  })
}

/**
 * Tjekker om en bruger har en specifik rolle
 */
export async function hasRole(
  userId: string,
  role: UserRole
): Promise<boolean> {
  const roles = await getUserRoleAssignments(userId)
  return roles.some((r) => r.role === role)
}

/**
 * Tjekker om en bruger har en af de angivne roller
 */
export async function hasAnyRole(
  userId: string,
  roles: UserRole[]
): Promise<boolean> {
  const userRoles = await getUserRoleAssignments(userId)
  return userRoles.some((r) => roles.includes(r.role))
}

/**
 * Tjekker om brugeren kan redigere (ikke readonly)
 */
export async function canEdit(userId: string): Promise<boolean> {
  const roles = await getUserRoleAssignments(userId)
  const readonlyRoles: UserRole[] = ['GROUP_READONLY', 'COMPANY_READONLY']
  
  // Brugeren kan redigere hvis de har mindst én ikke-readonly rolle
  return roles.some((r) => !readonlyRoles.includes(r.role))
}

/**
 * Tjekker om brugeren kan administrere brugere
 */
export async function canManageUsers(userId: string): Promise<boolean> {
  const roles = await getUserRoleAssignments(userId)
  const adminRoles: UserRole[] = ['GROUP_OWNER', 'GROUP_ADMIN']
  return roles.some((r) => adminRoles.includes(r.role))
}

/**
 * Tjekker om brugeren kan tilgå fakturering
 */
export async function canAccessBilling(userId: string): Promise<boolean> {
  return hasRole(userId, 'GROUP_OWNER')
}

/**
 * Returnerer det højeste sensitivitetsniveau brugeren har adgang til
 */
export async function getMaxSensitivityLevel(
  userId: string
): Promise<SensitivityLevel | null> {
  const roles = await getUserRoleAssignments(userId)

  if (roles.length === 0) {
    return null
  }

  let maxLevel: SensitivityLevel = 'PUBLIC'
  let maxIndex = 0

  for (const roleAssignment of roles) {
    const allowedLevels = ROLE_SENSITIVITY_ACCESS[roleAssignment.role]
    for (const level of allowedLevels) {
      const index = SENSITIVITY_HIERARCHY.indexOf(level)
      if (index > maxIndex) {
        maxIndex = index
        maxLevel = level
      }
    }
  }

  return maxLevel
}