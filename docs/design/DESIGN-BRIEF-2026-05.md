# ChainHub Design-brief — B-stil "Less is More"

**Til:** Claude Design (eller anden visuel design-iteration)
**Fra:** Brainstorming-session 2026-05-10 mellem Philip og Claude Code
**Status:** Tre mockups godkendt af bruger. Bruges som ground-truth for resten af UI-arbejdet.

---

## 1. Kontekst

ChainHub er et B2B SaaS-system til **kædegrupper** (tandlæge-, optiker-, fysio-, franchisekæder) der co-ejer lokationsselskaber med lokale partnere. Systemet samler kontraktstyring, governance, sagshåndtering, økonomi og personrelationer i ét dashboard.

**Primær bruger:** Kædelederen (GROUP_OWNER / GROUP_LEGAL / GROUP_FINANCE). Power-user med tæt operationelt overblik over 5–56 lokationer. Bruger appen dagligt, kender domænet, har brug for høj informations-density uden at det føles tilstoppet.

**Perspektivet er ALTID hovedkontorets.** Lokale partnere og klinikpersonale er data i systemet — ikke brugere.

**Sprog:** Dansk UI, du-form. Alle labels, knapper, fejlbeskeder på dansk.

---

## 2. Designprincipper (less is more, B-stil)

Inspiration: **Linear** + **Superhuman** + **GitHub Primer**.

1. **Maksimal data, minimal dekoration.** Hvert pixel bærer information. Ingen ikoner uden funktion, ingen runde fotos, ingen hero-billeder, ingen brand-fluff.
2. **Lille typografi, tæt linjeafstand.** 13px body som default, 11px for sekundær info, 10-12px for labels.
3. **Hver sektion er et panel.** Hvidt indhold, 1px grå border, 4px radius. Headeren har lille uppercase label + meta-info.
4. **Badges er små og funktionelle.** 11px tekst, tabular-nums, korte (14d, 28d, "Aktiv"). Farve = mening: rød=kritisk, amber=advarsel, grøn=OK, blå=info, grå=neutral.
5. **Keyboard-first.** ⌘K-palet, hover-states på alle rækker, kbd-hints i bottom-bar.
6. **Tabular-nums overalt** for tal (procenter, datoer, beløb) — så de er sammenlignbare.
7. **Ingen tomme hjørner.** Hvis der er plads, fyld med relevante data eller kollapsi layoutet.
8. **Sticky context.** Sidebar+breadcrumb altid synlig. Brugeren mister aldrig orientering.

---

## 3. Visual tokens

### Farver

```
/* Grundpalette (Inter neutral grays) */
--bg-canvas:        #fafafa
--bg-sidebar:       #f6f7f9
--bg-panel:         #ffffff
--bg-panel-header:  #fbfbfc
--bg-row-hover:     #f6f7f9
--border-default:   #e1e4e8
--border-strong:    #d0d7de

/* Tekst */
--text-primary:     #1f2328
--text-secondary:   #6e7681
--text-tertiary:    #8c959f

/* Status */
--red-bg:           #ffebe9   --red-fg:   #cf222e
--amber-bg:         #fff8c5   --amber-fg: #9a6700
--green-bg:         #dafbe1   --green-fg: #1a7f37
--blue-bg:          #ddf4ff   --blue-fg:  #0969da
--gray-bg:          #f6f8fa   --gray-fg:  #57606a

/* AI insight (lilla — afgrænset til AI-sektioner) */
--ai-bg:            linear-gradient(135deg, #f3e8ff 0%, #ede9fe 100%)
--ai-border:        #c4b5fd
--ai-fg:            #4c1d95
--ai-accent:        #7c3aed
```

### Typography

```
font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;

/* Skala */
--text-xs:   10px   /* labels, kbd */
--text-sm:   11px   /* sektion-labels, meta */
--text-base: 12-13px /* body, table rows */
--text-md:   14px   /* panel titles, header */
--text-lg:   16-18px /* page titles */
--text-xl:   22px   /* hero KPI */

/* Vægte */
font-weight: 400 (body), 500 (medium), 600 (panel titles, headers), 700 (hero)

/* Variants */
font-variant-numeric: tabular-nums; /* alle tal */
letter-spacing: -0.01em (large), 0.4-0.5px (uppercase labels)
```

### Spacing & sizing

```
--space-1: 4px   --space-2: 6px   --space-3: 8px
--space-4: 10px  --space-5: 12px  --space-6: 14px
--space-7: 18px  --space-8: 24px  --space-9: 32px

--radius-sm: 3px  /* badges */
--radius-md: 4px  /* panels, inputs, buttons */
--radius-lg: 6px  /* modals */

--sidebar-width: 220px
--max-content: 1280-1400px

/* Density-regler */
panel padding:        12-14px (header + body)
row vertical padding: 6-8px (NEVER 12-16px - for luftigt)
panel gap:            12-14px
```

---

## 4. Komponent-mønstre

### Sidebar (220px, fixed)

- 14px padding, lille logo + sektion-grupper
- 3 grupper: **Overblik** · **Portefølje** · **Ressourcer**
- Hver nav-item har count-badge til højre (alert-rød hvis kritisk)
- Active = `bg-#e8eaee` + medium font-weight
- Hover = `bg-#ecedf0`
- ⌘K søg-action altid tilgængelig (ikke en menu-item, men en topbar/global)

### Panel

```
┌─────────────────────────────────────────┐
│ EJERSKAB · 2 ejere               sortér │  ← header (fbfbfc bg, 12px, uppercase)
├─────────────────────────────────────────┤
│ Kædegruppe (Holding)             51%    │  ← rows (white bg, 6-8px padding)
│ Lars Hansen                      49%    │
│ Ejeraftale                       Aktiv  │
├─────────────────────────────────────────┤
│ Total 100%              + Tilføj ejer   │  ← footer (fbfbfc bg, dashed-border CTA)
└─────────────────────────────────────────┘
```

### Strip (KPI/facts row)

5-6 cells, equal width, 1px gap, ingen padding mellem. Hvert celle: `<num>` (16-18px, tabular) + `<label>` (10px uppercase). Farve på `<num>` for status (rød/amber/grøn).

### Badge

Inline, 11px font, 1-2px vertical padding, 6-8px horizontal, 3px radius. Tabular-nums. Farver: rød/amber/grøn/blå/grå (se palette).

### Button

```
.btn (default):     12px font, 4-6px padding, 1px border #d0d7de, white bg
.btn:hover:         bg #f6f8fa
.btn.primary:       blue #0969da bg + white text
.btn-add (dashed):  11px font, dashed border, transparent bg, color secondary
                    hover: solid border + blue text
```

### Modal

- 480px width, top-mounted (100px from top, ikke centreret vertikalt)
- Backdrop: `rgba(15,23,42,0.4)` + `backdrop-filter: blur(2px)`
- Header: `bg-fbfbfc`, title + sub-context (eksisterende state), `×` close
- Body: 16-18px padding, fields gap 14px
- Footer: `bg-fbfbfc`, kbd-hints venstre + Annuller/Submit højre
- Keyboard: Esc lukker, ⌘+Enter submit

### Form fields

- Label: 11px uppercase, secondary color, 4px gap til input
- Input: 13px font, 7-10px padding, 1px border, 4px radius
- Focus: 2px outline #0969da, no ring-shadow
- Field-row 2-col: korte felter (dato + dropdown) i grid
- Live preview når relevant (fx pct-bar viser fordeling efter ændring)

### AI-insight kort

Lilla gradient `#f3e8ff → #ede9fe`, kun afgrænset til AI-output. Header: 10px uppercase ⚡-prefix + konfidens-pct. Body: 12px tekst, kort. Citat: 11px italic for source.

---

## 5. Layout-arketyper (godkendte mockups)

Tre arketyper er godkendt i brainstorming. HTML-mockups ligger i:

- `docs/design/mockup-dashboard-b.html`
- `docs/design/mockup-company-detail-b.html`
- `docs/design/mockup-add-owner-modal-b.html`

Åbn dem i en browser for at se den definitive reference. Resterende sider skal følge samme mønstre.

### Arketype 1: Dashboard (`/dashboard`)

```
┌─ Sidebar ─┬──────────────────────────────────────────────────┐
│           │ Min portefølje · Onsdag 10. maj                  │
│           │                                                  │
│           │ ┌──┬──┬──┬──┬──┐  (5-cell strip)                 │
│           │ │32│ 3│ 7│ 9│412│                                 │
│           │ └──┴──┴──┴──┴──┘                                 │
│           │                                                  │
│           │ ┌─ Kræver opmærksomhed ─┐ ┌─ Health-heatmap ─┐  │
│           │ │ Forfaldent             │ │ ▣▣▣▢▣▣▢▣        │  │
│           │ │  3d Aalborg patient... │ │ ▣▣▢▣▣▣▢▣        │  │
│           │ │ 14d Østerbro lejekn... │ │ ▣▢▣▣▣▣▣▣        │  │
│           │ │ Denne uge              │ │                   │  │
│           │ │  7d Aarhus best.møde  │ │ Top urgency:     │  │
│           │ │ Ons Odense tilsyn...  │ │ • Aalborg        │  │
│           │ └────────────────────────┘ │ • Holstebro      │  │
│           │                            │ • Esbjerg        │  │
│           │                            └───────────────────┘  │
│           │ 32 selskaber · 184 kontrakter   ⌘K · G · N      │
└───────────┴──────────────────────────────────────────────────┘
```

### Arketype 2: Detail (`/companies/[id]`)

```
┌─ Sidebar ─┬──────────────────────────────────────────────────┐
│           │ Selskaber › Tandlæge Østerbro ApS                │
│           │                                                  │
│           │ Tandlæge Østerbro ApS    [Rediger] [Tilføj ▾]   │
│           │ CVR · adresse · status                           │
│           │                                                  │
│           │ ┌──┬──┬──┬──┬──┬──┐ (6-cell facts strip)        │
│           │                                                  │
│           │ ⚠ Lejekontrakt udløber om 14 dage  [Forny]      │
│           │                                                  │
│           │ ┌─ Ejerskab ─┬─ Personer ─┬─ AI Insight ─┐     │
│           │ │ rows + add │ rows + add │ purple kort   │     │
│           │ └────────────┴────────────┴───────────────┘     │
│           │                                                  │
│           │ ┌─ Kontrakter (full-width tabel) ───────────┐   │
│           │ │ row1 row2 row3 row4...     + Upload       │   │
│           │ └─────────────────────────────────────────────┘   │
│           │                                                  │
│           │ ┌─ Sager ─┬─ Finans ─┬─ Besøg ─┐              │
│           │                                                  │
│           │ ┌─ Dokumenter (full-width) ──────────────────┐  │
└───────────┴──────────────────────────────────────────────────┘
```

### Arketype 3: Modal (alle add-handlinger)

- 480px width, mounted ~100px fra top, blurred backdrop
- Header med titel + sub-context (eksisterende state)
- Body: stacked + 2-col grids til korte felter
- **Live preview når input påvirker andre data** (pct-bar viser fordeling efter ny ejer)
- Footer: Esc/⌘↵ kbd + Annuller/Submit

---

## 6. Sider der skal designes (prioriteret)

### Phase 1 — Pilot-blockers (P0 wiring)

Hver af disse er en _modal-implementation_ af samme mønster:

1. **Tilføj ejer** → MOCKUP FÆRDIG (`mockup-add-owner-modal-b.html`)
2. **Tilføj person** → samme mønster, rolle-segmented (CEO/Bestyrelse/Tandlæge/...) + ansættelses-felter
3. **Tilføj finansiel metric** → metric-type segmented (omsætning/EBITDA/...) + tal + periode
4. **Upload kontraktversion** → drop-zone + change-type segmented (Ny version/Redaktionel/Materiel/Allonge) + version-note
5. **Slut ejerskab/role** → simpel modal med slut-dato + årsag

### Phase 2 — Resterende sider

Alle skal følge sidebar+main-layout fra arketyperne:

| Side                     | Kommentar                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------- |
| `/companies` (portfolio) | Map+list+right-rail. Strip øverst som dashboard. Density-test for tabel.                                |
| `/contracts` (liste)     | Tabel-density. Filter-row + grupperet/flat-toggle. AI-extracted-badge på kontrakter.                    |
| `/contracts/[id]`        | Detail-arketype. **AI-extracted vilkår skal vises som lilla kort** (i dag mangler det — Plus-tier hul). |
| `/cases` + `/cases/[id]` | Tabel + detail.                                                                                         |
| `/tasks`                 | 3 view-modes: flat/grouped/kanban. Kanban-kolonner i B-stil (smalle, dense).                            |
| `/tasks/[id]`            | Detail med history-feed.                                                                                |
| `/persons` (liste)       | Compact tabel. Tabel-view default (kort-view sparse i dag).                                             |
| `/persons/[id]`          | Detail med AI-extracted ansættelses-vilkår (allerede leveret B.1c, men bredere layout).                 |
| `/documents`             | Tabel med confidence-badges + attention-fields tydeligere.                                              |
| `/documents/review/[id]` | Split-view (PDF + felt-liste). Phase B.1b leveret — kan stadig polish.                                  |
| `/calendar`              | Måneds-grid + agenda-fallback for mobile.                                                               |
| `/search`                | Sektioneret resultatliste — allerede god, mindre polish.                                                |
| `/settings`              | Org + brugere + AI-usage. Tæt panel-layout.                                                             |
| `/login`                 | Hold simpelt. Ingen brand-fluff.                                                                        |

---

## 7. Tone of voice

**Sprog:** Dansk, du-form. Aldrig De-form, aldrig engelsk i UI.

**Eksempler:**

- Knap: "Tilføj ejer" (ikke "Add owner")
- Tom-state: "Du har endnu ikke tilføjet kontrakter til dette selskab. **Upload din første →**"
- Fejl: "Andelen overstiger 100% — fjern eller juster en eksisterende ejer først." (handlingsanvisende)
- Bekræftelse: "Ejer tilføjet · Marie Kristensen 10%" (toast, neutral, faktuel)

**Aldrig:**

- Udråbstegn
- Emoji i UI-tekst (kun ⚡ til AI-kort, ⚠ til alerts — markup, ikke tone)
- Marketing-sprog ("Fantastisk!", "Du har klaret det!")
- Tekniske fagtermer uoversat ("validation error" → "ugyldigt input")

---

## 8. Tekniske constraints (hvis Claude Design eksporterer kode)

ChainHub-stacken er fastlagt:

- **Framework:** Next.js 14 App Router, React 18, TypeScript 5 (strict)
- **Styling:** Tailwind CSS — ingen inline styles, ingen CSS-moduler. Tokens i `tailwind.config.ts`.
- **Komponenter:** shadcn/ui-inspirerede primitiver i `src/components/ui/`
- **Ikoner:** Lucide React (importer kun de der bruges)
- **Toasts:** Sonner
- **Server actions:** Alle CRUD via `src/actions/<modul>.ts` (ikke API routes)
- **Forms:** Native HTML form + Zod validation. Ingen react-hook-form.

**Eksport-præferencer fra Claude Design:**

- HTML+Tailwind frem for vanilla CSS
- Komponent-grænser matcher eksisterende `src/components/`-struktur (ui/, company-detail/, task-detail/, dashboard/, etc.)
- Dansk text overalt, ikke engelsk placeholder-tekst
- Brug eksisterende `labels.ts` for enum→dansk-mapping

---

## 9. Eksisterende info-arkitektur (bevares)

Sidebar-struktur:

```
Top:        Søg (/search)            [⌘K shortcut]
Overblik:   Dashboard (/dashboard)
            Kalender (/calendar)
Portefølje: Selskaber (/companies)   → /companies/new, /companies/[id]
            Kontrakter (/contracts)  → /contracts/new, /contracts/[id]
            Sager (/cases)           → /cases/new, /cases/[id]
            Opgaver (/tasks)         → /tasks/new, /tasks/[id]
Ressourcer: Dokumenter (/documents)  → /documents/review/[id]
            Personer (/persons)      → /persons/new, /persons/[id]
Bottom:     Indstillinger (/settings) → /settings/ai-usage

Skjult:     /visits/new, /visits/[id] (nås kun via /calendar)
```

URL-mønster og navigations-træ bevares. Det er kun det visuelle lag der genskabes.

---

## 10. Hvad er IKKE inkluderet i denne brief

- **Mobile-design:** ChainHub er desktop-first (kædeleder sidder ved skrivebord). Mobile-fallback håndteres senere — designet skal bryde gracefully <1024px (sidebar bliver til drawer), men er ikke optimeret for touch.
- **Dark mode:** Kandidat til v2.
- **Branding/logo-design:** Behold eksisterende ▣ ChainHub-stil (simpelt sigil + wordmark). Ikke et marketing-redesign.
- **Marketing-sider:** Ingen landing page eller pricing-side i scope.
- **AI-extraction-pipeline UI** (`/documents/review/[id]`): Allerede leveret som A+ i Phase B.1b. Mindre polish ift. B-stil men ingen omdesign.

---

## 11. Næste skridt for bruger

1. **Åbn de 3 reference-mockups lokalt** (`docs/design/mockup-*.html`) for at se den endelige B-stil.
2. **Gå til Claude Design** (claude.ai/design — kræver Pro/Max/Team/Enterprise).
3. **Onboard ChainHub-codebasen** så Claude Design læser `tailwind.config.ts`, eksisterende komponenter og labels.
4. **Brief Claude Design** ved at uploade denne markdown-fil + de 3 HTML-mockups.
5. **Generer mockups for resterende sider** i prioriteret rækkefølge (P0 modaler først, derefter Phase 2-listen).
6. **Eksporter til Claude Code-format** og send til Claude Code-sessionen for implementation.

---

**Reference-session:** Brainstorming-session 2026-05-10 (visual companion mockups gemt i `.superpowers/brainstorm/23611-1778418230/content/`).
**Master review:** `docs/status/MASTER-REVIEW-2026-05.md`.
**P0-listen:** Afsnit 5 i master review.
