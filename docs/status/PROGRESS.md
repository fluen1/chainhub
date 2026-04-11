# PROGRESS.md — ChainHub

Opdateret: Plan 4B FÆRDIG 2026-04-11

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
- [x] Formular-logik ekstraheret til client-komponenter (Create*Form.tsx)
- [x] Zod UUID-validering rettet i 6 validerings-schemas (z.string().uuid() → z.string().min(1))
- [x] TaskStatusButton rettet (AKTIV_TASK enum-mapping)
- [x] /documents forbedret (upload, filtre, MIME-labels, download-links)
- [x] /persons forbedret (selskabs-filter)
- [x] Build: GRØN (41 routes, 0 TS-fejl, 48 tests grønne)

### Sprint 8 resterende scope
- [ ] Schema — task_participants, task_comments (deleted_at!), task_history
- [ ] Schema — company_notes (sensitivity!), tasks tasks[] → Company relation
- [ ] Opgave-udvidelser — deltagere, historik, kommentarer, kilde-badge
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

## Plan 4C — Resterende sider (afventer)
- [ ] `/tasks` list + `/tasks/[id]` detail-rewrite
- [ ] `/calendar` full-page (erstatter `/visits`, feeder CalendarWidget på dashboard)
- [ ] `/search` global søgning
- [ ] `/settings`
- [ ] `/companies/[id]` single-page rewrite (erstatter subpages)
- [ ] Slet `/visits` efter `/calendar` overtager

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
