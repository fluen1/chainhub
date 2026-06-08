# PROGRESS.md — ChainHub

Opdateret: Launch-readiness plan 3/4 leveret — 2026-06-08

## Launch-readiness plan 3/4 — Legal-konsolidering + Cookie-consent ✅ (2026-06-08)

Tredje af 4 launch-planer. Branch `feat/launch-readiness`. Bygger oven på plan 2 (public-lag). Etablerer komplet legal-lag under `/legal/*` og GDPR-compliant opt-in cookie-consent.

- [x] **Legal-ruter konsolideret under `/legal/*`** — fire sider samlet i `(public)/legal/`: `vilkaar`, `privatliv`, `cookiepolitik`, `databehandleraftale`. Alle arver public header/footer. Redirects fra gamle `/terms` og `/privacy` til nye stier
- [x] **`LegalPageLayout`** — afklædt standalone-chrome; virker nu som et rent indholdspanel der wrappes af det fælles public-layout
- [x] **Databehandlerliste rettet** — OpenAI (ikke Anthropic) som AI-leverandør; tilføjet Stripe, Upstash, PostHog og Google. I alt 10 underdatabehandlere dokumenteret. E2e-test håndhæver "OpenAI, ikke Anthropic"
- [x] **Databehandleraftale** — ny side (GDPR art. 28-krav); inkl. print/download-funktionalitet
- [x] **Opt-in cookie-consent** — PostHog initialiseres opt-out-by-default og aktiveres kun ved eksplicit samtykke via consent-banner (gemmes i localStorage). Cookiepolitik + privatlivs-§7 dokumenterer dette. (Bevidst afvigelse fra spec'ens "ingen tracking i v1" — Philips beslutning 8/6)
- [x] **Legal-links i public footer** — alle fire legal-sider linket direkte
- [x] **Inbound-links opdateret** — login, signup og invite-sider peger nu på `/legal/vilkaar` og `/legal/privatliv` (ikke de gamle `/terms`/`/privacy`)
- [x] **a11y-fix** — inline tekst-links understreget (WCAG 1.4.1, link-in-text-block)
- [x] **Kvalitetsgate ved lukning:** 2174 unit-tests/0 fail, tsc 0 fejl, build grøn, 60/60 e2e passed. Consent-banner krævede consent-seed i `loggedInPage`-fixture (ellers overlejrede banneret dashboard-klik)
- [x] **Kendte præeksisterende udestående (IKKE plan 3):** CVR-felt i privatlivs-§1 afventer selskabsregistrering; 4 præeksisterende ESLint-fejl + ~38 prettier-issues i ældre filer — ikke introduceret i denne plan

**Philip skal som jurist review'e:** vilkår, privatliv, cookiepolitik og databehandleraftale inden PR merges.

**Status:** Kode på branch `feat/launch-readiness`. PR afventer plan 3b + plan 4 (deploy-forberedelse) + afstemning med Rico (CopenAI-regel).

**Næste:** plan 4 (deploy: R2, env, bootstrap, DNS).

## Launch-readiness plan 2/4 — Public-lag (forside/pricing/kontakt) ✅ (2026-06-08)

Anden af 4 launch-planer. Branch `feat/launch-readiness`. Bygger oven på plan 1 (Gate 1 + dental-sanering). Etablerer det kundevendte public-lag som uautoriserede besøgende rammer, uden at røre det eksisterende dashboard.

- [x] **`(public)` Next.js route-group** — ny group etableret; rod-`src/app/page.tsx` erstattet af forside (redirect til `/dashboard` ophævet)
- [x] **Forside** (`/`) — ICP-specificeret: optiker-, fysio-, læge- og franchisekæder (ingen dental); "Gå til dashboard"-CTA synlig for indloggede brugere uden redirect (soft prompt)
- [x] **Pricing-side** (`/pricing`) — de låste tiers dokumenteret og eksponeret:
  - Basis 3.500 kr./md
  - Plus 9.500 kr./md inkl. 50 AI-ekstraktioner; ekstra 75 kr./ekstraktion
  - Enterprise: forhandles, floor 32.000 kr./md, fair-use 500 ekstraktioner
  - Onboarding-fee: 1 kr./dok (max 2.500 kr.)
  - Tier-data centraliseret i `src/lib/pricing.ts` med unit-tests der håndhæver priser + dental-eksklusion
- [x] **Kontaktformular** (`/kontakt`) — server action med Zod-validering, Resend-integration, honeypot-spamguard, HTML-escaping af utrustet input (sikkerhedsfix), kvitteringsbesked + notifikation til Philip via `replyTo`; mailto-fallback ved Resend-fejl
- [x] **`proxy.ts` auth-bypass** — `/`, `/pricing`, `/kontakt` fritaget fra krav om session
- [x] **Kvalitetsgate ved lukning:** 2171 unit-tests passed/0 failed, tsc 0 fejl, build grøn, 52 e2e passed/0 failed, axe-sweep grøn for alle 3 public routes
- [x] **Kendte præeksisterende udestående (IKKE plan 2):** 4 ESLint-fejl + ~38 prettier-format-issues i ældre filer — ikke introduceret i denne plan, adresseres i plan 3 eller separat cleanup

**Status:** Kode på branch `feat/launch-readiness`. PR til master afventer plan 3 (legal + onboarding-docs) + plan 4 (deploy-forberedelse) + afstemning med Rico (CopenAI-regel).

**Næste:** plan 3 (legal: privatlivspolitik, vilkår, databehandleraftale), plan 4 (deploy: R2, env, bootstrap, DNS).

## Launch-readiness plan 1/4 — Gate 1 + dental-sanering ✅ (2026-06-08)

Første af 4 launch-planer (spec: `docs/superpowers/specs/2026-06-08-launch-readiness-design.md`). Branch `feat/launch-readiness`. Beslutninger låst: navn Chainhub/chainhub.dk, pricing Basis 3.500/Plus 9.500/Enterprise fra 32.000 + onboarding-fee 1 kr/dok (max 2.500), dental-eksklusion (Philip = Legal Counsel hos Tandlægen.dk).

- [x] **Worktree-oprydning** — 5 stale agent-worktrees + branches fjernet
- [x] **Dental-sanering** — seed/scripts/docs/e2e: TandlægeGruppen → OptikGruppen, alle dental-strings væk fra kundevendt + internt materiale (historiske mockups undtaget). DB reseedet.
- [x] **Gate 1 browser-sweep** — alle 37 sider gennemgået i browser med screenshots (`screenshots/gate1/`) + rapport `docs/status/GATE1-2026-06.md`. 18 fund, alle ❌/⚠️ lukket.
- [x] **Bugs fundet+fixet undervejs:** env build-fase-secrets (G1-001), playwright DATABASE_URL (G1-002), unstable_cache Date+Decimal-serialisering → dashboard-crash/NaN (G1-003/010), seed FK-race (G1-007), 26→0 e2e-drift, 5 WCAG-kontrastfejl, skip-link-fokus, rå visit-enums, /billing placeholder-priser (G1-009), m.fl.
- [x] **Kvalitet ved lukning:** 2157 unit-tests grønne (+27), 44/44 e2e grønne, tsc ren, build grøn (47 routes)

**Næste:** plan 2 (public-lag: forside/pricing/kontakt), plan 3 (legal + onboarding-docs), plan 4 (deploy-forberedelse: R2, env, bootstrap, DNS).

## Sprint 1-6 ✅ FÆRDIGE

- [x] Sprint 1 — Fundament (Next.js 14, Prisma, Auth, Permissions, Dashboard shell)
- [x] Sprint 2 — Kernobjekter (Selskaber, Personer)
- [x] Sprint 3 — Kontrakter (34 typer, sensitivity, status-flow)
- [x] Sprint 4 — Sager og opgaver
- [x] Sprint 5 — Dashboard og økonomi
- [x] Sprint 6 — Produktion (48 tests, pentest, build grøn)

## Fase 0 — SPEC-TILLAEG-v2 ✅ GODKENDT (2026-03-12)

- [x] 17 beslutninger (16 ACCEPTED, 1 WONT-FIX)
- [x] 0 KRITISKE indsigelser

## Sprint 7 — UI Foundation + Enum Fix ✅ FÆRDIG

### TEKNISK GATE ✅

- [x] npm install — ingen fejl
- [x] prisma generate — OK
- [x] tsc --noEmit — 0 fejl
- [x] npx next build — GRØN (33 routes)
- [x] Alle 48 tests grønne

### UI GATE ✅

- [x] src/lib/labels.ts — global enum→dansk mapping (alle enums)
- [x] src/components/ui/Pagination.tsx — genanvendelig pagination
- [x] src/components/ui/SearchAndFilter.tsx — søgning + filtre
- [x] src/components/layout/sidebar.tsx — rolle-badge + counts + senest besøgt
- [x] src/app/(dashboard)/layout.tsx — server-side sidebar data
- [x] src/components/layout/header.tsx — global søgning
- [x] src/app/(dashboard)/search/page.tsx — søgeresultat-side
- [x] src/app/(dashboard)/dashboard/page.tsx — urgency panel + onboarding panel + card-grid
- [x] src/app/(dashboard)/companies/page.tsx — card-grid + filtre + pagination
- [x] src/app/(dashboard)/companies/[id]/page.tsx — redirect til overview
- [x] src/app/(dashboard)/companies/[id]/overview/page.tsx — NY overbliksfane
- [x] src/app/(dashboard)/companies/[id]/stamdata/page.tsx — stamdata (tidligere root)
- [x] src/components/companies/CompanyTabs.tsx — ny tab-rækkefølge (Overblik first)
- [x] src/app/(dashboard)/contracts/page.tsx — labels.ts + filtre + pagination
- [x] src/app/(dashboard)/persons/page.tsx — card-grid + søgning + pagination

### PRODUKT GATE ✅

- [x] Kædeleder-perspektiv er nu primært fokus
- [x] Overbliksfane giver svar på "hvad er status på denne klinik?"
- [x] Urgency panel giver svar på "hvad kræver min opmærksomhed nu?"

### BRUGER GATE ✅

- [x] Login-side loader uden fejl
- [x] Dashboard og routes kompilerer korrekt
- [x] Urgency panel med specifikke items og direkte links

## Sprint 8 — Accountability + Dokumenter (i gang)

### Sprint 8A — Skalering + Brugerstyring + Upload ✅ (2026-03-25)

- [x] Selskabs-filter på /contracts, /cases, /tasks (URL param ?company=uuid)
- [x] Grupperet visning på /contracts og /cases (?view=grouped/flat, default grupperet)
- [x] GroupToggle + CollapsibleSection UI-komponenter
- [x] Dashboard selskabskort med badge-counts (kontrakter, sager, forfaldne opgaver)
- [x] Brugerstyring /settings/users: list, opret, redigér rolle, deaktivér
- [x] Permissions: kun GROUP_OWNER/GROUP_ADMIN kan tilgå brugerstyring
- [x] Zod-validering + server actions for user CRUD
- [x] Dokument-upload: drag-and-drop, PDF/DOCX/PNG/JPG, max 10MB
- [x] Upload API route (/api/upload) + download route (/api/uploads/[...path])
- [x] DocumentList + FileUpload komponenter
- [x] Upload på /companies/[id]/documents og /contracts/[id]
- [x] Soft delete af dokumenter med permissions-check
- [x] Build: GRØN (36 routes, 0 TS-fejl)
- [x] Smoke-test: alle routes returnerer 200 med data

### Sprint 8B — Email + Versioner + Besøg ✅ (2026-03-25)

- [x] Email-digest: Resend-integration, daglig digest-template (dansk), cron API-endpoint
- [x] Deadline-helpers: getExpiringContracts, getOverdueTasks, getUpcomingTasks (DRY)
- [x] Kontraktversioner: upload ny version med ChangeType (NY_VERSION/REDAKTIONEL/MATERIEL/ALLONGE)
- [x] Kontraktversioner: UploadVersionForm med drag-and-drop, ChangeType-dropdown, version-note
- [x] Kontraktversioner: Fuld versionsliste med badges, download-links, "Aktuel" markering
- [x] Besøgsstyring: Visit-model i schema (6 VisitTypes, 3 statuser)
- [x] Besøgsstyring: /visits, /visits/new, /visits/[id] med filtre + pagination
- [x] Besøgsstyring: Dashboard "Kommende besøg" sektion
- [x] Besøgsstyring: /companies/[id]/visits med selskabsspecifik besøgshistorik
- [x] Besøgsstyring: Sidebar "Besøg" med MapPin-ikon + count
- [x] Besøgsstyring: CompanyTabs med ny "Besøg"-fane
- [x] Build: GRØN (41 routes, 0 TS-fejl)

### Sprint 8C — Konsolidering ✅ (2026-03-25)

- [x] Labels centraliseret i labels.ts — 10 sider migreret fra lokale hardcoded labels
- [x] Tilføjet CompanyPerson rolle-labels + MetricSource labels til labels.ts
- [x] Auth-check tilføjet på 5 "opret ny"-sider (companies, cases, contracts, tasks, persons)
- [x] Formular-logik ekstraheret til client-komponenter (Create\*Form.tsx)
- [x] Zod UUID-validering rettet i 6 validerings-schemas (z.string().uuid() → z.string().min(1))
- [x] TaskStatusButton rettet (AKTIV_TASK enum-mapping)
- [x] /documents forbedret (upload, filtre, MIME-labels, download-links)
- [x] /persons forbedret (selskabs-filter)
- [x] Build: GRØN (41 routes, 0 TS-fejl, 48 tests grønne)

### Sprint 8 resterende scope

- [x] Schema — task_history (leveret 2026-04-18 via `TaskHistory`-model + `TaskHistoryField`-enum)
- [x] Opgave-udvidelser — historik (kommentarer leveret tidligere via polymorf Comment; kilde-badge er del af detail-rewrite)
- [ ] Schema — task_participants (udskudt, se "Udskudte features")
- [ ] Schema — company_notes med sensitivity (udskudt, se "Udskudte features")
- [ ] Fase 2: Side-for-side UX-gennemgang (32 sider — spec i docs/superpowers/specs/)

## Plan 4A — Atomiske proto-komponenter ✅ (2026-04)

- [x] 11 komponenter migreret fra proto til `src/components/ui/` + `src/components/layout/`
- [x] KpiCard, FinRow, CoverageBar, HealthBar, CompanyRow, InsightCard, UrgencyList, CalendarWidget, SectionHeader
- [x] AppSidebar, AppHeader (kebab-case, shadcn-konvention)
- [x] Delte UI-typer i `src/types/ui.ts` (CalendarEvent, InlineKpi, SidebarBadge, UrgencyItem m.fl.)
- [x] Unit tests pr. komponent (Vitest + Testing Library)

## Plan 4B — Dashboard + layout-migration ✅ (2026-04-11)

- [x] HealthBar empty-state fix + AppHeader SSR-hydration fix (currentDate som prop)
- [x] `'use client'` fjernet fra pure presentation atoms (FinRow, CoverageBar, CompanyRow, HealthBar)
- [x] `src/actions/dashboard.ts` — parallel Prisma-batch aggregator (badges, rolle-adaptive KPIs, timeline, heatmap, coverage, portfolio-totals, role priority)
- [x] HeatmapGrid + TimelineSection komponenter i `src/components/dashboard/`
- [x] `/dashboard` page omskrevet til Timeline River + rolle-specifikke højrepaneler (606 → ~50 linjer)
- [x] `(dashboard)/layout.tsx` bruger nu AppSidebar + AppHeader
- [x] Legacy `sidebar.tsx`, `header.tsx`, `MobileNav.tsx` slettet
- [x] `buildSidebarBadges()` adapter i `src/lib/sidebar-data.ts`
- [x] `docs/build/CONVENTIONS.md` — kebab-case regel for ui/ + layout/
- [x] Scope-leak fix på openCases + expired-contract split + deterministic role priority
- [x] Build: GRØN, 242 tests passerer, Playwright-audit uden console errors

## Plan 4C — Selskabs-detalje single-page ✅ (2026-04-12)

- [x] 18 tasks via subagent-driven-development (Task 0 Prisma migration → Task 17 Playwright audit)
- [x] Ny Prisma-model `CompanyInsightsCache` med 24h TTL
- [x] Pure helpers i `src/lib/company-detail/helpers.ts`: sectionsForRole, pickHighestPriorityRole, deriveHealthDimensions, deriveStatusBadge, sortContractsByUrgency, sortCasesByUrgency, selectKeyPersons
- [x] 3 nye atoms: AlertBanner (red/amber banner), AiInsightCard (lilla gradient med **bold**-parser), SectionCard wrapper
- [x] 7 sektion-komponenter: OwnershipSection, ContractsSection, FinanceSection, CasesSection, PersonsSection, VisitsSection, DocumentsSection
- [x] CompanyHeader Server Component med editStamdataButton ReactNode slot
- [x] EditStamdataDialog Client Component modal + updateCompanyStamdata action i src/actions/companies.ts
- [x] AI job `src/lib/ai/jobs/company-insights.ts` — Zod-valideret output, 8s timeout, markdown JSON fence-stripping, cost-tracking
- [x] Server Action `src/actions/company-detail.ts` — parallel Prisma batch, role-baseret visibleSections, stale-after-24h cache
- [x] Page rewrite `/companies/[id]` single scroll-view (606 linjer legacy → 106 linjer thin wrapper)
- [x] 11 subpages slettet + layout.tsx + company-detail-client.tsx + CompanyTabs.tsx
- [x] 97 nye tests (35 helpers + ~45 components + 5 AI + 2 smoke) — total 339 passed, 4 skipped
- [x] Build: GRØN (26 routes, `/companies/[id]` 1.53 kB / 107 kB first-load)
- [x] Playwright audit: alle 7 sektioner renderes, ingen browser console errors, graceful AI degradation bekræftet

## Plan 4D — Resterende sider ✅ (i praksis lukket 2026-04-18)

- [x] `/tasks` list + `/tasks/[id]` detail-rewrite (2026-04-18 — 6 commits, TaskHistory + kanban)
- [x] `/calendar` full-page (leveret tidligere — event-filter, mobile layout, quick-add)
- [x] `/search` global søgning (2026-04-18 — 6 entitetstyper, scope-filtrering, sensitivity)
- [x] `/settings` organisation-info (2026-04-18 — navn/CVR/chain_structure editerbar + users-tabel bevaret)
- [x] Slet legacy `/visits` list-page (2026-04-18 — `/visits/[id]` og `/visits/new` bevaret for calendar + VisitsSection)

## Sprint 8 accountability + /search — 2026-04-18 ✅

### Leveret i session

- [x] **TaskHistory-model** i Prisma med `TaskHistoryField`-enum (STATUS, PRIORITY, ASSIGNEE, DUE_DATE, TITLE, DESCRIPTION)
- [x] **Atomiske historik-skriv** via `prisma.$transaction` i `updateTaskStatus/Priority/Assignee/DueDate`
- [x] **`/tasks/[id]` single-page rewrite** — sektion-baseret (TaskHeader, TaskContext, TaskDescription, TaskHistory, CommentSection) + EditTaskDialog
- [x] **`/tasks` grouped-view** — `?view=grouped|flat|kanban`, CollapsibleSection pr. selskab
- [x] **Kanban-view** — HTML5 native drag-drop, 4 kolonner pr. status, optimistisk UI med rollback
- [x] **`/search` udvidet til 6 entitetstyper** — Selskaber, Kontrakter, Sager, Opgaver, Personer, Dokumenter med søgning i både titler og beskrivelses-felter
- [x] **Permissions-fix** — scope-filter på sager (via case_companies), tasks/documents (NULL eller accessible), sensitivity-filter på kontrakter/sager/dokumenter
- [x] **Test-suite fix** — 8 pre-existing text/spec-mismatch failures rettet (finance, heatmap-cap + dot, cases, calendar-widget, company-header, app-header)
- [x] **`/settings` organisation-form** — name/cvr/chain_structure editerbar via `updateOrganization` server-action + Zod-validering
- [x] **Tests**: 339 → 378 → 390 passed, 0 failed

## Produktions-modenhed session 1 — 2026-04-18 ✅

Foundation-lag for production deploy. Arkitektur-review scorede 6/10 → 8/10.

- [x] **Pino structured logger** (`src/lib/logger.ts`) + `captureError` + `createLogger` factory
- [x] **Sentry-integration** (opt-in via DSN) — client/server/edge configs + `instrumentation.ts`
- [x] **`withActionLogging` wrapper** (`src/lib/action-helpers.ts`) — duration-tracking + uncaught-throw → Sentry
- [x] **Error boundaries**: `error.tsx` på `/dashboard`, `/companies`, `/tasks` + `global-error.tsx` + reusable `ErrorBoundaryUI`
- [x] **Calendar pagination caps**: alle 4 `findMany` cappet ved 500/type/måned med warning-log
- [x] **Prettier + .gitattributes + .editorconfig** — homogen formatering + LF line-endings
- [x] **Husky + lint-staged pre-commit** — auto-format + ESLint på stagede filer
- [x] **README rewrite** (37 linjer boilerplate → 160 linjer onboarding)
- [x] **`docs/DEVELOPER.md`** — Windows/OneDrive trouble-shooting, db push vs migrate, action/sektion patterns
- [x] **`docs/build/LOGGING-GUIDE.md`** — log-mønstre, levels, PII-regler, retrofit-plan

## Produktions-modenhed session 2 — 2026-04-18 ✅

Schema-modenhed + AuditLog-udvidelse + silent-catch retrofit. 8/10 → ~9/10.

- [x] **`Document.contract_id`** + reverse-relation på Contract — lukker DocumentExtraction-gap (kontrakter kan nu nå AI-data)
- [x] **`Company.parent_company_id`** — eksplicit holding→datterselskab self-relation. Backfilled for 6 seed-klinikker (TandlægeGruppen Holding ApS som parent)
- [x] **`recordAuditEvent` helper** (`src/lib/audit.ts`) med 4 unit-tests — standardiserer alle AuditLog-skriv, sluger DB-fejl stille via `captureError`
- [x] **AuditLog wire-in på 6 nye sites**: Case.status (STATUS_CHANGE), Ownership.update (UPDATE m. before/after), CompanyPerson.add/end (med governance-rolle sensitivity), eksisterende ownership.add/end migreret til ny helper
- [x] **32 silent-catch retrofits** — alle `catch {}` i `src/actions/` har nu `captureError(err, { namespace, extra })`. Filer: contracts.ts (4), tasks.ts (5), persons.ts (4), companies.ts (4), cases.ts (2), users.ts (4), visits.ts (2), finance.ts (2), contract-versions.ts (1), ownership.ts (3), governance.ts (2)
- [x] **Tests**: 390 → 394 passed (4 nye audit-helper unit-tests), 0 failed

### DocumentExtraction-feature er nu teknisk muliggjort

Med `Contract.documents` reverse-relation kan en person-detalje nu nå AI-udlæste data via `companyPerson.contract.documents[].extraction.extracted_fields`. Implementering af UI er separat feature-session.

## Coverage uplift — 2026-04-18 ✅

11 nye unit-test filer for tidligere utestede action-filer:

- cases (11), comments (8), contracts (14), contract-versions (6),
  document-review (8), documents (4), ownership (14), task-detail (5),
  tasks (22), users (16), visits (9) — i alt 117 nye tests

Tests: 428 → 545 passed (+117), 0 failed. Coverage på `src/actions/` nu
omkring 80%.

Mock-baseret pattern fra session 3 brugt konsistent: `vi.mock` af
`@/lib/auth`, `@/lib/db`, `@/lib/permissions`, `@/lib/audit`,
`@/lib/logger`, `next/cache`. Valid UUIDs til Zod-validering. `bcryptjs`
mocket i users.ts. `@/lib/ai/feedback` mocket i document-review.ts.
Transaction-mock pattern (passer mock-tx ind i `prisma.$transaction`)
brugt i tasks.ts, contract-versions.ts, users.ts.

Gate: format ✅, lint ✅, tsc ✅, build ✅.

## A11y-sweep — 2026-04-18 ✅

WCAG 2.1 Level A + kritisk AA bragt i hus. A11y-audit fra ~2/10 → ~8/10.

- [x] **eslint-plugin-jsx-a11y/recommended** enabled i `.eslintrc.json` — 59 baseline-violations identificeret
- [x] **Forms** — htmlFor/id retrofit på 8 forms (CreateTaskForm, CreateVisitForm, CreateCaseForm, CreateContractForm, CreateUserForm, AddCompanyPersonForm, AddOwnerForm, AddMetricForm). 34 nye id/htmlFor-par + 2 checkbox-grupper konverteret til `role="group"` + `aria-labelledby`
- [x] **AccessibleDialog-primitive** (`src/components/ui/accessible-dialog.tsx`) med focus-trap, Escape-close, aria-labelledby, focus-restore + 5 unit-tests (jsdom + testing-library)
- [x] **3 modals refaktoreret** til AccessibleDialog: EditStamdataDialog, AddCompanyPersonForm, AddOwnerForm. ~42 linjer manuel modal-boilerplate fjernet
- [x] **SkipToMain-link** i dashboard-layout for keyboard-first brugere — `<a href="#main-content">Spring til hovedindhold</a>` med `sr-only focus:not-sr-only`-pattern
- [x] **Kanban keyboard-navigation** — Enter/Space grabber, ArrowLeft/Right flytter mellem statusser (NY → AKTIV_TASK → AFVENTER → LUKKET), Escape slipper. Aria-live polite region annoncerer flyt på dansk. Drag-drop bevaret 100%
- [x] **Kontrast-sweep** — 117 `text-gray-400` → `text-gray-500` på brødtekst for WCAG AA (66 kept på icons/placeholders). Konvention dokumenteret i `docs/build/CONVENTIONS.md`
- [x] **Drop-zones + mobile-nav** — tastatur-support (role="button", tabIndex, onKeyDown, aria-label) på UploadVersionForm + FileUpload drop-zones og mobile-nav burger
- [x] **Tests**: 545 → 550 passed (+5 accessible-dialog), 0 failed
- [x] **Gate**: format ✅, lint ✅ (kun 2 forventede no-autofocus warnings), tsc ✅, build ✅

Produktions-modenhed-track lukket: foundation (session 1) + schema/audit (session 2) + E2E/CI/coverage (session 3) + coverage uplift + a11y. Resterende: tech-debt cleanup + Vercel deploy.

## Tech-debt cleanup — 2026-04-18 ✅

5 ekstraherede lib-moduler + eliminated type-safety gaps.

- [x] **`src/lib/calendar-constants.ts`** — MONTH_NAMES_DA/SHORT + WEEKDAYS_DA_SHORT, brugt i full-calendar.tsx + calendar-widget.tsx
- [x] **`src/lib/date-helpers.ts`** — formatDanishDate/Time/Short/Relative + 17 unit-tests. Pragmatisk valg: refaktorerede 28 call-sites til eksisterende `formatDate` i labels.ts for konsistens (allerede brugt i 30+ filer); nye helpers fyldte kun de huller labels.ts ikke dækkede (null-safe, datetime, relativ)
- [x] **`src/lib/dashboard-helpers.ts`** — 9 pure helpers fra dashboard.ts (filterLatestPerCompany, sumMetric, deriveHealth, pickHighestPriorityRole, firstLetter, relativeDays, buildInlineKpis, buildTimelineSections, emptyDashboardData) + 32 unit-tests. `dashboard.ts`: 740 → 362 linjer (−378)
- [x] **`src/lib/zod-enums.ts`** — 14 Zod-Prisma-enum-bro-schemas med `satisfies z.ZodType<T>`-pattern + 28 unit-tests. 25 `as never`-casts fjernet fra 6 action-filer + 9 UI/page-filer. Resterende 21 `as never` er legitime (Prisma Json-kolonner + Anthropic SDK type-bridge)
- [x] **`src/lib/nav-config.ts`** — fælles NAV_SECTIONS (sidebar, 3 grupper) + NAV_ITEMS (mobile, 10 items) via flatMap-derivation → ingen drift-mulighed mellem mobile + sidebar
- [x] **Bonus: 2 latente runtime-bugs fundet og rettet** ved fjernelse af `as never`:
  1. `CASE_SUBTYPE_BY_TYPE` havde 3 stavefejl der ikke matchede Prisma-enum (VIRKSOMHEDSKOEB, MYNDIGHEDSPAABUD, BESTYRELSESMOEDE) — ville give runtime P2003/P2009 på create
  2. `finance.ts` sendte `'ANDET'` hvor Prisma forventer identifier `'ANDET_METRIC'` (Prisma `@map` oversætter selv til DB)
- [x] **Tests**: 550 → 627 passed (+77 nye), 0 failed
- [x] **Gate**: format ✅, lint ✅, tsc ✅, build ✅

`fastest-levenshtein`-fjernelse blev skippet — dep bruges faktisk af `src/lib/ai/pipeline/pass3-source-verification.ts` (fuzzy match for AI extraction). Audit var forkert.

Produktions-modenhed + tech-debt fuldt lukket. Resterende: Vercel deploy.

## Phase A.0 — AI infrastructure + cost-research ✅ (2026-04-18)

Første leverance af produkt-roadmap (`docs/superpowers/plans/2026-04-18-product-roadmap.md` afsnit 9 + dedikeret execution-plan i `docs/superpowers/plans/2026-04-18-phase-a0-ai-infrastructure.md`).

- [x] **Schema:** `AIUsageLog`-model tilføjet — per-call tracking af tokens + cost + feature + model + provider + optional resource-attribution
- [x] **MODEL_COSTS opdateret** med verified priser fra `claude.com/pricing` 2026-04-18 (Opus 4.7 $5/$25, Sonnet 4.6 $3/$15, Haiku 4.5 $1/$5). Haiku-pris hævet fra gammel $0.8/$4. Cache-pricing tilføjet. Opus-support tilføjet
- [x] **`src/lib/ai/usage.ts`** — `recordAIUsage` + `getMonthlyUsage` helpers. DB-fejl sluges via `captureError` (logging må ikke bringe AI-flow ned). 4 unit-tests
- [x] **`src/lib/ai/cost-cap.ts`** — `checkCostCap` + `getCostCapStatus` enforcement. 5 tærskler (none / 50-info / 75-warn / 90-alert / exceeded). 7 unit-tests
- [x] **Retrofit company-insights** — `isAIEnabled` + `checkCostCap` gates foran AI-kald i `getCompanyDetailData` (kun på cache-miss-branchen); `recordAIUsage` efter success. Graceful skip uden at brække UI-render
- [x] **Retrofit extraction-job** — samme enforcement-hooks + status/reason-felter i return-type. Klar til Phase B.1 wiring (stadig dormant)
- [x] **Worker-proces** `worker/index.ts` verificeret (pre-eksisterende, starter korrekt, env loades auto via tsx). `tsconfig.worker.json` tilføjet til standalone prod-build
- [x] **Admin-UI** `/settings/ai-usage` med månedligt overblik, cap-progress-bar (farve-kodet pr. tærskel), pr.-feature + pr.-model breakdown, seneste 25 kald i tabel. Link fra `/settings` under ny "System"-sektion
- [x] **`getAIUsageDashboard` server action** + 3 unit-tests
- [x] **`src/lib/labels.ts`** — `AI_FEATURE_LABELS` + `labelForAIFeature` (5 feature-labels på dansk)
- [x] **`scripts/ai-cost-research.ts`** — aggregering af AIUsageLog + rapportering
- [x] **`docs/build/AI-COST-MODEL.md`** — levende dokument med verified priser + målte-tal-placeholder + Bedrock-status + volume-modellering-skelet
- [x] **Tests:** 627 → 652 passed (+25 nye: 5 MODEL_COSTS, 4 usage, 7 cost-cap, 3 company-insights retrofit, 3 extraction retrofit, 3 ai-usage-dashboard)
- [x] **Gate:** format ✅, lint ✅ (2 pre-existing autofocus-warnings), tsc ✅, build ✅

**Unblocker:** Basis-tier kan prissættes nu (ingen AI-cost). Plus/Enterprise afventer Phase B.1 måling for endelig pris (cost-model-dokumentet opdateres iterativt).

**Noter:**

- pg-boss v10+ kræver eksplicit `boss.createQueue(name)` før `boss.work(name)` — adresseres i Phase B.1 når pipelinen faktisk wires
- AWS Bedrock model-access-ansøgning afventer start (ekstern bruger-action)

## Mobile + Empty-states track ✅ (2026-04-18)

Første konkrete UX-fix-leverance efter page-audit. Gate 1 (lokalt færdig) krav adresseret: BLK-003 løst, empty-states-primitive på plads, responsive grids på critical-sider, 44px tap-targets på forms.

- [x] **Page-audit leveret** (`docs/status/PAGE-AUDIT-2026-04.md`, 687 linjer) — 25 sider gennemgået på 8 dimensioner, prioriteret fix-liste, reference-mønster identificeret (`/cases/[id]`)
- [x] **Del 1: `<EmptyState>`-primitive** (`src/components/ui/empty-state.tsx`) med 4 unit-tests + retrofit på 3 sider (/cases, /persons, /settings). 4 sider bevidst sprunget over pga. visuel-inkompabilitet med slate-tema/kompakte panel-layouts
- [x] **Del 2: Mobile sidebar-drawer (BLK-003 LØST)** — ny `MobileSidebarWrapper` med hamburger-knap i header, focus-trap, Escape-close, backdrop-click, auto-close ved route-skift, body-scroll lock. `AppSidebar` genbrugt direkte i drawer (identisk funktionalitet som desktop). 4 unit-tests
- [x] **Del 3: Responsive grids** på 5 critical sider: /dashboard (`grid-cols-[1fr_320px]` → `grid-cols-1 lg:grid-cols-[1fr_320px]`), /companies portfolio + filter-bar, /companies/[id], /contracts/[id] (2 grids). Kanban-board var allerede responsive
- [x] **Del 4: 44px tap-targets** på 6 Create-forms (inputs/selects/textareas/submits) + `<Pagination>` + `<GroupToggle>`. Mønster: `py-3 md:py-2` / `h-11 md:h-8` — mobile-venlig uden at ændre desktop-look
- [x] **Tests:** 652 → 660 passed (+8 nye: 4 empty-state, 4 mobile-sidebar-wrapper)
- [x] **Gate:** format ✅, lint ✅ (2 pre-existing autofocus), tsc ✅, build ✅
- [x] **10 commits** på master (Del 1 × 2, Del 2, Del 3, Del 4 × 2, audit, PROGRESS m.fl.)

**Udestående til næste iteration (Gate 1 fortsat):**

- A.3 manglende features: Data-eksport (CSV/Excel), GDPR-sletningsflow, kunde-backup-download, onboarding-wizard, R2-interface
- A.4 yderligere UX: Empty-states på de 4 skippede sider (kræver compact/slate variant af EmptyState), form-density på /new-sider (max-w-xl → max-w-2xl+), dashboard-finalization (print-stylesheet, empty-states 6 varianter)
- Performance-audit (Lighthouse >90 på alle top-pages)
- A11y-retrofit til WCAG 2.2 Level AA + axe-core i CI

## Compliance + Data-export track ✅ (2026-04-18)

Gate 1 legal/compliance-blokkere lukket. Uden disse kan ChainHub ikke lovligt onboarde betalende kunder. Følger plan `docs/superpowers/plans/2026-04-18-compliance-data-export.md`.

- [x] **CSV-helper** (`src/lib/export/csv.ts`) med `toCsvString` + `toCsvBuffer`, UTF-8 BOM for Excel-kompatibilitet, custom formatters pr. kolonne, null→tom + auto-escape. 4 unit-tests
- [x] **Per-entity serializers** (`src/lib/export/entities.ts`) for 6 entity-typer: companies, contracts, cases, tasks, persons, visits. 17 unit-tests. Dispatcher `fetchEntityForExport(entity, scope)`. Danske header-labels + dato-formatering
- [x] **Export server action** (`src/actions/export.ts`) + API-route (`/api/export/[entity]`) — admin-only via `canAccessModule('settings')`, audit-logget (`action='EXPORT'`), Content-Disposition attachment. 3 unit-tests
- [x] **`<ExportButton>`-komponent** på 6 list-sider (companies, contracts, cases, tasks, persons, calendar for visits). PageHeader udvidet med `extraActions`-slot. 3 unit-tests
- [x] **GDPR Article 15** (Right of access) — `gdprExportPerson(personId, orgId)` aggregerer Person + CompanyPerson + Ownership + ContractParty + CasePerson til JSON-bundle. Tenant-scoped. 3 unit-tests
- [x] **GDPR Article 17** (Right to erasure) — `gdprDeletePerson(personId, orgId)` pseudonymiserer Person (first_name='Slettet person', email=null, notes=null, microsoft_contact_id=null, deleted_at=now), soft-ender CompanyPerson + Ownership, hard-deleter ContractParty + CasePerson. Atomisk transaction. 3 unit-tests
- [x] **GDPR server actions + API** (`src/actions/gdpr.ts` + `/api/export/gdpr/[personId]`) — admin-only, audit-logget med sensitivity FORTROLIG (export) / STRENGT_FORTROLIG (delete), revalidatePath. 7 unit-tests
- [x] **GDPR admin-panel** på `/persons/[id]` — amber-bordered panel med 2 knapper (Eksportér + Slet). Sletning kræver navn-typing i AccessibleDialog, deaktiverer "Slet permanent" indtil match. Kun synligt for admin. 5 unit-tests
- [x] **Organisations-backup (ZIP)** — `createOrganizationBackupStream` med 19 org-scope tabeller som JSON-filer + manifest. API-route `/api/export/backup` med audit-trail (action='BACKUP', sensitivity='FORTROLIG'). "Download fuld backup"-knap på `/settings`
- [x] **Dependencies:** `csv-stringify`, `archiver`, `@types/archiver` installed
- [x] **Tests:** 660 → 705 passed (+45 nye på tværs af track)
- [x] **Gate:** format ✅, lint ✅ (2 pre-existing autofocus-warnings), tsc ✅, build ✅
- [x] **Audit-coverage** — alle compliance-handlinger logget: EXPORT / GDPR_EXPORT / GDPR_DELETE / BACKUP

**Design-beslutninger (dokumenteret):**

- CSV-format foretrukket (XLSX udskudt til v2) — csv-stringify er let, Excel åbner UTF-8 BOM + dansk korrekt
- Pseudonymization fremfor hard-delete for Person (bevarer audit-trail i B2B-kontext — juridisk equivalent til erasure)
- Backup er sync JSON-ZIP — async via pg-boss er flagget hvis orgs >100MB (v2)
- Ikke-inkluderet i backup: User, UserRoleAssignment (brugerstyring håndteres separat), AI-drift-data, join-metadata

## Onboarding + UX Polish track ✅ (2026-04-18)

Sidste store Gate 1-track. Dashboard-onboarding leveret per DEC-F0-013, /new-sider tættere, dashboard empty-states + print-support, EmptyState-primitiven udvidet med varianter.

- [x] **Onboarding-panel** (DEC-F0-013) — dashboard-top viser "Kom godt i gang med ChainHub" med 3 checklist-steps (opret selskab, tilføj kontrakt, invitér kollega). Auto-hide når alle 3 færdige ELLER org >14 dage. `getOnboardingStatus` + `<OnboardingPanel>` + 16 unit-tests
- [x] **Form-density** — alle 6 Create-forms opgraderet: `max-w-xl/2xl` → `max-w-3xl`, relaterede felter grupperet i 2-col grid (`grid-cols-1 md:grid-cols-2`). Bedre space-udnyttelse på wide viewports uden at være overloaded
- [x] **Dashboard empty-states** — 7 sektioner fik pædagogiske empty-states: urgency-list, timeline-river, heatmap-grid, calendar-widget, contract-coverage, finans-nøgletal, økonomi-snapshot. Konsistent pattern (`py-6 text-center`, titel + hint om næste skridt)
- [x] **Print-stylesheet** (`src/app/globals.css`) — `@media print`-regler skjuler nav/sidebar/buttons/sticky-elementer, fladere farver, borders uden shadow, page-break-inside avoid på sektioner. Dashboard har print-specifik header ("ChainHub — Porteføljerapport" + dato). `.print-hide` klasse på mobile-sidebar-wrapper
- [x] **EmptyState varianter** — `variant="compact"` (p-4 + h-8 ikon) + `theme="slate"` (slate-border i stedet for gray-dashed). Retrofit på 4 tidligere-skippede sider: /documents, /documents/review/[id] (slate), /persons/[id], /calendar (compact i begge). 3 nye variant-tests
- [x] **Tests:** 705 → 724 passed (+19 nye: 16 onboarding, 3 empty-state varianter)
- [x] **Gate:** format ✅, lint ✅ (1 pre-existing autofocus-warning), tsc ✅, build ✅

## Lokal-godkendelses fix-round ✅ (2026-04-18)

Bruger klikkede rundt lokalt og rapporterede 3 issues. Alle fixet.

- [x] **Comment-bug** — `comments.ts`, `visits.ts`, `finance.ts`, `document-review.ts` brugte stadig `z.string().uuid()` som afviser seed-IDs (`00000000-0000-0000-0000-000000000010`). Sprint 8C fixede 6 andre schemas men missede disse 4. Ændret til `z.string().min(1)`
- [x] **Dashboard density** — 5 ændringer: positiv empty-state med aggregerede metrics (CheckCircle2 + selskaber/sager-counts) når intet er forfaldent, højre-panel margins tættere (p-3, space-y-2), heatmap 5→6 cols + max 15→18, calendar-legend skjules ved 0 events, overdueTasks take 10→15
- [x] **Performance quick-wins** — 3 compound indexes på ofte-brugte patterns (`Task[org_id, deleted_at, status]`, `Contract[org_id, company_id, deleted_at, status]`, `Case[org_id, deleted_at, status]`) via manual migration-SQL med `CREATE INDEX CONCURRENTLY`. Tenant-filter tilføjet på batch holding-company fetch for multi-tenancy safety
- [x] **Tests:** stabilt 724 passed
- [x] **Gate:** format ✅, lint ✅, tsc ✅

**Tilbage til user-bekræftelse lokalt:** Performance kræver sandsynligvis produktions-build test (`npm run build && npm start`) — dev-mode er inherent langsomt. Deploy-arbejdet venter til Gate 2.

## R2 storage interface ✅ (2026-04-18)

Sidste store Gate-1 kode-item: swap-ready storage-abstraktion så R2 kan aktiveres ved deploy uden kode-ændringer.

- [x] **`src/lib/storage/`** — `StorageProvider`-interface (upload, download, delete, getDownloadUrl) + `LocalStorageProvider` (filesystem, dev + CI) + `R2StorageProvider` (S3-compatible via @aws-sdk/client-s3 + s3-request-presigner) + `getStorageProvider()`-factory (singleton) der vælger via `STORAGE_PROVIDER` env
- [x] **Refactor `/api/upload/route.ts`** — fjernet inline `writeFile`/`mkdir`, bruger nu `storage.upload()`. `file_url` genereres via `storage.getDownloadUrl(key)` (local: `/api/uploads/...`; R2: presigned URL, 1t expires)
- [x] **Refactor `/api/uploads/[...path]/route.ts`** — `readFile` → `storage.download()` + null-check → 404
- [x] **Path-traversal guard** — LocalStorageProvider afviser keys med `..`
- [x] **`.env.example`** opdateret med STORAGE*PROVIDER + R2*\* docs
- [x] **Tests:** 724 → 730 passed (+6 local-storage unit-tests med tempdir-cleanup)

**Swap-instruktion (Gate 2):** Sæt i prod env `STORAGE_PROVIDER=r2` + `R2_ACCOUNT_ID/ACCESS_KEY_ID/SECRET_ACCESS_KEY/BUCKET`. Ingen kode-ændringer.

## axe-core CI ✅ (2026-04-18)

Sidste Gate 1 kvalitets-infra. A11y-regressioner fanges nu automatisk i CI.

- [x] **`@axe-core/playwright`** installed som dev-dep
- [x] **`tests/e2e/a11y.spec.ts`** scanner 15 sider (10 top-level + 5 detail) med WCAG 2.1 A/AA tags. Bruger eksisterende `loggedInPage`-fixture
- [x] **CI fejler på critical/serious** — moderate/minor logges kun (tolereres p.t.)
- [x] **Detail-pages bruger seed-IDs** via `uid(n)`-konvention: companies(1001), persons(2001), contracts(5001), cases(6001), tasks(7001)
- [x] **`docs/build/A11Y-GUIDE.md`** — guide til at tilføje nye sider + fix-mønstre for common violations + eskalerings-regler
- [x] **Ingen CI-workflow-ændring** — specs kører automatisk via eksisterende `npx playwright test` i e2e-job
- [x] **Tests:** 730 Vitest passed (axe-tests kører i Playwright/CI separat)
- [x] **Gate:** format ✅, lint ✅ (1 pre-existing autofocus), tsc ✅

**Første CI-run efter merge vil afdække eventuelle violations** — adresseres i follow-up PR med fix-mønstre fra A11Y-GUIDE.md.

## Phase A.2 pricing-forarbejde + Phase B.1a extraction-trigger ✅ (2026-04-18)

### A.2 — Pricing-beslutning klar til bruger-afgørelse

- [x] **`docs/build/PRICING-DECISION-2026-04.md`** — fuldt beslutnings-dokument med 3 tier-forslag (Basis 3.500 kr., Plus 7.500 kr. m. staffeling, Enterprise floor 22.000 kr.) + 4 konkrete spørgsmål til bruger
- [x] Cost-grundlag fra AI-COST-MODEL.md + drift-cost beregning + 3 Plus-afregningsmodeller (A flat, B staffel, C forbrug)
- [ ] **Afventer bruger-svar på 4 spørgsmål** → priser låses derefter i roadmap + feature-flag-logik

### B.1a — Extraction-pipeline wired til upload

- [x] **`/api/upload/route.ts`** accepterer `contractId` FormData-field; når sat køer automatisk `EXTRACT_DOCUMENT`-job via pg-boss med base64-encoded buffer
- [x] **`UploadVersionForm.tsx`** sender `contractId` ved kontrakt-version-uploads (trigger extraction)
- [x] **Generisk FileUpload** sender IKKE contractId (designvalg — generiske dokumenter er ikke kontrakt-specifikke)
- [x] **Fail-silent queue-send** — upload fejler IKKE hvis pg-boss er nede
- [x] **Shadow-mode bevaret** — DocumentExtraction gemmes, INGEN auto-write-back til Contract.type_data (kræver human approval via review-UI)
- [x] **pg-boss v10+ queue-creation fix** — `boss.createQueue()` kaldes defensivt før `send()` (idempotent)
- [x] Tests: 730 passed uændret (upload-route-test komplekst pga. FormData/multipart — deferred)

**Unblocker:** Ekstraktion kører nu automatisk når en kontrakt-PDF uploades med contract_id. Review-UI findes allerede (`/documents/review/[id]`, 817 linjer — substantial fra Sprint 9). AI-fields rendering på `/persons/[id]` er næste delleverance (B.1c).

### B.1c — AI-udlæste vilkår på /persons/[id]

- [x] **`src/actions/person-ai.ts`** — `getPersonAIExtractions(personId)` fetcher via ContractParty → Contract → Document → DocumentExtraction, normaliserer `extracted_fields`-JSON til `{ value, confidence, sourcePage, sourceText }`, filtrerer uden company-access
- [x] **`PersonAIExtractionsSection`** — lilla gradient-sektion med 10 key-fields pr. kontrakt (løn, opsigelsesvarsel, pension, ferie, arbejdstid, start/slut, konkurrenceklausul), konfidens-badge pr. felt (grøn/amber/rød), link til review-UI, link til source-kontrakt
- [x] **Placering på person-detalje** — mellem ansættelseskontrakter-blokken og tilknytninger-griddet (ANSÆTTELSE-kontekst-nært). Skjules helt når 0 extractions
- [x] 5 nye unit-tests (normalization, empty, permission, no-session, skip without extraction)
- [x] **Tests:** 730 → 735 passed
- [x] **Gate:** format ✅, tsc ✅, build ✅

**Phase B first delivery komplet**: upload → auto-extraction → resultater synlige på person-side i shadow-mode. Write-back til Contract kræver stadig human approval via review-UI.

## Udskudte features (dedikerede sessions)

Disse er bevidst taget ud af scope efter exploration og venter på dedikeret planning.

- **DocumentExtraction-UI på persons** — schema-relationen er nu på plads (session 2). Mangler kun UI-rendering af AI-udlæste felter (løn, opsigelsesvarsel, pension, non-compete) på `/persons/[id]`.
- **TaskParticipant (watchers)** — lavt afkast for små teams der bruger `assigned_to` + digest-emails. Tages når watcher-behovet er reelt.
- **CompanyNote med sensitivity** — notater pr. selskab med 3-lags sensitivity-permissions. Dedikeret session pga. kompleks adgangskontrol.
- **R2-produktionsstorage** — pt. lokal storage. Deploy-gated — bliver først relevant ved produktions-launch.
- **Tech-debt duplicates** — `filterLatestPerCompany`, mobile-nav vs app-sidebar nav, calendar month/day arrays. Piggyback på næste refactor i hvert område.
- **Dashboard whitespace + sidebar-badge contrast** — kosmetisk polish-sprint.
- **Produktions-modenhed session 3** — E2E Playwright test-suite + CI, test-coverage op på 80%, accessibility-sweep.

## Sprint 9 — Polish + Kalender ❌ AFVENTER SPRINT 8

- [ ] Tværgående kalender
- [ ] Notater pr. selskab
- [ ] Kanban-visning opgaver
- [ ] R2 dokument-upload (production)
- [ ] Global søgning (fulltext/Meilisearch)
- [ ] Organisation-indstillinger

## BLK-001: Supabase — LØST (2026-03-25)

Supabase genaktiveret. Schema synkroniseret, seed-data indlæst.
docker-compose.yml klar til lokal PG som alternativ (kræver Docker Desktop).

## Sprint 7.5 — Oprydning + Pagination ✅ (2026-03-25)

- [x] Supabase genaktiveret og seed-data indlæst (7 selskaber, 18 kontrakter, 6 sager, 10 opgaver)
- [x] Cases-liste: SearchAndFilter + Pagination (status + type filtre)
- [x] Opgaveliste: SearchAndFilter + Pagination (status + prioritet filtre)
- [x] Login verificeret med seed-bruger (philip@chainhub.dk)
- [x] Smoke-test: alle 9 routes returnerer 200 med data
- [x] Build: GRØN (34 routes, 0 TS-fejl)
- [x] docker-compose.yml oprettet til lokal PostgreSQL
- [x] CLAUDE.md opdateret med docker-kommandoer

## E2E polish session — 2026-05-24/25 ✅

33 runder browser-audit, 18 commits, 22 bugs fixet.

- [x] **Page titles** — `<title>`-tags tilføjet/rettet på alle routes
- [x] **Dansk 404-side** — custom not-found.tsx med dansk tekst
- [x] **Cmd+K / Ctrl+K** — global søgnings-genvej registreret i layout
- [x] **Logout-knap + brugernavn** i sidebar footer
- [x] **Activity-feed** — case-insensitive route-matching + uppercase enum-labels
- [x] **GDPR UUID** — person-detail viser maskeret UUID, ikke rå data
- [x] **Dashboard deep-links** — urgency-panel linker direkte til korrekte detalje-sider
- [x] **Dansk verbum-mappings** i activity-feed (oprettet, opdateret, arkiveret, m.fl.)
- [x] **#besoeg hash-anchor** på company-detail for direkte navigation til besøg-sektion
- [x] **Tests:** 735 → 1190 passed (store E2E-forbedringer + pagination-actions + ny action-coverage)
- [x] **Gate:** tsc ✅, build ✅

## Hardening session — 2026-05-25 ✅

Sikkerhed, performance og framework-opgraderinger.

- [x] **`src/lib/env.ts`** — startup-validering af miljøvariable via Zod; manglende påkrævede variabler kaster ved boot
- [x] **`auth()` internt i alle server actions** — organization_id sendes aldrig som parameter; actions henter session selv (forhindrer tenant-hopping)
- [x] **`parsePaginationParams`** — server-side pagination standardiseret via `src/lib/pagination.ts`; page.tsx henter ikke data direkte fra Prisma
- [x] **Ingen direkte Prisma-import i page.tsx** — al data-hentning via action-funktioner
- [x] **Tests:** 1190 passed, 4 skipped, 0 failed
- [x] **Gate:** tsc ✅, build ✅

## Resterende kendte UI-problemer

- Ejerskab-advarsel kan forbedres (Sprint 9)
- Sidebar rolle-badge contrast på mørk baggrund (Sprint 9 polish)
