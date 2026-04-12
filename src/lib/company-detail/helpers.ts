// -----------------------------------------------------------------
// Typer
// -----------------------------------------------------------------

export type SectionKey =
  | 'ownership'
  | 'contracts'
  | 'finance'
  | 'cases'
  | 'persons'
  | 'visits'
  | 'documents'
  | 'insight'

export type DimSeverity = 'red' | 'amber' | 'green'

export interface HealthDimensions {
  kontrakter: DimSeverity
  sager: DimSeverity
  oekonomi: DimSeverity
  governance: DimSeverity
}

export interface StatusBadge {
  label: 'Kritisk' | 'Advarsel' | 'Sund'
  severity: 'critical' | 'warning' | 'healthy'
}

// -----------------------------------------------------------------
// Rolle-konfiguration
// -----------------------------------------------------------------

const ROLE_PRIORITY: Record<string, number> = {
  GROUP_OWNER: 100,
  GROUP_ADMIN: 90,
  GROUP_LEGAL: 80,
  GROUP_FINANCE: 80,
  GROUP_READONLY: 70,
  COMPANY_MANAGER: 60,
  COMPANY_LEGAL: 50,
  COMPANY_READONLY: 40,
}

// Proto's roleConfig mapped til ChainHub's rolle-navne
const SECTIONS_BY_ROLE: Record<string, SectionKey[]> = {
  GROUP_OWNER:      ['ownership', 'contracts', 'finance', 'cases', 'persons', 'visits', 'documents', 'insight'],
  GROUP_ADMIN:      ['ownership', 'persons', 'visits', 'documents'],
  GROUP_LEGAL:      ['ownership', 'contracts', 'cases', 'documents', 'insight'],
  COMPANY_LEGAL:    ['ownership', 'contracts', 'cases', 'documents', 'insight'],
  GROUP_FINANCE:    ['contracts', 'finance', 'insight'],
  COMPANY_MANAGER:  ['persons', 'visits'],
  GROUP_READONLY:   ['ownership', 'contracts', 'finance', 'cases', 'persons', 'visits', 'documents', 'insight'],
  COMPANY_READONLY: ['persons', 'visits'],
}

// Hardcoded senior-roller for Noeglepersoner-sektionen (hierarki-orden = prioritet)
export const KEY_PERSON_ROLES = [
  'Partner',
  'Medejer',
  'CEO',
  'Direktoer',
  'CFO',
  'Bestyrelsesformand',
  'Bestyrelsesmedlem',
  'Klinisk leder',
  'Klinikchef',
  'Stedfortraeder',
] as const

// -----------------------------------------------------------------
// Rolle-helpers
// -----------------------------------------------------------------

export function pickHighestPriorityRole(roleRows: Array<{ role: string }>): string {
  if (roleRows.length === 0) return 'GROUP_READONLY'
  return [...roleRows].sort(
    (a, b) => (ROLE_PRIORITY[b.role] ?? 0) - (ROLE_PRIORITY[a.role] ?? 0)
  )[0].role
}

export function sectionsForRole(role: string): Set<SectionKey> {
  const list = SECTIONS_BY_ROLE[role] ?? SECTIONS_BY_ROLE.GROUP_OWNER
  return new Set(list)
}

// -----------------------------------------------------------------
// Health-dimensions
// -----------------------------------------------------------------

export interface HealthDimensionsInput {
  activeContracts: Array<{ expiry_date: Date | null }>
  openCases: Array<{ status: string }>
  finance2025: { ebitda: number; margin: number; omsaetning: number } | null
  finance2024: { omsaetning: number } | null
  lastVisitDate: Date | null
  today: Date
}

export function deriveHealthDimensions(input: HealthDimensionsInput): HealthDimensions {
  const { activeContracts, openCases, finance2025, finance2024, lastVisitDate, today } = input

  // Kontrakter
  const in30days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
  const hasExpired = activeContracts.some(
    (c) => c.expiry_date !== null && c.expiry_date < today
  )
  const hasExpiringSoon = activeContracts.some(
    (c) => c.expiry_date !== null && c.expiry_date >= today && c.expiry_date < in30days
  )
  const kontrakter: DimSeverity = hasExpired ? 'red' : hasExpiringSoon ? 'amber' : 'green'

  // Sager
  const hasActiveCase = openCases.some((c) => c.status === 'NY' || c.status === 'AKTIV')
  const hasAwaitingCase = openCases.some((c) => c.status.startsWith('AFVENTER_'))
  const sager: DimSeverity = hasActiveCase ? 'red' : hasAwaitingCase ? 'amber' : 'green'

  // Oekonomi
  let oekonomi: DimSeverity = 'green'
  if (finance2025) {
    if (finance2025.ebitda < 0) {
      oekonomi = 'red'
    } else if (finance2025.margin < 0.05) {
      oekonomi = 'amber'
    } else if (finance2024 && finance2024.omsaetning > 0) {
      const yoyDrop = (finance2024.omsaetning - finance2025.omsaetning) / finance2024.omsaetning
      if (yoyDrop > 0.1) oekonomi = 'amber'
    }
  }

  // Governance
  let governance: DimSeverity = 'red'
  if (lastVisitDate) {
    const daysSince = Math.floor((today.getTime() - lastVisitDate.getTime()) / (1000 * 60 * 60 * 24))
    if (daysSince < 180) governance = 'green'
    else if (daysSince < 365) governance = 'amber'
  }

  return { kontrakter, sager, oekonomi, governance }
}

export function deriveStatusBadge(dims: HealthDimensions): StatusBadge {
  const values = [dims.kontrakter, dims.sager, dims.oekonomi, dims.governance]
  if (values.includes('red')) return { label: 'Kritisk', severity: 'critical' }
  if (values.includes('amber')) return { label: 'Advarsel', severity: 'warning' }
  return { label: 'Sund', severity: 'healthy' }
}

// -----------------------------------------------------------------
// Sorterings-helpers
// -----------------------------------------------------------------

export function sortContractsByUrgency<T extends { expiry_date: Date | null }>(
  contracts: T[],
  today: Date
): T[] {
  const in30days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
  return [...contracts].sort((a, b) => {
    const aExpired = a.expiry_date !== null && a.expiry_date < today
    const bExpired = b.expiry_date !== null && b.expiry_date < today
    if (aExpired && !bExpired) return -1
    if (!aExpired && bExpired) return 1

    const aSoon = a.expiry_date !== null && a.expiry_date >= today && a.expiry_date < in30days
    const bSoon = b.expiry_date !== null && b.expiry_date >= today && b.expiry_date < in30days
    if (aSoon && !bSoon) return -1
    if (!aSoon && bSoon) return 1

    const aTime = a.expiry_date?.getTime() ?? Number.POSITIVE_INFINITY
    const bTime = b.expiry_date?.getTime() ?? Number.POSITIVE_INFINITY
    return aTime - bTime
  })
}

export function sortCasesByUrgency<T extends { status: string; created_at: Date }>(cases: T[]): T[] {
  const statusRank: Record<string, number> = { NY: 0, AKTIV: 1 }
  return [...cases].sort((a, b) => {
    const aRank = statusRank[a.status] ?? (a.status.startsWith('AFVENTER_') ? 2 : 3)
    const bRank = statusRank[b.status] ?? (b.status.startsWith('AFVENTER_') ? 2 : 3)
    if (aRank !== bRank) return aRank - bRank
    return b.created_at.getTime() - a.created_at.getTime()
  })
}

// -----------------------------------------------------------------
// Noeglepersoner
// -----------------------------------------------------------------

export interface KeyPersonCandidate {
  role: string
  anciennity_start: Date | null
  person: { first_name: string; last_name: string }
}

export function selectKeyPersons<T extends KeyPersonCandidate>(candidates: T[]): T[] {
  const roleIndex = (role: string): number => {
    const idx = (KEY_PERSON_ROLES as readonly string[]).indexOf(role)
    return idx === -1 ? Number.POSITIVE_INFINITY : idx
  }

  return [...candidates]
    .filter((c) => (KEY_PERSON_ROLES as readonly string[]).includes(c.role))
    .sort((a, b) => {
      const aRank = roleIndex(a.role)
      const bRank = roleIndex(b.role)
      if (aRank !== bRank) return aRank - bRank

      const aAnc = a.anciennity_start?.getTime() ?? Number.POSITIVE_INFINITY
      const bAnc = b.anciennity_start?.getTime() ?? Number.POSITIVE_INFINITY
      if (aAnc !== bAnc) return aAnc - bAnc

      const aName = `${a.person.first_name} ${a.person.last_name}`
      const bName = `${b.person.first_name} ${b.person.last_name}`
      return aName.localeCompare(bName, 'da')
    })
    .slice(0, 3)
}
