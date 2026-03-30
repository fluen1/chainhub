# Dashboard Redesign — Design Spec

**Dato:** 2026-03-31
**Status:** Godkendt
**Mockup:** `.superpowers/brainstorm/37069-1774908762/content/dashboard-with-calendar.html`

---

## Overblik

Redesign af ChainHub prototype-dashboardet med nyt visuelt designsystem og rollebaseret auto-tilpasning. Dashboardet er hovedkontorets primære arbejdsflade — det skal give øjeblikkeligt overblik over porteføljen og surfacing af handlingskrævende items.

## Designprincipper

| Princip | Implementering |
|---------|----------------|
| Light mode, mørk sidebar | Baggrund `#f0f2f5`, kort `#fff` med `border: 1px solid #e5e7eb`, sidebar `#0f172a` |
| Card-based layout | Alt indhold i hvide kort med `border-radius: 12px` og subtle hover shadow |
| Blå accent | Primær accent `#3b82f6`, aktive sidebar items, links, primær CTA |
| Whitespace heavy | Generøs padding (20px kort, 28-32px dashboard area), gap 16px mellem kort |
| Status-farver | Rød `#ef4444` (kritisk/udløbet), amber `#f59e0b` (advarsel/snart), grøn `#22c55e` (sund/ok), blå `#3b82f6` (info/planlagt) |
| Konsistente komponenter | Genbrugte patterns: KPI-kort, urgency-liste, company-row, coverage-bar, fin-row |

## Typografi

- **Font:** Plus Jakarta Sans (Google Fonts)
- **Weights:** 400 (body), 500 (labels/nav), 600 (card titles/badges), 700 (headings/KPI), 800 (store tal)
- **Scale:** 11px (badges/legend) → 12px (labels/meta) → 13px (body/lister) → 14px (card-titles) → 18px (greeting) → 30px (KPI-tal)
- **Tabular nums:** På alle tal (KPI, procenter, datoer, beløb)

## Farvepalet

| Token | Hex | Brug |
|-------|-----|------|
| `--bg` | `#f0f2f5` | Side-baggrund |
| `--card` | `#ffffff` | Kort-baggrund |
| `--card-border` | `#e5e7eb` | Kort-border |
| `--card-divider` | `#f1f5f9` | Interne dividers i kort |
| `--sidebar` | `#0f172a` | Sidebar-baggrund |
| `--sidebar-active` | `rgba(59,130,246,0.12)` | Aktivt sidebar-item |
| `--text-primary` | `#0f172a` | Headings, KPI-tal |
| `--text-body` | `#1e293b` | Body text, navne |
| `--text-secondary` | `#64748b` | Labels, metadata |
| `--text-muted` | `#94a3b8` | Subtitles, placeholders |
| `--accent` | `#3b82f6` | Primær accent, links, aktive states |
| `--success` | `#22c55e` / `#16a34a` | Sund, positiv, 100% |
| `--warning` | `#f59e0b` / `#d97706` | Advarsel, snart, lav dækning |
| `--danger` | `#ef4444` / `#dc2626` | Kritisk, udløbet, forfaldne |
| `--purple` | `#8b5cf6` | Sager, AI-ekstraherede events |

## Layout-struktur

```
┌─────────────────────────────────────────────────────┐
│ Sidebar (240px)  │  Main Content                    │
│  #0f172a         │                                  │
│                  │  ┌─ Topbar (hvid, border-bottom) │
│  Logo            │  │  Greeting + søg + notif       │
│  ─────           │  ├──────────────────────────────  │
│  Dashboard ●     │  │                                │
│  Kalender        │  │  KPI-grid (4 kolonner)         │
│  ─────           │  │                                │
│  Selskaber       │  │  ┌─ Urgency ──┬─ Kalender ─┐  │
│  Kontrakter      │  │  │  + Portf.  │  widget     │  │
│  Sager           │  │  └────────────┴────────────┘  │
│  Opgaver         │  │                                │
│  ─────           │  │  §Juridisk                     │
│  Dokumenter      │  │  ┌─ Dækning ─┬─ Sager ────┐  │
│  Personer        │  │  └───────────┴────────────┘  │
│  ─────           │  │                                │
│  Indstillinger   │  │  §Økonomi                      │
│                  │  │  ┌─ Nøgletal ─┬─ Opmærksom ┐  │
│                  │  │  └───────────┴────────────┘  │
└─────────────────────────────────────────────────────┘
```

## Rollebaseret auto-tilpasning

Dashboardet tilpasser sig automatisk baseret på brugerens rolle (RBAC). Ingen synlig rolle-switcher — systemet bestemmer ud fra `session.user.role`.

### Direktør (GROUP_OWNER)

Ser **alt** — fuldt dashboard med sektions-overskrifter:

1. **KPI-grid (4 kort):** Selskaber, udløbende kontrakter, aktive sager, forfaldne opgaver
2. **Kræver handling:** Urgency-feed (top 5 handlingspunkter, sorteret efter kritikalitet)
3. **Porteføljesundhed:** Sund/advarsel/kritisk counts + health-bar + top selskaber der kræver opmærksomhed
4. **Kalender-widget:** Månedsvisning + kommende 7 dage
5. **§ Juridisk:** Kontraktdækning (coverage-bars) + aktive sager fordelt på type
6. **§ Økonomi:** Nøgletal (omsætning/EBITDA/margin) + opmærksomhedspunkter (forfaldne fakturaer, underskud)

### Juridisk (GROUP_LEGAL)

Ser **kun juridisk-relevante blokke:**

1. **KPI-grid (4 kort):** Udløbende kontrakter, aktive tvister, kontrakter til gennemgang, kontraktdækning %
2. **Juridiske handlingspunkter:** Urgency-feed filtreret til kontrakter og sager
3. **Sager fordelt på type:** Lejemål, ejeraftale, ansættelse, compliance
4. **Kontraktdækning:** Coverage-bars
5. **Dokumenter til review:** Seneste uploadede kontrakter der afventer gennemgang
6. **Kalender-widget:** Filtreret til kontraktfrister og sagsfrister

### Økonomi (GROUP_FINANCE)

Ser **kun økonomi-relevante blokke:**

1. **KPI-grid (4 kort):** Samlet omsætning, EBITDA, EBITDA margin, gns. omsætning/lokation
2. **Top lokationer (omsætning):** Rangeret liste med YoY-trend
3. **Opmærksomhedspunkter:** Forfaldne fakturaer, udestående betalinger, lokationer med underskud, budgetafvigelse
4. **Lokationer med underskud:** Company-rows med EBITDA-tal
5. **Kontrakter med økonomisk impact:** Udløbne aftaler der medfører økonomisk risiko
6. **Kalender-widget:** Filtreret til betalingsfrister og kontraktøkonomi

### Fremtidige roller (parkeret)

- **Drift:** Kan tilføjes senere med besøgsplanlægning, datakvalitet, stamdata-komplethed
- **Marketing:** Kan tilføjes senere med kampagneoverblik, kunderejse, NPS
- **HR:** Kan tilføjes senere med ansatte, ansættelseskontrakter, tilfredshedsundersøgelser

## Kalender-widget

### Dashboard-widget (kompakt)

Placering: Højre kolonne, ved siden af urgency + portefølje.

**Elementer:**
- Måneds-header med navigation (‹ ›)
- 7×6 grid med dag-numre
- Farvede dots under datoer med events (max 2-3 dots per dag)
- "Kommende 7 dage" liste under kalenderen
- Farve-legende: Rød=udløb, Amber=frist, Blå=besøg/møde, Lilla=sag, Grøn=fornyelse
- "Åbn fuld kalender →" link

**AI-populering:**
- Events markeret med lilla "AI" badge når de er automatisk ekstraheret fra uploadede dokumenter
- AI scanner kontrakter for: udløbsdatoer, fornyelsesfrister, opsigelsesperioder, betalingsfrister
- Brugeren kan manuelt tilføje events (besøg, møder)

### Fuld kalenderside (nyt sidebar-punkt)

Selvstændig side med:
- Dag/uge/måned-visning
- Filtrering på event-type (kontrakter, besøg, sager, deadlines)
- Klik på event → navigér til relevant kontrakt/sag/selskab
- Opret nye events manuelt

**Farve-koding for event-typer:**

| Farve | Dot | Type | Eksempel |
|-------|-----|------|----------|
| Rød | `#ef4444` | Udløb/overskredet | Kontrakt udløbet, forfaldne opgaver |
| Amber | `#f59e0b` | Frist/snart | Opsigelsesfrist, udløber inden 14d |
| Blå | `#3b82f6` | Besøg/møde | Driftsbesøg, genforhandlingsmøde |
| Lilla | `#8b5cf6` | Sag/juridisk | Sagsfrist, indsigelsesdeadline |
| Grøn | `#22c55e` | Fornyelse/positiv | Automatisk fornyelse, underskrift |

## Lokationsside (360° overblik)

Når brugeren klikker på et selskab navigeres til en **selvstændig detail-side** med fuldt overblik:

- **Header:** Selskabsnavn, CVR, status-badge, lokationsleder
- **Sektioner:** Stamdata, ansatte, kontrakter, økonomi, sager, dokumenter, besøgshistorik
- **Navigation:** Breadcrumb (Dashboard → Selskaber → [Selskabsnavn]) eller browser back

Detaljeret design af lokationssiden specificeres separat.

## Komponenter (genbrugelige)

| Komponent | Brug | Nøgle-props |
|-----------|------|-------------|
| `KpiCard` | KPI-grid | label, value, trend (up/down/neutral), valueColor |
| `UrgencyList` | Handlingspunkter | items med indicator-farve, navn, sub, days |
| `HealthBar` | Porteføljesundhed | counts (sund/advarsel/kritisk) |
| `CompanyRow` | Selskabslister | avatar, name, cvr/meta, status-badge |
| `CoverageBar` | Kontraktdækning | label, percentage, fill-farve |
| `FinRow` | Økonomital | label, value, valueColor |
| `CalendarWidget` | Dashboard-kalender | events[], selectedDate |
| `SectionHeader` | Rolle-sektioner | title |

## Sidebar-struktur

```
Overblik
  Dashboard (aktiv)
  Kalender [badge: antal events denne uge]

Portefølje
  Selskaber [badge: total antal]
  Kontrakter [alert badge: udløbende]
  Sager
  Opgaver [alert badge: forfaldne]

Ressourcer
  Dokumenter
  Personer

System
  Indstillinger
```

## Interaktioner

- **KPI-kort hover:** Subtle shadow (`box-shadow: 0 4px 12px rgba(0,0,0,0.05)`)
- **Urgency-item klik:** Navigér til relevant kontrakt/sag/opgave
- **Company-row klik:** Navigér til lokationsside (360° overblik)
- **Kalender dag-klik:** Vis events for den dag
- **"Se alle →" klik:** Navigér til fuldt modul (kontrakter/sager/opgaver)
- **"Åbn fuld kalender →":** Navigér til kalenderside

## Tekniske noter

- **Font loading:** `font-display: swap` på Plus Jakarta Sans
- **Responsive:** Dashboard-grid kollapser til 1 kolonne på mobil, kalender-widget under urgency
- **Data:** Server-side rendering via Next.js Server Actions (eksisterende pattern)
- **RBAC:** `canAccessModule()` styrer hvilke sektioner der renderes
- **AI-ekstraktion:** Backend-service der scanner uploadede PDF/DOCX kontrakter og ekstraherer datoer via LLM
