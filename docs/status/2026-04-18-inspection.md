# Visuel inspektion — 2026-04-18

## Kontekst

Efter commit af 3 WIP-commits (labels, persons HR, kalender) kørte jeg dev-serveren og gennemgik centrale sider med Playwright.

## Fund

### Grønt

- `/login` → `/dashboard` loginflow virker
- `/dashboard` renderer urgency, KPI-header, heatmap uden fejl
- `/persons?layout=tabel` — NY tabel-toggle virker, 6 resultater, avatar-initialer, rolle-filter har alle 14 enum-options
- `/persons/[id]` — NY "Ansættelseskontrakter"-sektion prominent øverst med kontrakt-link, selskab, rolle, ansættelsestype, status-badge, ikrafttrædelse, opsigelsesvarsel. Virker på Anders Jensen (Direktørkontrakt, 180 dage opsigelse, 1. jan. 2020).
- `/calendar` — NY event-filter persister i URL (`?hide=expiry`), dags-valg persister (`?day=18`), accessibility korrekt (grid + gridcell + aria-selected)
- `/calendar?day=18` — Quick-add UI renderer korrekt: "Ingen events denne dag", "Opret på denne dag"-sektion med "Ny opgave" + "Nyt besøg"-link (med `?visitDate=2026-04-18`)
- `/companies/[id]` (Plan 4C single-page) loader uden fejl
- `/tasks` — legacy-layout: "Forfaldne (6)" + "Kommende (2)" sektioner med basis søge/filter-række
- Ingen console errors på nogen af besøgte sider
- Sidebar-counts: Selskaber 7 · Kontrakter 18 · Sager 4 · Opgaver 6 · Dokumenter 8 · Personer 10
- Header KPIs: Selskaber 7 · Udløbende 0 · Sager 4 · Forfaldne 6 · Omsætning 28.6m

### Gult

- **Pre-existing test-failures (8)**: Ikke forårsaget af WIP. Tests ude af synk med UI-tekst:
  - `finance-section.test.tsx` — forventer "Ingen oekonomi-data for 2025", UI viser "Ingen økonomi-data registreret for 2025"
  - `heatmap-grid.test.tsx` — 3 failures på sort-order, openCaseCount dot, cap ved 15
  - `calendar-widget.test.tsx` — tom-state text
  - `cases-section.test.tsx` — tom-state text
  - `company-header.test.tsx` — health-dimensions count
  - `app-header.test.tsx` — placeholder-tekst "Søg efter"
  - Handling: tilføj til tech-debt, fix separat — ikke blocker.
- **Seed-data for HR**: kun DIREKTØR-roller. Ingen MEDARBEJDER/FUNKTIONÆR/VIKAR til at teste rolle-filter visuelt. Kan kræve seed-udvidelse.

### Rødt

- Ingen.

## Plan 4D — næste skridt

`/tasks` + `/tasks/[id]` rewrite er den mest værdifulde næste opgave:

- Dækker Plan 4D-item OG resterende Sprint 8 backend (task_comments, task_history, task_participants)
- Høj daglig brugsværdi (6 forfaldne opgaver lige nu)
- Single-page-mønster fra `/companies/[id]` kan genbruges
- `/search` + `/settings` er mindre kritiske (og `/search` er pt. blot 181B placeholder)
