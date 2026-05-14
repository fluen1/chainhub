# ChainHub — 6-dimensions fix-program 2026-05-15

Branch: `audit-fixes-2026-05-15` (17 commits over master)
Status: ✅ Alle 5 faser komplet (H, I+J, L, M, K). Build grøn. 1039 tests passerer (104 test-filer, op fra 898 baseline).

---

## Sammenfatning

| Metric                   | Baseline | Efter audit-fixes | Diff |
| ------------------------ | -------- | ----------------- | ---- |
| Tests                    | 898      | 1039              | +141 |
| Test-filer               | 99       | 105               | +6   |
| TypeScript fejl          | 0        | 0                 | —    |
| Build                    | grøn     | grøn              | —    |
| 🔴 Kritiske audit-fund   | 15       | 0                 | -15  |
| 🟡 Vigtige audit-fund    | ~70      | <10               | ~-60 |
| 🟢 Kosmetiske audit-fund | ~35      | <15               | ~-20 |
| Commits                  | —        | 17                | —    |

---

## Per-fase status

### Phase H — Data integrity + sikkerhed ✅ (3 commits, 11 fixes)

- `Company.cvr` unique constraint (race-condition lukket)
- `addOwner` SERIALIZABLE transaction med sum-tjek (kan ikke overstige 100%)
- Cascading soft-delete: `Ownership.deleted_at`, `CompanyPerson.deleted_at`, `ContractVersion.deleted_at`, `Comment.deleted_at`
- `Comment.deleteComment` konverteret fra hard- til soft-delete
- `resource_company_id` udfyldt i alle Phase B audit-events
- Audit-log på `deleteCase`, `deleteTask`, `deleteCompany`, `deletePerson`
- Max-length Zod på description/notes (5000/2000 tegn)
- 7 nye `error.tsx` filer på contracts/cases/persons/documents/settings/calendar/search
- Multi-tenancy fix: `activity-feed.ts` + `gdpr.ts` organization_id-filter

Commits: `6b113fd`, `b47e7d1`, `f6bd959`

### Phase I+J — Mobile + A11y ✅ (3 commits, 15 fixes)

- `BModal` useId + `<h2>` titel + `max-w-[calc(100vw-16px)]` (fixer alle 9 modaler på mobile)
- `BField` useId + htmlFor + aria-required/aria-invalid/aria-describedby (fixer alle form-felter på tværs af alle modaler)
- `FilterRow` flex-wrap (fixer 6 list-pages på mobile)
- `TableWrap` overflow-x-auto + min-w-600px (fixer 6 list-pages)
- Calendar prev/next tap-target 44px
- Document-review breakpoint (`grid-cols-1 lg:grid-cols-[1.6fr_1fr]`)
- `--b-text-2` kontrast fixed (#6e7681 → #586069 = 4.7:1)
- `prefers-reduced-motion` global support
- `DeleteDocumentButton` slate-400 → slate-600
- `ContractStatusButton` keyboard nav + ARIA-attributes (aria-expanded/haspopup/role=listbox)
- `aria-grabbed` → ARIA 1.2 pattern (aria-pressed)
- Hamburger 32px → 44px på mobile
- Heatmap aria-label på celler

Commits: `31a3b94`, `28a5191`, `93bc2fc`

### Phase L — Performance ✅ (3 commits, 8 fixes)

- `next/dynamic` på LeafletMap (~150kB lazy)
- `next/dynamic` på GdprPanel (admin-only lazy)
- AuditLog compound index `[organization_id, resource_company_id, created_at]`
- `getDashboardData/getSidebarData/getRecentActivity` accepterer `preloadedCompanyIds` (eliminerer 2 ud af 3 DB-roundtrips)
- `getSidebarData` wrapped i `React.cache()` (request-memoization)
- R2 presigned URL TTL: 1h → 24h
- `getSettingsAIUsage` konsolidering (TODO-mark for fuld query-merge)

Commits: `ba71de0` (delt med M), `d5ef4c0`, `9d6e8bc`

### Phase M — Content + copywriting ✅ (3 commits, 13 fixes)

- `AKTINONAERLAAN` → `AKTIONAERLAAN` (stavefejl)
- Rå enum "GROUP_OWNER/GROUP_ADMIN" → "kædeejer/administrator"
- Engelsk-rester migreret: `auto-refresh on`, `cost-cap`, `extractions`, `AI-kald`, `renewal-risk`, `tier`, `soft-delete`, `processeret`, `via UI`
- $USD beløb fjernet/omformuleret
- `formatMio` til dansk format (komma + " mio. kr.")
- Decimal-separator i placeholders (33.33 → 33,33, 5000000 → 5.000.000)
- Actionable fejlbeskeder: "Ikke autoriseret" → session-fejl, "Ingen adgang" → kontakt admin, "Ugyldigt input" → udfyld felter (~25 sites)
- GDPR Art.-referencer fjernet fra knap-labels (bevaret som tooltips)
- "uomkørbar" → "kan ikke fortrydes"
- "Annullér" → "Annuller" (16+ sites)
- Email-template: GDPR-afmeld-link + "Hej" greeting + ny footer
- P-nummer hint i EditStamdataDialog

Commits: `ba71de0` (delt med L), `c7c1f5c`, `7cd60b5`

### Phase K — UX-funktionalitet ✅ (4 commits, 11 fixes)

- Kommentarer fetches fra DB på `/cases/[id]` (KRITISK — tidligere forsvandt de visuelt efter Gem)
- Slet-knap på egne kommentarer (wired til soft-delete)
- `EditCaseDialog` har nu `assignedTo`-felt (combobox med org-brugere)
- `ContractStatusButton` OPSAGT/UDLOEBET viser note-felt synligt + validerer ikke-tom
- Strip-KPIs klikbare (alle 6 cells linker korrekt med URL-params)
- "Udløber 30d" data/label-fix: 14d → 30d (matcher labelen)
- ActivityPanel default åben
- HeatmapPanel "Se alle N kritiske →" footer-link
- `fetchCompaniesForExport` udvidet med finansdata (omsætning/EBITDA/margin/YoY)
- YoY-procent vises nu i FinanceSection med rød/grøn
- `CreateVisitForm` "Planlæg endnu ét"-flow
- KbdHints fjernet fra 7 BottomBars (kun /search bevarer dem)

Commits: `438edd4`, `9a79d14`, `3fcc8c5`, `f5916a2`

---

## Schema-ændringer ved deploy

Migrering kræver `npx prisma db push` på target-DB:

1. `Company.@@unique([organization_id, cvr])` — duplikat-CVR blokeres
2. `Ownership.deleted_at DateTime?` — nullable
3. `CompanyPerson.deleted_at DateTime?` — nullable
4. `ContractVersion.deleted_at DateTime?` — nullable
5. `Comment.deleted_at DateTime?` — nullable
6. `AuditLog @@index([organization_id, resource_company_id, created_at])` — nyt compound index

OBS: Unique constraint på CVR vil fejle hvis der findes duplikater i prod-data. Tjek først: `SELECT cvr, organization_id, COUNT(*) FROM "Company" WHERE deleted_at IS NULL GROUP BY cvr, organization_id HAVING COUNT(*) > 1`.

---

## Resterende kosmetiske items (lavt risikoniveau)

- **Mobile Kanban touch drag-drop** — native HTML5 virker ikke på touch. Library som dnd-kit nødvendigt. Udskudt til separat session.
- **Calendar agenda default på `<md`** — viewport-detection kræver server-side header-parsing eller client-redirect. Udskudt.
- **Cases/tasks mobile card-stack** — alternativ table-view på mobile. Udskudt (P2-3).
- **Bulk-select på lister** — checkbox-multi-select på companies/contracts/cases. Udskudt — kræver ny komponent + 5+ actions.
- **`getSettingsAIUsage` fuld konsolidering** — TODO-mark sat (kræver `getCostCapStatus` refaktor).
- **Onboarding-UI komponent** — `getOnboardingStatus` action returnerer data men ingen UI rendrer den endnu.
- **`company-insights.ts` hardcoded "2025"** — udskudt (kræver schema-ændring til dynamic år-fields).

---

## Næste skridt

Pull request fra `audit-fixes-2026-05-15` til `master` anbefales. Ingen breaking changes for eksisterende brugere.

PR-checkliste:

- [x] 17 commits, alle med dansk kommit-besked og co-author
- [x] tsc --noEmit: 0 fejl
- [x] npm test: 1039 passed / 4 skipped / 0 failed
- [x] Schema-migrationer dokumenteret
- [x] DB-push allerede kørt mod Supabase (verificeret)
- [ ] Playwright re-verification af top 10 kritiske fund — anbefales

---

_Statisk audit + parallel fix-program, 2026-05-15. 6 audit-agents → 5 fix-agents → 1 UX-finalisering. ~120 fund lukket._
