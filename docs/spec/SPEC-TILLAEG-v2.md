# SPEC-TILLÆG v2.1 — ChainHub Udvidelser

**Dato:** 2026-03-12
**Grundlag:** Brugerfeedback + UI-audit + gap-analyse + konkrete observationer
**Status:** GODKENDT (2026-03-12)
**Placering:** docs/spec/SPEC-TILLAEG-v2.md

---

## Baggrund

ChainHub v1 blev bygget i 6 sprints (31 routes, 48 tests, grøn build).
Resultatet er teknisk korrekt men har brug for UX-, kommerciel og domænegennemgang.
Denne spec dækker de identificerede forbedringer.

---

## DEL 0: KONKRETE UI-PROBLEMER OBSERVERET I NUVÆRENDE BUILD

Disse er observeret direkte i den kørende applikation og SKAL rettes.

---

### 0.1 Generelt problem: "Lange lister der bare løber nedad"

**Berørte sider:** Kontrakter, sager, opgaver, personer, dokumenter, og faner under selskab.

**Problem:** Alle lister renderer som `<table>` med ubegrænset rækkeantal og uden:

- Pagination (side 1/2/3 eller "vis mere")
- Filtrering (type, status, klinik, tidsperiode)
- Søgning (fritekst i listen)
- Grupperingsvisning (fx kontrakter grupperet pr. selskab eller pr. type)
- Visnings-toggle (tabel vs. kort-grid vs. kompakt)

**Krav:** ALLE lister i systemet SKAL have:

```
1. Pagination: Max 20 rækker pr. side. "Viser 1-20 af 47" + sidetal.
2. Søgning: Fritekst-søgefelt over listen (filtrer klient-side for <100 records).
3. Filtrering: Minimum 2 relevante filtre pr. liste (se pr. side nedenfor).
4. Sortering: Klikbare kolonnehoveder med pil-indikator.
5. Standardvisning: Den mest handlingsrettede visning som default.
```

---

### 0.2 Problem: Rå enum-værdier i UI

**Observeret:**

- Selskabslisten viser `under_stiftelse` (med underscore) i status-badge
- Opgavesiden viser `AKTIV_TASK` i stedet for "Aktiv"
- Kontrakttyper viser `EJERAFTALE`, `DIREKTOERKONTRAKT` i stedet for danske navne

**Årsag:**

- Selskabslisten bruger `{company.status}` direkte i stedet for `CompanyStatusBadge`-komponenten
- Prisma enum `AKTIV_TASK @map("AKTIV")` giver TypeScript-værdien `AKTIV_TASK`,
  men `STATUS_LABELS` mapper kun `AKTIV` → `Aktiv`
- Kontrakttyper har ingen display-name mapping overhovedet

**Krav — GLOBAL REGEL:**

```
Ingen rå enum-værdi, database-værdi eller SCREAMING_SNAKE_CASE tekst
må nogensinde vises til brugeren.

ALLE enums SKAL have et dansk display-name dictionary.
Fælles utility: src/lib/labels.ts — ét sted for ALLE enum-til-dansk mappings.
Eksempler:
  AKTIV_TASK         → "Aktiv"
  under_stiftelse    → "Under stiftelse"
  EJERAFTALE         → "Ejeraftale"
  DIREKTOERKONTRAKT  → "Direktørkontrakt"
  STRENGT_FORTROLIG  → "Strengt fortrolig"
  ANSAETTELSE_FUNKTIONAER → "Ansættelseskontrakt (funktionær)"

Alle komponenter SKAL bruge denne utility — aldrig inline labels.
```

---

### 0.3 Problem: Dashboard mangler kædeledelses-fokus

**Observeret:** Dashboardet har KPI-kort og selskabsgrid, men føles som et generisk overblik.
En kædeleder der åbner systemet om morgenen skal besvares: "Hvad kræver min opmærksomhed?"

**Krav — ny dashboard-struktur:**

```
TOP: "KRÆVER OPMÆRKSOMHED" (urgency panel)
  Prioriteret liste — maks 10 items, sorteret efter kritikalitet:
  🔴 Forfaldne opgaver (X stk — "Send revideret NDA til modpart, 1 dag forfalden")
  🔴 Kontrakter der udløber inden 14 dage ("Lejekontrakt Østerbro — 25 dage")
  🟡 Sager der afventer handling ("Lejeforhandling Østerbro — afventer modbud")
  🟡 Planlagte besøg der er overskredet
  Hvert item: klikbart → direkte link til kilden

MIDT: KPI-KORT (eksisterende — beholdes, evt. med trends)
  + Evt. trend-indikator: "↑ 2 nye sager denne uge"

BUND: SELSKABSGRID (cards i stedet for tabel)
  Hvert kort: Navn + status-badge + ejerandel + nøglepersoner +
              "3 kontrakter · 1 sag · Sidste besøg: 14/2"
  Filtre: Status / "Vis kun med åbne issues"
  Sortering: Navn / Seneste aktivitet / Antal åbne issues
```

---

### 0.4 Problem: Selskabslisten er en generisk tabel

**Observeret:** Tabel med navn, CVR, status, kontrakter, sager. Viser `under_stiftelse` råt.

**Krav:**

```
Erstat tabel med CARD-GRID (responsive 2-3 kolonner):
  Hvert kort:
    Selskabsnavn (bold, klikbart)
    CVR + selskabsform
    Status-badge (CompanyStatusBadge — ALTID)
    Nøglepersoner: Direktør [navn], Souschef [navn] (top 2)
    KPI-linje: X kontrakter · Y sager · Z åbne opgaver
    Evt. alert: "⚠ Lejekontrakt udløber om 25 dage"

  Filter-bar over grid:
    Status (dropdown) · Søg (fritekst) · Sortering (dropdown)

  Alternativ: Toggle mellem "Kort" og "Tabel" visning.
```

---

### 0.5 Problem: Selskabsprofil starter med stamdata-formular

**Observeret:** Når man åbner et selskab, lander man på en redigeringsformular for stamdata.
Det er ikke det en kædeleder har brug for — de vil se status og handlinger.

**Krav — ny fane-rækkefølge + "Overblik" som default:**

```
FANER (ny rækkefølge):
  1. Overblik (NY — default ved åbning)
  2. Stamdata (nuværende — men redigering er sekundær)
  3. Kontrakter
  4. Sager
  5. Ansatte
  6. Ejerskab
  7. Governance
  8. Økonomi
  9. Dokumenter
  10. Aktivitetslog

"OVERBLIK"-FANE:
  Venstre kolonne:
    Stamdata-resumé (read-only): Navn, CVR, adresse, status
    Nøglepersoner: Direktør + souschef + kontaktperson (med tlf/email)
    [Rediger stamdata] knap → navigerer til Stamdata-fane

  Højre kolonne — KPI-kort:
    Åbne opgaver (X stk, Y forfaldne)
    Aktive kontrakter (X stk, Y udløber snart)
    Aktive sager (X stk)
    Sidste besøg: [dato] — [X åbne handlingspunkter]
    Økonomi: Omsætning [X] DKK (seneste år)

  Alerts-sektion:
    🔴 "Lejekontrakt udløber om 25 dage — forhandling påkrævet"
    🔴 "2 forfaldne opgaver"
    🟡 "3 åbne handlingspunkter fra besøg d. 14/2"

  Quick-actions:
    [Planlæg besøg] [Opret opgave] [Ny kontrakt] [Tilføj notat]
```

---

### 0.6 Problem: Ejerskab-fanen — uforståelig advarsel

**Observeret:** "⚠️ Samlet ejerandel er 45.00% — forventet 100%"

**Problem:** Seed-data har kun personlige ejere. Holdingselskabet der ejer de øvrige 55% er ikke registreret. Advarslen er teknisk korrekt men uforståelig.

**Krav:**

```
Erstat med kontekstuel besked:
  "Registrerede ejere udgør 45% af selskabet.
   [Tilføj resterende ejerandel] for at nå 100%."

Ejerskabs-visning:
  Vis som visuel EJER-DIAGRAM (fx simpel bar eller cirkeldiagram)
  Pr. ejer: Navn + % + type (person/selskab) + ejeraftale-link
  "Uregistreret andel: 55%" (klikbar → opret ny ejer)

Understøt selskab-som-ejer (owner_company_id — eksisterer i schema, mangler i UI):
  Dropdown: "Person" / "Selskab" → søg i hhv. personer og selskaber i systemet
```

---

### 0.7 Problem: Governance, ansatte, kontrakter, sager, økonomi, dokumenter, aktivitetslog — alle faner

**Observeret:** Alle faner under selskab har samme mønster: en tabel eller liste uden
filtrering, søgning, eller visuel hierarki. De er funktionelle men ikke intuitive.

**Generelle krav til ALLE faner under selskab:**

```
1. Header med count + CTA:
   "Ansatte (8)" + [+ Tilføj ansat]
   "Kontrakter (12)" + [+ Ny kontrakt]

2. Kontekstuelle alerts øverst i fanen:
   Ansatte: "2 ansatte uden tilknyttet ansættelseskontrakt"
   Kontrakter: "1 kontrakt udløber inden for 30 dage"
   Sager: "1 sag afventer klient-input"

3. Søgefelt + relevante filtre
   Ansatte: Aktive/fratrådte, rolle/stilling
   Kontrakter: Status, type, sensitivity
   Sager: Status, type

4. Tabel med klikbare rækker (ikke bare link i første kolonne)

5. Tom-state med kontekstuel CTA
   "Ingen ansatte registreret for dette selskab. [Tilføj ansat]"
```

**Ansatte-fanen specifikt:**

```
Vis rolle/stilling tydeligt (Direktør, Tandplejer, Klinikassistent etc.)
Vis tilknyttet kontrakt: "Ansættelseskontrakt ✓" / "Ingen kontrakt ⚠"
  [Tilknyt kontrakt] → søg eksisterende ELLER opret ny
  [Download kontrakt] → direkte download af kontraktdokument
Brugerdefinerede stillingsbetegnelser (fritekst — ikke enum)
```

---

### 0.8 Problem: Persondatabasen mangler roller og er uoverskuelig

**Observeret:** Liste med navn, email, telefon, antal tilknytninger. Ingen information
om hvad personen er — direktør, funktionæransat, revisor, advokat.

**Krav:**

```
PERSONLISTE — udvidet visning:
  Card-grid ELLER tabel med:
    Navn + avatar-initial
    Primær rolle/stilling (den højeste/vigtigste)
    Tilknyttede selskaber: "Tandlæge Østerbro (Direktør), Tandlæge Aarhus (Bestyrelsesmedlem)"
    Kontaktinfo: email + telefon
    Tags: Direktør, Tandlæge, Ansat, Leverandør, Rådgiver (farvekodede)

  Filtre: Rolle/tag, selskab, søg på navn/email

PERSON-PROFIL (/persons/[id]) — udvidet:
  Header: Navn + primær rolle + kontaktinfo
  Sektioner:
    1. Tilknytninger: Liste over selskaber med rolle + startdato
    2. Kontrakter: Alle kontrakter personen er part i
    3. Sager: Alle sager personen er tilknyttet
    4. Dokumenter: Ansættelseskontrakt, direktørkontrakt etc.
    5. Aktivitetslog

Stillingsbetegnelser:
  Fritekst — brugeren definerer selv (Tandplejer, Klinikassistent,
  Receptionist, Tandlæge, Souschef etc.)
  System foreslår baseret på eksisterende titler i organisationen (autocomplete)
```

---

### 0.9 Problem: Dokumentsiden er en kontekstløs liste

**Observeret:** Alle dokumenter på tværs af selskaber i én lang tabel.
Når man har 50+ dokumenter fordelt på 7 selskaber er det ubrugeligt.

**Krav:**

```
DOKUMENTOVERSIGT — grupperet visning:
  Default: Grupperet pr. selskab
    "Tandlæge Østerbro (6 dokumenter)"
      - Ejeraftale — underskrevet.pdf
      - Lejekontrakt — Østerbrogade 123.pdf
      - ...
    "Tandlæge Aarhus (3 dokumenter)"
      - ...

  Alternativ: Flat liste med selskabs-kolonne + filtre

  Filtre: Selskab, filtype (PDF/DOCX), sensitivity, periode
  Søg: Fritekst i titel/filnavn

UPLOAD (mangler helt — NEED-TO-HAVE):
  Drag-and-drop zone + filbrowser
  Tilknyt til: Selskab (påkrævet) + kontrakt/sag (valgfrit)
  Sensitivity: Dropdown (default: arves fra kontekst)
  Accepterede typer: PDF, DOCX, XLSX, PNG, JPG (max 25 MB)
  Storage: Cloudflare R2 under /{organization_id}/{company_id}/
```

---

### 0.10 Problem: Sidebar og header mangler identitet og kontekst

**Observeret:** Sidebar er ren navigation uden kontekst. Header viser kun navn + non-funktionel klokke.

**Krav — se DEL 2, Udvidelse G nedenfor.**

---

## DEL 1: NYE MODULER

---

### Modul A — Besøgsstyring (Site Visits)

**Prioritet:** HØJ — kernefeedback fra kædeledelse
**URL:** `/visits` (global) + `/companies/[id]/visits` (pr. selskab)
**Adgang:** GROUP_OWNER, GROUP_ADMIN, GROUP_LEGAL, COMPANY_MANAGER

#### Formål

HQ-medarbejdere besøger klinikker/lokationer regelmæssigt. Systemet skal dokumentere
hvad der blev gennemgået, hvem der deltog, og hvilke handlingspunkter der kom ud af det.

#### Datamodel (nye tabeller)

```
visits
  id                  UUID PK
  organization_id     UUID FK → organizations
  company_id          UUID FK → companies
  title               TEXT                         -- fx "Kvartalsbesøg Q1 2025"
  visit_date          DATE
  visit_type          VisitType ENUM               -- KVARTALSBESOEG, OPFOELGNING, AD_HOC, AUDIT, ONBOARDING, OVERDRAGELSE
  status              VisitStatus ENUM             -- PLANLAGT, GENNEMFOERT, AFLYST
  summary             TEXT                         -- referat / hovedkonklusioner
  next_visit_date     DATE?
  created_at          TIMESTAMPTZ
  created_by          UUID FK → users
  deleted_at          TIMESTAMPTZ?

visit_participants
  id                  UUID PK
  organization_id     UUID FK
  visit_id            UUID FK → visits
  user_id             UUID? FK → users             -- intern HQ-bruger
  person_id           UUID? FK → persons           -- ekstern deltager
  role                TEXT                          -- "Besøgende", "Klinikchef", "Souschef"
```

#### UI-flows

```
BESØGSLISTE (/visits):
  Card-grid eller tabel: Klinik | Type | Dato | Deltagere | Åbne handlingspunkter | Status
  Filter: Klinik, type, periode, status
  Rød badge hvis planlagt besøg er overskredet

BESØGSDETALJE (/visits/[id]):
  Header: Klinik + dato + type + status
  1. Deltagere (HQ + klinik)
  2. Referat / noter
  3. Handlingspunkter (oprettes direkte herfra → Task med source_type=BESOEG)
  4. Vedhæftede dokumenter

SELSKABSPROFIL — "Besøg" sektion i overbliksfanen:
  "Sidste besøg: 14/2-2025 — 3 åbne handlingspunkter"
  [Planlæg besøg]
```

---

### Modul B — Udvidet opgavestyring (handlingsplaner / action items)

**Prioritet:** HØJ — kernefeedback
**Kobling:** Udvider eksisterende Task-model

#### Nye kolonner til `tasks`

```
  source_type         TEXT?    -- 'BESOEG' / 'SAG' / 'MOEDE' / 'STANDALONE'
  source_id           UUID?    -- FK → visits / cases
  agreed_with_name    TEXT?    -- hvem på klinikken blev det aftalt med
  agreed_with_person  UUID? FK → persons
  agreed_date         DATE?
```

#### Nye tabeller

```
task_participants    -- flere deltagere pr. opgave
  id, organization_id, task_id, user_id, role ('ANSVARLIG'/'DELTAGER'/'OBSERVATOER')

task_comments        -- tråd pr. opgave
  id, organization_id, task_id, user_id, content, created_at

task_history         -- fuld historik pr. opgave
  id, organization_id, task_id, user_id, field, old_value, new_value, created_at
```

#### UI-ændringer

```
OPGAVELISTE:
  Tilføj kolonner: Kilde (ikon), deltagere (avatarer), aftalt med
  Tilføj: Kanban-visning (NY | AKTIV | AFVENTER | LUKKET) med drag-and-drop
  Tilføj: Kalendervisning

OPGAVEDETALJE:
  Kilde-kontekst: "Oprettet under besøg på Østerbro d. 14/2" (klikbart)
  Deltagere med roller
  Kommentartråd med tidsstempler
  Historik: "Philip ændrede status fra NY → AKTIV d. 15/2 kl. 09:33"
```

---

### Modul C — Tværgående kalender

**Prioritet:** MELLEM
**URL:** `/calendar`

#### UI

```
Måned / uge / dagvisning med farvekodede events:
  🔴 Forfaldne + kritiske frister
  🟠 Udløber snart (30 dage)
  🔵 Planlagte besøg
  🟢 Opgave-deadlines
  ⚫ Sags-frister

Filtre: Event-type (toggle) · Klinik · Ansvarlig
Klik event → slide-over med detaljer + link
Klik dato → opret opgave/besøg

Datakilder (aggregerer — ingen separat tabel):
  contracts.expiry_date, tasks.due_date, visits.visit_date,
  cases.due_date, deadlines.due_date
```

---

### Modul F — Notater / Kommunikationslog pr. selskab

**Prioritet:** MELLEM
**URL:** Integreret i selskabsprofil

#### Datamodel

```
company_notes
  id, organization_id, company_id, content, pinned, created_at, created_by, updated_at, deleted_at
```

#### UI

```
SELSKABSPROFIL — ny fane "Notater" (eller sektion i overbliksfane):
  Kronologisk feed (nyeste øverst)
  Fastgjorte noter øverst (gul baggrund)
  Pr. notat: avatar + navn + tid + indhold
  [+ Ny notat] → inline textarea (hurtig indtastning)
  Søgning i noter
```

---

## DEL 2: UDVIDELSER AF EKSISTERENDE MODULER

---

### Udvidelse G — Bruger-identitet og rollesynlighed i UI

**Problem:** Brugeren ved ikke hvem de er eller hvad de har adgang til.

```
SIDEBAR — udvidet:
  Øverst: Organisation-logo + navn (fx "TandlægeGruppen A/S")

  Navigation med live counts + badges:
    Dashboard
    Selskaber (7)
    Kontrakter (18)
    Sager (4) 🔵
    Opgaver (9) 🔴 2
    Besøg (NY)
    Kalender (NY)
    Personer (10)
    Dokumenter (8)

  "Senest besøgt" sektion:
    3-5 seneste selskaber (klikbare)

  Nederst:
    Avatar + navn + rolle-badge
    "Philip Larsen · Kædeejer"
    [▼] → Min profil | Indstillinger | Log ud

ROLLE DISPLAY-NAMES:
  GROUP_OWNER      → Kædeejer
  GROUP_ADMIN      → Kædeadministrator
  GROUP_LEGAL      → Juridisk ansvarlig
  GROUP_FINANCE    → Økonomisk ansvarlig
  GROUP_READONLY   → Revisor / Læseadgang
  COMPANY_MANAGER  → Klinikchef
  COMPANY_LEGAL    → Klinikjurist
  COMPANY_READONLY → Klinik-læseadgang

UI-GUARDS:
  Knapper brugeren ikke har adgang til → skjules helt
  Sider brugeren ikke har adgang til → redirect med toast
  Scope-indikator: "Du har adgang til 3 af 7 selskaber"
  Sensitivity-indikator: "18 kontrakter (3 skjulte pga. fortrolighed)"
```

---

### Udvidelse H — Brugerstyring (/settings/users)

**Status:** Spec eksisterer, UI er placeholder.

```
BRUGERLISTE: Navn | Email | Roller (badges) | Status | Sidst aktiv
INVITÉR (slide-over): Email + rolle + scope + seat-tjek
REDIGER ROLLER (slide-over): Nuværende roller + tilføj/fjern + historik
MIN PROFIL (/settings/profile): Navn, roller (read-only), skift password
```

---

### Udvidelse I — Organisation-indstillinger

```
/settings: Gruppenavn, CVR, logo, advis-standarder
/settings/billing: Plan, seats, faktura-historik (Stripe Portal)
/settings/integrations: Microsoft 365 tilslutning
```

---

## DEL 3: MANGLENDE FUNKTIONALITET

---

### Dokument-upload (Cloudflare R2)

```
Upload: Drag-and-drop + filbrowser (PDF, DOCX, XLSX, PNG, JPG — max 25 MB)
Storage: Cloudflare R2: /{organization_id}/{company_id}/{uuid}/{filename}
Preview: PDF in-browser, billeder inline, DOCX metadata + download
Tilknytning: Selskab (påkrævet) + kontrakt/sag (valgfrit)
Sensitivity: Dropdown — arves fra kontekst
```

### Kontraktversioner + bilag-upload

```
Kontrakt-detaljeside — "Dokumenter" sektion:
  Versioner: v3 (aktuel) → v2 → v1 med dato og ændringstype
  Bilag: Bilag 1, Bilag 2... med upload/download
  [Upload ny version] → auto-increment version_number
```

### Ansættelses-/direktørkontrakt tilknyttet person

```
Ansatte-fane → klik ansat → "Kontrakt: Ingen tilknyttet" [Tilknyt]
  → Tilknyt eksisterende kontrakt ELLER opret ny
  → Upload kontraktdokument som del af oprettelsen
  → [Download kontrakt] direkte fra ansatte-listen

Samme flow: Governance → Direktør → Direktørkontrakt
```

---

## DEL 4: DESIGNPRINCIPPER

---

### Designfilosofi

```
ChainHub er et kædeledelses-værktøj, ikke et generisk CRM.
Hvert skærmbillede besvarer ét spørgsmål:

  1. "Hvad kræver min opmærksomhed nu?"      → Dashboard urgency panel
  2. "Hvad er status på denne klinik?"        → Selskabs-overblik
  3. "Hvad aftalte vi sidst?"                 → Besøgs- og opgavehistorik
  4. "Hvem er ansvarlig?"                     → Rolle- og deltagersynlighed
  5. "Hvornår udløber noget vigtigt?"         → Kalender og advarsler
```

### Visuel hierarki

```
FARVER (semantiske — bruges konsistent i hele systemet):
  🔴 Rød (#DC2626):     Forfaldent / kritisk / handling NU
  🟠 Orange (#EA580C):  Advarsel / udløber snart / planlæg
  🔵 Blå (#2563EB):     Aktiv / informativ / navigation
  🟢 Grøn (#16A34A):    OK / gennemført / ingen handling
  ⚫ Grå (#6B7280):     Lukket / arkiveret / inaktiv

BADGES (roller): Blå=kæde, lilla=juridisk, grøn=økonomi, orange=klinik, grå=læseadgang
SENSITIVITY: 🔴 lås=strengt fortrolig, 🟠 lås=fortrolig, ⚫ lås=intern, ingen=standard/public
```

### Need-to-have vs. Nice-to-have

```
NEED-TO-HAVE (Sprint 7-8):
  ☐ Alle enum-værdier mapped til danske display-names (global utility)
  ☐ Pagination + filtre + søgning på ALLE lister
  ☐ Dashboard urgency panel
  ☐ Selskabs-overbliksfane med alerts og KPI'er
  ☐ Rollesynlighed (sidebar, min profil)
  ☐ Brugerstyring + rolleadministration
  ☐ Dokument-upload (Cloudflare R2)
  ☐ Kontraktversioner + bilag
  ☐ Ansættelseskontrakt-upload tilknyttet person
  ☐ Besøgsstyring med handlingspunkter
  ☐ Opgave-deltagere + historik + kommentarer
  ☐ Card-grid visning for selskaber og personer

NICE-TO-HAVE (Sprint 9):
  ☐ Tværgående kalender
  ☐ Notater/kommunikationslog pr. selskab
  ☐ Kanban + kalendervisning for opgaver
  ☐ Sidebar med live counts + senest besøgte
  ☐ Global søgning i header
  ☐ Ejerskabs-diagram (visuel)

FASE 2 (efter betalende kunder):
  ☐ Microsoft 365-integration
  ☐ Stripe Billing
  ☐ Email-advisering (90/30/7 dage)
  ☐ Operationelle KPI'er pr. klinik
```

---

## DEL 5: PROCES-ÆNDRINGER

---

### UX-principper (fra spec-review)

```
Udfordr specifikt:
  - Er dette skærmbillede intuitivt for en kædeleder der bruger det 20 min om dagen?
  - Kan brugeren besvare "hvad kræver min opmærksomhed?" inden for 3 sekunder?
  - Er der for mange klik til den mest almindelige handling?
  - Er visuelt hierarki korrekt — vigtigste info mest fremtrædende?
  - Er tomme tilstande motiverende (ikke bare "ingen data")?
  - Er konsistens i designmønstre overholdt på tværs af alle sider?
  - Er farve-semantik korrekt — rød=fare, orange=advarsel, blå=info, grøn=ok?
```

### Sprint 7-9

```
Sprint 7 — UI Foundation + Enum Fix ✅ FÆRDIG
  Fix alle enum display-names (global labels.ts)
  Pagination + filtre + søgning på alle lister
  Card-grid for selskaber og personer
  Dashboard urgency panel
  Selskabs-overbliksfane
  Sidebar med roller + counts

Sprint 8 — Accountability + Dokumenter
  Besøgsstyring (nyt modul)
  Opgave-udvidelser (deltagere, historik, kommentarer)
  Dokument-upload (Cloudflare R2)
  Kontraktversioner + bilag
  Brugerstyring (/settings/users)

Sprint 9 — Polish + Kalender
  Tværgående kalender
  Notater pr. selskab
  Kanban-visning opgaver
  Global søgning
  Organisation-indstillinger
```

---

## Changelog

```
v2.2 (2026-03-12): DEC-F0-001 til DEC-F0-017 implementeret. Status: GODKENDT.

v2.1 (2026-03-12):
  + DEL 0 tilføjet: Konkrete UI-problemer observeret i kørende app
  + UX-principper tilføjet
  + Sprint 7 fokuseret på UI foundation FØRST (enum-fix, pagination, cards)

v2.0 (2026-03-12):
  Første udkast — nye moduler + udvidelser + manglende funktionalitet
```
