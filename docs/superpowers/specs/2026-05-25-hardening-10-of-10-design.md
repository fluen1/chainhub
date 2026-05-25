# ChainHub Hardening: 6/10 → 10/10

**Dato:** 2026-05-25
**Baseline:** Modenhedsaudit pr. 2026-05-25 (111 test-filer, 26 actions, 32 Prisma-modeller)
**Målskala:** 20-50 lokationer pr. organisation
**Tilgang:** Risk-First med parallel agent-dispatch inden for hver fase
**Arbejdsform:** Faseopdelt — hver fase er et selvstændigt commit-punkt

---

## Fase 1: Sikkerhed (CRITICAL + HIGH)

**Mål:** Ingen server action kan kaldes uden gyldig session. Login er rate-limited. App starter ikke med manglende env vars.

### 1.1 Login rate-limiting

- In-memory rate-limiter (IP + email) på NextAuth CredentialsProvider
- Max 5 forsøg pr. 15 min, derefter lockout
- Dansk fejlbesked: "For mange loginforsøg — prøv igen om X minutter"
- **Filer:** `src/lib/auth/index.ts`

### 1.2 Server actions intern auth

- Alle 6 actions henter session internt via `auth()` i stedet for at modtage `organizationId`/`userId` som parametre
- Callere (page.tsx) fjerner session-data fra props og lader actions hente selv
- **Filer:** `src/actions/activity-feed.ts`, `src/actions/calendar.ts`, `src/actions/company-detail.ts`, `src/actions/dashboard.ts`, `src/actions/search.ts`, `src/actions/task-detail.ts` + deres callere

### 1.3 Middleware-dækning

- Tilføj `/calendar/:path*`, `/search/:path*`, `/visits/:path*` til middleware matcher
- **Filer:** `src/middleware.ts`

### 1.4 Env-validering ved startup

- Zod-schema der validerer alle påkrævede env vars (`DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`)
- Importeres i instrumentering/config så app fail-faster ved startup
- Klar, dansk fejlbesked pr. manglende variabel
- **Filer:** Ny `src/lib/env.ts`, import i `instrumentation.ts` eller `next.config.mjs`

**Paralleliserbarhed:** Alle 4 opgaver er uafhængige → 4 agenter parallelt.

---

## Fase 2: Data & Performance (HIGH + MEDIUM)

**Mål:** Ingen list-page henter mere end 25 rækker ad gangen. Alle actions validerer input med Zod. Ingen slugede fejl.

### 2.1 Server-side pagination — `/tasks`

- Flyt filtering, sortering og pagination til DB-laget (`findMany` med `take`/`skip`/`where`/`orderBy`)
- URL-baseret pagination state (searchParams)
- Bevar eksisterende filter/sort UI men bind til server-side queries
- **Filer:** `src/actions/task.ts`, `src/app/(dashboard)/tasks/page.tsx`, `src/app/(dashboard)/tasks/tasks-list-b.tsx`

### 2.2 Server-side pagination — `/persons`

- Samme mønster som 2.1
- **Filer:** `src/actions/person.ts`, `src/app/(dashboard)/persons/page.tsx`

### 2.3 Server-side pagination — `/contracts`

- Samme mønster som 2.1
- **Filer:** `src/actions/contract.ts`, `src/app/(dashboard)/contracts/page.tsx`

### 2.4 Zod-validering på 12 actions

- Tilføj input-schemas på: `activity-feed`, `ai-usage`, `calendar`, `company-detail`, `dashboard`, `documents`, `export`, `gdpr`, `onboarding`, `person-ai`, `search`, `task-detail`
- Særlig opmærksomhed på `export` og `gdpr` (har side-effects)
- **Filer:** 12 action-filer

### 2.5 Fejlhåndtering fixes

- `ai-usage.ts`: Tilføj `captureError()` i catch-blok (linje ~73)
- `person-ai.ts`: Erstat `log.error` med `captureError()` så Sentry ser AI-fejl
- **Filer:** `src/actions/ai-usage.ts`, `src/actions/person-ai.ts`

**Paralleliserbarhed:** 2.1-2.3 parallelt (uafhængige list-pages). 2.4-2.5 parallelt. Total: op til 5 agenter.

---

## Fase 3: Framework-upgrades

**Mål:** Alle deps er current. Ingen kendte CVE'er. Alle tests passerer.

### 3.1 Prisma 5 → 7

- Opdatér `@prisma/client` og `prisma` til v7
- Tilpas relation-API kald, `findUniqueOrThrow` semantik, nye defaults
- Kør alle tests + typecheck efter upgrade
- **Sekvens:** Skal gennemføres før Next.js-upgrade (Prisma client bruges overalt)

### 3.2 React 18 → 19

- Opdatér `react` og `react-dom` til v19
- Fix deprecated patterns: `forwardRef` → ref prop, `useRef` generics, evt. `useContext` → `use()`
- **Sekvens:** Kan køre parallelt med 3.1 (uafhængig)

### 3.3 Next.js 14 → 15 → 16

- To-trins upgrade for at minimere risiko
- **14 → 15:** `params`/`searchParams` bliver async, `cookies()`/`headers()` async, caching opt-in
- **15 → 16:** Nye Server Actions imports, `next/form`, yderligere ændringer
- Kør full test suite + build efter hvert trin
- **Sekvens:** Skal køre EFTER 3.1 og 3.2 (afhænger af begge)

### 3.4 npm audit fix

- Opdatér sårbare transitive deps (xmldom, undici, flatted)
- Kør efter alle major upgrades
- **Sekvens:** Sidst i fasen

**Paralleliserbarhed:** 3.1 og 3.2 parallelt → 3.3 sekventielt → 3.4 sidst.

---

## Fase 4: Kodekvalitet

**Mål:** Ingen fil over 400 linjer. Alle tests har beskrivende navne. Ingen dead code. Dokumentation matcher virkelighed.

### 4.1 Split god-filer

- `tasks-list-b.tsx` (942L) → FilterBar, TaskTable, TaskRow, TaskActions
- `contracts/[id]/page.tsx` (813L) → ContractHeader, ContractTabs, ContractParties, ContractTimeline
- `companies-list-b.tsx` (794L) → FilterBar, CompanyTable, CompanyRow, CompanyActions
- Max 300-400 linjer pr. fil

### 4.2 Fjern dead code

- Slet `OwnershipListNew.tsx` (ingen imports)
- Slet gammel `src/components/ui/page-header.tsx` (erstattet af `ui/b/PageHeader.tsx`)
- Scan for andre ubrugte exports

### 4.3 Rename test-filer

- `phase-X-fixes.test.ts` → navne der beskriver hvad der testes
- Eksempel: `phase-c-fixes.test.ts` → undersøg indhold, navngiv efter testede moduler
- Bevar alle tests uændrede — kun filnavne ændres

### 4.4 Flyt Prisma-kald fra page.tsx til actions

- 20 page-filer med direkte `findMany` → flyt til action-funktioner
- Ensartet mønster: page.tsx kalder action → action kalder Prisma
- Konsistent med CLAUDE.md konvention

### 4.5 Opdatér CLAUDE.md

- "48 tests" → korrekt antal
- Tilføj nye konventioner fra hardening (env-validering, pagination-mønster)
- Opdatér kommando-sektion hvis nødvendigt

### 4.6 Opdatér stale dokumentation

- `prisma/schema.prisma` kommentar: "Sprint 1" → korrekt version
- `PROGRESS.md`: Tilføj E2E polish session og hardening-status

**Paralleliserbarhed:** Alle 6 opgaver uafhængige → 6 agenter parallelt. Dog: 4.4 har overlap med 4.1 (begge rører page-filer) — kør 4.1 før 4.4, eller koordinér worktrees.

---

## Fase 5: Polish

**Mål:** WCAG 2.1 AA på alle sider. Nul `any`. Optimeret bundle. DRY error boundaries.

### 5.1 A11y-fixes

- `htmlFor`/`aria-label` på 20+ inputs i form-komponenter
- `aria-label` på 3 icon-only buttons
- Verificér med axe-core E2E tests
- **Filer:** ~8 komponent-filer (AddCompanyPersonForm, AddOwnerForm, CreateCaseForm, AddContractPartyModal m.fl.)

### 5.2 Bundle-optimering

- Tilføj `optimizePackageImports: ['lucide-react']` i next.config
- Evaluér leaflet → static map image (150KB besparelse)
- **Filer:** `next.config.mjs`, evt. `leaflet-map.tsx`

### 5.3 TypeScript hardening

- Fjern 4× `any` i `openai-direct.ts` → `unknown` + type narrowing
- Aktivér `noUncheckedIndexedAccess` i `tsconfig.json`
- Fix resulterende type-fejl
- **Filer:** `src/lib/ai/client/openai-direct.ts`, `tsconfig.json`

### 5.4 Error boundary standardisering

- 10 identiske `error.tsx` → fælles `ErrorBoundary`-komponent med `page`-parameter
- Thin wrappers i hver route der kalder fælles komponent
- **Filer:** 10 `error.tsx` filer → 1 komponent + 10 one-liners

**Paralleliserbarhed:** Alle 4 opgaver uafhængige → 4 agenter parallelt.

---

## Samlet overblik

| Fase            | Opgaver        | Parallelle agenter | Afhænger af |
| --------------- | -------------- | ------------------ | ----------- |
| 1. Sikkerhed    | 4              | 4                  | —           |
| 2. Data & Perf  | 5              | 5                  | Fase 1      |
| 3. Upgrades     | 4              | 2 → 1 → 1          | Fase 2      |
| 4. Kodekvalitet | 6              | 5-6                | Fase 3      |
| 5. Polish       | 4              | 4                  | Fase 4      |
| **Total**       | **23 opgaver** |                    |             |

## Succeskriterier for 10/10

- [ ] Ingen server action callable uden gyldig session
- [ ] Login rate-limited (5 forsøg/15 min)
- [ ] App fail-faster ved manglende env vars
- [ ] Alle list-pages server-side pagineret (max 25 rækker pr. request)
- [ ] Zod-validering på alle 26 actions
- [ ] Ingen kendte CVE'er i dependencies
- [ ] Next.js 16, React 19, Prisma 7
- [ ] Ingen fil over 400 linjer
- [ ] Alle tests har beskrivende navne
- [ ] Ingen dead code
- [ ] WCAG 2.1 AA (axe-core verified)
- [ ] Nul `any` i codebase
- [ ] `noUncheckedIndexedAccess` aktiveret
- [ ] Dokumentation matcher virkelighed
- [ ] `npx next build` gennemføres uden fejl
- [ ] Alle tests passerer
