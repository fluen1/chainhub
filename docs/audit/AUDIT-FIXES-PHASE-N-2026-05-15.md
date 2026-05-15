# ChainHub — Phase N fix-program (pilot-blokkere) 2026-05-15

Branch: `audit-fixes-2026-05-15-v3` (13 commits, mergede til master som `82c4486`)
Status: ✅ Alle 5 N-faser komplet. Build grøn. 1078+ tests passerer.

---

## Sammenfatning

| Metric            | Baseline (efter v2) | Efter Phase N | Diff |
| ----------------- | ------------------- | ------------- | ---- |
| Tests             | 1039                | 1078+         | +39+ |
| Test-filer        | 105                 | 114           | +9   |
| TypeScript fejl   | 0                   | 0             | —    |
| Build             | grøn                | grøn          | —    |
| 🔴 Pilot-blokkere | 10                  | 0             | -10  |
| 🟡 Vigtige fund   | ~12                 | <5            | ~-8  |

---

## Per-fase status

### Phase N1 — Permissions + RBAC ✅ (3 commits, 6 fixes)

- **Export-modul tilføjet** i `permissions/index.ts`: `case 'export'` tillader GROUP_OWNER/ADMIN/LEGAL/FINANCE. `prepareExport` bruger nu det i stedet for restriktive `'settings'`. GDPR-export bevarer admin-only.
- **`/api/users-list` rolle-gate**: ny `case 'users-list'` (alle GROUP\_\*-roller + COMPANY_MANAGER). 403 hvis ikke tilladt.
- **`/companies/new` permission-konsistens**: brugte `canAccessModule('settings')`, nu `'companies'` (matches list-page som accepterer GROUP_LEGAL).
- **Sensitivity server-validering** i `updateCase`/`createCase`: `canAccessSensitivity` på input-niveau forhindrer eskalering til niveau bruger ikke kan se.
- **`documentsCount`/`personsCount` scoped** i `sidebar-data.ts` + `dashboard.ts`: filtrér på `company_id IN companyIds` (+ orphan-records + org-wide).
- **Dashboard Strip-cells rolle-filtreret**: GROUP_FINANCE ser ikke "Åbne sager"/"Dokumenter" (dead affordances elimineret).

Commits: `ad7a496`, `e6442a9`, `2468f4f`

### Phase N2 — Dashboard + Onboarding ✅ (3 commits, 5 fixes)

- **Strip-link `?expiresWithin=30d` filter implementeret** i `contracts-list-b.tsx`. `normalizeStatusParam()` accepterer både `AKTIV` og `Aktiv` (case-insensitive). Dashboard "1 Udløber 30d" matcher nu liste-count.
- **`getRecentActivity` `since`-parameter** (default 24h). ActivityPanel-label er nu sand.
- **ActivityPanel events klikbare**: wraps `<Link>` baseret på `resource_type` + `resource_id`.
- **UrgencyPanel akrymatisk label-fix**: `SECTION_SHORT_LABEL` map (Forfaldne→Frist, Denne uge→7d, Næste uge→14d, Næste 2 uger→28d).
- **OnboardingPanel** komponent: 3-step checklist (Opret selskab / Tilføj kontrakt / Inviter kollega). Auto-hide når shouldShow=false (alle 3 done eller org >14 dage). Action eksisterede men var orphan — nu wired på dashboard øverst.

Commits: `ae4b09e`, `bdadcd3`, `6bbf2e0`

### Phase N3 — Company + Cases ✅ (2 commits, 3 fixes)

- **AlertBar når `healthStatus=critical`** på `/companies/[id]`: rød AlertBar med årsag ("X forfaldne opgaver og Y åbne sager"). Tidligere skulle bruger scrolle for at finde årsagen.
- **`CaseStatusPill` inline** i `/cases/[id]` PageHeader: dropdown med gyldige `CASE_TRANSITIONS`. NY→AKTIV er nu 2 klik (var 3 via EditCaseDialog).
- **Finance peer-rang**: `peerRank: { rank, total }` tilføjet til `FinanceViewData`. Vises som "Rang X af Y selskaber" under EBITDA.

Commits: `7f1dd4b`, `c05a3c0`

### Phase N4 — Mobile + Tasks ✅ (3 commits, 4 fixes)

- **Kanban SegmentedToggle tab-bar på `<lg`**: én status-kolonne ad gangen. Desktop 4-col grid uændret.
- **Calendar agenda-default på `<md`**: `useEffect` ved mount detect mobile + `?view`-tom → `router.replace('?view=agenda')`. Respekterer eksplicit valg.
- **task-detail "+ Tilknyt" wired**: åbner EditTaskDialog.
- **ExportButton `canExport` UI-gate**: prop skjuler knappen for roller uden eksport-adgang. Bruges på tasks-listen — øvrige lister kan trivielt opdateres.

Commits: `7c951b4`, `7543e2b`, `7f27fe2`

### Phase N5 — Forms + Validation ✅ (2 commits, 5 fixes)

- **BModal `maxWidth` i stedet for `width`**: fjerner inline-vs-class overflow-risiko. Alle 9 nye modaler respekterer nu mobile-viewport.
- **CVR client-side regex** (`/^\d{8}$/`) i `CreateCompanyForm`. Inline fejlbesked + submit disabled.
- **CreateUserForm B-stil port**: BTextField/BFieldWrap/BButton + `ROLE_HINTS`-map giver hint under valgt rolle.
- **CreateContractForm `loadError`**: silent-catch erstattet med dansk fejl-besked. 0-selskaber empty-state med link til `/companies/new`. Sensitivity-hint bruger `getSensitivityLabel()` i stedet for rå enum.

Commits: `a980a13`, `80f7147` (test-fixes)

---

## De 10 kritiske pilot-blokkere — alle lukket

| #   | Pilot-blokker                                           | Fixed i |
| --- | ------------------------------------------------------- | ------- |
| 1   | Strip "Udløber 30d" filter-mismatch (0 resultater)      | N2      |
| 2   | GROUP_FINANCE kan ikke eksportere                       | N1      |
| 3   | ActivityPanel "seneste 24 timer" uden created_at-filter | N2      |
| 4   | /api/users-list manglede rolle-gate                     | N1      |
| 5   | EditCaseDialog sensitivity uden server-validering       | N1      |
| 6   | /companies/[id] mangler AlertBar når critical           | N3      |
| 7   | Dashboard Strip-cells ikke rolle-filtreret              | N1      |
| 8   | documentsCount/personsCount ikke company-scoped         | N1      |
| 9   | Onboarding-flow ikke wired til UI                       | N2      |
| 10  | Kanban kollapser til 1 kolonne uden navigation mobile   | N4      |

---

## Test-cleanup post-merge

To pre-existing test-failures blev fixed i samme runde:

- `phase-c-fixes.test.ts` Fix 1 forventede "UDLOEBET" i raw SQL, men hotfix `941b415` reverterede til "UDLOBET" (Prisma `@map`-værdi til DB). Test inverteret med dokumentation.
- `cases-actions.test.ts createCase` manglede `canAccessSensitivity` mock efter N1 sensitivity-validering. Mock tilføjet.

Begge fixed i commit `80f7147`.

---

## Resterende udskudt (lavt risikoniveau)

- **FinanceSection multi-år trendgraf** — kompleks, kræver schema-redesign for at vise N år ad gangen
- **Portefølje-niveau finansaggregering** på dashboard — pragmatisk skipped (Strip-cells er rolle-filtreret men ikke udvidet)
- **Real-time notification** ved kollega-actions
- **Bulk-select på lister**
- **Mobile Kanban touch drag-drop** (tab-bar workaround leveret i N4; dnd-kit udskudt)
- **`company-insights.ts` "2025"** hardcode
- **Audit-log side** for compliance-self-service
- **CreateContractForm sample-data templates**

---

## Akkumuleret status (3 audit-programmer)

- **Audit v1 (kode-niveau)**: 38 kritiske + 55 vigtige + 30 kosmetiske → 30 commits → master ✅
- **Audit v2 (6 dimensioner)**: ~120 fund i UX/Mobile/A11y/Perf/Content/Data → 19 commits → master ✅
- **Audit v3 (pilot-readiness)**: 10 blokkere + 12 vigtige → 13 commits → master ✅

**Total:** ~62 commits, ~220 audit-fund lukket, 697 → 1078+ tests grønne.

---

_Phase N fix-program, 2026-05-15. 1 sequential agent (N1) + 4 parallelle agents (N2-N5)._
