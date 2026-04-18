# ChainHub AI-Integreret Prototype — Implementeringsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Byg en komplet interaktiv prototype af ChainHub med AI-intelligens, rolle-tilpasset UX, dokument-ekstraktion og unified search — i den eksisterende Next.js codebase med mock-data.

**Architecture:** Prototypen bygger et mock-data lag (`src/mock/`) der erstatter Prisma-kald. En PrototypeProvider (React Context) styrer aktiv rolle, selskabsantal og data-scenarie. Alle prototype-sider lever under den eksisterende `(dashboard)` route-gruppe og genbruger eksisterende layout. Prototype-mode aktiveres via `NEXT_PUBLIC_PROTOTYPE_MODE=true`.

**Tech Stack:** Next.js 14 (App Router), React 18, TypeScript 5, Tailwind CSS, Lucide icons, Sonner toasts. Ingen nye dependencies.

**Design Spec:** `docs/superpowers/specs/2026-03-30-ai-integrated-prototype-design.md`

---

## File Structure

### New Files

```
src/
├── mock/
│   ├── types.ts                    — Prototype-specifikke TypeScript types
│   ├── users.ts                    — 5 mock-brugere med roller
│   ├── companies.ts                — 22 selskaber med varieret sundhed
│   ├── contracts.ts                — 142 kontrakter inkl. udloebne/manglende
│   ├── tasks.ts                    — 34 opgaver inkl. forfaldne
│   ├── documents.ts                — Dokumenter med AI-ekstraktion mock
│   ├── financial.ts                — Oekonomi-data med trends
│   ├── insights.ts                 — Pre-genererede AI-indsigter per rolle
│   ├── search-responses.ts         — Mock AI-svar paa foruddefinerede spoergsmaal
│   └── helpers.ts                  — Filtreringsfunktioner baseret paa rolle
├── components/
│   ├── prototype/
│   │   ├── PrototypeProvider.tsx    — React Context for rolle-switcher state
│   │   ├── RoleSwitcher.tsx         — Prototype rolle-switcher UI komponent
│   │   └── InsightCard.tsx          — Genanvendelig indsigts-kort komponent
│   ├── layout/
│   │   ├── prototype-sidebar.tsx    — Ny sidebar med 6 items (prototype)
│   │   └── prototype-header.tsx     — Header med soegefelt + Ctrl+K hint
│   └── ui/
│       └── CoverageBar.tsx          — Daeknings-indikator (19/22 = 86%)
├── app/
│   └── proto/
│       ├── layout.tsx               — Prototype layout med RoleSwitcher
│       ├── dashboard/
│       │   └── page.tsx             — Overblik (rolle-tilpasset)
│       ├── portfolio/
│       │   ├── page.tsx             — Portefoelje-listen
│       │   └── [id]/
│       │       └── page.tsx         — Selskabs-detalje (sektionsbaseret)
│       ├── contracts/
│       │   ├── page.tsx             — Kontrakter (kryds-portefoelje)
│       │   └── [id]/
│       │       └── page.tsx         — Kontrakt-detalje
│       ├── tasks/
│       │   ├── page.tsx             — Opgaver (kryds-portefoelje)
│       │   └── [id]/
│       │       └── page.tsx         — Opgave-detalje
│       ├── documents/
│       │   ├── page.tsx             — Dokumenter (upload + AI-hub)
│       │   └── review/
│       │       └── [id]/
│       │           └── page.tsx     — Dokument-gennemgang (split-panel)
│       ├── search/
│       │   └── page.tsx             — Soeg & Spoerg (dedikeret side)
│       └── settings/
│           └── page.tsx             — Indstillinger (placeholder)
```

### Modified Files

```
.env.local                          — Tilfoej NEXT_PUBLIC_PROTOTYPE_MODE=true
```

### Why `(prototype)` route group?

**VIGTIGT: Next.js route group konflikt.** Både `(dashboard)` og `(prototype)` er route groups uden URL-segment. Det betyder at `/dashboard` ville konflikte mellem `(dashboard)/dashboard/page.tsx` og `(prototype)/dashboard/page.tsx`.

**Loesning:** Prototypen bruger et URL-prefix `/proto/`. Alle prototype-routes lever under `/proto/dashboard`, `/proto/portfolio`, osv. Dette undgaar konflikter med det eksisterende system og goer det tydeligt hvornaar man er i prototype-mode.

Alternativt kan den eksisterende `(dashboard)` omdoebes midlertidigt, men det er mere invasivt. URL-prefix er den sikre loesning.

**Opdateret sitemap:**

```
/proto/dashboard              — Overblik (rolle-tilpasset)
/proto/portfolio              — Portefoelje-listen
/proto/portfolio/[id]         — Selskabs-detalje
/proto/contracts              — Kontrakter (kryds-portefoelje)
/proto/contracts/[id]         — Kontrakt-detalje
/proto/tasks                  — Opgaver (kryds-portefoelje)
/proto/tasks/[id]             — Opgave-detalje
/proto/documents              — Dokumenter (upload + AI-hub)
/proto/documents/review/[id]  — Dokument-gennemgang (split-panel)
/proto/search                 — Soeg & Spoerg (dedikeret side)
/proto/settings               — Indstillinger
```

---

## Task 1: Mock Types og Basis-typer

**Files:**

- Create: `src/mock/types.ts`

- [ ] **Step 1: Opret mock types**

```typescript
// src/mock/types.ts

export type MockRole =
  | 'GROUP_OWNER'
  | 'GROUP_LEGAL'
  | 'GROUP_FINANCE'
  | 'GROUP_ADMIN'
  | 'COMPANY_MANAGER'

export type DataScenario = 'normal' | 'many_warnings' | 'empty'

export interface MockUser {
  id: string
  name: string
  email: string
  role: MockRole
  roleLabel: string
  companyIds: string[] // tom = alle
}

export interface MockCompany {
  id: string
  name: string
  cvr: string
  status: 'AKTIV' | 'UNDER_STIFTELSE' | 'UNDER_AFVIKLING' | 'INAKTIV'
  city: string
  address: string
  companyType: string
  healthStatus: 'healthy' | 'warning' | 'critical'
  healthReasons: string[]
  partnerName: string
  partnerOwnershipPct: number
  groupOwnershipPct: number
  contractCount: number
  openCaseCount: number
  employeeCount: number
}

export interface MockContract {
  id: string
  companyId: string
  companyName: string
  displayName: string
  systemType: string
  category: string
  categoryLabel: string
  status: 'UDKAST' | 'AKTIV' | 'UDLOEBET' | 'OPSAGT' | 'FORNYET'
  statusLabel: string
  expiryDate: string | null
  daysUntilExpiry: number | null
  urgency: 'critical' | 'warning' | 'normal' | 'none'
  sensitivity: string
}

export interface MockTask {
  id: string
  title: string
  status: 'NY' | 'AKTIV' | 'AFVENTER' | 'LUKKET'
  statusLabel: string
  priority: 'LAV' | 'MELLEM' | 'HOEJ' | 'KRITISK'
  priorityLabel: string
  dueDate: string | null
  daysUntilDue: number | null
  companyId: string
  companyName: string
  assignedTo: string
  assignedToName: string
  timeGroup: 'overdue' | 'this_week' | 'next_week' | 'later' | 'no_date'
}

export interface MockDocument {
  id: string
  fileName: string
  fileType: string
  companyId: string
  companyName: string
  uploadedAt: string
  uploadedBy: string
  status: 'processing' | 'ready_for_review' | 'reviewed' | 'archived'
  processingStage?: string
  processingProgress?: number
  confidenceLevel?: 'high' | 'medium' | 'low'
  extractedFieldCount?: number
  attentionFieldCount?: number
}

export interface MockExtractedField {
  id: string
  fieldName: string
  fieldLabel: string
  extractedValue: string | null
  existingValue: string | null
  confidence: number
  confidenceLevel: 'high' | 'medium' | 'low'
  sourcePageNumber: number
  sourceParagraph: string
  sourceText: string
  hasDiscrepancy: boolean
  discrepancyType?: 'value_mismatch' | 'missing_clause' | 'new_data'
  category: string
}

export interface MockFinancialMetric {
  companyId: string
  companyName: string
  year: number
  omsaetning: number | null
  ebitda: number | null
  resultat: number | null
  omsaetningTrend: number | null // procent aendring fra forrige aar
  ebitdaTrend: number | null
}

export interface MockInsight {
  id: string
  type: 'critical' | 'warning' | 'info' | 'coverage'
  icon: string // Lucide icon name
  title: string
  description: string
  actionLabel: string
  actionHref: string
  roles: MockRole[] // hvilke roller ser denne indsigt
  page: string // hvilken side vises den paa
}

export interface MockSearchResponse {
  query: string
  queryType: 'search' | 'question' | 'action'
  directMatches: {
    type: 'company' | 'person' | 'contract' | 'document' | 'case'
    typeLabel: string
    id: string
    title: string
    subtitle: string
    href: string
  }[]
  aiAnswer?: {
    text: string
    dataPoints: {
      label: string
      value: string
      urgency?: 'critical' | 'warning' | 'normal'
      href?: string
    }[]
  }
  suggestedFollowUps: string[]
  actionPreview?: {
    description: string
    items: {
      label: string
      checked: boolean
    }[]
    confirmLabel: string
  }
}

export interface PrototypeState {
  activeUser: MockUser
  companyCount: number
  dataScenario: DataScenario
}
```

- [ ] **Step 2: Verificer TypeScript kompilerer**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: Ingen fejl relateret til `src/mock/types.ts`

- [ ] **Step 3: Commit**

```bash
git add src/mock/types.ts
git commit -m "feat(prototype): tilfoej mock types til AI-prototype"
```

---

## Task 2: Mock Users

**Files:**

- Create: `src/mock/users.ts`

- [ ] **Step 1: Opret mock users**

```typescript
// src/mock/users.ts
import type { MockUser } from './types'

export const mockUsers: MockUser[] = [
  {
    id: 'user-philip',
    name: 'Philip Jensen',
    email: 'philip@chainhub.dk',
    role: 'GROUP_OWNER',
    roleLabel: 'Direktoer',
    companyIds: [], // tom = alle
  },
  {
    id: 'user-maria',
    name: 'Maria Hansen',
    email: 'maria@tandlaegegruppen.dk',
    role: 'GROUP_LEGAL',
    roleLabel: 'Jurist',
    companyIds: [],
  },
  {
    id: 'user-thomas',
    name: 'Thomas Nielsen',
    email: 'thomas@tandlaegegruppen.dk',
    role: 'GROUP_FINANCE',
    roleLabel: 'Oekonomi',
    companyIds: [],
  },
  {
    id: 'user-sara',
    name: 'Sara Andersen',
    email: 'sara@tandlaegegruppen.dk',
    role: 'GROUP_ADMIN',
    roleLabel: 'Admin',
    companyIds: [],
  },
  {
    id: 'user-lars',
    name: 'Lars Jensen',
    email: 'lars@horsens-tandklinik.dk',
    role: 'COMPANY_MANAGER',
    roleLabel: 'Lokationsleder',
    companyIds: ['company-horsens', 'company-vejle', 'company-fredericia'],
  },
]

export function getUserById(id: string): MockUser | undefined {
  return mockUsers.find((u) => u.id === id)
}

export function getDefaultUser(): MockUser {
  return mockUsers[0]
}
```

- [ ] **Step 2: Commit**

```bash
git add src/mock/users.ts
git commit -m "feat(prototype): tilfoej mock users med 5 roller"
```

---

## Task 3: Mock Companies

**Files:**

- Create: `src/mock/companies.ts`

- [ ] **Step 1: Opret 22 mock selskaber med varieret sundhed**

Opret filen `src/mock/companies.ts` med 22 selskaber. Foelgende regler:

- 3 selskaber har `healthStatus: 'critical'` (Odense, Horsens, Viborg) med specifikke `healthReasons`
- 4 selskaber har `healthStatus: 'warning'` med mildere issues
- 15 selskaber har `healthStatus: 'healthy'`
- Byer er danske: Odense, Horsens, Viborg, Aalborg, Aarhus, Randers, Silkeborg, Kolding, Vejle, Fredericia, Esbjerg, Herning, Holstebro, Roskilde, Naestved, Slagelse, Hilleroed, Helsingoer, Koege, Svendborg, Nyborg, Haderslev
- Alle har realistiske CVR-numre (8 cifre)
- `partnerOwnershipPct` varierer mellem 30-49%, `groupOwnershipPct` er resten til 100%
- `contractCount` varierer 4-14, `openCaseCount` 0-3, `employeeCount` 2-8

Eksporter ogsaa:

```typescript
export function getCompanies(scenario: DataScenario, companyCount: number): MockCompany[]
// 'normal' returnerer companyCount selskaber med default sundhed
// 'many_warnings' saetter 8 til critical, 8 til warning
// 'empty' returnerer []

export function getCompanyById(id: string): MockCompany | undefined
```

- [ ] **Step 2: Verificer med tsc**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/mock/companies.ts
git commit -m "feat(prototype): tilfoej 22 mock selskaber med sundhedsstatus"
```

---

## Task 4: Mock Contracts

**Files:**

- Create: `src/mock/contracts.ts`

- [ ] **Step 1: Opret 142 mock kontrakter**

Opret filen `src/mock/contracts.ts` med kontrakter fordelt paa 22 selskaber. Regler:

- 6 kategorier: Ejerskab, Ansaettelse, Lokaler, Kommercielle, Forsikring, Strukturaftaler
- Brug `CONTRACT_CATEGORY_MAP` fra `src/lib/labels.ts` til at mappe systemType -> kategori
- 4 kontrakter har `status: 'UDLOEBET'` med `urgency: 'critical'`
- 8 kontrakter udloeber inden 90 dage med `urgency: 'warning'`
- 3 selskaber mangler standard kontrakttyper (Horsens mangler ejeraftale, Odense mangler forsikring, Viborg mangler lejekontrakt)
- Resten er `status: 'AKTIV'` med `urgency: 'normal'`
- `daysUntilExpiry` beregnes fra mock-datoer

Eksporter:

```typescript
export function getContracts(scenario: DataScenario): MockContract[]
export function getContractsByCompany(companyId: string): MockContract[]
export function getContractById(id: string): MockContract | undefined
export function getContractCoverage(): {
  type: string
  typeLabel: string
  covered: number
  total: number
  pct: number
}[]
export function getExpiringContracts(withinDays: number): MockContract[]
export function getMissingContracts(): {
  companyId: string
  companyName: string
  missingType: string
  missingTypeLabel: string
}[]
```

- [ ] **Step 2: Commit**

```bash
git add src/mock/contracts.ts
git commit -m "feat(prototype): tilfoej 142 mock kontrakter med urgency og daekning"
```

---

## Task 5: Mock Tasks

**Files:**

- Create: `src/mock/tasks.ts`

- [ ] **Step 1: Opret 34 mock opgaver**

Opret `src/mock/tasks.ts` med opgaver. Regler:

- 6 opgaver er forfaldne (`timeGroup: 'overdue'`, `daysUntilDue` negativ)
- 4 opgaver forfalder denne uge
- 8 opgaver naeste uge
- 10 opgaver senere
- 6 opgaver uden forfaldsdato
- 2 opgaver har vaeret `AFVENTER` i 14+ dage
- Fordelt paa 12 forskellige selskaber
- Tildelt til forskellige mock-brugere
- Prioriteter varierer: 2 KRITISK, 6 HOEJ, 16 MELLEM, 10 LAV

Eksporter:

```typescript
export function getTasks(scenario: DataScenario): MockTask[]
export function getTasksByCompany(companyId: string): MockTask[]
export function getTasksByUser(userId: string): MockTask[]
export function getTaskById(id: string): MockTask | undefined
export function getOverdueTasks(): MockTask[]
export function getStaleWaitingTasks(staleDays: number): MockTask[]
```

- [ ] **Step 2: Commit**

```bash
git add src/mock/tasks.ts
git commit -m "feat(prototype): tilfoej 34 mock opgaver med tidsgruppering"
```

---

## Task 6: Mock Documents med AI-ekstraktion

**Files:**

- Create: `src/mock/documents.ts`

- [ ] **Step 1: Opret mock dokumenter og AI-ekstraktioner**

Opret `src/mock/documents.ts`. Regler:

- 47 dokumenter totalt
- 2 har `status: 'processing'` med `processingStage` og `processingProgress`
- 2 har `status: 'ready_for_review'` — et med hoej confidence (alle felter >95%), et med 2 felter der kraever opmaarksomhed
- Resten er `status: 'reviewed'`
- For de 2 review-klare dokumenter: opret detaljerede `MockExtractedField[]` arrays med:
  - Hoej-confidence felter (>95%): selskabsnavn, dokumenttype, dato
  - Medium-confidence felter (70-95%): beloeb, ejerandele
  - Lav-confidence felter (<70%): komplekse klausuler
  - Mindst 1 discrepancy (`value_mismatch`: ejerandele 60/40 vs. system 55/45)
  - Mindst 1 manglende klausul (`missing_clause`: medsalgspligt)
  - Source text referencer (sidenummer, paragraf)

Eksporter:

```typescript
export function getDocuments(scenario: DataScenario): MockDocument[]
export function getDocumentsByCompany(companyId: string): MockDocument[]
export function getDocumentById(id: string): MockDocument | undefined
export function getExtractedFields(documentId: string): MockExtractedField[]
export function getDocumentsAwaitingReview(): MockDocument[]
export function getDocumentsProcessing(): MockDocument[]
```

- [ ] **Step 2: Commit**

```bash
git add src/mock/documents.ts
git commit -m "feat(prototype): tilfoej mock dokumenter med AI-ekstraktion felter"
```

---

## Task 7: Mock Financial Data

**Files:**

- Create: `src/mock/financial.ts`

- [ ] **Step 1: Opret mock financial data**

Opret `src/mock/financial.ts` med oekonomi-data for alle 22 selskaber. Regler:

- Data for 2024 og 2025 (2 aar)
- Odense har EBITDA-fald paa 23% (fra 490K til 380K) — dette bruges i direktoerens dashboard
- Viborg har omsaetningsfald paa 8%
- 15 selskaber har positiv trend
- Beloeb er realistiske for tandklinikker (omsaetning 2-6M, EBITDA 200K-800K)

Eksporter:

```typescript
export function getFinancialMetrics(scenario: DataScenario): MockFinancialMetric[]
export function getFinancialByCompany(companyId: string): MockFinancialMetric[]
export function getUnderperformingCompanies(): {
  companyId: string
  companyName: string
  metric: string
  change: number
}[]
export function getPortfolioTotals(year: number): {
  omsaetning: number
  ebitda: number
  resultat: number
}
```

- [ ] **Step 2: Commit**

```bash
git add src/mock/financial.ts
git commit -m "feat(prototype): tilfoej mock oekonomi-data med trends"
```

---

## Task 8: Mock Insights (rolle-tilpassede)

**Files:**

- Create: `src/mock/insights.ts`

- [ ] **Step 1: Opret rolle-tilpassede indsigter**

Opret `src/mock/insights.ts`. Regler:

- Maks 2 indsigter per side per rolle (jf. design spec)
- Hver indsigt har `actionLabel` og `actionHref`
- Alle indsigter bruger Lucide icon-navne

Indsigter for **Overblik-siden** (`page: 'dashboard'`):

| Rolle           | Indsigt 1                                                                             | Indsigt 2                                                                                    |
| --------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| GROUP_OWNER     | "EBITDA faldet 23% i Odense (Q4-Q1)" → /proto/portfolio/company-odense                | "Ejeraftale-fornyelse: Lars Jensen, 6 uger" → /proto/portfolio/company-horsens               |
| GROUP_LEGAL     | "4 kontrakter udloebet — vis og planlaeg fornyelse" → /proto/contracts?filter=expired | "Kontraktdaekning: 86% — 3 lokationer mangler" → /proto/contracts?filter=missing             |
| GROUP_FINANCE   | "Samlet omsaetning Q1: 48.2M DKK (op 4%)" → /proto/portfolio                          | "2 lokationer underpraeesterer" → /proto/portfolio?filter=underperforming                    |
| GROUP_ADMIN     | "6 opgaver er forfaldne" → /proto/tasks?filter=overdue                                | "Datakvalitet: 3 selskaber med ufuldstaendige stamdata" → /proto/portfolio?filter=incomplete |
| COMPANY_MANAGER | "2 opgaver forfaldne paa dine lokationer" → /proto/tasks?filter=mine                  | "Lejekontrakt udloeber om 42 dage" → /proto/contracts                                        |

Tilsvarende for **Kontrakter**, **Opgaver**, **Portefoelje** og **Dokumenter** sider.

Eksporter:

```typescript
export function getInsights(page: string, role: MockRole, scenario: DataScenario): MockInsight[]
```

- [ ] **Step 2: Commit**

```bash
git add src/mock/insights.ts
git commit -m "feat(prototype): tilfoej rolle-tilpassede indsigter for alle sider"
```

---

## Task 9: Mock Search Responses

**Files:**

- Create: `src/mock/search-responses.ts`

- [ ] **Step 1: Opret mock soegeresultater og AI-svar**

Opret `src/mock/search-responses.ts` med foruddefinerede svar. Regler:

- Mindst 8 foruddefinerede queries der daeekker alle 3 interaktionstyper
- Fuzzy matching: "horsens" matcher "Horsens Tandklinik"
- Default fallback for ukendte queries: vis direkte matches baseret paa keyword

Foruddefinerede queries:

1. `"Horsens"` → type: search, 3 direkte matches (selskab + person + kontrakt)
2. `"Horsens forsikring"` → type: search+question, direkte match + AI-svar om forsikringsstatus
3. `"Hvilke lokationer mangler forsikring?"` → type: question, AI-svar med 3 lokationer
4. `"Vis kontrakter der udloeber inden sommer"` → type: question, AI-svar med liste
5. `"Sammenlign omsaetning Odense vs Aalborg"` → type: question, AI-svar med tal
6. `"Opret en sag for manglende forsikringer"` → type: action, Intent Preview med 3 selskaber
7. `"Hvem har vi ingen bestyrelse paa?"` → type: question, AI-svar med governance-gaps
8. `"12345678"` → type: search, CVR-match til Horsens Tandklinik

Eksporter:

```typescript
export function searchMock(query: string, role: MockRole): MockSearchResponse
export function getSuggestedQueries(role: MockRole, currentPage: string): string[]
```

- [ ] **Step 2: Commit**

```bash
git add src/mock/search-responses.ts
git commit -m "feat(prototype): tilfoej mock soegeresultater og AI-svar"
```

---

## Task 10: Mock Helpers (filtrering og aggregering)

**Files:**

- Create: `src/mock/helpers.ts`

- [ ] **Step 1: Opret filtreringsfunktioner**

```typescript
// src/mock/helpers.ts
import type {
  MockRole,
  MockCompany,
  MockContract,
  MockTask,
  MockInsight,
  DataScenario,
} from './types'

/**
 * Filtrer selskaber baseret paa rolle.
 * COMPANY_MANAGER ser kun sine tildelte selskaber.
 * Alle andre ser alle.
 */
export function filterCompaniesByRole(
  companies: MockCompany[],
  role: MockRole,
  assignedCompanyIds: string[]
): MockCompany[] {
  if (role === 'COMPANY_MANAGER') {
    return companies.filter((c) => assignedCompanyIds.includes(c.id))
  }
  return companies
}

/**
 * Bestem hvilke dashboard-blokke der er synlige for en rolle.
 * Raekkefoelgen er fast — vi returnerer kun de synlige blok-navne.
 */
export function getVisibleDashboardBlocks(role: MockRole): string[] {
  const allBlocks = [
    'requires_action',
    'portfolio_health',
    'contract_coverage',
    'compliance_status',
    'financial_overview',
    'data_quality',
    'recent_activity',
    'upcoming_visits',
    'document_inbox',
  ]

  const roleBlockMap: Record<MockRole, string[]> = {
    GROUP_OWNER: [
      'requires_action',
      'portfolio_health',
      'financial_overview',
      'upcoming_visits',
      'recent_activity',
      'document_inbox',
    ],
    GROUP_LEGAL: [
      'requires_action',
      'contract_coverage',
      'compliance_status',
      'recent_activity',
      'document_inbox',
    ],
    GROUP_FINANCE: ['requires_action', 'financial_overview', 'recent_activity', 'document_inbox'],
    GROUP_ADMIN: [
      'requires_action',
      'portfolio_health',
      'data_quality',
      'upcoming_visits',
      'recent_activity',
      'document_inbox',
    ],
    COMPANY_MANAGER: ['requires_action', 'recent_activity', 'document_inbox'],
  }

  // Returner i den faste raekkefoelge defineret i allBlocks
  const visible = roleBlockMap[role] || roleBlockMap.GROUP_OWNER
  return allBlocks.filter((block) => visible.includes(block))
}

/**
 * Bestem hvilke selskabs-detalje-sektioner der er synlige for en rolle.
 * Raekkefoelgen er ALTID fast.
 */
export function getVisibleCompanySections(role: MockRole): string[] {
  const allSections = [
    'insights',
    'stamdata',
    'ownership',
    'contracts',
    'financial',
    'persons',
    'cases',
    'visits',
    'documents',
  ]

  const hiddenByRole: Record<MockRole, string[]> = {
    GROUP_OWNER: [],
    GROUP_LEGAL: ['financial', 'visits'],
    GROUP_FINANCE: ['cases', 'visits', 'persons'],
    GROUP_ADMIN: ['financial'],
    COMPANY_MANAGER: [],
  }

  const hidden = hiddenByRole[role] || []
  return allSections.filter((s) => !hidden.includes(s))
}

/**
 * Generer rolle-tilpasset subtekst for et selskab i portefoeljelisten.
 */
export function getCompanySubtitle(company: MockCompany, role: MockRole): string {
  switch (role) {
    case 'GROUP_OWNER':
      return `Partner: ${company.partnerName} (${company.groupOwnershipPct}/${company.partnerOwnershipPct})`
    case 'GROUP_LEGAL':
      return `${company.contractCount} kontrakter · ${company.openCaseCount} aabne sager`
    case 'GROUP_FINANCE':
      return `${company.contractCount} kontrakter`
    case 'GROUP_ADMIN':
      return `${company.employeeCount} ansatte · ${company.contractCount} kontrakter`
    case 'COMPANY_MANAGER':
      return `${company.contractCount} kontrakter · ${company.openCaseCount} aabne sager`
  }
}

/**
 * Generer rolle-tilpasset sidebar badge-tekst.
 */
export function getSidebarBadge(
  navItem: string,
  role: MockRole,
  data: {
    expiringContracts: number
    underperforming: number
    overdueTasks: number
    processingDocs: number
  }
): string | null {
  switch (navItem) {
    case 'contracts':
      if (role === 'GROUP_LEGAL' && data.expiringContracts > 0) {
        return `${data.expiringContracts}`
      }
      return null
    case 'portfolio':
      if (role === 'GROUP_OWNER' && data.underperforming > 0) {
        return `${data.underperforming}`
      }
      return null
    case 'tasks':
      if (data.overdueTasks > 0) return `${data.overdueTasks}`
      return null
    case 'documents':
      if (data.processingDocs > 0) return `${data.processingDocs}`
      return null
    default:
      return null
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/mock/helpers.ts
git commit -m "feat(prototype): tilfoej mock helpers til rolle-filtrering"
```

---

## Task 11: PrototypeProvider (React Context)

**Files:**

- Create: `src/components/prototype/PrototypeProvider.tsx`

- [ ] **Step 1: Opret PrototypeProvider**

```typescript
// src/components/prototype/PrototypeProvider.tsx
'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import type { MockUser, DataScenario, PrototypeState } from '@/mock/types'
import { mockUsers, getDefaultUser } from '@/mock/users'

interface PrototypeContextType extends PrototypeState {
  setActiveUser: (user: MockUser) => void
  setCompanyCount: (count: number) => void
  setDataScenario: (scenario: DataScenario) => void
  allUsers: MockUser[]
}

const PrototypeContext = createContext<PrototypeContextType | null>(null)

export function PrototypeProvider({ children }: { children: ReactNode }) {
  const [activeUser, setActiveUser] = useState<MockUser>(getDefaultUser())
  const [companyCount, setCompanyCount] = useState(22)
  const [dataScenario, setDataScenario] = useState<DataScenario>('normal')

  return (
    <PrototypeContext.Provider
      value={{
        activeUser,
        companyCount,
        dataScenario,
        setActiveUser,
        setCompanyCount,
        setDataScenario,
        allUsers: mockUsers,
      }}
    >
      {children}
    </PrototypeContext.Provider>
  )
}

export function usePrototype(): PrototypeContextType {
  const context = useContext(PrototypeContext)
  if (!context) {
    throw new Error('usePrototype must be used within a PrototypeProvider')
  }
  return context
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/prototype/PrototypeProvider.tsx
git commit -m "feat(prototype): tilfoej PrototypeProvider context"
```

---

## Task 12: RoleSwitcher komponent

**Files:**

- Create: `src/components/prototype/RoleSwitcher.tsx`

- [ ] **Step 1: Opret RoleSwitcher**

```typescript
// src/components/prototype/RoleSwitcher.tsx
'use client'

import { usePrototype } from './PrototypeProvider'
import { Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DataScenario } from '@/mock/types'

export function RoleSwitcher() {
  const {
    activeUser,
    companyCount,
    dataScenario,
    setActiveUser,
    setCompanyCount,
    setDataScenario,
    allUsers,
  } = usePrototype()

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-3">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-amber-600" />
          <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
            Prototype
          </span>
        </div>

        {/* Rolle-skift */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-amber-700">Rolle:</label>
          <select
            value={activeUser.id}
            onChange={(e) => {
              const user = allUsers.find((u) => u.id === e.target.value)
              if (user) setActiveUser(user)
            }}
            className="rounded border border-amber-300 bg-white px-2 py-1 text-xs text-gray-900"
          >
            {allUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} — {user.roleLabel}
                {user.companyIds.length > 0
                  ? ` (${user.companyIds.length} selskaber)`
                  : ' (alle)'}
              </option>
            ))}
          </select>
        </div>

        {/* Selskabs-antal */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-amber-700">Selskaber:</label>
          <select
            value={companyCount}
            onChange={(e) => setCompanyCount(Number(e.target.value))}
            className="rounded border border-amber-300 bg-white px-2 py-1 text-xs text-gray-900"
          >
            <option value={5}>5</option>
            <option value={22}>22</option>
            <option value={56}>56</option>
          </select>
        </div>

        {/* Data-scenarie */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-amber-700">Data:</label>
          <select
            value={dataScenario}
            onChange={(e) => setDataScenario(e.target.value as DataScenario)}
            className="rounded border border-amber-300 bg-white px-2 py-1 text-xs text-gray-900"
          >
            <option value="normal">Normal</option>
            <option value="many_warnings">Mange advarsler</option>
            <option value="empty">Tomt</option>
          </select>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/prototype/RoleSwitcher.tsx
git commit -m "feat(prototype): tilfoej RoleSwitcher komponent"
```

---

## Task 13: InsightCard komponent

**Files:**

- Create: `src/components/prototype/InsightCard.tsx`

- [ ] **Step 1: Opret InsightCard**

```typescript
// src/components/prototype/InsightCard.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  TrendingDown,
  FileWarning,
  BarChart3,
  CheckCircle2,
  X,
  ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MockInsight } from '@/mock/types'

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  AlertTriangle,
  TrendingDown,
  FileWarning,
  BarChart3,
  CheckCircle2,
}

interface InsightCardProps {
  insight: MockInsight
}

export function InsightCard({ insight }: InsightCardProps) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  const Icon = iconMap[insight.icon] || AlertTriangle

  const styles = {
    critical: 'border-l-red-400 bg-red-50',
    warning: 'border-l-amber-400 bg-amber-50',
    info: 'border-l-blue-400 bg-blue-50',
    coverage: 'border-l-amber-400 bg-amber-50',
  }

  const iconStyles = {
    critical: 'text-red-500',
    warning: 'text-amber-500',
    info: 'text-blue-500',
    coverage: 'text-amber-500',
  }

  return (
    <div
      className={cn(
        'relative flex items-start gap-3 rounded-r-lg border-l-4 px-4 py-3',
        styles[insight.type]
      )}
    >
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', iconStyles[insight.type])} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{insight.title}</p>
        {insight.description && (
          <p className="mt-0.5 text-xs text-gray-600">{insight.description}</p>
        )}
        <Link
          href={insight.actionHref}
          className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-gray-700 hover:text-gray-900"
        >
          {insight.actionLabel}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
        aria-label="Luk"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/prototype/InsightCard.tsx
git commit -m "feat(prototype): tilfoej InsightCard komponent"
```

---

## Task 14: CoverageBar komponent

**Files:**

- Create: `src/components/ui/CoverageBar.tsx`

- [ ] **Step 1: Opret CoverageBar**

```typescript
// src/components/ui/CoverageBar.tsx

import { cn } from '@/lib/utils'

interface CoverageBarProps {
  label: string
  covered: number
  total: number
  className?: string
}

export function CoverageBar({ label, covered, total, className }: CoverageBarProps) {
  const pct = total > 0 ? Math.round((covered / total) * 100) : 0
  const isComplete = covered === total

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-gray-700">{label}</span>
        <span className={cn('font-medium', isComplete ? 'text-green-600' : 'text-amber-600')}>
          {covered}/{total} ({pct}%)
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-gray-200">
        <div
          className={cn(
            'h-1.5 rounded-full transition-all',
            isComplete ? 'bg-green-500' : pct >= 80 ? 'bg-amber-400' : 'bg-amber-500'
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/CoverageBar.tsx
git commit -m "feat(prototype): tilfoej CoverageBar UI-komponent"
```

---

## Task 15: Prototype Sidebar

**Files:**

- Create: `src/components/layout/prototype-sidebar.tsx`

- [ ] **Step 1: Opret prototype sidebar med 6 items**

Opret `src/components/layout/prototype-sidebar.tsx`. Baseret paa eksisterende `sidebar.tsx` men med:

- 6 navigation items: Overblik (/proto/dashboard), Portefoelje (/proto/portfolio), Kontrakter (/proto/contracts), Opgaver (/proto/tasks), Dokumenter (/proto/documents), Soeg & Spoerg (/proto/search)
- Rolle-tilpassede urgency badges via `getSidebarBadge()` fra mock helpers
- Brug `usePrototype()` til at laese aktiv bruger
- Bevar eksisterende styling (gray-900 sidebar, gray-300 text, etc.)
- Indstillinger i bunden som foer
- Bruger-info med rolle-badge
- Fjern "Senest besoegt" sektionen (erstattet af intelligent navigation)

Brug de korrekte Lucide icons:

- Overblik: `LayoutDashboard`
- Portefoelje: `Building2`
- Kontrakter: `FileText`
- Opgaver: `CheckSquare`
- Dokumenter: `FolderOpen`
- Soeg & Spoerg: `Search`
- Indstillinger: `Settings`

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/prototype-sidebar.tsx
git commit -m "feat(prototype): tilfoej prototype sidebar med 6 items og rolle-badges"
```

---

## Task 16: Prototype Header med Soeg & Spoerg

**Files:**

- Create: `src/components/layout/prototype-header.tsx`

- [ ] **Step 1: Opret prototype header**

Opret `src/components/layout/prototype-header.tsx`. Baseret paa eksisterende `header.tsx` men med:

- Soegefelt med placeholder: "Soeg eller stil et spoergsmaal..."
- Ctrl+K hint til hoejre for feltet: `<kbd>Ctrl</kbd> + <kbd>K</kbd>`
- Ved submit: navigerer til `/proto/search?q=...`
- Keyboard event listener for Ctrl+K der fokuserer soege-inputtet
- Bevar eksisterende styling (h-16, border-b, white bg)

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/prototype-header.tsx
git commit -m "feat(prototype): tilfoej prototype header med Soeg & Spoerg felt"
```

---

## Task 17: Prototype Layout

**Files:**

- Create: `src/app/proto/layout.tsx`

- [ ] **Step 1: Opret prototype layout**

```typescript
// src/app/proto/layout.tsx
import { PrototypeSidebar } from '@/components/layout/prototype-sidebar'
import { PrototypeHeader } from '@/components/layout/prototype-header'
import { PrototypeProvider } from '@/components/prototype/PrototypeProvider'
import { RoleSwitcher } from '@/components/prototype/RoleSwitcher'

export default function PrototypeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <PrototypeProvider>
      <div className="flex h-screen overflow-hidden">
        <div className="hidden lg:flex">
          <PrototypeSidebar />
        </div>
        <div className="flex flex-1 flex-col overflow-hidden">
          <RoleSwitcher />
          <PrototypeHeader />
          <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
            {children}
          </main>
        </div>
      </div>
    </PrototypeProvider>
  )
}
```

- [ ] **Step 2: Verificer build**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds (prototype layout kompilerer)

- [ ] **Step 3: Commit**

```bash
git add src/app/proto/layout.tsx
git commit -m "feat(prototype): tilfoej prototype layout med RoleSwitcher"
```

---

## Task 18: Overblik-side (Dashboard)

**Files:**

- Create: `src/app/proto/dashboard/page.tsx`

- [ ] **Step 1: Opret Overblik-side**

Opret `src/app/proto/dashboard/page.tsx` som en client component der bruger `usePrototype()`.

Siden skal:

1. Vise "Godmorgen, [navn]" greeting
2. Hente synlige blokke via `getVisibleDashboardBlocks(role)`
3. Hente indsigter via `getInsights('dashboard', role, scenario)`
4. Rendere InsightCard for de foerste 2 indsigter
5. Rendere dynamiske blokke i fast raekkefoelge:
   - `requires_action`: Liste af forfaldne opgaver og udloebne kontrakter (maks 5 items)
   - `portfolio_health`: Antal aktive/warning/critical selskaber med farve-indikatorer
   - `contract_coverage`: CoverageBar for hver kontrakttype
   - `compliance_status`: Antal aabne compliance-sager
   - `financial_overview`: Samlet omsaetning/EBITDA med trend-pile
   - `data_quality`: Antal selskaber med ufuldstaendige stamdata
   - `recent_activity`: Seneste 5 mock-haendelser
   - `upcoming_visits`: Naeste 3 planlagte besoeg
   - `document_inbox`: Dokumenter der afventer review
6. Bruge grid layout: `grid grid-cols-1 lg:grid-cols-2 gap-4` for blok-kortet
7. Bevar eksisterende styling-moenstre (bg-white rounded-lg shadow-sm border)

- [ ] **Step 2: Test i browser**

Run: `npm run dev`
Gaa til: `http://localhost:3000/proto/dashboard`
Verificer: Siden renderer, blokke aendrer sig naar rolle skiftes i RoleSwitcher

- [ ] **Step 3: Commit**

```bash
git add src/app/proto/dashboard/page.tsx
git commit -m "feat(prototype): tilfoej Overblik-side med rolle-tilpassede blokke"
```

---

## Task 19: Portefoelje-liste

**Files:**

- Create: `src/app/proto/portfolio/page.tsx`

- [ ] **Step 1: Opret Portefoelje-liste**

Opret `src/app/proto/portfolio/page.tsx` som en client component.

Siden skal:

1. Hente selskaber via `getCompanies(scenario, companyCount)` filtreret med `filterCompaniesByRole()`
2. Vise 2 indsigter oeeverst via InsightCard
3. Gruppere i 2 collapsible sektioner:
   - "Kraever opmaarksomhed" — selskaber med `healthStatus: 'critical' | 'warning'`, sorteret critical foerst
   - "Sunde lokationer" — resten
4. Hvert selskab er en klikbar raekke (Link til `/proto/portfolio/[id]`) med:
   - Farvet venstre-border (roed=critical, amber=warning, groen=healthy)
   - Selskabsnavn + status-badge
   - Rolle-tilpasset subtekst via `getCompanySubtitle()`
   - By + CVR i graa
5. Summary-linje oeeverst: "22 selskaber · 3 kraever opmaarksomhed"
6. Soegefelt der filtrerer client-side paa navn/cvr/by
7. Liste-format (ikke cards) — bruger en `<ul>` med `<li>` items

- [ ] **Step 2: Commit**

```bash
git add src/app/proto/portfolio/page.tsx
git commit -m "feat(prototype): tilfoej Portefoelje-liste med sundhedsstatus"
```

---

## Task 20: Selskabs-detaljeside

**Files:**

- Create: `src/app/proto/portfolio/[id]/page.tsx`

- [ ] **Step 1: Opret selskabs-detalje**

Opret `src/app/proto/portfolio/[id]/page.tsx` som en client component.

Siden skal:

1. Hente selskab via `getCompanyById(id)`
2. Hente synlige sektioner via `getVisibleCompanySections(role)`
3. Vise breadcrumb: "← Portefoelje"
4. Vise selskabsnavn, CVR, status, partner-info i header
5. Vise 2 indsigter kontekstuelt for dette selskab
6. Rendere sektioner i fast raekkefoelge som CollapsibleSection:
   - **Stamdata**: Adresse, by, selskabstype, kontaktinfo
   - **Ejerskab**: Partner-andele, ejeraftale-status
   - **Kontrakter**: Grupperet efter kategori med urgency-farver + link "Se alle kontrakter paa tvaers →"
   - **Oekonomi**: Omsaetning/EBITDA for 2024-2025 med trend-pile + sparkline (simpel CSS)
   - **Personer**: Liste med roller (direktoer, bestyrelse, ansat)
   - **Sager**: Aabne sager med status
   - **Besoeg**: Naeste planlagte + seneste gennemfoerte
   - **Dokumenter**: Seneste 5 dokumenter
7. Sektioner der ikke er i `getVisibleCompanySections()` renders ikke

- [ ] **Step 2: Commit**

```bash
git add src/app/proto/portfolio/\[id\]/page.tsx
git commit -m "feat(prototype): tilfoej selskabs-detaljeside med rolle-filtrerede sektioner"
```

---

## Task 21: Kontrakter kryds-portefoelje view

**Files:**

- Create: `src/app/proto/contracts/page.tsx`

- [ ] **Step 1: Opret Kontrakter-side**

Opret `src/app/proto/contracts/page.tsx` som en client component.

Siden skal:

1. Vise 2 rolle-tilpassede InsightCards oeeverst
2. Summary-linje: "142 kontrakter · 22 selskaber · 7 kraever handling"
3. Filter-tabs: `Alle | Udloeber snart | Manglende | Nyligt aendrede`
4. Soegefelt + Grupper-dropdown (Type / Selskab / Status)
5. "Kraever handling" gruppe oeeverst (urgency-sorteret) som CollapsibleSection
6. Derefter collapsible grupper baseret paa valgt gruppering
7. Hvert kontrakt-item viser:
   - Farvet venstre-border baseret paa urgency
   - Kontraktnavn + kategori-label
   - Selskabsnavn (klikbart → /proto/portfolio/[id])
   - Status-badge + udloebsdato
8. CoverageBar under summary for daekning pr. kontrakttype
9. Filter-tabs styres via URL params (`?tab=expiring`)

- [ ] **Step 2: Commit**

```bash
git add src/app/proto/contracts/page.tsx
git commit -m "feat(prototype): tilfoej Kontrakter kryds-portefoelje view"
```

---

## Task 22: Kontrakt-detalje

**Files:**

- Create: `src/app/proto/contracts/[id]/page.tsx`

- [ ] **Step 1: Opret kontrakt-detalje**

Simpel detalje-side med:

- Breadcrumb: "← Kontrakter"
- Kontrakt header (navn, type, status-badge, kategori)
- Selskab-link
- Udloebsdato med urgency-farve
- Sensitivity-badge
- Placeholder-sektioner: Versionshistorik, Tilknyttede sager, Dokumenter

- [ ] **Step 2: Commit**

```bash
git add src/app/proto/contracts/\[id\]/page.tsx
git commit -m "feat(prototype): tilfoej kontrakt-detaljeside"
```

---

## Task 23: Opgaver kryds-portefoelje view

**Files:**

- Create: `src/app/proto/tasks/page.tsx`

- [ ] **Step 1: Opret Opgaver-side**

Opret `src/app/proto/tasks/page.tsx` som en client component.

Siden skal:

1. Vise 2 rolle-tilpassede InsightCards
2. Summary-linje: "34 aabne opgaver · 6 forfaldne"
3. Filter-tabs: `Mine | Alle | Forfaldne | Afventer`
   - "Mine" filtrerer paa `activeUser.id`
   - "Alle" viser alt
   - "Forfaldne" viser kun `timeGroup: 'overdue'`
   - "Afventer" viser kun `status: 'AFVENTER'`
4. Soegefelt
5. Tidsbaseret gruppering (default) som CollapsibleSections:
   - Forfaldne (roed header-accent)
   - Denne uge
   - Naeste uge
   - Senere
   - Ingen forfaldsdato
6. Hvert opgave-item viser:
   - Farvet venstre-border (roed=forfalden, amber=denne uge, graa=resten)
   - Titel + prioritets-badge
   - Selskabsnavn (klikbart) + tildelt person
   - Forfaldsdato med dage-indikator

- [ ] **Step 2: Commit**

```bash
git add src/app/proto/tasks/page.tsx
git commit -m "feat(prototype): tilfoej Opgaver kryds-portefoelje view med tidsgruppering"
```

---

## Task 24: Opgave-detalje

**Files:**

- Create: `src/app/proto/tasks/[id]/page.tsx`

- [ ] **Step 1: Opret opgave-detalje**

Simpel detalje-side med breadcrumb, opgave header, status, prioritet, forfaldsdato, tildelt person, selskab-link. Placeholder for kommentarer/historik.

- [ ] **Step 2: Commit**

```bash
git add src/app/proto/tasks/\[id\]/page.tsx
git commit -m "feat(prototype): tilfoej opgave-detaljeside"
```

---

## Task 25: Dokumenter-side (Upload + AI hub)

**Files:**

- Create: `src/app/proto/documents/page.tsx`

- [ ] **Step 1: Opret Dokumenter-side**

Opret `src/app/proto/documents/page.tsx` som en client component.

Siden skal:

1. Summary-linje: "47 dokumenter · 2 analyseres · 1 klar til gennemgang"
2. Upload-zone oeeverst (drag-and-drop styling med stiplet border)
   - Tekst: "Traek filer hertil — AI-analyse starter automatisk. Du kan fortsaette dit arbejde imens."
   - Ved "upload" (mock): tilfoej et nyt dokument med `status: 'processing'`
3. Sektion: "Klar til gennemgang" — dokumenter med `status: 'ready_for_review'`
   - Hvert item viser: filnavn, antal felter fundet, antal der kraever opmaarksomhed
   - Hoej-confidence docs faar [Hurtig-godkend ✓] knap + [Gennemgaa →] link
   - Lav/medium-confidence docs faar kun [Gennemgaa →] link til `/proto/documents/review/[id]`
4. Sektion: "Analyseres nu" — dokumenter med `status: 'processing'`
   - Viser processing stage og tidsestimat
5. Sektion: "Seneste dokumenter" — resten, sorteret efter uploadedAt

- [ ] **Step 2: Commit**

```bash
git add src/app/proto/documents/page.tsx
git commit -m "feat(prototype): tilfoej Dokumenter-side med upload og AI-hub"
```

---

## Task 26: Dokument-gennemgang (split-panel)

**Files:**

- Create: `src/app/proto/documents/review/[id]/page.tsx`

- [ ] **Step 1: Opret dokument-gennemgangs view**

Opret `src/app/proto/documents/review/[id]/page.tsx` som en client component.

Siden skal:

1. Split-panel layout: 60% venstre (dokument), 40% hoejre (ekstraktion)
   - `grid grid-cols-5` → venstre `col-span-3`, hoejre `col-span-2`
2. **Venstre panel**: Mock PDF preview
   - Graa boks med tekst "PDF Preview — Side 1 af 12"
   - Naar bruger hoverer over et felt til hoejre, vis highlighted passage (gul baggrund paa mock-tekst)
3. **Hoejre panel**: AI-ekstraktion
   - Header: "AI-ekstraktion — X/Y klar ✓"
   - Sektion "Hoej confidence (auto)" — foldet sammen som default, groen ✓ badge
   - Sektion "Kraever opmaarksomhed (N)" — aaben som default
     - Hvert felt viser:
       - Felt-label + confidence-farve (amber/roed)
       - Ekstraheret vaerdi vs. eksisterende vaerdi (delta)
       - Kilde-reference: "Side X, §Y"
       - Handlingsknapper: [Brug AI-vaerdi] / [Behold eksisterende] / [Ret manuelt]
   - Sektion "Manglende klausuler" — hvis relevant
     - Roed badge, beskrivelse, [Tilfoej manuelt] / [Accepter]
4. Bund: [Godkend] + [Naeste dok →] knapper
5. Breadcrumb: "← Dokumenter"

- [ ] **Step 2: Commit**

```bash
git add src/app/proto/documents/review/\[id\]/page.tsx
git commit -m "feat(prototype): tilfoej dokument-gennemgangs view med split-panel"
```

---

## Task 27: Soeg & Spoerg side

**Files:**

- Create: `src/app/proto/search/page.tsx`

- [ ] **Step 1: Opret Soeg & Spoerg side**

Opret `src/app/proto/search/page.tsx` som en client component.

Siden skal:

1. Stort soegefelt oeeverst med placeholder "Skriv et navn, CVR, eller stil et spoergsmaal..."
2. Naar feltet er tomt: vis foreslaaede spoergsmaal fra `getSuggestedQueries(role, 'search')`
   - Maerket som "Forslag" med lille label
   - Klikbare — udfylder sogefeltet og soeger
3. Ved soegning: kald `searchMock(query, role)` og vis resultater:
   - **Direkte matches** (oeeverst) — grupperet efter entitetstype med ikon
     - Filter-tabs: `Alle | Selskaber | Personer | Kontrakter | Dokumenter`
     - Maks 3-5 per type med "Vis alle [type]" link
   - **AI-svar** (nedenunder, hvis relevant) — i en adskilt boks med blaa venstre-border
     - Formateret tekst med urgency-farvede datapunkter
   - **Handlings-preview** (hvis type=action) — Intent Preview boks
     - Checkbox-liste med foreslaaede handlinger
     - [Tilpas] og [Opret →] knapper
4. Under resultater: "Relaterede spoergsmaal" med klikbare follow-ups
5. Kontekst-chip naar der er en aktiv soegning: "Fortsaetter fra: '[query]' [✕]"
   - [✕] nulstiller og viser forslag igen

- [ ] **Step 2: Commit**

```bash
git add src/app/proto/search/page.tsx
git commit -m "feat(prototype): tilfoej Soeg & Spoerg side med dual output"
```

---

## Task 28: Settings placeholder

**Files:**

- Create: `src/app/proto/settings/page.tsx`

- [ ] **Step 1: Opret settings placeholder**

```typescript
// src/app/proto/settings/page.tsx
'use client'

import { Settings } from 'lucide-react'

export default function PrototypeSettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Indstillinger</h1>
      <div className="rounded-lg border bg-white p-12 text-center shadow-sm">
        <Settings className="mx-auto h-12 w-12 text-gray-300" />
        <p className="mt-4 text-sm text-gray-500">
          Indstillinger er ikke en del af prototypen.
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/proto/settings/page.tsx
git commit -m "feat(prototype): tilfoej settings placeholder"
```

---

## Task 29: Environment Variable + Routing

**Files:**

- Modify: `.env.local`

- [ ] **Step 1: Tilfoej prototype mode flag**

Tilfoej til `.env.local`:

```
NEXT_PUBLIC_PROTOTYPE_MODE=true
```

- [ ] **Step 2: Tilfoej redirect fra proto-rod til prototype dashboard**

Opret `src/app/proto/page.tsx`:

```typescript
import { redirect } from 'next/navigation'

export default function PrototypeRoot() {
  redirect('/proto/dashboard')
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/proto/page.tsx
git commit -m "feat(prototype): tilfoej prototype routing og environment flag"
```

---

## Task 30: Fuld integration test

- [ ] **Step 1: Start dev server og test alle sider**

Run: `npm run dev`

Test hvert af de 11 endpoints:

1. `/proto/dashboard` — Overblik med rolle-blokke
2. `/proto/portfolio` — Portefoelje-listen med sundhedsstatus
3. `/proto/portfolio/company-odense` — Selskabs-detalje med sektioner
4. `/proto/contracts` — Kontrakter kryds-portefoelje
5. `/proto/contracts/[id]` — Kontrakt-detalje
6. `/proto/tasks` — Opgaver med tidsgruppering
7. `/proto/tasks/[id]` — Opgave-detalje
8. `/proto/documents` — Dokumenter med upload-zone
9. `/proto/documents/review/[id]` — Split-panel gennemgang
10. `/proto/search` — Soeg & Spoerg med dual output
11. `/proto/settings` — Placeholder

For hver side: test rolle-switcher skifter indhold korrekt.

- [ ] **Step 2: Test TypeScript build**

Run: `npx tsc --noEmit`
Expected: Ingen fejl

- [ ] **Step 3: Test Next.js build**

Run: `npx next build`
Expected: Build succeeds med alle prototype routes

- [ ] **Step 4: Commit (hvis der var fixes)**

```bash
git add -A
git commit -m "fix(prototype): integration fixes efter fuld test"
```

---

## Task Dependency Overview

```
Tasks 1-9:   Mock data (kan koeres parallelt)
Task 10:     Mock helpers (afhaenger af types)
Tasks 11-14: UI komponenter (afhaenger af types + mock data)
Tasks 15-16: Layout komponenter (afhaenger af helpers + context)
Task 17:     Layout (afhaenger af 15-16)
Tasks 18-28: Sider (afhaenger af layout + mock data + komponenter)
Task 29:     Routing (afhaenger af layout)
Task 30:     Integration test (afhaenger af alt)
```

**Parallelle grupper:**

- Gruppe 1 (mock data): Tasks 1-9
- Gruppe 2 (komponenter): Tasks 11-14
- Gruppe 3 (layout): Tasks 15-17
- Gruppe 4 (sider): Tasks 18-28
- Gruppe 5 (integration): Tasks 29-30
