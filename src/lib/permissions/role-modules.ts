import { type UserRole } from '@prisma/client'

// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for rolle→modul-adgang (UX-review #10).
//
// Tidligere var rolle-trimning spredt over 3+ steder der divergerede:
//   • b-sidebar.tsx (statisk SECTIONS, ingen rolle-filtrering)
//   • dashboard/page.tsx (inline if/else for Strip-cells)
//   • company-detail/helpers.ts (SECTIONS_BY_ROLE)
// Resultat: GROUP_FINANCE så "Kontrakter"/"Sager" i sidebar + selskabsliste-
// kolonner + sags-baserede dashboard-links — moduler rollen ikke kan åbne.
//
// Denne fil er den ENESTE autoritative kilde. Den synkrone `roleCanAccessModule`
// bruges i UI-lag der allerede kender brugerens rolle (sidebar, lister, paneler).
// Den async `canAccessModule` (permissions/index.ts) delegerer til samme matrix,
// så server-tjek og UI-gating ikke kan divergere.
//
// Matrix afledt direkte af docs/spec/roller-og-tilladelser.md
// "Modul-adgang pr. rolle (MVP)".
// ─────────────────────────────────────────────────────────────────────────────

export type AppModule =
  | 'companies'
  | 'contracts'
  | 'cases'
  | 'tasks'
  | 'persons'
  | 'documents'
  | 'finance'
  | 'governance'
  | 'ownership'

export const ALL_MODULES: readonly AppModule[] = [
  'companies',
  'contracts',
  'cases',
  'tasks',
  'persons',
  'documents',
  'finance',
  'governance',
  'ownership',
] as const

// ✅ = ser, ❌ = ser ikke (spec linje 142-156):
//                    OWNR ADMN LEGL FIN  RO   MGR  C_LEG C_RO
// companies          ✅   ✅   ✅   ✅   ✅   ✅   ✅    ✅
// contracts          ✅   ✅   ✅   ❌   ✅   ✅   ✅    ✅
// cases              ✅   ✅   ✅   ❌   ✅   ✅   ✅    ✅
// tasks              ✅   ✅   ✅   ✅   ✅   ✅   ✅    ✅
// persons            ✅   ✅   ✅   ✅   ✅   ✅   ✅    ✅
// documents          ✅   ✅   ✅   ✅   ✅   ✅   ✅    ✅
// finance            ✅   ✅   ❌   ✅   ✅   ✅   ❌    ❌  (se note)
// governance         ✅   ✅   ✅   ✅   ✅   ✅   ✅    ✅
// ownership          ✅   ✅   ✅   ❌   ❌   ❌   ❌    ❌
//
// NOTE (Rule 7 — konflikt løst konservativt): Spec-dokumentet markerer
// COMPANY_READONLY ✅* for Økonomi-overblik, men den eksisterende — og test-
// dækkede — async `canAccessModule('finance')` (permissions/index.ts) UDELADER
// COMPANY_READONLY. Vi konformerer til den faktiske kode (ikke spec-doc'et) for
// ikke at udvide adgang ved en refaktorering, og delegerer canAccessModule hertil
// så de to ikke kan divergere. Hvis COMPANY_READONLY-finance ønskes, rettes det
// ét sted (her) + i canAccessModule's testforventning.
const ROLE_MODULES: Record<UserRole, readonly AppModule[]> = {
  GROUP_OWNER: [...ALL_MODULES],
  GROUP_ADMIN: [...ALL_MODULES],
  GROUP_LEGAL: [
    'companies',
    'contracts',
    'cases',
    'tasks',
    'persons',
    'documents',
    'governance',
    'ownership',
  ],
  GROUP_FINANCE: ['companies', 'tasks', 'persons', 'documents', 'finance', 'governance'],
  GROUP_READONLY: [
    'companies',
    'contracts',
    'cases',
    'tasks',
    'persons',
    'documents',
    'finance',
    'governance',
  ],
  COMPANY_MANAGER: [
    'companies',
    'contracts',
    'cases',
    'tasks',
    'persons',
    'documents',
    'finance',
    'governance',
  ],
  COMPANY_LEGAL: ['companies', 'contracts', 'cases', 'tasks', 'persons', 'documents', 'governance'],
  COMPANY_READONLY: [
    'companies',
    'contracts',
    'cases',
    'tasks',
    'persons',
    'documents',
    'governance',
  ],
}

const ROLE_MODULE_SETS = (Object.keys(ROLE_MODULES) as UserRole[]).reduce(
  (acc, role) => {
    acc[role] = new Set(ROLE_MODULES[role])
    return acc
  },
  {} as Record<UserRole, ReadonlySet<AppModule>>
)

/**
 * Pure, synkron rolle→modul-tjek. Fail-closed: ukendt rolle ELLER ukendt modul
 * returnerer false. Brug i UI-lag der allerede kender brugerens rolle-streng.
 *
 * Parameteren er typet bredt (string) fordi rolle-strenge kommer fra session/DB
 * og kan teoretisk være en værdi vi ikke kender — så fail-closer vi i stedet for
 * at kaste.
 */
export function roleCanAccessModule(role: string, module: AppModule): boolean {
  const set = ROLE_MODULE_SETS[role as UserRole]
  if (!set) return false
  return set.has(module)
}

/**
 * Returnér mængden af moduler en rolle kan tilgå. Tom mængde ved ukendt rolle.
 */
export function modulesForRole(role: string): ReadonlySet<AppModule> {
  return ROLE_MODULE_SETS[role as UserRole] ?? new Set<AppModule>()
}
