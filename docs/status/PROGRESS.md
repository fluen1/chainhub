# PROGRESS.md — ChainHub

Opdateret: Plan 4D i praksis lukket + Sprint 8 accountability — 2026-04-18

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

## Udskudte features (dedikerede sessions)

Disse er bevidst taget ud af scope efter exploration og venter på dedikeret planning.

- **DocumentExtraction-data på persons** — kræver `contract_id`-felt på `Document`-model (mangler i schema), backfill af eksisterende dokumenter, UI-rendering af AI-udlæste felter (løn, opsigelsesvarsel, pension, non-compete). Egen session med schema-migration + datasti `contract → document → extraction`.
- **TaskParticipant (watchers)** — lavt afkast for små teams der bruger `assigned_to` + digest-emails. Tages når watcher-behovet er reelt.
- **CompanyNote med sensitivity** — notater pr. selskab med 3-lags sensitivity-permissions. Dedikeret session pga. kompleks adgangskontrol.
- **R2-produktionsstorage** — pt. lokal storage. Deploy-gated — bliver først relevant ved produktions-launch.
- **Tech-debt duplicates** — `filterLatestPerCompany`, mobile-nav vs app-sidebar nav, calendar month/day arrays. Piggyback på næste refactor i hvert område.
- **Dashboard whitespace + sidebar-badge contrast** — kosmetisk polish-sprint.

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

## Resterende kendte UI-problemer

- Ejerskab-advarsel kan forbedres (Sprint 9)
- Sidebar rolle-badge contrast på mørk baggrund (Sprint 9 polish)
