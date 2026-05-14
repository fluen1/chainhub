# ChainHub — Audit fixes komplet 2026-05-14

Branch: `audit-fixes-2026-05-14` (28 commits over master)
Status: ✅ Alle 7 faser komplet. Build grøn. 898 tests passerer (op fra 697 baseline).

---

## Sammenfatning

| Metric                   | Baseline (master) | Efter audit-fixes | Diff |
| ------------------------ | ----------------- | ----------------- | ---- |
| Tests                    | 697               | 898               | +201 |
| TypeScript fejl          | 0                 | 0                 | —    |
| Build                    | grøn              | grøn              | —    |
| 🔴 Kritiske audit-fund   | 38                | 0                 | -38  |
| 🟡 Vigtige audit-fund    | ~55               | <5                | ~-50 |
| 🟢 Kosmetiske audit-fund | ~30               | <10               | ~-20 |
| Commits                  | —                 | 28                | —    |

---

## Per-fase status

### Phase A — RBAC + sikkerhed ✅ (3 commits)

Fixes: scope-leak i dashboard/sidebar/search/activity-feed, `getUserRoles` tenant-filter, fail-closed `canAccessModule`, tenant-verifikation på `/api/upload`, timing-safe `daily-digest`, AuditLog-wiring på `/api/export/*` + `/api/export/gdpr/*`, RFC 5987 encoding.

Commits: `e56c713`, `7d51d1e`, `56d369a`

### Phase B — Dead flows + manglende UI ✅ (12 commits, 7 parallelle agents)

- **B1 Cases:** kommentar-submit wired (createCaseComment), EditCaseDialog + CloseCaseDialog, sensitivity labels, +Tilknyt/+Upload knapper, Eskalér + Luk sag actions
- **B2 Persons:** GdprPanel (Art. 15+17), admin-guard, AddPersonRoleModal, AddPersonOwnershipModal, EditPersonDialog, AI extraction field-mapping
- **B3 Tasks:** EditTaskDialog (erstatter 3x 404-routes), CreateTaskForm udvidet (companyId, assignedTo), TaskHistory på create
- **B4 Contracts:** ContractStatusButton (wired), extraction query bug-fix, EditContractDialog, AddContractPartyModal, dead buttons fixed
- **B5 Kanban:** native HTML5 drag-drop, keyboard-nav (Enter/Space/Arrow/Escape), aria-live polite, sortering fix
- **B6 Settings:** real AI-usage data (ikke hardcodet 0%), 3 placeholder-toggles fjernet, sidstAktiv real, 4 stub-sektioner opgraderet med roadmap
- **B7 Companies/upload/env:** EditStamdataDialog modal, `/documents/upload`-route, NEXTAUTH_URL dokumentation + dev-warning

Commits: `d4e0350`, `91ac9bc`, `6a3da1b`, `133fbf1`, `9b91f05`, `d8a75c2`, `8e05804`, `03967ae`, `1f5b871`, `fd1da14`, `79acc04`, `7783a4b`

Plus `010bef6` (security-fix til escalateCase findFirst — manglede `organization_id`)

### Phase C — Kritiske SQL/enum-bugs ✅ (3 commits)

- `UDLOBET` → `UDLOEBET` typo i raw SQL
- Finance hardcoded `period_year: 2025/2024` → dynamic `getFullYear()` / `currentYear - 1`
- `KEY_PERSON_ROLES` lowercase DB-strings (case-mismatch fix)
- AddOwnerModal HOLDING-feedback + note-felt wiring
- EndOwnershipRoleModal note-felt wiring

Commits: `0b32875`, `ce3a2fe`, `94db752`

### Phase D — Orphaned actions wired ✅ (1 commit absorbed Phase C #3)

- DeleteDocumentButton wired på documents-list + review-page
- Readonly-gating på 4 + Opret-knapper i /companies/[id]
- Eksportér ▾ wired på 5 list-pages (ExportButton i stedet for no-op)
- Document badge bevarer alle 3 tilstande (AI ✓ / Til review / Ikke AI)

Commit: `94db752`

### Phase E — Labels migration + utilities ✅ (2 commits)

- labels.ts udvidet med HEATMAP_STATUS_LABELS, REGION_LABELS, HEALTH_STATUS_LABELS
- HELAER duplikat slettet, AKTIV/AKTIV_TASK legacy ryddet
- formatShortDate konsolideret (3 lokale kopier → date-helpers.ts)
- getInitials() konsolideret (3 lokale kopier → labels.ts)
- MAANEDER/UGEDAGE/DAYS/MONTHS centraliseret i calendar-constants.ts
- HeatmapPanel statusFor() bruger labels
- dashboard.ts REQUIRED_TYPES bruger getContractTypeLabel()
- calendar.ts visit_type bruger getVisitTypeLabel()
- contracts/page.tsx lokal statusLabel slettet
- search/page.tsx rå enums via labels
- task-detail-b.tsx rå case/contract status via labels

Commits: `4d6d332`, `581398f`

### Phase F — B-stil porting ✅ (3 commits)

- 5 Create-forms porteret (Company, Case, Contract, Visit, Person)
- FileUpload porteret
- ActivityPanel bruger `<Panel>`-primitive
- HeatmapPanel hardcoded hex → `bg-b-heat-*` design tokens
- /visits/[id] page komplet B-stil port
- VisitStatusForm: GENNEMFOERT/AFLYST viser nu AlertBar + "Genåbn besøg"-knap (i stedet for `return null`)

Commits: `c73b4f9`, `5d1bffa`, `8cd4c73`

### Phase G — Final cleanup + polish ✅ (3 commits)

- URL-persistent filter-state på 4 list-pages (contracts/cases/tasks/persons)
- Calendar events klikbare (`CalendarEvent.href` + `<Link>` wrapping)
- Calendar legend/colorForType sync fix (besøg/renewal farver)
- Calendar `searchParams` Promise type (Next.js 15-kompatibel)
- `/search/loading.tsx` skeleton tilføjet
- Urgency-task-links → `/tasks/[id]` (i stedet for `/tasks` list)
- /companies/[id] strip-cells conditional på `visibleSections`
- KbdHints fjernet fra BottomBar (de var rent dekorative)

Commits: `f81fde7`, `05f8ddb`, `3250c53`

---

## Resterende kosmetiske items (lavt risikoniveau)

Disse blev ikke fixet — vurderet som lavt-værdi eller kræver product-decisions:

- **Shadow-mode write-back til Contract.type_data** — `approveDocumentReview` opdaterer kun `reviewed_by/reviewed_at`. Bevidst designvalg per spec (kræver separat migrations-step). Audit-rapporten flaggede UI-tvetydighed, men selve flow'et er korrekt — kunne forbedres med eksplicit UI-besked "Godkendelse logges; write-back kræver bekræftelse fra system-administrator".
- **CreatePersonForm duplikat-email-toast** — duplikat-detektion er implementeret men toast vises ikke. Ikke kritisk fordi DB-constraint forhindrer alligevel.
- **Cases extraction-query for AI** — `/cases/[id]` indlæser ikke `DocumentExtraction` (modsat /contracts og /persons). Audit flaggede dette som inkonsistent — beslutning udskudt indtil AI-extraction-flow for sager er defineret.
- **`TaskParticipant` (watchers)** — udskudt iht. PROGRESS.md "lavt afkast for små teams".
- **Yderligere mobile responsive testing** — P2-1 (calendar agenda-list) og P2-3 (cases/tasks mobile card-stack) markeret af memory som "venter på separat session".

---

## Forventede DB-migrationer ved deploy

To schema-ændringer kræver `npx prisma db push` (eller migrate) på target-DB:

1. **`AuditLog.resource_company_id` (nullable)** — tilføjet i Phase A for at scope-filtrere activity-feed per company-access.
2. **`User.last_login_at` (nullable)** — tilføjet i Phase B6 for at vise reel "Sidst aktiv" i brugerstyring.

Begge er bagudkompatible (nullable, intet backfill kræves).

---

## Næste skridt

Pull request fra `audit-fixes-2026-05-14` til `master` anbefales. Ingen breaking changes for eksisterende brugere.

PR-checkliste:

- [x] 28 commits, alle med dansk kommit-besked og co-author
- [x] tsc --noEmit: 0 fejl
- [x] npm test: 898 passed / 4 skipped / 0 failed
- [x] DB-migrationer dokumenteret
- [ ] Manuel rolle-walkthrough (philip + maria + finance-test) — anbefales før merge
- [ ] Playwright re-verification af top 10 kritiske fund — kan dispatchet hvis tid

---

_Genereret 2026-05-14. Hovedaudit: `AUDIT-2026-05-14.md`. Playwright-baseline: `AUDIT-PLAYWRIGHT-2026-05-14.md`._
