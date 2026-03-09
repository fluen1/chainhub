import { prisma } from '@/lib/db'
import { SensitivityLevel, UserRole } from '@prisma/client'

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
  | 'dashboard'

export type { SensitivityLevel }

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
    'dashboard',
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
    'dashboard',
  ],
  GROUP_LEGAL: [
    'companies',
    'contracts',
    'cases',
    'tasks',
    'persons',
    'documents',
    'settings',
    'dashboard',
  ],
  GROUP_FINANCE: [
    'companies',
    'tasks',
    'persons',
    'documents',
    'finance',
    'settings',
    'dashboard',
  ],
  GROUP_READONLY: [
    'companies',
    'contracts',
    'cases',
    'tasks',
    'persons',
    'documents',
    'finance',
    'dashboard',
  ],
  COMPANY_MANAGER: [
    'companies',
    'contracts',
    'cases',
    'tasks',
    'persons',
    'documents',
    'finance',
    'dashboard',
  ],
  COMPANY_LEGAL: [
    'companies',
    'contracts',
    'cases',
    'tasks',
    'persons',
    'documents',
    'dashboard',
  ],
  COMPANY_READONLY: [
    'companies',
    'contracts',
    'cases',
    'tasks',
    'persons',
    'documents',
    'dashboard',
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
      organizationId: user.organizationId,
    },
  })
}

/**
 * Tjekker om en bruger har adgang til et bestemt selskab.
 */
export async function canAccessCompany(userId: string, companyId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  })

  if (!user) return false

  // Tjek at selskabet tilhører brugerens organisation
  const company = await prisma.company.findFirst({
    where: {
      id: companyId,
      organizationId: user.organizationId,
      deletedAt: null,
    },
    select: { id: true },
  })

  if (!company) return false

  const roleAssignments = await getUserRoleAssignments(userId)

  if (roleAssignments.length === 0) return false

  for (const assignment of roleAssignments) {
    // ALL scope: adgang til alle selskaber i organisationen
    if (assignment.scope === 'ALL') return true

    // ASSIGNED scope: tjek om brugeren er tildelt dette selskab
    if (assignment.scope === 'ASSIGNED' || assignment.scope === 'OWN') {
      const companyAssignment = await prisma.userCompanyAssignment.findFirst({
        where: {
          userId,
          companyId,
        },
      })
      if (companyAssignment) return true
    }
  }

  return false
}

/**
 * Tjekker om en bruger har adgang til et bestemt sensitivitetsniveau.
 */
export async function canAccessSensitivity(
  userId: string,
  level: SensitivityLevel
): Promise<boolean> {
  const roleAssignments = await getUserRoleAssignments(userId)

  if (roleAssignments.length === 0) return false

  for (const assignment of roleAssignments) {
    const allowedLevels = ROLE_SENSITIVITY_ACCESS[assignment.role]
    if (allowedLevels && allowedLevels.includes(level)) {
      return true
    }
  }

  return false
}

/**
 * Tjekker om en bruger har adgang til et bestemt modul.
 */
export async function canAccessModule(userId: string, module: ModuleType): Promise<boolean> {
  const roleAssignments = await getUserRoleAssignments(userId)

  if (roleAssignments.length === 0) return false

  for (const assignment of roleAssignments) {
    const allowedModules = ROLE_MODULE_ACCESS[assignment.role]
    if (allowedModules && allowedModules.includes(module)) {
      return true
    }
  }

  return false
}

/**
 * Returnerer alle selskaber som brugeren har adgang til.
 */
export async function getAccessibleCompanies(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  })

  if (!user) return []

  const roleAssignments = await getUserRoleAssignments(userId)

  if (roleAssignments.length === 0) return []

  // Tjek om brugeren har ALL scope
  const hasAllScope = roleAssignments.some((a) => a.scope === 'ALL')

  if (hasAllScope) {
    return prisma.company.findMany({
      where: {
        organizationId: user.organizationId,
        deletedAt: null,
      },
      orderBy: { name: 'asc' },
    })
  }

  // ASSIGNED eller OWN scope: hent kun tildelte selskaber
  const companyAssignments = await prisma.userCompanyAssignment.findMany({
    where: { userId },
    select: { companyId: true },
  })

  const companyIds = companyAssignments.map((a) => a.companyId)

  return prisma.company.findMany({
    where: {
      id: { in: companyIds },
      organizationId: user.organizationId,
      deletedAt: null,
    },
    orderBy: { name: 'asc' },
  })
}

/**
 * Tjekker om en bruger har en readonly-rolle (og dermed ikke må mutere data).
 */
export async function isReadonlyUser(userId: string): Promise<boolean> {
  const roleAssignments = await getUserRoleAssignments(userId)

  if (roleAssignments.length === 0) return true

  const hasWriteRole = roleAssignments.some((a) => !READONLY_ROLES.includes(a.role))
  return !hasWriteRole
}

/**
 * Kaster en fejl hvis brugeren er en readonly-bruger.
 */
export async function requireWriteAccess(userId: string): Promise<void> {
  const readonly = await isReadonlyUser(userId)
  if (readonly) {
    throw new Error('Denne handling kræver skriveadgang')
  }
}

// Re-export sensitivity hierarchy for external use
export { SENSITIVITY_HIERARCHY, READONLY_ROLES }