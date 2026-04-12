# Kalender-side (/calendar) — Design Spec

## Mål
Byg en fuld kalender-side der aggregerer kontrakt-udløb, opgave-frister, besøg, sags-frister og fornyelser i én samlet visning. Eliminerer to døde links (sidebar + dashboard-widget).

## Arkitektur

**Server Action:** `getCalendarEvents(userId, orgId, year, month)` → `CalendarEvent[]`
Aggregerer 5 datakilder i én parallel query-batch. Scoped til brugerens accessible companies.

**Page:** Server Component der henter data og sender til client component.

**Client Component:** `FullCalendar` — interaktiv månedsvisning med dag-valg og event-liste.

## Datakilder → Event-mapping

| Datakilde | Prisma-felt | CalendarEventType | Farve |
|-----------|------------|-------------------|-------|
| Kontrakt-udløb | `Contract.expiry_date` (status AKTIV) | `expiry` | Rød |
| Opgave-frister | `Task.due_date` (status ≠ LUKKET) | `deadline` | Amber |
| Besøg | `Visit.visit_date` (status PLANLAGT) | `meeting` | Blå |
| Sags-frister | `Case.due_date` (status åben) | `case` | Lilla |
| Auto-fornyelser | `Contract.expiry_date` (auto_renew = true) | `renewal` | Grøn |

## Side-layout

```
┌──────────────────────────────────────────────────────────┐
│  Kalender                                  [< April 2026 >] │
│  Kontrakter, sager, besøg og frister                      │
├──────────────────────────────┬───────────────────────────┤
│                              │                           │
│   MÅNEDS-GRID                │  EVENTS FOR VALGT DAG     │
│   (store celler med          │  (eller "Kommende 7 dage" │
│    event-titler synlige,     │   hvis ingen dag valgt)   │
│    farvekodede venstre-      │                           │
│    border per event)         │  ┌─ 🔴 Lejekontrakt ─────┐│
│                              │  │ Østerbrogade 123      ││
│   Klik dag → højre panel     │  │ Tandlæge Østerbro →   ││
│   opdateres                  │  └───────────────────────┘│
│                              │                           │
│                              │  FILTER                   │
│                              │  [●] Udløb  [●] Frist    │
│                              │  [●] Besøg  [●] Sag      │
│                              │  [●] Fornyelse            │
└──────────────────────────────┴───────────────────────────┘
```

### Dag-celler i grid
- Hver celle viser op til 3 events med truncated titel + farvekodede venstre-border
- "+N mere" hvis flere end 3
- I dag markeret med blå ring
- Weekend-dage subtilt dæmpet
- Dage uden events: tom (ingen dots, ingen tekst)

### Højre panel
- Default: "Kommende 7 dage" liste (som dashboard-widget)
- Ved dag-klik: viser alle events for den dag med fulde titler, selskab, og link til detalje
- Filter-toggles (checkboxes) for event-typer

### Deep linking
URL opdateres med query params: `/calendar?month=2026-04&day=15`
- `month` param styrer hvilken måned der vises
- `day` param styrer hvilken dag der er valgt i højre panel

## Filer

| Fil | Formål |
|-----|--------|
| `src/actions/calendar.ts` | Server action: 5 parallelle queries → CalendarEvent[] |
| `src/app/(dashboard)/calendar/page.tsx` | Server component: metadata + data fetching |
| `src/app/(dashboard)/calendar/loading.tsx` | Loading skeleton |
| `src/components/calendar/full-calendar.tsx` | Client component: grid + dag-valg + events |
| `src/app/(dashboard)/dashboard/page.tsx` | Wire dashboard-widget med rigtige events |

## Dashboard-widget integration
`dashboard/page.tsx` kalder `getCalendarEvents()` med aktuel måned og sender til `CalendarWidget` i stedet for tomme arrays. Én delt datakilde = konsistens.

## YAGNI
- Ingen uge-visning
- Ingen drag-and-drop
- Ingen opret-event fra kalender
- Ingen iCal export
- Ingen recurring events UI
