# ChainHub AI-Integreret Prototype — Design Spec

**Dato:** 2026-03-30
**Status:** Godkendt
**Scope:** Komplet interaktiv prototype af hele systemet med AI-intelligens og rolle-tilpasset UX

---

## 1. Vision og principper

### Kernefilosofi
**UX er arkitekten, AI er materialet.** Vi designer det bedste tænkelige værktøj til kædegruppe-ledere — og bruger AI der, hvor det loser reelle problemer bedre end traditionel UI.

### Designprincipper

| Princip | Beskrivelse |
|---------|-------------|
| **Siderne selv er intelligente** | Ingen chatbot-panel. AI er embedded i sidernes struktur — alerts, indsigter, forslag dukker op in-context |
| **AI foreslaar, mennesket beslutter** | AI auto-udfylder aldrig kritiske felter. Den foreslaar, brugeren godkender |
| **En overflade, mange linser** | Samme sidestruktur for alle roller. Forskellen er hvilke sektioner/blokke der vises — aldrig omordning af layout |
| **80/20** | 80% proaktiv intelligent overflade, 20% spoergemulighed |
| **Daekningssprog, ikke fejlsprog** | "19/22 lokationer har forsikring" — ikke "3 mangler forsikring!" Amber for mangler, ikke roed |

### Tre arkitektur-lag

```
Lag 1: ADGANG (eksisterer)     — Hvad maa brugeren se? (permissions)
Lag 2: RELEVANS (nyt)          — Hvad er vigtigt for denne rolle? (AI-laget)
Lag 3: DOKUMENT-INTELLIGENS    — Forstaa dokumenter, ekstraher data, kvalitetskontrol
```

---

## 2. Navigation

### Sidebar (6 primaere items)

```
Overblik          — Proaktiv intelligens, rolle-tilpasset startside
Portefoelje       — Alle selskaber, den primaere navigationsakse
Kontrakter        — Kryds-portefoelje kontraktoverblik (dagligt vaerktoj for jurist/admin)
Opgaver           — Kryds-portefoelje opgavestyring (dagligt vaerktoj for alle)
Dokumenter        — Upload-hub med AI-ekstraktion
Soeg & Spoerg     — Unified intelligence query
──────────
Indstillinger
```

**Forskningsgrund:** NNGroup viser at 4 sidebar-items er for aggressivt — daglige vaerktoejer maa vaere synlige. 5-7 items er sweet spot. Skjult navigation performer daarligere paa alle maalbare metrikker.

### Soegefelt: Tre lag af tilgaengelighed

1. **Header:** Kompakt soegefelt altid synligt — "Soeg eller stil et spoergsmaal..."
2. **Ctrl+K:** Overlay-soegning (power user accelerator). Hint vises ved feltet.
3. **Dedikeret /search side:** Komplekse AI-svar og handlinger faar fuld plads.

### Sidebar-badges er rolle-tilpassede
Juristen ser "3 kontrakter kraever handling" paa Kontrakter. Direktoeren ser "2 lokationer underpraeesterer" paa Portefoelje.

---

## 3. Overblik (rolle-tilpasset startside)

### Dynamiske blokke
Siden er bygget af blokke der vises/skjules baseret paa rolle. Blokbiblioteket:

| Blok | Primaer for |
|------|------------|
| **Kraever handling** | Alle — opgaver, deadlines, udloebne kontrakter sorteret efter urgency |
| **Portefoelje-sundhed** | Direktoer, Admin — X aktive, Y kraever opmaarksomhed, trend |
| **Kontraktdaekning** | Jurist — daekning pr. kontrakttype, procentvisning |
| **Compliance-status** | Jurist — aabne sager, manglende dokumenter |
| **Finansielt overblik** | Oekonomi — omsaetning/EBITDA paa tvaers, afvigelser |
| **Datakvalitet** | Admin — ufuldstaendige stamdata, manglende info |
| **Seneste aktivitet** | Alle — uploads, aendringer, lukkede sager |
| **Kommende besoeg** | Direktoer, Admin — planlagte besoeg med dato |
| **Dokument-indbakke** | Alle — dokumenter der afventer AI-behandling/godkendelse |

### Rolle-tilpasningsregel (forskningsbaseret)
**Filtrer synlighed — omordner ALDRIG.** Blokke der vises er altid i samme raekkefoelge. En rolle ser faerre blokke, men de blokke der vises er altid i deres faste position. Dette bevarer spatial hukommelse (NNGroup/ScienceDirect).

### Indsigts-zone regler
- Maks 2 indsigter per side
- Hver indsigt skal have en direkte handlingslink
- Dismissible (brugeren kan lukke)
- Roterende (ikke den samme i flere sessioner)

---

## 4. Portefoelje

### Portefoelje-listen
**Liste-format med urgency-sortering** (ikke card grid — cards bryder ned ved 20+ enheder, jf. NNGroup).

To grupper:
1. **Kraever opmaarksomhed** — selskaber med urgency, sorteret efter alvorlighed
2. **Sunde lokationer** — med inline status-indikatorer

Subtekst under hvert selskab er rolle-tilpasset:
- Direktoer ser oekonomi og partnerskab-status
- Jurist ser kontraktdaekning og compliance
- Oekonomi ser tal og trends

### Selskabs-detaljeside
**Sektionsbaseret scroll-view — ingen tabs.** (Baymard: 27% overser indhold bag tabs. Collapsible sektioner performer bedst.)

Sektioner i fast raekkefoelge (aldrig omordnet pr. rolle):
1. Indsigter (kontekstuelt, rolle-tilpasset)
2. Stamdata
3. Ejerskab
4. Kontrakter
5. Oekonomi
6. Personer
7. Sager
8. Besoeg
9. Dokumenter

**Rolle-tilpasning:** Irrelevante sektioner skjules — raekkefoelgen aendres aldrig.

Kryds-referencer: "Se alle kontrakter paa tvaers ->" link fra selskabets kontrakt-sektion.

---

## 5. Dokumenter (AI-ekstraktion hub)

### Upload-flow
1. Bruger uploader dokument (drag-and-drop)
2. AI-analyse starter asynkront — brugeren kan fortsaette arbejdet
3. Multi-stage progress synlig: "Trin 3/4: Matcher mod eksisterende data..."
4. Notifikation naar analyse er klar

### Koe-moenster
- **Klar til gennemgang** — med confidence-indikator og hurtig-godkend for hoej-confidence dokumenter
- **Analyseres nu** — med stage-progress og tidsestimat
- **Sekventiel navigation:** "Naeste dok ->" efter gennemgang (som Gmail)
- **Batch-godkendelse:** Dokumenter med alle felter >95% confidence kan godkendes fra listen

### Gennemgangs-view (split-panel)
**60:40 ratio** (dokument stoerre — det er den primaere reference). Jf. Sweller's Split-Attention Principle.

**Visual linking:** Naar brugeren fokuserer paa et ekstraheret felt, highlightes den relevante passage i dokumentet (og omvendt).

**Tre-trins confidence-visning:**

| Confidence | Visning | Brugerhandling |
|-----------|---------|---------------|
| Hoej (>95%) | Groen, auto-godkendt, foldet sammen | Exception-based: kun synlig ved udfoldning |
| Medium (70-95%) | Amber, pre-udfyldt | Brugeren ser feltet, kan rette inline |
| Lav (<70%) | Roed, tomt felt | Brugeren SKAL manuelt udfylde |

**Anti-automation-bias (Parasuraman & Manzey):**
- Friktion paa kritiske felter (ejerandele, beloeb, udloebsdatoer) — ikke pre-checked
- Vis AI'ens reasoning: "Fundet paa side 4, §7: 'Partneren ejer 40% af anparterne'"
- Periodiske kalibrerings-checks: af og til uden AI-forslag

**Afvigelsesdetektion:**
- Maks 3 severity-niveauer
- Aggreger relaterede advarsler
- Vis delta eksplicit: "AI: 60/40 · System nu: 55/45"
- Hver advarsel har handling: [Brug AI-vaerdi] / [Behold eksisterende] / [Ret manuelt]

**Manglende klausuler:** AI ved hvad der BOER vaere i en dokumenttype og advarer naar noget mangler.

---

## 6. Soeg & Spoerg

### Et felt, dual output (forskningsbaseret)
Brugeren skriver i et felt. Systemet viser BEGGE resultater samtidigt:
- **Direkte matches** (oeverst) — selskaber, personer, kontrakter der matcher keywords
- **AI-svar** (nedenunder) — intelligent analyse hvis relevant

Ingen disambiguation noedvendig. Brugeren scanner med oejnene.

### Tre interaktionstyper
1. **Direkte soegning** — "Horsens" -> instant matches grupperet pr. entitetstype
2. **Naturligt sprogs-spoergsmaal** — "Hvilke lokationer mangler forsikring?" -> AI-svar med data
3. **Handlings-spoergsmaal** — "Opret en sag for manglende forsikringer" -> Intent Preview med godkendelse

### Soegeresultater
Federated search med maks 3-5 resultater per type + filter-tabs: `Alle | Selskaber | Personer | Kontrakter | Dokumenter`

### Foreslaaede spoergsmaal
- Kontekstuelle og rolle-tilpassede (ikke generiske)
- Maerket som "Forslag" (ikke de eneste muligheder)
- Roterende (ikke de samme hver gang)
- Baseret paa brugerens nuvaerende side og seneste aktivitet

### AI-handlinger: Act with Confirmation (Microsoft Design)
- Fuld Intent Preview foer udfoerelse
- Checkbox-godkendelse af individuelle elementer
- Aldrig auto-execute destructive operationer

### Follow-up spoergsmaal
- Kontekst-chip viser hvad systemet husker: "Fortsaetter fra: 'Horsens forsikring' [x]"
- Clear-knap nulstiller kontekst
- Navigation vaek nulstiller automatisk
- Latency under 2 sekunder

---

## 7. Kontrakter (kryds-portefoelje view)

### Forskel fra selskabets kontrakt-sektion
Selskabs-kontekst viser kontrakter for ET selskab i dybden. Kryds-portefoelje view viser ALLE kontrakter paa tvaers med moenstre og gaps.

### Layout
- Indsigts-zone (maks 2, handlingsanvisende, dismissible)
- Filter-tabs: `Alle | Udloeber snart | Manglende | Nyligt aendrede`
- Soegefelt + Grupper-dropdown (Type / Selskab / Status)
- "Kraever handling" gruppen oeverst (urgency-sorteret)
- Derefter collapsible grupper efter valgt dimension

### AI-intelligens
- **Daekning pr. kontrakttype:** "Forsikringsdaekning: 19/22 lokationer (86%)" — amber, ikke roed
- **Manglende kontrakter:** AI ved hvilke typer der BOER eksistere pr. lokation
- **Moenstre:** "3 lokationer har kontrakter der alle udloeber inden Q3"

---

## 8. Opgaver (kryds-portefoelje view)

### Tidsbaseret gruppering (default)
```
Forfaldne (6) -> Denne uge (4) -> Naeste uge (8) -> Senere (10) -> Ingen forfaldsdato (6)
```
**Forskningsgrund:** Eisenhower-matricen og kognitiv belastningsteori — tidsbaseret besvarer "hvad skal jeg goere NU?", status-baseret besvarer "hvad er tilstanden?"

### Filter-tabs
`Mine | Alle | Forfaldne | Afventer`

### AI-intelligens
- Spotter opgaver der er gaaet i staa ("afventer i 14+ dage")
- Selskabs-kontekst altid synlig ved hver opgave

---

## 9. Rolle-switcher (prototype-only)

### Aktivering
Kun synlig naar `NEXT_PUBLIC_PROTOTYPE_MODE=true` i `.env.local`. Fjernes helt i produktion.

### Tre kontroller
1. **Rolle-skift** — 5 foruddefinerede brugere med forskellige roller
2. **Selskabs-antal** — Simuler portefoelje-stoerrelse (5 / 22 / 56)
3. **Data-scenarie** — Normal / Mange advarsler / Tomt

### Brugere i prototypen

| Navn | Rolle | Selskaber |
|------|-------|-----------|
| Philip Jensen | GROUP_OWNER (Direktoer) | 22 (alle) |
| Maria Hansen | GROUP_LEGAL (Jurist) | 22 (alle) |
| Thomas Nielsen | GROUP_FINANCE (Oekonomi) | 22 (alle) |
| Sara Andersen | GROUP_ADMIN (Admin) | 22 (alle) |
| Lars Jensen | COMPANY_MANAGER | 3 (tildelte) |

---

## 10. Prototype-infrastruktur

### Mock-data

```
src/mock/
  users.ts              — 5 brugere med roller
  companies.ts          — 22 selskaber med varieret sundhed
  contracts.ts          — 142 kontrakter inkl. udloebne/manglende
  tasks.ts              — 34 opgaver inkl. forfaldne
  documents.ts          — Dokumenter med AI-ekstraktion mock
  financial.ts          — Oekonomi-data med trends
  insights.ts           — Pre-genererede AI-indsigter per rolle
  search-responses.ts   — Mock AI-svar paa foruddefinerede spoergsmaal
```

### Sitemap (11 sider)

```
/dashboard              — Overblik (rolle-tilpasset)
/portfolio              — Portefoelje-listen
/portfolio/[id]         — Selskabs-detalje (sektionsbaseret)
/contracts              — Kontrakter (kryds-portefoelje)
/contracts/[id]         — Kontrakt-detalje
/tasks                  — Opgaver (kryds-portefoelje)
/tasks/[id]             — Opgave-detalje
/documents              — Dokumenter (upload + AI-hub)
/documents/review/[id]  — Dokument-gennemgang (split-panel)
/search                 — Soeg & Spoerg (dedikeret side)
/settings               — Indstillinger
```

### Teknisk tilgang
- Bygges i eksisterende Next.js codebase med mock-data
- Eksisterende `ActionResult<T>` type genbruges
- Server Actions erstattes midlertidigt af mock-funktioner
- Tailwind CSS, Lucide icons, eksisterende komponent-moenstre
- Prototype-mode aktiveres via environment variable

---

## 11. Visuelt designsprog: "Nordisk kontrol-rum"

| Element | Beslutning |
|---------|-----------|
| Farvepalet | Slate sidebar, hvid workspace, farve KUN til urgency/status |
| Urgency | Roed border-left = handling nu, Amber = opmaarksomhed, Graa = normal |
| Daekning | Amber for mangler — ikke roed (mangel er ikke fejl) |
| Typografi | Distinkt display-font til headings, clean sans-serif til body |
| Whitespace | Generoest — data er taet, praesentation aander |
| Animation | Kun funktionel: indsigt glider ind = "dette er nyt" |
| Ikoner | Lucide (eksisterende) |
| Interaktion | Hele raekker klikbare, subtle hover, collapsible sektioner |

---

## 12. Forskningsgrundlag

Designbeslutninger er valideret mod foegende forskningskilder:

| Beslutning | Kilde | Noelefund |
|-----------|-------|-----------|
| Collapsible sektioner > tabs | Baymard Institute | 27% overser indhold bag tabs |
| Fast layout, skjul irrelevante sektioner | ScienceDirect 2025, NNGroup | 35% hurtigere task completion, men omordning forvirrer |
| 6 sidebar-items (ikke 4 eller 10) | NNGroup | Skjult navigation performer daarligere paa alle metrikker |
| Liste > cards ved 20+ enheder | NNGroup, Pencil & Paper | Cards bryder ned ved 12+ items |
| Ambient AI > chatbot | Smashing Magazine, UX Collective | Chatbots laegger byrden paa brugeren |
| Split-panel 60:40 med visual linking | Sweller (Split-Attention), legal tech | Reducerer kognitiv belastning |
| Tre-trins confidence | Agentic Design, Extend | Exception-based for hoej, editable for medium, manual for lav |
| Anti-automation-bias friktion | Parasuraman & Manzey 2010, Frontiers | Checkbox confirmation reducerer overafhaengighed |
| Maks 2 indsigter per side | NNGroup, IBM | Alert fatigue: 72-99% alarmer ignoreres ved overbelastning |
| Tidsbaseret opgavegruppering | Eisenhower, Todoist, kognitiv belastningsteori | Besvarer "hvad nu?" bedre end status-gruppering |
| Dual output (matches + AI-svar) | NNGroup 2026 | Brugere har dual mental model: lookup vs. exploration |
| Kontekst-chip ved follow-up | Google SGE, arXiv 2024 | Kontekst-bevarelse reducerer kognitiv belastning markant |
| Act with Confirmation | Microsoft Design, Smashing Magazine | Parasuraman levels 5-7 genererer mest tillid |
| Daekning (procent) > mangler (alarm) | DataKitchen, compliance UX | Amber for gaps, roed kun for fejl |
| 2-3 grupperings-valg | Smashing Magazine, NNGroup | Flere valg skaber beslutningslammelse |
| Horizontal tabs + dropdown chips | Baymard, Pencil & Paper | Tabs uegnede >6-8 typer, perfekte for 3-5 primaere filtre |
| Kryds-referencer mellem perspektiver | NNGroup hub-and-spoke | Brugere har brug for begge perspektiver med tydelige links |
| Asynkron dokument-analyse | NNGroup wait times | 30-60 sek kraever async + progress + notification |
