# ChainHub — Pilot-readiness E2E audit 2026-05-15

**Metode:** Production build (`next build`) + production server (`next start -p 3010`) + 4 parallelle statiske pilot-persona-agents + sekventiel Playwright walkthrough i prod-mode. Branch er post-merge med v2 audit-fixes (commit `941b415`).

**Build-status:**

- ✅ Production build grøn (alle 24 routes kompileret)
- ✅ Bundle-sizes sunde: shared 87.4 kB, tungest route /persons/[id] = 135 kB (under Google's 170 kB-budget)
- ✅ 0 console-errors i prod-mode
- ✅ Dashboard initial load: 251ms (philip@chainhub.dk)

**Total fund:** ~25 nye pilot-relaterede fund. 1 ny prod-bug fanget live (Strip-filter-mismatch).

---

## 🔴 KRITISK — pilot-blokkere

### 1. Strip-KPI "Udløber 30d" filter-mismatch (NY, prod-fanget)

Dashboard tæller "1 Udløber 30d", men klik på Strip-link → `/contracts?status=AKTIV&expiresWithin=30d` viser **0 resultater filtreret fra 18 kontrakter**. Filter-værdien `status=AKTIV` matches sandsynligvis mod display-label ikke enum, og `expiresWithin=30d` parameter er IKKE implementeret i `contracts-list-b.tsx`.

**Live-bevis:** `http://localhost:3010/contracts?status=AKTIV&expiresWithin=30d` → "0 resultater — filtreret fra 18 kontrakter".

### 2. GROUP_FINANCE kan ikke eksportere (kerne use case blokeret)

`prepareExport()` i `src/actions/export.ts:26` kræver `canAccessModule('settings')` som kun GROUP_OWNER/GROUP_ADMIN har. Lars (finance) kerne-flow er "kvartalsrapport-eksport" — han kan se finansdata men ikke eksportere det. UI viser knappen, men action returnerer toast error.

### 3. ActivityPanel header "seneste 24 timer" er ikke sand

`activity-feed.ts:70-86` `getRecentActivity` har INGEN `created_at WHERE`-klausul. Returnerer altid de 10 nyeste events uanset alder. Mandag morgen kan listen indeholde events fra forrige uge. Philip ser misvisende prioritering.

### 4. `/api/users-list` mangler rolle-gate

Endpoint har kun `auth()`-check. Alle authentificerede brugere i org kan liste alle kollegaer (navn + ID). Ikke crash, men RBAC-læk. Bruges af EditTaskDialog + EditCaseDialog (begge OK use cases) men ikke begrænset.

### 5. EditCaseDialog sensitivity-dropdown uden server-validering

Maria (GROUP_LEGAL) kan ændre case-sensitivity til STRENGT_FORTROLIG uden at server validerer hun har ret til at _sætte_ niveauet. `updateCase` action bør tilføje `canAccessSensitivity` check på input-sensitivity.

### 6. /companies/[id] mangler AlertBar når healthStatus=critical

Philip klikker rød heatmap-celle → company-detail-side → kritisk-status er kun synlig via Strip + Sager-panel scroll. Ingen `<AlertBar tone="red">` med "Selskabet er kritisk: X forfaldne opgaver / Y åbne sager". Brugeren skal scrolle for at finde årsagen.

### 7. Dashboard Strip-cells ikke rolle-filtreret

"Åbne sager" + "Dokumenter"-celler vises altid på dashboard, også for GROUP_FINANCE. Klik for finance → /cases redirecter → /dashboard. Dead affordances.

### 8. `documentsCount` + `personsCount` i sidebar/dashboard ikke company-scoped

`sidebar-data.ts` + `dashboard.ts` tæller `prisma.document.count` og `prisma.person.count` med kun `organization_id`-filter — ikke `company_id IN companyIds`. Tæller alle dokumenter/personer i org uanset bruger-scope.

### 9. Onboarding-flow er ikke wired

`src/actions/onboarding.ts` returnerer `shouldShow: boolean` men kaldes aldrig fra page-komponent. Mette (ny bruger) ser intet onboarding-CTA. 4 tomme paneler simultant uden retning.

### 10. Kanban kollapser til 1 kolonne uden navigation på mobile

`KanbanView` har `lg:grid-cols-4` der falder til 1 kolonne på <1024px. Ingen tab-bar/swipe-gesture mellem 4 statusser. Philip ser én kolonne ad gangen + skal scrolle gennem alle 4 lodret.

---

## 🟡 Vigtige fund

### Onboarding (Mette)

- `/companies/new` bruger `canAccessModule('settings')` — inkonsistent med list-page som accepterer GROUP_LEGAL
- `CreateContractForm` har silent `catch(() => {})` på `/api/companies-list` fetch — bruger sidder fast hvis API fejler
- `CreateContractForm` med 0 selskaber: select-dropdown blank uden CTA til `/companies/new`
- CVR mangler client-side regex/length-validering (kun server)
- `CreateUserForm` ikke B-stil (visuelt brud i settings)
- Rolle-dropdown viser 8 enum-navne uden tooltip/forklaring
- Sensitivity-låsning på EJERAFTALE viser "STRENGT_FORTROLIG" som rå enum hint

### Daily kædeleder (Philip)

- /cases/[id] har ingen inline StatusPill (3 klik for NY→AKTIV vs 2 for tasks)
- `UrgencyPanel` viser `section.label.split(' ')[0]` → "Denne", "Forfaldne", "Næste" som akrymatiske labels
- ActivityPanel events er ikke klikbare links til ressourcen
- "Omsætning YTD" Strip-celle har ingen `href` (inkonsistent med 5 andre)
- task-detail "+ Tilknyt" knap har stadig ingen onClick
- `⌘+Enter` shortcut for comment-submit er implementeret men ikke synligt i UI

### Legal (Maria)

- ExportButton vises for alle roller men virker kun for admin (UX-misvisende)
- Ingen real-time notification ved kollega-actions på samme sag
- Ingen bulk-select (kendt udskudt)
- Ingen "send til kollega til review"-flow

### Finance (Lars)

- FinanceSection mangler peer-benchmark + multi-år trendgraf
- Ingen aggregeret finansview (total EBITDA, samlet margin, underperforming-count på portefølje)
- `underperformingCount` beregnes i backend men eksponeres ikke i UI
- Ingen audit-log-side for compliance-self-service

### Mobile (Philip på 375px)

- Calendar month-view 7-kolonne grid squished (53px pr. celle) — kendt udskudt
- Ingen automatisk fallback til agenda-view ved `<md`
- Kanban touch drag-drop virker ikke (kendt udskudt)
- BModal `style={{width:480}}` + Tailwind `max-w-[calc(100vw-16px)]` — potential inline-vs-class konflikt på iOS

---

## 🟢 Kosmetiske / nice-to-haves

- Onboarding-flow: tour, video, sample-data templates
- Bulk-forny flow ("Forny alle udløbende inden XX")
- Kontrakt-templates / klausul-library
- Peer-comparison på finance-niveau
- Saved searches på lister
- Customizable dashboard (drag panels)
- Mobile quick-action floating button

---

## Bekræftet OK i prod-mode (audit-fixes v1+v2 holder)

| Fix                                        | PROD-verifikation                                 |
| ------------------------------------------ | ------------------------------------------------- |
| Dashboard load-time                        | 251ms                                             |
| 0 console-errors                           | ✅ alle testede routes                            |
| Strip-KPIs klikbare                        | ✅ 5 cells med href (alle undtagen Omsætning YTD) |
| ActivityPanel default åben                 | ✅ `▾` arrow vises                                |
| "automatisk opdatering" dansk              | ✅ engelsk-rest fjernet                           |
| Kommentar på /cases/[id] gemmes + renderes | ✅ med forfatter + dato + Slet-knap               |
| EditCaseDialog `Ansvarlig`-felt            | ✅ 7 felter inkl. assignedTo                      |
| BModal `<h2>` + useId                      | ✅ unikke IDs (`:r1:` osv.)                       |
| ContractStatusButton ARIA                  | ✅ aria-haspopup="listbox" + aria-expanded        |
| Mobile 375px ingen overflow                | ✅ doc-width = viewport                           |
| Hamburger 44px                             | ✅ h-11 w-11 på mobile                            |
| TableWrap overflow-x: auto                 | ✅                                                |
| FilterRow flex-wrap                        | ✅                                                |

---

## Anbefalet fix-rækkefølge (Phase N)

Hvis et yderligere fix-program startes, prioritér disse 10:

1. Fix Strip-filter-mismatch (`expiresWithin=30d` + `status` enum-mapping) på `/contracts`
2. Open GROUP_FINANCE export-access (særskilt action eller udvid `canAccessModule`)
3. Tilføj `created_at >= 24h ago` filter på `getRecentActivity` (matcher panel-header)
4. Tilføj rolle-gate på `/api/users-list` (mindst GROUP_ADMIN+OWNER kan se alle)
5. Server-side sensitivity-validering i `updateCase` (canAccessSensitivity på input)
6. AlertBar når healthStatus=critical på `/companies/[id]`
7. Rolle-filtrér Strip-cells på dashboard (skjul "Åbne sager" for finance)
8. Scope `documentsCount`/`personsCount` på `company_id`
9. Implementér onboarding-UI (action eksisterer allerede)
10. Mobile Kanban: enten dnd-kit for touch-drag ELLER tab-bar mellem kolonner

**Estimat:** ~3-4 dage hvis kørt som parallelt agent-program.

---

## Resterende fra v2-audit (stadig udskudt)

- Mobile Kanban touch drag-drop (kræver dnd-kit)
- Calendar agenda default på `<md`
- Bulk-select på lister
- Onboarding-UI komponent (relateret til #9)
- `company-insights.ts` "2025" hardcode
- `getSettingsAIUsage` fuld konsolidering

---

_Pilot-readiness E2E audit, prod-build verificeret, 4 personas + live Playwright, 2026-05-15._
