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

// Readonly-roller der IKKE må udføre muterende operationer
const READONLY_ROLES: UserRole[] = ['GROUP_READONLY', 'COMPANY_READONLY']

/**
 * Henter brugerens rolle-tildelinger FILTRERET på brugerens organisation.
 * SIKKERHED (DEC-021/PENTEST-002): Uden organizationId-filter kan rolle-tildelinger
 * fra andre organisationer (data-korruption, fremtidig multi-org) give uautoriseret adgang.
 */
async function getUserRoleAssignments(userId: string) {
  // Hent brugerens organisation først
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  })

  if (!user) return []

  return prisma.userRoleAssignment.findMany({
    where: {
      userId,
      organizationId: user.organizationId, // ← KRITISK: DEC-021 fix
    },
  })
}

/**
 * Tjekker om en bruger har adgang til et specifikt selskab.
 * Validerer scope (ALL / ASSIGNED / OWN) og companyIds.
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
 * Tjekker om en bruger har adgang til et specifikt sensitivitetsniveau.
 * Tjekker ALLE niveauer — ingen shortcuts for PUBLIC/STANDARD/INTERN,
 * da dette fremtidssikrer mod fase 2-roller med mere restriktiv adgang.
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
 * Tjekker om en bruger har adgang til et specifikt modul.
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
 * Tjekker om brugeren har skriveadgang (ikke readonly).
 *
 * SIKKERHED (PENTEST-001 / DEC-047):
 * COMPANY_READONLY og GROUP_READONLY må KUN læse — aldrig skrive, opdatere eller slette.
 * Denne funktion SKAL kaldes som første tjek i ALLE muterende server actions.
 *
 * En bruger har skriveadgang hvis de har MINDST ÉN ikke-readonly rolle.
 * Dette tillader kombinationer som GROUP_LEGAL + COMPANY_READONLY
 * (har skriveadgang via GROUP_LEGAL).
 */
export async function canWrite(userId: string): Promise<boolean> {
  const roles = await getUserRoleAssignments(userId)

  if (roles.length === 0) {
    return false
  }

  // Brugeren kan skrive hvis de har mindst én ikke-readonly rolle
  return roles.some((r) => !READONLY_ROLES.includes(r.role))
}

/**
 * Returnerer alle selskaber som brugeren har adgang til.
 * Respekterer scope (ALL / ASSIGNED / OWN).
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

  // Hvis brugeren har adgang til alle, hent alle selskaber i organisationen
  if (hasAllAccess) {
    return prisma.company.findMany({
      where: {
        organizationId: user.organizationId,
        deletedAt: null,
      },
      orderBy: { name: 'asc' },
    })
  }

  // Ellers hent kun de specifikke selskaber — verificer organizationId
  if (accessibleCompanyIds.size === 0) {
    return []
  }

  return prisma.company.findMany({
    where: {
      id: { in: Array.from(accessibleCompanyIds) },
      organizationId: user.organizationId, // ← Tenant isolation
      deletedAt: null,
    },
    orderBy: { name: 'asc' },
  })
}

/**
 * Tjekker om en bruger har en specifik rolle.
 */
export async function hasRole(
  userId: string,
  role: UserRole
): Promise<boolean> {
  const roles = await getUserRoleAssignments(userId)
  return roles.some((r) => r.role === role)
}

/**
 * Tjekker om en bruger har en af de angivne roller.
 */
export async function hasAnyRole(
  userId: string,
  roles: UserRole[]
): Promise<boolean> {
  const userRoles = await getUserRoleAssignments(userId)
  return userRoles.some((r) => roles.includes(r.role))
}

/**
 * Tjekker om brugeren kan redigere (ikke readonly).
 * @deprecated Brug canWrite() i stedet — samme semantik, mere præcist navn.
 */
export async function canEdit(userId: string): Promise<boolean> {
  return canWrite(userId)
}

/**
 * Tjekker om brugeren kan administrere brugere.
 * Kun GROUP_OWNER og GROUP_ADMIN.
 */
export async function canManageUsers(userId: string): Promise<boolean> {
  const roles = await getUserRoleAssignments(userId)
  const adminRoles: UserRole[] = ['GROUP_OWNER', 'GROUP_ADMIN']
  return roles.some((r) => adminRoles.includes(r.role))
}

/**
 * Tjekker om brugeren kan tilgå fakturering.
 * Kun GROUP_OWNER.
 */
export async function canAccessBilling(userId: string): Promise<boolean> {
  return hasRole(userId, 'GROUP_OWNER')
}

/**
 * Returnerer det højeste sensitivitetsniveau brugeren har adgang til.
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