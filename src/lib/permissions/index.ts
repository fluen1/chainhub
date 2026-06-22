import { type SensitivityLevel, type UserRole } from '@prisma/client'
import { cache } from 'react'
import { prisma } from '@/lib/db'
import { type AppModule, roleCanAccessModule } from './role-modules'

// Re-eksportér single source of truth for rolle→modul-adgang, så call-sites
// kan importere alt fra '@/lib/permissions'.
export { type AppModule, ALL_MODULES, roleCanAccessModule, modulesForRole } from './role-modules'

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

const getUserRoles = cache(
  async (
    userId: string,
    organizationId: string
  ): Promise<
    Array<{
      role: UserRole
      scope: string
      company_ids: string[]
    }>
  > => {
    // organization_id-filter forhindrer cross-tenant rolle-leak ved UUID-kollision
    const assignments = await prisma.userRoleAssignment.findMany({
      where: { user_id: userId, organization_id: organizationId },
      select: { role: true, scope: true, company_ids: true },
    })
    return assignments
  }
)

export async function canAccessCompany(
  userId: string,
  companyId: string,
  organizationId: string
): Promise<boolean> {
  const roles = await getUserRoles(userId, organizationId)

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

/**
 * Bulk-variant af canAccessCompany — ét enkelt DB-kald for N selskaber.
 * Returnerer et Set med de company-IDs brugeren har adgang til.
 * Brug i stedet for at kalde canAccessCompany i en løkke.
 */
export async function canAccessCompanies(
  userId: string,
  companyIds: string[],
  organizationId: string
): Promise<Set<string>> {
  if (companyIds.length === 0) return new Set()

  const roles = await getUserRoles(userId, organizationId)

  // Har brugeren ALL-scope? → alle company-IDs er tilgængelige
  const hasAllScope = roles.some(
    (assignment) => GROUP_ROLES.includes(assignment.role) && assignment.scope === 'ALL'
  )
  if (hasAllScope) return new Set(companyIds)

  // Ellers: byg et Set af eksplicit tildelte company-IDs
  const assignedIds = new Set<string>()
  for (const assignment of roles) {
    if (assignment.scope === 'ASSIGNED' || assignment.scope === 'OWN') {
      for (const cid of assignment.company_ids) {
        assignedIds.add(cid)
      }
    }
  }

  // Returnér skæringssættet: kun de ønskede IDs brugeren rent faktisk har adgang til
  return new Set(companyIds.filter((id) => assignedIds.has(id)))
}

export async function canAccessSensitivity(
  userId: string,
  level: SensitivityLevel,
  organizationId: string
): Promise<boolean> {
  const roles = await getUserRoles(userId, organizationId)
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
  const roles = await getUserRoles(userId, organizationId)

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

export async function canAccessModule(
  userId: string,
  module: string,
  organizationId: string
): Promise<boolean> {
  const roles = await getUserRoles(userId, organizationId)
  const userRoles = roles.map((r) => r.role)

  switch (module) {
    case 'settings':
    case 'user_management':
      return userRoles.some((r) => r === 'GROUP_OWNER' || r === 'GROUP_ADMIN')
    case 'billing':
      return userRoles.includes('GROUP_OWNER')
    // Data-moduler delegerer til single source of truth (role-modules.ts), så
    // server-tjek og UI-gating (sidebar/lister/dashboard) ikke kan divergere.
    // Spec: docs/spec/roller-og-tilladelser.md "Modul-adgang pr. rolle (MVP)".
    case 'finance':
    case 'cases':
    case 'contracts':
    case 'documents':
    case 'tasks':
    case 'companies':
    case 'persons':
    case 'governance':
    case 'ownership':
      return userRoles.some((r) => roleCanAccessModule(r, module as AppModule))
    // Onboarding: vises til alle authentikerede brugere med en hvilken som helst rolle
    case 'onboarding':
      return userRoles.length > 0
    // Export: compliance/rapport-brug — GROUP_OWNER, GROUP_ADMIN, GROUP_LEGAL, GROUP_FINANCE
    // GDPR-export (prepareGdprExport) er admin-only og bruger 'settings'-modulet separat.
    case 'export':
      return userRoles.some(
        (r) =>
          r === 'GROUP_OWNER' || r === 'GROUP_ADMIN' || r === 'GROUP_LEGAL' || r === 'GROUP_FINANCE'
      )
    // Users-list: bruges af assignee-dropdowns i cases/tasks/contracts.
    // Tilgængeligt for alle der kan redigere i mindst ét modul.
    case 'users-list':
      return userRoles.some(
        (r) =>
          r === 'GROUP_OWNER' ||
          r === 'GROUP_ADMIN' ||
          r === 'GROUP_LEGAL' ||
          r === 'GROUP_FINANCE' ||
          r === 'GROUP_READONLY' ||
          r === 'COMPANY_MANAGER' ||
          r === 'COMPANY_LEGAL' ||
          r === 'COMPANY_READONLY'
      )
    default:
      // FAIL-CLOSED: ukendte moduler afvises. Tilføj eksplicit case for nye moduler.
      return false
  }
}

/**
 * Returnerer alle SensitivityLevel-værdier brugeren har adgang til.
 * Bruges til `sensitivity: { in: allowedLevels }` i WHERE-klausuler.
 */
export async function getAllowedSensitivityLevels(
  userId: string,
  organizationId: string
): Promise<SensitivityLevel[]> {
  const roles = await getUserRoles(userId, organizationId)
  const userRoles = roles.map((r) => r.role)

  if (userRoles.some((r) => STRENGT_FORTROLIG_ROLES.includes(r))) {
    // Kan se alt
    return ['PUBLIC', 'STANDARD', 'INTERN', 'FORTROLIG', 'STRENGT_FORTROLIG']
  }
  if (userRoles.some((r) => FORTROLIG_ROLES.includes(r))) {
    return ['PUBLIC', 'STANDARD', 'INTERN', 'FORTROLIG']
  }
  // Alle øvrige autentikerede brugere kan kun se PUBLIC, STANDARD, INTERN
  return ['PUBLIC', 'STANDARD', 'INTERN']
}

/**
 * Eksport leverer hele datasæt på tværs af selskaber og er en compliance/admin-funktion.
 * Beslutning (Philip 2026-06-16): KUN GROUP_OWNER/GROUP_ADMIN må eksportere.
 * GROUP_LEGAL/GROUP_FINANCE og alle COMPANY_*-roller afvises (fail-closed), selv
 * med ALL-scope/top-sensitivity. Kræver tillige ALL-scope, så en company-begrænset
 * admin-tildeling ikke kan exfiltrere data på tværs af selskaber.
 * Ren funktion for testbarhed — wrappes af canExportAllScope nedenfor.
 */
export function rolesCanExportAllScope(
  roles: ReadonlyArray<{ role: UserRole; scope: string }>
): boolean {
  return roles.some(
    (a) => (a.role === 'GROUP_OWNER' || a.role === 'GROUP_ADMIN') && a.scope === 'ALL'
  )
}

export async function canExportAllScope(userId: string, organizationId: string): Promise<boolean> {
  const roles = await getUserRoles(userId, organizationId)
  return rolesCanExportAllScope(roles)
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
