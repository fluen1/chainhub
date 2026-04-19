# ChainHub Page Audit — 2026-04-18

**Metode:** 8-dimension audit pr. side. Se `docs/superpowers/plans/2026-04-18-product-roadmap.md` afsnit 4.
**Anvendt UX-forskning:** HAX 18 guidelines (Amershi 2019), Stephen Few dashboard-principper (2013), Cowan arbejdshukommelse (2010).

**Samlet billede:** ChainHub har i dag et konsistent og modent desktop-design med tydelige etablerede mønstre (single-page detail-sider efter Plan 4C, collapsible grupper, to-linje-rækker og urgency-badges). De to største systemiske huller er (1) totalt fravær af mobile-layout — selve layouten skjuler sidebaren under `lg` og ingen side har sat responsive grid-breakpoints på de tunge two-column splits, (2) `/new`-formularerne er alle bygget med `max-w-xl`/`max-w-2xl` + `p-6`, hvilket efterlader desktop-siden halvt-tom. Empty-states er implementeret meget inkonsistent: rige mønstre på `/persons`, `/cases`, `/tasks` — mens `/documents`, `/companies`, `/contracts` og `/settings` mangler eller har svage varianter. Density-niveauet er generelt godt på list-sider, men `/persons` kort-layout og `/documents` fremstår sparse. Der er ingen grundlæggende strukturproblemer — siderne er næsten alle modne, og arbejdet består i retrofit snarere end refaktorering.

---

## Oversigt

| #   | Side                    | Density    | Mobile     | Empty   | Struktur           | Severity | Anbefaling                            |
| --- | ----------------------- | ---------- | ---------- | ------- | ------------------ | -------- | ------------------------------------- |
| 1   | /companies              | balanced   | missing    | partial | map+list+side      | **high** | responsive grid + tom-totalt empty    |
| 2   | /contracts              | balanced   | missing    | partial | chart+list         | **high** | responsive grid + eksplicit 0-state   |
| 3   | /persons (liste)        | sparse     | needs-work | defined | kort/tabel toggle  | **high** | kort-layout mere info-tæt             |
| 4   | /documents              | sparse     | missing    | missing | filter+liste       | **high** | empty-state + responsive + density    |
| 5   | /settings               | sparse     | needs-work | partial | tabel+form+link    | **high** | user-tabel wrap + AI-kort sektion     |
| 6   | /companies/new          | sparse     | works      | n/a     | form               | **high** | bredere layout, 2-kol felter          |
| 7   | /contracts/new          | sparse     | works      | n/a     | form               | **high** | bredere layout, sektioner             |
| 8   | /companies/[id]         | balanced   | needs-work | partial | 2-col single-page  | **high** | responsive grid (2→1 under lg)        |
| 9   | /tasks/new              | sparse     | works      | n/a     | form               | **high** | bredere layout, 2-kol felter          |
| 10  | /persons/[id]           | balanced   | needs-work | partial | single-page stack  | **high** | responsive grid + kontrakt-vilkår     |
| 11  | /dashboard              | balanced   | missing    | defined | 2-col timeline     | medium   | responsive grid + print stylesheet    |
| 12  | /cases (liste)          | balanced   | needs-work | defined | tabel+gruppering   | medium   | responsive cell-wrapping              |
| 13  | /cases/new              | sparse     | works      | n/a     | form               | medium   | bredere layout                        |
| 14  | /cases/[id]             | balanced   | works      | partial | 2-col single-page  | medium   | 2-col → 1-col under lg (allerede sat) |
| 15  | /tasks (liste)          | balanced   | needs-work | defined | list+kanban+gruppe | medium   | responsive filter-row, kanban scroll  |
| 16  | /tasks/[id]             | balanced   | works      | defined | stacked single     | low      | —                                     |
| 17  | /contracts/[id]         | balanced   | needs-work | partial | tabs + sections    | medium   | responsive terms-grid                 |
| 18  | /persons/new            | sparse     | works      | n/a     | form               | medium   | bredere layout                        |
| 19  | /visits (via /calendar) | balanced   | needs-work | defined | kalender           | medium   | mobile list-fallback                  |
| 20  | /visits/new             | sparse     | works      | n/a     | form               | medium   | bredere layout                        |
| 21  | /visits/[id]            | balanced   | works      | partial | 2-col single-page  | low      | —                                     |
| 22  | /calendar               | balanced   | needs-work | defined | kalender           | medium   | mobile list-fallback                  |
| 23  | /search                 | balanced   | works      | defined | sektioneret liste  | low      | —                                     |
| 24  | /settings/ai-usage      | balanced   | needs-work | defined | dashboard          | low      | responsive widget-grid                |
| 25  | /documents/review/[id]  | overloaded | missing    | n/a     | split-view         | medium   | mobile-split ikke brugbart            |

---

## Detaljer pr. side

### 1. /companies

**Formål:** Porteføljeoverblik — kort over alle lokationer, liste/tabel med health-indikator, right-rail med KPI-oversigt og "Kræver opmærksomhed"-panel.

**Files:** `src/app/(dashboard)/companies/page.tsx` + `src/app/(dashboard)/companies/portfolio-client.tsx`

**Info-density:** balanced. Siden har et højt informationsniveau (map + health-badges + kontraktcount + åbne sager + ownership-pct + omsætning + EBITDA) og bruger Few-principperne godt — critical-first via health-farvede badges (`portfolio-client.tsx:28-35`), tabulære tal via `tabular-nums` (`portfolio-client.tsx:93`).

**Mobile:** missing. `portfolio-client.tsx:516: <div className="grid grid-cols-[1fr_340px] gap-4">` — custom 2-kolonne grid uden `lg:`/`md:` prefix. Map-fallback (`page.tsx:12-19`) har `min-h-[560px]` som vil bryde på små skærme. Right-rail på 340px fast bredde vil klippe ved <1000px viewport.

**Empty states:** partial. Hvis `mapped.length === 0` viser klienten ikke en eksplicit empty-state — map-komponenten rendrer blot tom, og listen vises tom. Sammenlign `/persons:205-230` som har dashed-box-mønster. Mangler "Ingen selskaber endnu — opret dit første" CTA.

**Struktur:** Map+list-split med right-rail. Konsistent med proto. Toggle mellem map og list-view (`portfolio-client.tsx:6` imports `Map`, `List` icons).

**Kognitiv load:** medium. 6-7 datapunkter pr. række — grænser til Cowan 4±1 men mitigeret af health-farve som primary cue.

**Anbefaling:** (1) gør outer grid responsive `lg:grid-cols-[1fr_340px] grid-cols-1`, (2) collapsing right-rail til bunden under tablet, (3) tilføj `totalCount===0` empty-state. Estimat: 3-4 timer.

**Severity:** high (BLK-003 primær manifest her — dette er portfolio-produktets hoved-side).

---

### 2. /contracts

**Formål:** Kontraktregister på tværs af selskaber, med status-derivation (expired/expiring/active), kategori-chips og sort på 5 felter.

**Files:** `src/app/(dashboard)/contracts/page.tsx` + `src/app/(dashboard)/contracts/contracts-client.tsx`

**Info-density:** balanced. Status-encoding sker på 3 niveauer (`contracts-client.tsx:69-75`) via `deriveStatus()` som kombinerer DB-status og `daysUntilExpiry`. Kategori-farver (`contracts-client.tsx:54-62`) understøtter preattentive processing.

**Mobile:** missing. Client returnerer allerede tom-liste når `companyIds.length===0` (`page.tsx:42-44`) men det er ikke samme som "0 kontrakter i systemet". Sortering og kompakt tabelhovedet har ingen mobile-wrap — horizontal scroll vil være eneste udvej.

**Empty states:** partial. Server-side short-circuit giver en tom-client men ikke en CTA. Når kontrakter===0 totalt og der ER selskaber, vises formodentlig en halvtom widget-layout (ikke verificeret i detaljer — inspicér `contracts-client.tsx` fra linje 150+).

**Struktur:** Liste + top-bar med sort-controls og chart (REQUIRED_TYPES matrix `contracts-client.tsx:44-51` viser "hvad hvert selskab SKAL have").

**Kognitiv load:** medium. Good use of sticky-headers og sort-indicators.

**Anbefaling:** (1) eksplicit empty-state når `contracts.length===0 && companies.length>0`, (2) responsive table → card-stack under sm, (3) filter/sort UI collapsing under md. Estimat: 4-5 timer.

**Severity:** high.

---

### 3. /persons (liste)

**Formål:** HR-orienteret personale-oversigt med ansatte/alle-toggle og kort/tabel-toggle.

**Files:** `src/app/(dashboard)/persons/page.tsx`

**Info-density:** sparse i kort-layout. `page.tsx:305: grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` er responsive OK, men kortet selv (`page.tsx:319: p-5`) bruger mange pixel pr. person til lidt information (avatar + navn + rolle + email + telefon + selskaber). Tabel-layoutet (`page.tsx:234-303`) er bedre udnyttet.

**Mobile:** needs-work. Kort-layout er responsive for selve grid, men header-row (`page.tsx:152: flex items-center gap-3`) stabler ikke filter og toggles vertikalt — under 640px vil de 3 elementer (search + layout-toggle + view-toggle) klippe eller wrap uæstetisk. Toggle-links er indlejrede `<Link>` som ikke-knap — ingen tap-target > 44px garanti.

**Empty states:** defined. `page.tsx:205-230` er mønsterkandidaten for hele appen: dashed-border, icon, 2-variant (med filter / uden filter), CTA-knap.

**Struktur:** Liste med dual toggle (layout + view). Pagination (`page.tsx:390-392`).

**Kognitiv load:** low-medium.

**Anbefaling:** (1) kort-layout information-tættere (email som label-ikon, komprimér selskabs-linje), (2) header-row `flex-col sm:flex-row`, (3) toggle-links bliver segmented control med min-height. Estimat: 3-4 timer.

**Severity:** high (sparse density + sub-mobile UX).

**Noter:** Memory-noten "persons mangler kontrakt-vilkår + tabel-view" er delvist adresseret (tabel-view er tilføjet), men kort-view er stadig kandidat til densification.

---

### 4. /documents

**Formål:** Dokumenthåndtering med AI-extraction review-kø, confidence-niveau og status.

**Files:** `src/app/(dashboard)/documents/page.tsx` + `src/app/(dashboard)/documents/documents-client.tsx`

**Info-density:** sparse. Ud fra `documents-client.tsx:1-80` har docs 4 statusser + confidence (høj/mellem/lav) + felt-tælling + attention-fields — men visuel præsentation udnytter ikke dette. Mangler review-prioritet-badge ved siden af navne.

**Mobile:** missing. Ingen responsive prefixes i `documents-client.tsx` outer layout (verificér fuld fil; baseline angiver missing).

**Empty states:** missing. Hverken `page.tsx` eller bundled client har dashed-box-empty-state, hvilket betyder at tomme organisationer får tom hvid canvas.

**Struktur:** Header + filter-pill-row (all/review/processing/archived) + liste.

**Kognitiv load:** low. Kunne bære mere info.

**Anbefaling:** (1) tilføj empty-state komponent som matcher `/persons` mønsteret, (2) `documents-client.tsx` outer grid responsive, (3) højere density — stack attention-badges i liste-rækker. Estimat: 4-5 timer.

**Severity:** high.

---

### 5. /settings

**Formål:** Brugerhåndtering, organisationsstamdata, link til AI-usage.

**Files:** `src/app/(dashboard)/settings/page.tsx`

**Info-density:** sparse. User-tabel har 5 kolonner (`page.tsx:98-104`): Bruger/Rolle/Status/Oprettet/Handlinger — men `px-6 py-3` og `px-6 py-4` gør rækker 72-80px høje; for 5-10 brugere er siden overwhelmingly tom.

**Mobile:** needs-work. Tabel er wrapped i `overflow-x-auto` (`page.tsx:95`) så horisontal scroll virker, men tap-targets på UserActions er små. Header-row `flex items-center justify-between` (`page.tsx:81`) breaker ikke — CreateUserForm knap kan pushe ud.

**Empty states:** partial. Brugerne: `page.tsx:164-170` har "Ingen brugere fundet" — men kun tekst, ikke CTA. Ingen empty-state for ai-usage-kortet (som kun er én link).

**Struktur:** 3 sektioner: Brugere (tabel) → Organisation (form) → System (kort-grid). Konsistent card-layout.

**Kognitiv load:** low.

**Anbefaling:** (1) user-tabel tighter (`py-3` i stedet for `py-4`), (2) mobile: tabel → card-stack, (3) System-sektionen er under-brugt — én link i en 2-col grid efterlader halvdelen tomt (`page.tsx:221: grid gap-3 px-6 py-5 sm:grid-cols-2`). Estimat: 3-4 timer.

**Severity:** high.

---

### 6. /companies/new

**Formål:** Opret nyt selskab.

**Files:** `src/app/(dashboard)/companies/new/page.tsx` (pass-through) + `src/components/companies/CreateCompanyForm.tsx`

**Info-density:** sparse. `CreateCompanyForm.tsx:52: mx-auto max-w-xl` + `p-5` (linje 72, 134) = 576px bred centreret form på en 1280+ canvas. Felterne (`name`, `cvr`, `companyType`, `address`, `city`, `postalCode`, `foundedDate`, `notes`) stables alle én pr. række.

**Mobile:** works. `max-w-xl` + stablet layout er mobile-friendly pr. default.

**Empty states:** n/a.

**Struktur:** Form (single column) med 2 paneler (stamdata + noter). Korrekt konvention pr. Plan 4C's form-mønster (2xl-kandidat).

**Kognitiv load:** low — 8 felter er overskueligt.

**Anbefaling:** `max-w-2xl` eller `max-w-3xl` med 2-kolonne layout for korte felter (cvr/companyType, address/city/postalCode, foundedDate standalone). Estimat: 2-3 timer pr. form × 6 forms = 15-18 timer total.

**Severity:** high (sparse density — produktet ser amatøragtigt ud ved første møde med "opret selskab" som er første interaktion).

---

### 7. /contracts/new

**Formål:** Opret ny kontrakt.

**Files:** `src/app/(dashboard)/contracts/new/page.tsx` + `src/components/contracts/CreateContractForm.tsx`

**Info-density:** sparse. Samme mønster: `max-w-xl`+`p-6 shadow-sm` (`CreateContractForm.tsx:118`). Mange felter (type, parter, datoer, sensitivitet, company, expiry, notes) stables alle — form bliver lang og kræver scroll.

**Mobile:** works.

**Empty states:** n/a.

**Struktur:** Form.

**Kognitiv load:** medium (mange felter, men ét ad gangen er OK).

**Anbefaling:** `max-w-3xl` + sektionsopdeling (stamdata / parter / vilkår / tilknytninger) som 2-kol grids inde i sektioner. Estimat: indgår i samlet 15-18 timers form-densification.

**Severity:** high.

---

### 8. /companies/[id]

**Formål:** Portfolio-detail pr. selskab — ét samlet overblik (Plan 4C).

**Files:** `src/app/(dashboard)/companies/[id]/page.tsx` + `src/components/company-detail/*`

**Info-density:** balanced. 8 sections (ownership / contracts / finance / cases / persons / visits / documents / insight) vises selektivt via `data.visibleSections`. Excellent — følger RBAC + sensitivity pr. section.

**Mobile:** needs-work. `page.tsx:78: grid grid-cols-2 gap-4` uden responsive prefix. På <1024px vil sektioner klippe. AI-insight `page.tsx:106: col-span-2` virker kun når grid er 2-col. max-w-1100 (`page.tsx:27`) er fornuftig desktop-bredde.

**Empty states:** partial. Sections kan skjules hvis `visibleSections` ikke indeholder dem, men når section ER synlig uden data (fx `cases.top === []`), afhænger empty-state af section-komponenten (hver `CasesSection` / `PersonsSection` har egne tomme varianter — ikke auditeret enkeltvis her).

**Struktur:** Single-page stack med 2-kol grid, AlertBanner øverst, header + stamdata-edit, sticky breadcrumb. Perfekt Plan 4C-implementation.

**Kognitiv load:** medium (meget data men sektioneret og labelled).

**Anbefaling:** `page.tsx:78` → `grid grid-cols-1 lg:grid-cols-2 gap-4`. Estimat: 1 time (men skal verificeres at hver section ikke har internal assumptions om width).

**Severity:** high.

---

### 9. /tasks/new

**Formål:** Opret opgave.

**Files:** `src/app/(dashboard)/tasks/new/page.tsx` + `src/components/tasks/CreateTaskForm.tsx`

**Info-density:** sparse. `CreateTaskForm.tsx:52: max-w-xl space-y-6`, `p-6`. Fewer felter (title, description, dueDate, priority, caseId) så mindre akut end `/contracts/new`.

**Mobile:** works.

**Struktur:** Form. Pre-filled via queryparams `caseId` og `dueDate` (`CreateTaskForm.tsx:13-14`) — god UX fra kalender/case-kontekst.

**Kognitiv load:** low.

**Anbefaling:** `max-w-2xl` med dueDate/priority som 2-kol. Estimat: indgår i form-densification.

**Severity:** high (visuel sparse på desktop, men god UX-flow).

---

### 10. /persons/[id]

**Formål:** Person-detail — HR-orienteret med kontrakt-vilkår, ansættelses-historik.

**Files:** `src/app/(dashboard)/persons/[id]/page.tsx`

**Info-density:** balanced. Rig data: stamdata (`page.tsx:148: grid grid-cols-2 sm:grid-cols-4`), aktive tilknytninger + kontrakt-links (`page.tsx:277: grid grid-cols-2 gap-4`), historiske roller, ejerskaber, sager.

**Mobile:** needs-work. `page.tsx:148` OK (har `sm:grid-cols-4`). Men `page.tsx:277: grid grid-cols-2 gap-4` (aktive+ejerskaber) mangler responsive. `page.tsx:196: grid grid-cols-2 sm:grid-cols-4 gap-3` igen — så stamdata er OK, men employment-sections skal fixes. `max-w-4xl` (`page.tsx:106`) er trang desktop-wise.

**Empty states:** partial. `activeRoles.length===0` viser `"Ingen aktive tilknytninger"` som paragraph (`page.tsx:287`). Mangler dashed-box variant.

**Struktur:** Header + stamdata + ansættelses-kontrakter + 2-col (aktive/ejerskaber) + historic + sager. Single-page Plan 4C-konform.

**Kognitiv load:** medium.

**Anbefaling:** (1) `page.tsx:277` → responsive grid, (2) `max-w-4xl` → `max-w-6xl` for at udnytte desktop, (3) kontrakt-vilkår er allerede her (via `cp.contract`) men kunne stå tydeligere. Estimat: 3-4 timer.

**Severity:** high.

---

### 11. /dashboard

**Formål:** Rolle-specifik urgency-first landing med Timeline River + right panels (KPI, health, kalender).

**Files:** `src/app/(dashboard)/dashboard/page.tsx` + `src/app/(dashboard)/dashboard/right-panels.tsx`

**Info-density:** balanced. Timeline-sections + multiple right-panels. Few's urgency-first-princip er hjerteleverance her.

**Mobile:** missing. `page.tsx:33: grid grid-cols-[1fr_320px] gap-5 max-w-[1400px] mx-auto` — custom 2-col uden responsive prefix. Worst offender siden 320px right-rail er fastlåst.

**Empty states:** defined. `page.tsx:40-45` har eksplicit empty-state ("Ingen begivenheder / Din tidslinje er tom lige nu") — god praksis.

**Struktur:** 2-col: timeline + right-rail.

**Kognitiv load:** medium — bevidst urgency-ordering hjælper.

**Anbefaling:** (1) responsive grid → collapse right-rail under lg til bund, (2) print-stylesheet (hidden paneler, print-friendly timeline). Estimat: 3-4 timer mobile + 2-3 timer print.

**Severity:** medium (ikke critical fordi 80% af brugere er på desktop, men alligevel første møde med produktet).

---

### 12. /cases (liste)

**Formål:** Sager-oversigt med gruppering pr. selskab eller flat tabel.

**Files:** `src/app/(dashboard)/cases/page.tsx`

**Info-density:** balanced. Tabel har 5 kolonner inkl. `_count.tasks` badge for åbne opgaver (`page.tsx:229-236`) — god density.

**Mobile:** needs-work. `page.tsx:268: flex items-center justify-between gap-4` har ingen `flex-col sm:flex-row`. Tabel-celler `px-6 py-4` bliver trangt og vil horizontal-scrolle.

**Empty states:** defined. `page.tsx:328-354` eksemplarisk EmptyState-komponent med 2 varianter.

**Struktur:** Filter-row → collapsible groups eller flat tabel. Konsistent med /tasks.

**Kognitiv load:** low.

**Anbefaling:** filter-row responsive + tabel → card-stack under sm. Estimat: 3-4 timer.

**Severity:** medium.

---

### 13. /cases/new

**Formål:** Opret sag.

**Files:** `src/app/(dashboard)/cases/new/page.tsx` + `src/components/cases/CreateCaseForm.tsx`

**Info-density:** sparse. `max-w-2xl` + `p-6 shadow-sm` (`CreateCaseForm.tsx:91-99`). Lidt bedre end `max-w-xl`.

**Mobile:** works.

**Struktur:** Form.

**Anbefaling:** indgår i form-densification. Da den allerede er `max-w-2xl`, er fixet lettere — 2-kol for korte felter.

**Severity:** medium.

---

### 14. /cases/[id]

**Formål:** Sags-detail med tilknyttede selskaber, kontrakter, opgaver, personer, statusflow.

**Files:** `src/app/(dashboard)/cases/[id]/page.tsx`

**Info-density:** balanced. 2-col med hoved-panel (sagsdetaljer+selskaber+opgaver+kontrakter) og side-panel (status-form, personer).

**Mobile:** works. `page.tsx:108: grid grid-cols-1 gap-6 lg:grid-cols-3` — **ENESTE side i /[id]-familien der korrekt bruger responsive grid**. Reference-implementation.

**Empty states:** partial. `page.tsx:166: "Ingen opgaver tilknyttet endnu"` — inline text, ikke dashed box.

**Struktur:** 2-col single-page (Plan 4C). `page.tsx:114: grid grid-cols-2 gap-4` er fast — men kun for stamdata-dl og det er OK under 400px da indhold er kort tekst.

**Kognitiv load:** medium.

**Anbefaling:** inline-empty-states → dashed-box-komponent for konsistens. Estimat: 1 time.

**Severity:** medium.

**Noter:** Denne side er reference for hvordan `/[id]`-sider bør lave responsive grid.

---

### 15. /tasks (liste)

**Formål:** Opgaver med 3 view-modes: flat tidslinje / grouped pr. selskab / kanban.

**Files:** `src/app/(dashboard)/tasks/page.tsx`

**Info-density:** balanced. Flat-view opdeles i "Forfaldne" + "Kommende" (`page.tsx:256-282`). Kanban-view tildeles alle 4 statusser inkl. LUKKET (linje 96-98 kommentaren er belysende).

**Mobile:** needs-work. `page.tsx:168: flex flex-col gap-3 sm:flex-row` — **godt eksempel** på responsive flex. Men view-toggle (`page.tsx:180`) kan klippe og kanban er ikke designet for mobile (3-4 kolonner).

**Empty states:** defined. `page.tsx:218-234` med 2 varianter. Konsistent mønster.

**Struktur:** Header + filter + toggle + conditional rendering efter view.

**Kognitiv load:** medium.

**Anbefaling:** (1) kanban → horizontal-scroll under md, (2) TaskList `hidden sm:block` for statuslabel (`page.tsx:361`) er allerede der — god praksis at følge. Estimat: 2-3 timer.

**Severity:** medium.

---

### 16. /tasks/[id]

**Files:** `src/app/(dashboard)/tasks/[id]/page.tsx`

**Info-density:** balanced. `max-w-3xl space-y-4` (`page.tsx:24`) — smal, men indhold består af stackede sektioner (header, context, description, history, comments) så OK.

**Mobile:** works. Stacked layout uden custom grids er responsive per definition.

**Empty states:** defined (via TaskHistory/CommentSection).

**Struktur:** Stacked single-column. Ikke 2-col men det passer opgave-størrelsen.

**Anbefaling:** ingen. Severity low.

---

### 17. /contracts/[id]

**Files:** `src/app/(dashboard)/contracts/[id]/page.tsx` + `src/app/(dashboard)/contracts/[id]/contract-detail-client.tsx`

**Info-density:** balanced. Key-terms-grid `contract-detail-client.tsx:409: grid grid-cols-2 gap-x-8 gap-y-3`, sektions-header `contract-detail-client.tsx:439: grid grid-cols-[180px_1fr] gap-8`. Rig struktur.

**Mobile:** needs-work. Begge grids mangler responsive prefixes — under lg bliver 180px-label-kolonne for trang og 8px gap for meget.

**Empty states:** partial (afhænger af section — ikke auditeret pr. section).

**Struktur:** Single-page med key-terms-panel, relaterede cases/tasks/documents/contracts, activity-timeline.

**Anbefaling:** responsive terms-grid. Estimat: 2 timer.

**Severity:** medium.

---

### 18. /persons/new

**Files:** `src/components/persons/CreatePersonForm.tsx`

**Info-density:** sparse. `max-w-2xl` + `p-6 shadow-sm` (CreatePersonForm.tsx:41-49).

**Anbefaling:** form-densification (som /cases/new).

**Severity:** medium.

---

### 19. /visits

Bemærk: der er ingen `/visits/page.tsx` — visits-oversigten sker via `/calendar`. Se #22.

---

### 20. /visits/new

**Files:** `src/app/(dashboard)/visits/new/page.tsx` + `src/components/visits/CreateVisitForm.tsx`

**Info-density:** sparse. `max-w-2xl` + `p-6 shadow-sm` (CreateVisitForm.tsx:68-76).

**Mobile:** works.

**Severity:** medium.

---

### 21. /visits/[id]

**Files:** `src/app/(dashboard)/visits/[id]/page.tsx`

**Info-density:** balanced. `page.tsx:56: grid grid-cols-1 gap-6 lg:grid-cols-3` — korrekt responsive. `page.tsx:62: grid grid-cols-2 gap-4` for dl er OK.

**Mobile:** works.

**Empty states:** partial (for notes-section, ikke auditeret).

**Struktur:** 2-col single-page, similar to /cases/[id]. Plan 4C-konform.

**Severity:** low.

---

### 22. /calendar

**Files:** `src/app/(dashboard)/calendar/page.tsx` + `src/components/calendar/full-calendar.tsx`

**Info-density:** balanced. Fuld måneds-kalender med event-dots.

**Mobile:** needs-work. Kalender-grids med 7 kolonner (week) er generelt dårlige under 400px. FullCalendar-komponenten bør have en mobile-list-fallback (agenda-view).

**Empty states:** defined (via FullCalendar internal).

**Struktur:** Kalender-grid med day-klik → side-panel for selectedDay.

**Severity:** medium.

---

### 23. /search

**Files:** `src/app/(dashboard)/search/page.tsx`

**Info-density:** balanced. Resultater sektioneret pr. entity-type (companies/contracts/cases/tasks/persons/documents).

**Mobile:** works. `page.tsx:236: grid grid-cols-2 gap-3` er for QuickAccessPanel og er fint på mobile (2 kort). Resultater er stacked lists.

**Empty states:** defined. `page.tsx:50-58` dashed-icon + "Ingen resultater for ..." — god variant.

**Struktur:** Suspense-wrapped SearchResults + QuickAccessPanel når query < MIN_SEARCH_LENGTH.

**Severity:** low.

---

### 24. /settings/ai-usage

**Files:** `src/app/(dashboard)/settings/ai-usage/page.tsx` + `src/app/(dashboard)/settings/ai-usage/ai-usage-client.tsx`

**Info-density:** balanced. AI-dashboard med cap-status, månedligt forbrug, seneste kald.

**Mobile:** needs-work. Widget-grids er typisk ikke responsive som standard (ikke dybde-auditeret).

**Empty states:** defined (hvis `result.data` tomt håndteres i klient).

**Struktur:** Dashboard-layout.

**Severity:** low.

---

### 25. /documents/review/[id]

**Files:** `src/app/(dashboard)/documents/review/[id]/page.tsx` + `src/app/(dashboard)/documents/review/[id]/review-client.tsx`

**Info-density:** overloaded. Split-view med dokument-preview og felt-review — meget information. `review-client.tsx:503: grid grid-cols-[1.6fr_1fr] gap-4 flex-1 min-h-0` — fast split-ratio.

**Mobile:** missing. Split-view virker ikke på mobile — kræver enten tab-switch eller stacked.

**Empty states:** n/a (site forudsætter gyldigt dokument).

**Struktur:** Split (dokument-preview + felt-liste) + queue-sidebar.

**Anbefaling:** accept at denne side er desktop-only (markér via banner på mobile "brug desktop"), eller byg tabbed mobile-variant. Estimat: 4-6 timer for mobile-variant, 30 min for banner.

**Severity:** medium.

---

## Mønster-findings (cross-cutting)

### 1. BLK-003: Mobile-layout ikke implementeret

**Rod-årsag:** `src/app/(dashboard)/layout.tsx:39: <div className="hidden lg:flex h-full">` skjuler hele sidebaren under lg-breakpointet. Ingen mobile-alternativ (drawer, bottom-nav) findes. Der er heller ingen mobile-header-toggle.

**Hoved-grids uden responsive prefix (citat-liste):**

- `dashboard/page.tsx:33` — `grid-cols-[1fr_320px]`
- `companies/portfolio-client.tsx:516` — `grid-cols-[1fr_340px]`
- `companies/[id]/page.tsx:78` — `grid grid-cols-2`
- `persons/[id]/page.tsx:277` — `grid grid-cols-2`
- `contracts/[id]/contract-detail-client.tsx:409` — `grid grid-cols-2`
- `contracts/[id]/contract-detail-client.tsx:439` — `grid-cols-[180px_1fr]`
- `documents/review/[id]/review-client.tsx:503` — `grid-cols-[1.6fr_1fr]`

**Sider der GØR det rigtigt (reference-mønstre):**

- `cases/[id]/page.tsx:108` — `grid grid-cols-1 gap-6 lg:grid-cols-3`
- `visits/[id]/page.tsx:56` — samme mønster
- `persons/page.tsx:305` — `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- `persons/[id]/page.tsx:148` — `grid grid-cols-2 sm:grid-cols-4` (god tablet-stigning)
- `tasks/page.tsx:168` — `flex flex-col gap-3 sm:flex-row`

**Antal sider påvirket:** 12 af 25 har layout-problem. Sidebar-problemet rammer alle 25.

**Estimat:** 30-40 timer — inkl. mobile-drawer (8 timer), grid-responsive-fix (12-15 timer × 12 sider), tap-target/spacing-review (5-8 timer), kanban og kalender mobile-fallback (5-8 timer).

---

### 2. Empty-states inkonsistent

**Reference-mønster (dashed box + icon + 2 varianter + CTA):**

- `persons/page.tsx:205-230`
- `cases/page.tsx:328-354` (ekstraheret til `EmptyState`-komponent!)
- `tasks/page.tsx:218-234`
- `dashboard/page.tsx:40-45` (mini-variant)

**Svage varianter (kun tekst, ingen CTA):**

- `cases/[id]/page.tsx:167` — `"Ingen opgaver tilknyttet endnu."`
- `persons/[id]/page.tsx:287` — `"Ingen aktive tilknytninger"`
- `settings/page.tsx:164-170` — kun kolonne-tekst

**Mangler totalt:**

- `/companies` — ingen 0-totalt-state på portfolio-client
- `/contracts` — ingen 0-totalt-state (kun 0-companies-short-circuit)
- `/documents` — ingen på list-siden

**Anbefaling:** Ekstrahér `<EmptyState>` fra `cases/page.tsx:328` til `components/ui/empty-state.tsx` og retrofit overalt.

**Estimat:** 12-16 timer (1 time komponent + 1 time × 12 sider + visuel review).

---

### 3. Form-density for lav på /new-sider

**Konsistent anti-pattern:**

- `CreateCompanyForm.tsx:52` — `max-w-xl` + `p-5`
- `CreateTaskForm.tsx:52` — `max-w-xl` + `p-6`
- `CreateContractForm.tsx:118` — implied `max-w-xl` + `p-6`
- `CreateCaseForm.tsx:91-99` — `max-w-2xl` + `p-6`
- `CreatePersonForm.tsx:41-49` — `max-w-2xl` + `p-6`
- `CreateVisitForm.tsx:68-76` — `max-w-2xl` + `p-6`

**Effekt:** På en 1280-1600px canvas efterlades ~60% tom. Selve felterne er alle stackede 1-pr-række, hvilket øger form-scroll og reducerer visuel overview.

**Anbefaling:** Konsolider til `max-w-3xl` (eller `max-w-4xl` for kontrakter) med 2-kol grids for korte felter:

- `cvr | companyType`
- `city | postalCode`
- `dueDate | priority`
- `effectiveDate | expiryDate`
- `noticeDays | terminationDate`

**Estimat:** 20-28 timer (3-5 timer pr. form × 6 forms). Inkluderer Zod-validering-review og visuel balance-check.

---

### 4. Density i list-sider (/persons kort, /documents)

- `persons/page.tsx:319: p-5` kort — kunne reduceres til `p-4` med tighter internal spacing
- `documents-client.tsx` liste-layout er ikke auditeret i fuld, men baseline+visuel inspektion sparse

**Estimat:** indgår i 12-16 timer total density-review.

---

### 5. /settings System-sektion sparse

`settings/page.tsx:221: grid gap-3 px-6 py-5 sm:grid-cols-2` med kun ét link (AI-usage) = halvt-tomt kort. Enten: (a) fyld med flere settings-links (integrations, notifications), (b) kollapsi til single-kol.

---

## Konsistens-vurdering

**Single-page-mønster (Plan 4C):**

- `/companies/[id]`: ✅ — single-page med 2-col sections + AlertBanner + sticky header. Reference.
- `/tasks/[id]`: ✅ — stacked (passer opgave-størrelsen), header + context + description + history + comments.
- `/contracts/[id]`: ✅ — key-terms-grid + related + activity.
- `/cases/[id]`: ✅ — 2-col `lg:grid-cols-3` (reference for responsive).
- `/persons/[id]`: ⚠ — Plan 4C-konform i struktur, men mangler responsive grid + `max-w-4xl` er trangt.
- `/visits/[id]`: ✅ — samme mønster som /cases/[id], responsive.

Mønsteret er modent og konsistent — eneste afvigelse er `max-w` på persons + mangling af responsive prefixes.

**Form-mønster (/new-sider):** ⚠ — konsistent i struktur (`mx-auto max-w-xl/2xl space-y-6` + `form.p-6.shadow-sm.rounded-lg.border`), men for smal canvas-udnyttelse. Stien fremad er bulk-update af width og grid-struktur.

**/settings-subroutes:**

- `/settings` og `/settings/ai-usage` — semi-konsistente. Settings bruger `rounded-lg border bg-white shadow-sm` pr. sektion; ai-usage har egen client med dashboard-stil. Overgangen opleves som et skift.

---

## Prioriteret fix-liste (input til A.3 + A.4)

**Critical** (blokker Gate 1):

- [ ] BLK-003: mobile-drawer + responsive grids (`/companies`, `/dashboard`, `/companies/[id]`, `/persons/[id]`, `/contracts/[id]`)
- [ ] Mobile-header toggle — kræves for at nå sidebar på < lg

**High** (bør med i Gate 1):

- [ ] Form-density på alle 6 `/new`-sider (`/companies/new`, `/contracts/new`, `/tasks/new`, `/cases/new`, `/persons/new`, `/visits/new`)
- [ ] Empty-state komponent ekstraheret + retrofit på `/companies`, `/contracts`, `/documents`, `/settings`
- [ ] `/persons` kort-layout density

**Medium** (polish før kommerciel):

- [ ] `/cases` + `/tasks` list → card-stack under sm
- [ ] `/contracts/[id]` terms-grid responsive
- [ ] `/calendar` mobile-list-fallback (agenda)
- [ ] `/documents/review/[id]` mobile-banner eller tabbed
- [ ] `/settings` user-tabel tightening + System-sektion opfyldning
- [ ] Print stylesheet for `/dashboard`

**Low** (post-launch):

- [ ] `/tasks/[id]` — ingen behov
- [ ] `/visits/[id]` — ingen behov
- [ ] `/search` — ingen behov
- [ ] `/settings/ai-usage` — mindre polish

---

## Implementerings-estimat (input til A.3 + A.4)

| Track                  | Scope                                                                       | Est. timer |
| ---------------------- | --------------------------------------------------------------------------- | ---------- |
| Mobile-layout retrofit | Sidebar-drawer + 12 sider responsive grids + flex-col filters + tap-targets | 30-40      |
| Empty-states           | Ekstrahér komponent + retrofit 12 steder (inkl. svage varianter)            | 12-16      |
| Form-density           | 6 /new-sider + 2-kol layout + width-upgrade                                 | 20-28      |
| Dashboard-finalization | Print stylesheet + panel-tightening + persist view-state                    | 8-12       |
| Konsistens-fixes       | EmptyState-komponent, inline → dashed-box, small UX-details                 | 4-6        |
| **Total**              |                                                                             | **74-102** |

---

## Referencer

- `docs/superpowers/plans/2026-04-18-product-roadmap.md` — UX-principper (afsnit 4)
- `docs/build/CONVENTIONS.md` — design-stil
- `docs/status/BLOCKERS.md` — BLK-003 mobile-navigation
- Stephen Few, "Information Dashboard Design" (2013) — urgency-first, tabular-nums, preattentive processing
- Amershi et al., "Guidelines for Human-AI Interaction" (CHI 2019) — G1 (make clear what system can do), G4 (contextually relevant info), G11 (consequences of actions)
- Cowan, "The Magical Mystery Four" (2010) — working memory capacity 4±1 (grænse for samtidige datapunkter pr. række)
