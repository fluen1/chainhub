# PROGRESS.md — ChainHub MABS

Opdateret: Sprint 7 FÆRDIG 2026-03-12

## Fase 0 — Original spec ✅ (Sprint 1-6)
- [x] Alle spec-dokumenter godkendt

## Sprint 1-6 ✅ FÆRDIGE
- [x] Sprint 1 — Fundament (Next.js 14, Prisma, Auth, Permissions, Dashboard shell)
- [x] Sprint 2 — Kernobjekter (Selskaber, Personer)
- [x] Sprint 3 — Kontrakter (34 typer, sensitivity, status-flow)
- [x] Sprint 4 — Sager og opgaver
- [x] Sprint 5 — Dashboard og økonomi
- [x] Sprint 6 — Produktion (48 tests, pentest, build grøn)

## Fase 0 — SPEC-TILLAEG-v2 ✅ GODKENDT (2026-03-12)
- [x] 9 DEA-agenter + BA-12 challenge
- [x] 17 beslutninger (16 ACCEPTED, 1 WONT-FIX)
- [x] 0 KRITISKE indsigelser

## Sprint 7 — UI Foundation + Enum Fix ✅ FÆRDIG

### TEKNISK GATE ✅
- [x] npm install — ingen fejl
- [x] prisma generate — OK
- [x] tsc --noEmit — 0 fejl
- [x] npx next build — GRØN (33 routes)
- [x] Alle 48 tests grønne

### UI GATE ✅ (DEA-08 godkendt)
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

### PRODUKT GATE ✅ (DEA-09 godkendt)
- [x] Kædeleder-perspektiv er nu primært fokus
- [x] Overbliksfane giver svar på "hvad er status på denne klinik?"
- [x] Urgency panel giver svar på "hvad kræver min opmærksomhed nu?"

### BRUGER GATE ✅ (BA-12: 0 BLOKERENDE fund)
- [x] Login-side loader uden fejl
- [x] Dashboard og routes kompilerer korrekt
- [x] Urgency panel med specifikke items og direkte links

## Sprint 8 — Accountability + Dokumenter ❌ STARTER NU

### Sprint 8 scope (baseret på DEC-F0-*)
- [ ] BA-02: Schema — visits (VisitType+OVERDRAGELSE), visit_participants (org_id!)
- [ ] BA-02: Schema — task_participants, task_comments (deleted_at!), task_history
- [ ] BA-02: Schema — company_notes (sensitivity!), tasks tasks[] → Company relation
- [ ] BA-05: Besøgsstyring — /visits, /visits/[id], /companies/[id]/visits
- [ ] BA-05: Opgave-udvidelser — deltagere, historik, kommentarer, kilde-badge
- [ ] BA-05: Kontraktversioner + bilag-upload + ChangeType dialog (DEC-F0-010)
- [ ] BA-05: Brugerstyring (/settings/users) + rolle-administration
- [ ] BA-06: Dokument-upload (lokal storage mock → R2 i Sprint 9)
- [ ] BA-06: Email-digest (Resend — DEC-F0-014)
- [ ] DEA-08: UX review
- [ ] DEA-09: Produkt-helhed review
- [ ] BA-12: Testbruger workflows

## Sprint 9 — Polish + Kalender ❌ AFVENTER SPRINT 8
- [ ] Tværgående kalender
- [ ] Notater pr. selskab
- [ ] Kanban-visning opgaver
- [ ] R2 dokument-upload (production)
- [ ] Global søgning (fulltext/Meilisearch)
- [ ] Organisation-indstillinger

## BLK-001: Supabase paused
Status: AKTIV — ikke-blokerende for build/dev/test
Action: Genaktiver Supabase inden Sprint 8 deploy-test.

## Resterende kendte UI-problemer (efter Sprint 7)
- Cases-liste mangler pagination (BA-05 Sprint 8)
- Opgaveliste mangler pagination (BA-05 Sprint 8)
- Ejerskab-advarsel kan forbedres (Sprint 9)
- Sidebar rolle-badge contrast på mørk baggrund (Sprint 9 polish)

[2026-03-11 20:25] BA-04 — Sprint 7 — UI Foundation komplet: FÆRDIG

[2026-03-11 20:25] BA-12 — Sprint 7 testbruger-verificering: FÆRDIG
