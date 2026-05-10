# Prompts til Claude Design — ChainHub B-stil

**Brug:** Kopier prompt → paste i Claude Design → upload de 3 mockups + DESIGN-BRIEF-2026-05.md som kontekst.

**Workflow pr. side:**

1. Start med Prompt 0 (én gang pr. session) for at etablere kontekst
2. Brug en specifik side-prompt
3. Iterer i Claude Design indtil tilfreds
4. Eksporter til Claude Code-format
5. Send eksporten til Claude Code-sessionen

---

## Prompt 0 — Onboarding (kør én gang per session)

```
Jeg arbejder på et B2B SaaS-system kaldet ChainHub. Jeg uploader nu en design-brief
og 3 reference-mockups. Læs dem grundigt før vi begynder.

Filer:
- DESIGN-BRIEF-2026-05.md (komplet brief med tokens, mønstre, principper)
- mockup-dashboard-b.html (godkendt dashboard)
- mockup-company-detail-b.html (godkendt selskabs-detalje)
- mockup-add-owner-modal-b.html (godkendt modal-mønster)

Vigtige regler du SKAL følge i alt du genererer:

1. STIL: Linear/Superhuman dense — power-user, 13px body, Inter font, grå-toner.
   Se mockups for præcis udførelse.

2. SPROG: Alt UI på dansk, du-form. Aldrig engelsk i labels/knapper.
   Aldrig udråbstegn. Ingen marketing-sprog.

3. DENSITY: Maksimal data, minimal dekoration. Ingen ikoner uden funktion.
   Ingen runde fotos. Ingen hero-billeder. Ingen brand-fluff.

4. PANEL-MØNSTER: Hver sektion = panel med uppercase header (12px), white body,
   #fbfbfc footer. 1px border #e1e4e8, 4px radius.

5. BADGES: 11px, tabular-nums. Farver = mening (rød=kritisk, amber=advarsel,
   grøn=OK, blå=info, grå=neutral).

6. LIVE PREVIEW i modaler: Når input påvirker andre data (fx pct-fordeling),
   vis konsekvensen visuelt før submit.

Når du genererer en side: brug eksakte hex-koder fra brief'en, eksakte font-sizes,
eksakt spacing. Output skal være Tailwind + Next.js-kompatibelt (ingen vanilla CSS,
ingen styled-components, ingen react-hook-form).

Bekræft at du har læst alle 4 filer og forstår stilen. Derefter venter jeg
på næste prompt for første side.
```

---

## Prioritet 1 — P0 Modaler (pilot-blockers)

Disse er kritiske for at en pilot-kunde kan onboarde sig selv. Alle skal følge `mockup-add-owner-modal-b.html`-mønstret.

### Prompt 1 — Tilføj person-modal

```
Generer modal "Tilføj person til selskab" i samme mønster som
mockup-add-owner-modal-b.html.

KONTEXT (skal vises i header sub):
- Selskab: Tandlæge Østerbro ApS
- Eksisterende: 4 personer (Lars Hansen CEO, Marie Kristensen bestyrelsesformand,
  Peter Brandt tandlæge, Sara Olsen klinikassistent)

FELTER (i den her rækkefølge):
1. Person-vælger: søg-input med autocomplete på eksisterende persons OR
   "Opret ny person"-toggle der åbner navne+email+telefon-felter
2. Rolle (segmented): CEO · Bestyrelsesmedlem · Bestyrelsesformand · Direktør ·
   Tandlæge · Klinikassistent · Andet (custom-input)
3. Sensitivitet (segmented, kun synlig for governance-roller): PUBLIC · STANDARD ·
   INTERN · FORTROLIG
4. Ansættelses-type (segmented, kun synlig for medarbejder-roller): Fuldtid ·
   Deltid · Vikar · Konsulent
5. Start-dato (date input)
6. Anciennitets-start (date input, valgfri — default = start-dato)
7. Note (textarea, valgfri)

LIVE PREVIEW: Hvis rollen er bestyrelses-relateret, vis advarsel:
"⚠ Denne rolle giver adgang til governance-data — sensitivitet skal sættes."

VALIDERING: Hvis CEO eksisterer i selskabet allerede, vis advarsel:
"Lars Hansen er allerede CEO i dette selskab. Slut hans rolle først eller vælg
anden rolle."

Behold kbd-hints (Esc/⌘↵), Annuller/Tilføj person-knapper, dimmed backdrop
med selskabs-detalje synlig bagved.
```

### Prompt 2 — Tilføj finansiel metric-modal

```
Generer modal "Tilføj finansiel metric" i samme mønster som
mockup-add-owner-modal-b.html.

KONTEXT (sub-header): Tandlæge Østerbro ApS · Q1 2026 · Sidste rapport 28. apr

FELTER:
1. Metric-type (segmented): Omsætning · EBITDA · Margin · Andet (custom)
2. Beløb (number input, dansk format med komma som decimal): "1.840.000,00"
3. Enhed (segmented): kr · kr/md · % · antal
4. Periode (2-col grid):
   - Periode-type: Måned · Kvartal · År
   - Specifik periode (dropdown — auto-fylder baseret på type, fx "Q1 2026")
5. Kilde (segmented): Manuel · CSV-import · E-conomic · Andet
6. Note (textarea, valgfri)

LIVE PREVIEW: Vis seneste 3 målinger af samme metric-type:
"Tidligere: Q4 2025: 1,72m · Q3 2025: 1,68m · Q2 2025: 1,55m"
Med en lille trend-pil eller +/- pct sammenlignet med foregående periode.

VALIDERING: Hvis samme metric+periode allerede findes, vis advarsel:
"Omsætning Q1 2026 er allerede registreret (1,84m). Vil du erstatte?"
+ knap "Erstat" eller "Annuller".
```

### Prompt 3 — Upload kontraktversion-modal

```
Generer modal "Upload kontraktversion" i B-stil mønster, men UDVIDET med
drag-and-drop drop-zone øverst (over felterne).

KONTEXT (sub-header): Lejekontrakt erhverv · Tandlæge Østerbro ApS · Aktuelt
v3 (uploadet 14. mar 2026)

DROP-ZONE (øverst):
- 200px høj dashed-border zone
- "Træk PDF/DOCX/PNG/JPG hertil eller klik for at vælge"
- Max 10 MB
- Ved hover/drag: solid border + bg #ddf4ff
- Når fil valgt: vis filename + størrelse + "Skift fil"-link

FELTER (under drop-zone):
1. Change-type (segmented): NY VERSION · REDAKTIONEL · MATERIEL · ALLONGE
   Med tooltip på hver: "MATERIEL = ændrer rettigheder/forpligtelser"
2. Version-note (textarea): "Beskriv hvad der er ændret siden forrige version"
3. Effective-dato (date input): default = i dag
4. Auto-extract via AI (toggle, default ON):
   "AI læser dokumentet og opdaterer kontrakt-felterne (kræver review)"

LIVE PREVIEW: Hvis Auto-extract er ON, vis info-banner:
"⚡ Kontrakten queues til extraction. Du får besked når review er klar
(typisk 2-5 minutter)."
```

### Prompt 4 — Slut ejerskab/role-modal

```
Generer kompakt confirm-modal til "Slut ejerskab" og "Slut role" (samme
mønster, parameteriseret).

KONTEXT (sub-header): Lars Hansen · 49% ejer i Tandlæge Østerbro ApS
(ejerskab aktiv siden 14. jan 2018)

FELTER (kompakt — modal kun 380px bred):
1. Slut-dato (date input): default = i dag, max = i dag
2. Årsag (segmented): Salg · Død · Tilbagetrækning · Konkurs · Andet (textarea)
3. Note (textarea, valgfri)

LIVE PREVIEW: Vis effekt på ejerskab efter slut:
"Efter slut: Kædegruppe 51% + ledig 49% = 51% total
⚠ Selskabet vil mangle 49% ejer — tilføj ny ejer eller juster fordeling."

KNAP: "Slut ejerskab" (rød primary, ikke blå) — destructive action.
Confirm-step: bruger skal skrive "SLUT" i et felt for at aktivere knappen.
```

---

## Prioritet 2 — Sider med uafklarede mønstre

### Prompt 5 — /contracts/[id] med AI-extractions (Plus-tier hul)

```
Generer kontrakt-detail-side i samme arketype som mockup-company-detail-b.html,
men tilpasset en kontrakt.

EKSEMPEL: Lejekontrakt erhverv for Tandlæge Østerbro ApS.

LAYOUT:
- Sidebar (samme som detail-mockup)
- Breadcrumb: Kontrakter › Lejekontrakt erhverv · Tandlæge Østerbro ApS
- Header: Kontrakt-titel + meta (parter, type, sensitivity, status)
  + [Rediger] [Upload ny version ▾]-knapper

- 6-cell strip:
  Type: LEJEKONTRAKT_ERHVERV · Sensitivity: STANDARD · Aktuel version: v3 ·
  Effektiv: 14. mar 2026 · Udløb: 24. maj 2026 (14 DAGE) · Parter: 2

- Alert-bar (rød): "Lejekontrakt udløber om 14 dage — start forny-flow"

- 2-col grid (1.4fr 1fr):
  - VENSTRE: Vilkår-panel (key-terms grid)
    - 2-col inde i panelet: label + value + AI-confidence-badge
    - Eksempler: "Månedlig leje: 38.500 kr (✓ AI 94%)",
      "Opsigelsesvarsel: 6 måneder (⚠ AI 72%)",
      "Indeksregulering: Nettoprisindeks (✓ AI 89%)",
      "Depositum: 115.500 kr (✓ AI 96%)",
      "Fremlejeret: Ikke tilladt (⚠ AI 68%)"
    - Footer: "Review AI-extractions →" link til /documents/review/[id]

  - HØJRE: AI Insight-kort (lilla, samme stil som detail-mockup):
    "⚡ Renewal-risk · 82% conf.
    Forventet markedsleje for Østerbrogade-segmentet er 10-12% over nuværende.
    Anbefaling: start forhandling nu, ikke efter udløb."

- Fuld-bredde: Versions-historik (panel)
  Tabel: version · uploadet · af bruger · change-type-badge · download-link
  Eksempler: v3 · 14. mar 2026 · Philip · ALLONGE · 📎
            v2 · 8. jan 2024 · Maria · MATERIEL · 📎
            v1 · 14. jan 2018 · Lars · NY VERSION · 📎

- 3-col nederst:
  - Parter (panel): Tandlæge Østerbro ApS (lejer) + Ejendomsselskab Østerbro ApS (udlejer)
  - Tilknytninger (panel): 1 sag (#2841 forhandling), 2 opgaver, 0 dokumenter
  - Aktivitet (panel, kort): seneste 5 events (uploaded, kommenteret, status-ændret)

VIGTIGT: AI-extractions med confidence-badges er Plus-tier-feature. Vis dem
prominent — det er det vigtigste demo-element for Plus-salget.
```

### Prompt 6 — /contracts (liste med tabel-density)

```
Generer kontrakt-liste-side med fokus på tabel-density.

LAYOUT:
- Sidebar
- Breadcrumb: Kontrakter
- Header: "Kontrakter" + meta "184 aktive · 3 udløber inden for 30 dage" +
  [+ Opret kontrakt]-primary-knap

- Filter-row (kompakt, en linje):
  - Søg-input (200px)
  - Selskab-dropdown (multiselect)
  - Type-dropdown (multiselect — alle 34 kontrakttyper grupperet)
  - Status-dropdown: Alle · Aktiv · Udløber 30d · Udløbet · Opsagt
  - Toggle: Grupperet pr. selskab · Flat liste · Kanban (efter status)
  - Højre: "Eksportér ▾" (CSV/Excel)

- Hovedtabel (flat-view, default):
  Kolonner (kompakt):
  | Type | Selskab | Parter | Værdi | Effektiv | Udløb | Status | Sensitivity |
  Hver række 6-8px vertical padding (DENSE).

  Eksempler (10 rækker, varieret):
  | Lejekontrakt | Tandlæge Østerbro | Selskabet+udlejer | 38.500 kr/md | 14.03.21 | 14d ⚠ | Aktiv | STANDARD |
  | Ansættelse | Klinik Aalborg | Selskabet+Tina H. | 52.000 kr/md | 01.02.22 | — | Aktiv | INTERN |
  | Ejeraftale | Klinik Esbjerg | Holding+Per L. | — | 14.06.20 | — | Aktiv | FORTROLIG |
  ...

- AI-extracted-badge på rækker hvor AI har læst dokumentet (lille ⚡ ikon i type-kolonnen)

- Pagination i bund: "1-10 af 184 · Vis: 10/25/50 · ⌘K"

ALTERNATIV VISUNG (toggle aktiv): Grupperet pr. selskab — collapsible sections
med selskabs-navn som header + count-badge + alle selskabets kontrakter under.
```

### Prompt 7 — Refresh dashboard med bedre balance

```
Tag mockup-dashboard-b.html og lav en lille polish-iteration:

ÆNDRINGER:
1. Strip øverst: tilføj "Omsætning YTD" som 6. cell (i dag kun 5)
2. "Kræver opmærksomhed"-panel: tilføj search/filter-input øverst i panelet
   (placeholder: "Filtrér urgency-items...")
3. Health-heatmap: tilføj tooltips on hover (vis selskabs-navn + status ved
   hover på hver cell)
4. Bottom-bar: tilføj "Sidst synkroniseret 14:32" til venstre
5. Tilføj NY sektion under hovedlayoutet: "Sidste aktivitet" (kollapsibel) —
   feed med 5-10 events: "Marie Kristensen tilføjede note · 12 min siden",
   "Philip uploadede kontraktversion · 47 min siden"

ALT andet bevares fra original mockup.
```

---

## Template — Andre sider (selv-tilpasses)

For sider jeg ikke har lavet specifik prompt til, brug denne skabelon:

```
Generer [SIDE-NAVN] for ChainHub i B-stil (Linear/Superhuman dense).

LAYOUT:
- Sidebar (samme som mockup-dashboard-b.html)
- Breadcrumb: [navigations-sti]
- Header: [side-titel] + meta + [primary action]-knap

INDHOLD:
- [Beskriv hvilke paneler/data der skal vises]
- Brug strip-pattern hvis der er 4-6 nøgletal at vise
- Hver sektion = panel med uppercase header + body + footer
- Tilføj-knapper som dashed-border CTA i panel-footer

EKSEMPEL-DATA:
- [Konkret dansk eksempel-data — selskab, kontrakt, person, etc.]

INTERAKTION:
- [Hvad sker når man klikker en række? Modal? Navigation? Inline-edit?]
- Keyboard-shortcuts: [hvis relevant]

EDGE CASES:
- Empty state: [tekst + CTA]
- Loading: skeleton-rows i panel-rækker (samme højde som rigtig data)
- Fejl: alert-bar øverst med rød border

VIGTIGT: Bevar samme spacing, font-sizes og farver som de godkendte mockups.
```

**Sider der mangler prompts (i prioriteret rækkefølge):**

8. `/persons/[id]` — person-detalje med AI-extracted ansættelses-vilkår
9. `/persons` — liste (tabel default, kort som toggle)
10. `/cases/[id]` — sags-detalje
11. `/cases` — liste
12. `/tasks/[id]` — opgave-detalje med history-feed
13. `/tasks` — liste med 3 view-modes (flat/grouped/kanban)
14. `/calendar` — måneds-grid + side-panel for valgte dag
15. `/documents` — liste med AI-status-badges
16. `/companies` — portfolio-liste med map+tabel+right-rail
17. `/search` — global søgning med 6 entitetstyper
18. `/settings` — org + brugere + System-link
19. `/login` — simpel login-side, ingen brand-fluff

---

## Iteration-tips

**Når Claude Design's første output ikke rammer:**

- "Gør density tættere — du har for meget vertikalt space mellem rækker"
- "Fjern dekorative ikoner — kun funktionelle ikoner (chevron, arrow, status)"
- "Brug tabular-nums på alle tal-felter"
- "Headeren skal være uppercase 11-12px, ikke 14-16px"
- "Modalen er for centreret — den skal mountes 100px fra top"
- "Padding i panel-footer skal være 6-8px, ikke 12-16px"

**Når Claude Design glemmer dansk:**

- "Alt UI skal være på dansk. 'Add owner' skal være 'Tilføj ejer'."
- "Brug du-form, aldrig De-form."

**Eksport til Claude Code:**

- Bed Claude Design om "Export as Claude Code-compatible HTML+Tailwind"
- Send filen til mig (Claude Code) sammen med "implementer denne side" — jeg
  konverterer til Next.js + server actions + Prisma queries.
