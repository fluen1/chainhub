# ChainHub — 6-dimensions audit 2026-05-15

**Metode:** Parallel statisk audit via 6 Explore-agents (UX flows, Mobile/responsive, A11y WCAG 2.2 AA, Performance, Content/copywriting, Data integrity). Hver agent leverede ~600 linjer detaljerede fund. Rapporten her er prioriteret syntese på tværs af dimensioner.

**Baseline:** Branch er post-merge med 30 audit-fixes (commit `f75498e`). 898 tests grønne. Build grøn.

**Total fund:** ~120 nye fund fordelt på 6 dimensioner. Mange er systematiske (samme bug ramt 8-10 steder pga. delt komponent).

---

## 🔴 KRITISK — pilot-blokkere (top 15)

Disse skal lukkes før pilot kan starte:

### Data integrity / sikkerhed

1. **`prisma/schema.prisma` Company.cvr mangler `@@unique([organization_id, cvr])`** — race-condition kan skabe CVR-duplikater. Application-level check i `createCompany` er ikke nok. (Data)

2. **`src/actions/ownership.ts` addOwner mangler sum-tjek i transaction** — to samtidige kald med 60% hver vil begge validere og oprette → samlet 120%. Skal være SELECT FOR UPDATE + SUM-check inden insert. (Data)

3. **Cascading soft-delete eksisterer ikke** — `deleteCompany` sætter kun `Company.deleted_at`. Selskabets `Contract`/`Case`/`CompanyPerson` forbliver synlige i `/contracts`, `/cases`-lister (de filtrerer kun på egen `deleted_at`). Skal enten cascade eller filtrere lister på selskabets `deleted_at`. (Data)

4. **`resource_company_id` ikke udfyldt i Phase B audit-events** — alle `recordAuditEvent`-kald i `cases.ts`, `comments.ts`, `ownership.ts` osv. sender ikke det nye felt. Activity Feed RBAC-scope fra Phase A virker derfor kun via null-fallback — alle events leakes som "ikke-scoped". (Data)

5. **`Comment` bruger hard delete** — `deleteComment` kalder `prisma.comment.delete` (hard). Bryder CLAUDE.md-regel "Aldrig hard delete" + mister historik. Skal være `update({ deleted_at: new Date() })`. (Data)

### UX-blokkere

6. **Kommentarer fetches IKKE fra DB på `/cases/[id]`** — `case-detail-b.tsx:27` importerer `createCaseComment` og brugeren skriver + klikker "Gem" → kommentaren skrives → `router.refresh()` — men `page.tsx:30-63` henter ikke comments fra Prisma. Kommentaren forsvinder visuelt fra UI selvom den er gemt. Brugeren tror data er tabt. (UX)

7. **`EditCaseDialog` mangler `assignedTo`-felt** — `updateCase` action understøtter det (`cases.ts:329,373`), men UI ekspoenerer ikke feltet. GROUP_LEGAL kan ikke reassigne sager fra UI. (UX)

8. **`/dashboard` Strip-KPI-tal er ikke klikbare** — Strip-cells siger "5 udløber 30d" men har ingen `href`. Dead affordance. Plus: tallet er beregnet på 14 dage (`twoWeekEnd` i `dashboard.ts:53,110`), labelen lover 30d. **Mismatch label/data.** (UX)

### Mobile-blokkere

9. **`BModal` 9 modaler overflower på 375px** — hardcoded `style={{ width: 480 }}` i BModal.tsx. Alle 9 nye edit-modaler arver problemet (EditCase, EditTask, EditPerson, EditContract, EditStamdata, CloseCase, AddPersonRole, AddPersonOwnership, AddContractParty). Fix: `max-w-[calc(100vw-16px)] w-full` på dialog-container. (Mobile)

10. **`FilterRow flex-nowrap` overflow på 6 list-pages** — companies/contracts/cases/tasks/persons/documents lister bruger `FilterRow` med `flex flex-nowrap overflow-visible`. På 375px med 5+ filter-elementer forsvinder filtrene ud af viewport. Fix: `flex-wrap gap-y-1.5`. (Mobile)

11. **`FlatTable` mangler `overflow-x-auto`** — TableWrap bruger `overflow-hidden` i stedet for `overflow-x-auto`. Tabeller med 7-9 kolonner og samlede bredder 600-940px er ubrugelige på 375px. (Mobile)

12. **Tasks Kanban native HTML5 drag-drop virker IKKE på touch** — `draggable`/`onDragStart`/`onDrop` er mouse-baseret. iOS Safari + Android Chrome understøtter det ikke nativt. Brugere på mobile kan ikke flytte tasks i kanban — kun via keyboard. (Mobile)

### A11y-blokkere

13. **`BFieldWrap` mangler `htmlFor`/`id`-kobling** — `<label>` peger ikke på `<input>` i `src/components/ui/b/BField.tsx:22-37`. ALLE form-felter i ALLE modaler arver dette problem. Screen-reader læser ikke label ved fokus på input. axe-core `label`-regel fejler. Plus: `aria-required`/`aria-invalid`/`aria-describedby` mangler. (A11y)

14. **`BModal` duplikat `titleId="b-modal-title"`** — alle BModal-instanser uden eksplicit `titleId` bruger samme statiske ID. Når to modaler er åbne giver ARIA ID-kollision. Fix: `useId()`. (A11y)

15. **Kontrast: `text-b-2` (#6e7681) på `b-canvas` (#fafafa) = 4.3:1** — fejler WCAG 4.5:1 AA-krav for brødtekst. Bruges i alle BField-labels, alle DataTable `secondary`-celler, PageHeader meta-linjer. Plus: `text-slate-400` i `DeleteDocumentButton.tsx:85` = 2.6:1 (fejler markant). (A11y)

---

## 🟡 Vigtige fund (samlet pr. dimension)

### UX-friktion

- **ActivityPanel lukket pr. default på dashboard** — første ting brugeren ser mandag morgen er INGEN aktivitet. Skal være åben default.
- **HeatmapPanel viser top-3 selskaber, ingen "Se alle kritiske"-link** — bruger med 15 kritiske selskaber ser kun 3.
- **`ContractStatusButton` klik på OPSAGT/UDLOEBET-status gør INGENTING synligt** — note-felt vises ikke før klik. Brugeren tror knappen er defekt.
- **Ingen bulk-operations nogen steder** — 8 udløbende kontrakter = 32 klik for at forny dem. Companies/contracts/cases-lister har ingen checkbox-select.
- **`CreateVisitForm` ingen recurring/template + redirecter til /calendar efter opret** — 3 besøg = ~15 klik (skal navigere tilbage hver gang).
- **`fetchCompaniesForExport` mangler finansdata** — GROUP_FINANCE kan ikke eksportere EBITDA/Omsætning. Kolonner: id, name, cvr, address, city, postal_code, founded_date, created_at.
- **`yoy_pct` beregnes i backend men vises IKKE i UI** — `company-detail.ts:79,620-621` har YoY-data, `company-detail-b.tsx:500-536` viser kun seneste år.
- **`deleteComment` action implementeret men aldrig kaldt fra UI** — ingen "Slet"-knap på kommentarer.
- **⌘K hints i BottomBar overalt, kun /search implementerer det** — alle andre er ghost-labels.
- **AlertBar "Start forny-flow"-knap på contracts/[id] peger på `/tasks/new?contract=`** — det opretter en opgave, men kaldes "forny-flow". Vildledende.
- **`/cases/[id]` Eskalér-knap kun synlig ved `data.isUrgent` (frist ≤3d)** — GROUP_LEGAL kan ikke eskalere før det er kritisk.
- **`/visits/new` ingen validering på fortidig dato** — server accepterer historiske besøg stiltiende.

### Mobile-issues

- **Hamburger-knap `h-8 w-8` (32px)** — under 44px iOS/Google-minimum (`b-shell.tsx:119`).
- **BButton `py-1` (~27px)** — primary action-knapper underdimensionerede for touch.
- **Kalender prev/next-knapper `py-0.5` (~22px)** — meget lille tap-target.
- **Document-review side-by-side `grid-cols-[1.6fr_1fr]` uden breakpoint** — på 375px bliver PDF-panel ~225px, ulæseligt (`review-client.tsx:562`).
- **Strip 6-cells inline grid-template-columns** — på 375px ~60px pr. celle, "Omsætning YTD" og "Udløber 30d" trunkerer aggressivt.
- **P2-1 (calendar agenda-list) + P2-3 (cases/tasks mobile card-stack)** — stadig huller. Default view på calendar er month-grid som er ulæseligt; agenda-view eksisterer men er ikke default på `<md`.
- **CalendarPageHeader actions kan overlappe title** — ingen flex-wrap.
- **Login vis/skjul password tap-target ~24px** — under 44px.

### A11y-issues

- **`ContractStatusButton` dropdown mangler keyboard-luk + `aria-expanded`/`aria-haspopup`** — keyboard-brugere sidder fast i åben dropdown.
- **`GroupedView` gruppe-toggle mangler `aria-expanded`/`aria-controls`** (`tasks-list-b.tsx:565`).
- **`aria-grabbed` deprecated i ARIA 1.2** — axe-core flagger Kanban-implementeringen. Skal være `aria-selected` + `role="option"` pattern.
- **`BModal` dialog-titel er `<div id={titleId}>`, ikke `<h2>`** — heading-hierarki brydes når modal åbner.
- **Ingen `prefers-reduced-motion` support nogen steder** — alle `animate-spin`, transitions kører uafhængigt.
- **Color-only meaning på tasks-list-b PageHeader meta** — `text-b-red-fg` for "X kritiske" uden ikon/tekst-differentiering.
- **Heatmap-celler kommunikerer kun via baggrundsfarve** — ingen `aria-label` med tekstuel status.
- **GdprPanel fejl-`<p>` mangler `role="alert"`** — screen-reader annoncerer ikke "navn matcher ikke".
- **BModal close-button `h-7 w-7` (28px)** — AAA 44px-anbefaling. AA-kompatibel.
- **`text-b-3` (#8c959f) på `b-panel` = 3.3:1** — fejler 4.5:1 hvor det bruges som sekundær brødtekst (ikke kun placeholder).

### Performance-issues

- **`leaflet-map.tsx` (~150kB) statisk-imported i `company-detail-b.tsx`** — bundle i company-detail route uden grund. Map vises kun ved koordinater. `next/dynamic` med `ssr: false`.
- **`GdprPanel` statisk-imported i `person-detail-b.tsx`** — kun admin ser den, men bundlet for alle. `next/dynamic`.
- **`AuditLog` mangler compound index `[organization_id, resource_company_id, created_at]`** — `getRecentActivity` rammer det på hvert dashboard-load.
- **`getAccessibleCompanies` kaldes 3 gange per dashboard-load** (dashboard, sidebar, activity-feed). Refaktor til at resolve én gang og pass ned.
- **`getSidebarData` kaldes 2 gange per dashboard-request** (layout + page). Brug `cache()` fra react eller pass som prop.
- **`createCase` sekventiel `canAccessCompany` i `for...of`-loop** — bør være `Promise.all`.
- **`getSettingsAIUsage` duplikerer `organizationAISettings.findUnique`** — første kald via `getCostCapStatus`, andet direkte.
- **R2 presigned URLs udløber efter 1 time** — risiko for broken document-links ved lange sessioner. Øg TTL til 24h eller refresh on-demand.
- **`User[last_login_at]` mangler index** hvis B6-use-case sorterer.
- **`CompanyPerson[organization_id, person_id, end_date]` mangler** for "aktive roller"-queries.

### Content/copywriting

- **Rå enum vist til bruger** — `companies-list-b.tsx:148`: "Bed en **GROUP_OWNER** eller **GROUP_ADMIN** om at oprette det første selskab." Skal være "kædeejer eller administrator".
- **"GDPR Art. 15" / "GDPR Art. 17" som knap-labels** — for juridisk. "Eksportér persondata (GDPR)" + "Slet persondata permanent".
- **Engelsk-rester (mange):** `auto-refresh on`, `soft-delete`, `via UI`, `cost-cap`, `extractions`, `AI-kald`, `renewal-risk`, `processeret`, `via UI`, `TOTP`, `SAML 2.0`, `tier`.
- **$USD-beløb vist til danske brugere** — `settings-b.tsx:398`: "90% af cost-cap brugt (${currentUsd} / ${capUsd} USD)".
- **Decimal-separator i placeholders bruger punktum** — `33.33`, `50.00`, `5000000` (`AddOwnerForm.tsx:114`, `AddPersonOwnershipModal.tsx:118`, `AddMetricForm.tsx:132`). Skal være `,` per da-DK.
- **`formatMio` returnerer rå streng med punktum** — `28.5m` i stedet for `28,5 mio. kr.`
- **"Ikke autoriseret" + "Ingen adgang" + "Ugyldigt input"** — generiske fejlbeskeder, ikke actionable. ~25 sites.
- **`Ugyldig statusændring: ${case.status} → ${newStatus}`** eksponerer rå Prisma-enums til brugeren.
- **Empty-states for korte** — `<PanelEmpty>Ingen ejere registreret</PanelEmpty>` på 6 sites. Skal have `title` + `hint` med CTA.
- **GdprPanel: "Denne handling er uomkørbar"** — ikke naturlig dansk. Skal være "kan ikke fortrydes".
- **Email-template mangler GDPR-afmeld-link** — juridisk påkrævet for uopfordret email i DK.
- **"AKTIONAERLAAN" stavet "AKTINONAERLAAN" i labels.ts** — label-lookup matcher aldrig Prisma-enum.
- **Onboarding-action returnerer `shouldShow: boolean` men ingen UI-komponent rendrer panelet** — feature er kun action-laget.
- **Annuller vs Annullér** — begge former i kodebasen. Vælg én (anbefaling: Annuller).

### Data integrity

- **`Ownership` har ingen `deleted_at`** — `endOwnership` sætter `end_date` men ejerskabet vises altid. Historiske roller filtreres ikke.
- **`CompanyPerson` har ingen `deleted_at`** — samme mønster.
- **`ContractVersion` mangler `deleted_at`** (men ContractAttachment har det).
- **8 routes mangler `error.tsx`** — `/contracts`, `/contracts/[id]`, `/cases`, `/cases/[id]`, `/persons`, `/persons/[id]`, `/documents`, `/settings`, `/calendar`, `/search`. Uventet Prisma-fejl bobler til `global-error.tsx`.
- **`deleteCase`, `deleteTask`, `deleteCompany`, `deletePerson` mangler audit-log entries**.
- **`createCaseSchema.description/notes` mangler `max`-validering** — bruger kan sende 1MB string.
- **`activity-feed.ts` user-lookup mangler `organization_id`-filter** (Phase A's fix var ufuldstændig).
- **`lib/export/gdpr.ts` ownership-query mangler `organization_id`**.
- **`contracts.ts` max 100 kontrakter per fetch** — client-filtre arbejder på subset uden UI-advarsel. Bryder ved 150+ kontrakter.
- **`company-insights.ts` hardkoder årstal "2025"** — stale fra 2026 (vi er pt. 2026-05-15).
- **`CompanyInsightsCache` invalideres ikke ved `deleteCase`/`deleteTask`**.
- **`revalidatePath` mangler i `deleteCase` for `/cases/${caseId}` + `deleteTask` for case-detail**.

---

## 🟢 Kosmetiske fund (top udvalg)

- **"Sensitivitet" som UI-term er anglicisme** — "fortrolighedsgrad" eller "klassifikation" er mere dansk. Men nu etableret som terminologi.
- **"Klient" i `AFVENTER_KLIENT`** — "klient" er juristsprog. "Afventer selskab" matcher resten.
- **`formatDateShort()` "15/1-25" inkonsistent med fuld "15. jan. 2025"** — vælg én.
- **Procent uden mellemrum** — "45%" vs dansk standard "45 %".
- **Manglende seed-data** — 0 sager i NY/AFVENTER\_\*/ARKIVERET status, 0 Comments, 0 Visits, 0 TaskHistory, ingen orphan-person, ingen tom-finance-selskab.
- **`AIInsightCard` kunne være server component** (har ingen state/hooks).
- **B-stil Strip-celle "Ansvarlig: [navn]"** på case-detail — tekst i tal-plads, visuelt malplaceret.
- **HeatmapPanel ved 0 selskaber: "Ingen selskaber i porteføljen endnu"** — ingen onboarding-link.

---

## Tværgående mønstre

### Mønster 1: Systematiske komponent-fejl rammer mange call-sites

- `BFieldWrap` `htmlFor`-bug → påvirker ALLE form-felter i ALLE modaler
- `BModal` `titleId`-bug → påvirker alle 9 nye modaler
- `FilterRow` `flex-nowrap` → påvirker 6 list-pages
- `FlatTable` `overflow-hidden` → påvirker 6 list-pages
- Fix EN komponent → fix mange call-sites.

### Mønster 2: Beregnet data uden UI-eksponering

- `yoy_pct` beregnes men vises ikke
- Aggregeret finance per portefølje beregnes men vises ikke
- Onboarding-action returnerer data men UI er ikke implementeret
- Strip-KPIs har data men er ikke klikbare

### Mønster 3: Phase B audit-events ikke fuld-utilfyldte

- `resource_company_id` nyt felt fra Phase A, ikke udfyldt i nye Phase B actions
- Activity Feed RBAC virker derfor kun via fallback
- Eksisterende audit-events fra Phase A bør backfilles

### Mønster 4: Bulk-operations ikke implementeret nogen steder

- Mest klik-friktion stammer fra 1-at-a-time-pattern
- Kontrakter, sager, opgaver: ingen multi-select
- /visits/new: ingen "Opret kvartalsbesøg for alle selskaber"

### Mønster 5: Engelsk-rester + jargon synligt for brugere

- `cost-cap`, `extractions`, `AI-kald`, `soft-delete`, `processeret`
- "GROUP_OWNER" enum-værdier i UI-tekst
- Decimal-separator med punktum (engelsk standard)

---

## Anbefalet fix-rækkefølge

### Fase H — Data integrity + sikkerhed (pilot-blokkere)

**Estimat: 1-2 dage**

- `Company.cvr` unique constraint
- `addOwner` sum-check transaction
- Cascading soft-delete på 4 entiteter
- `resource_company_id` udfyldelse i Phase B audit-events + backfill seed
- `Comment.deleted_at` soft-delete (i stedet for hard)
- Manglende audit-log: deleteCase, deleteTask, deleteCompany, deletePerson
- 8 manglende `error.tsx` routes
- Max-length Zod på description/notes

### Fase I — Mobile responsive (P2-1, P2-3, modaler)

**Estimat: 2-3 dage**

- BModal `max-w-[calc(100vw-16px)]` (fixer 9 modaler ad gangen)
- FilterRow `flex-wrap` (fixer 6 list-pages)
- TableWrap `overflow-x-auto` (fixer 6 list-pages)
- Document-review breakpoint
- Tasks Kanban touch drag-drop (touch-events eller library som dnd-kit)
- Calendar agenda-view default på `<md`
- Cases/tasks mobile card-stack
- Hamburger 32→44px + tap-targets på buttons

### Fase J — A11y WCAG 2.2 AA komplet

**Estimat: 1-2 dage**

- `BFieldWrap`: `useId()` for label/id-kobling + aria-required/invalid/describedby (én fix → mange call-sites)
- `BModal`: `useId()` for titleId + `<h2>` i stedet for `<div>`
- Kontrast: `text-b-2` op til ≥4.5:1, `text-slate-400` op til `text-slate-600`
- `ContractStatusButton`: keyboard-luk + ARIA-attributes
- Erstat `aria-grabbed` med ARIA 1.2-pattern
- Heatmap-celler: `aria-label` med status-tekst
- `prefers-reduced-motion` på animations

### Fase K — UX-funktionalitet

**Estimat: 2-3 dage**

- Wire kommentarer til DB-fetch på /cases/[id] + deleteComment UI
- EditCaseDialog: tilføj `assignedTo`-felt
- Strip-KPIs klikbare med rigtige links + "Udløber 30d" fix data/label-mismatch
- ActivityPanel åben default på dashboard
- ContractStatusButton OPSAGT/UDLOEBET note-felt synligt
- "Se alle kritiske"-link fra HeatmapPanel
- Bulk-select på companies/contracts/cases-lister
- CreateVisitForm "Opret endnu ét"-flow
- `fetchCompaniesForExport` udvid med finansdata + YoY-kolonner
- Vis `yoy_pct` i FinanceSection
- ⌘K kommandopalette ELLER fjern hints overalt

### Fase L — Performance optimeringer

**Estimat: 1 dag**

- `next/dynamic` på leaflet-map (-150kB)
- `next/dynamic` på GdprPanel
- AuditLog compound index
- Konsolidér `getAccessibleCompanies` (1x i stedet for 3x)
- `cache()` på `getSidebarData`
- `createCase` Promise.all
- `getSettingsAIUsage` konsolidér queries
- R2 URL TTL 1h→24h

### Fase M — Content + copywriting + email

**Estimat: 1 dag**

- Rå enum "GROUP_OWNER" → "kædeejer" (USER_ROLE_LABELS)
- Engelsk-rester: cost-cap → kvota, extractions → analyser, soft-delete → arkiveret, processeret → behandlet, renewal-risk → fornyelsesrisiko
- $USD → DKK i settings
- Decimal-separator i placeholders: . → ,
- `formatMio` → komma + " mio. kr."
- Fejlbeskeder: actionable formuleringer (~25 sites)
- Empty-states: title + hint pattern på 6 sites
- Email-template GDPR-afmeld-link
- "AKTINONAERLAAN" → "AKTIONAERLAAN" stavefejl
- "uomkørbar" → "kan ikke fortrydes"
- Annuller vs Annullér: vælg én
- Onboarding-UI-komponent implementér eller fjern action

---

## Fase 2 — Playwright-verifikation (efter fixes)

Som forrige audit-runde anbefales runtime-verifikation af top 10 kritiske fund når Fase H-M er gennemført. Specielt:

- Modaler på 375px viewport
- BFieldWrap label-association via screen-reader
- Strip-KPIs faktisk klikbare
- Kommentarer rendres efter Gem
- Bulk-operations virker
- $USD ikke vises

---

_6 parallelle Explore-agents, 2026-05-15._
