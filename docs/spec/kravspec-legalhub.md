# Kravspecifikation: ChainHub — Porteføljestyring for kæder med delejede lokationsselskaber

**Version 2.3**
**Målgruppe for produktet:** Kæder/grupper der co-ejer lokationsselskaber med lokale partnere (tandlæge-, optiker-, fysio-, franchise-kæder)

---

## 1. Produkt-vision

Et web-baseret SaaS-system der giver kædegruppen **ét samlet overblik** over alle delejede selskaber (lokationer) — med fuld kontrol over governance-lag, kontrakter, økonomi og personrelationer. Tænk: "HoldCo command center."

Analogien der definerer arkitekturen:
```
McDonald's Corp.     →  Kædegruppen (brugerne af systemet)
McDonald's lokation  →  Klinikselskabet (ApS med CVR)
Franchise-ejer       →  Lokal partner (fx tandlægen)
McDonald's som part  →  Holdingselskabet (medejer via ejeraftale)
Restaurantchef       →  Direktør i klinik-ApS
```

---

## 2. Kernedatamodel

```
GRUPPE (tenant — kædegruppen)
└── SELSKAB (en klinik/lokation)
    ├── CVR, navn, adresse, stiftelsesdato, status
    ├── EJERSKAB (ejeraftale, ejerandel %, part → person/selskab)
    ├── ROLLER (direktør, bestyrelsesmedlem, tegningsberettiget...)
    │   └── PERSON (navn, email, tlf, CPR-ref, start/slutdato)
    ├── ANSATTE (klinikassistenter, behandlere, administration)
    │   └── PERSON + ansættelsestype + kontrakt-reference
    ├── KONTRAKTER (ejeraftale, direktørkontrakt, lejekontrakt, leverandør...)
    ├── SAGER (tvister, M&A-processer, compliance, generelle)
    ├── OPGAVER (deadlines, frister, to-do)
    ├── DOKUMENTER (alle filer tilknyttet selskabet)
    └── ØKONOMI (nøgletal, fakturaer, tidsregistrering)
```

Alle PERSONER er centrale kontakter på tværs — én person kan have roller i flere selskaber.

---

## 3. Tech Stack

```
Frontend:     Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
Backend:      Next.js API Routes + Prisma ORM
Database:     PostgreSQL
  - Multi-tenancy: organization_id på alle tabeller
  - Soft delete på kritiske records
Auth:         NextAuth.js (email/password + Microsoft OAuth/SSO)
Storage:      Cloudflare R2 (dokumenter, PDF-preview)
Email:        Microsoft Graph API (Outlook-integration)
Betalinger:   Stripe Billing (per-seat subscriptions)
Hosting:      Vercel (frontend) + Railway eller Supabase (database)
Search:       PostgreSQL full-text search (fase 1) → Meilisearch (fase 2)
```

---

## 4. Brugerroller

Roller er defineret i SCREAMING_SNAKE_CASE og matcher `UserRole`-enum i databaseskemaet.

### Gruppe-niveau (scope: ALL)

```
GROUP_OWNER     Fuld adgang til alt inkl. fakturering og brugerstyring
GROUP_ADMIN     Fuld adgang til alle selskaber, ingen fakturering
GROUP_LEGAL     Kontrakter + sager på tværs — ingen økonomi
GROUP_FINANCE   Økonomi-overblik på tværs — ingen kontrakter
GROUP_READONLY  Kun se — ingen redigering (typisk revisor/ekstern rådgiver)
```

### Selskabs-niveau (scope: ASSIGNED/OWN)

```
COMPANY_MANAGER  Fuld adgang til tildelte selskaber
COMPANY_LEGAL    Kontrakter + sager for tildelte selskaber
COMPANY_READONLY Kun se for tildelte selskaber
```

### Fase 2 — ekstern adgang (ikke MVP)

```
EXTERNAL_PARTNER   Tandlæge-medejer ser sin klinik (begrænset)
EXTERNAL_EMPLOYEE  Ansat ser egne dokumenter
```

Én bruger kan have flere rolle-tildelinger via `user_role_assignments`-tabellen (fx `GROUP_LEGAL` på tværs + `COMPANY_MANAGER` på én specifik klinik).

---

## 5. Data-sensitivitetsniveauer

Alle records tildeles ét af disse `SensitivityLevel`-enum-værdier:

| Niveau | Kode | Eksempler |
|---|---|---|
| Strengt fortroligt | `STRENGT_FORTROLIG` | Ejeraftale, aktionæroverenskomst, M&A-dokumenter |
| Fortroligt | `FORTROLIG` | Direktørkontrakt, bestyrelsesreferater, økonominøgletal |
| Internt | `INTERN` | Lejekontrakt, leverandøraftaler, sager |
| Normalt | `STANDARD` | Ansættelseskontrakter, opgaver, kontaktinfo |
| Offentligt | `PUBLIC` | Stamdata (CVR, adresse, selskabsnavn) |

---

## 6. Moduler

---

### 6.1 Portfolio-dashboard (startsiden)

Gruppens overblik over **alle selskaber på én gang.**

- Kort/tabel-visning af alle selskaber med:
  - Status (Aktiv / Under stiftelse / Under afvikling)
  - Ejerandel %
  - Antal aktive sager
  - Antal udløbende kontrakter (næste 90 dage)
  - Forfaldne opgaver
- Klik på et selskab → åbner selskabets detaljeside
- Filtrer på: status, region, ejerandel, sagstype
- Hurtig-søgning på tværs af alle selskaber, personer og kontrakter

---

### 6.2 Selskabsprofil

Hvert selskab har en struktureret profil:

**Stamdata-fane:**
- Selskabsnavn, CVR, selskabsform (ApS/A/S/I/S)
- Adresse, stiftelsesdato, regnskabsår
- Status: Aktiv / Under stiftelse / Under afvikling / Solgt
- Interne noter og tags

**Ejerskab-fane:**
- Liste over ejere med: navn, ejerandel %, ejertype (person/selskab), dato for erhvervelse
- Reference til ejeraftale-dokument
- Historik: tidligere ejere og ændringer

**Governance-fane:**
- Roller i selskabet:
  ```
  Direktør              → Person + startdato + direktørkontrakt-reference
  Bestyrelsesformand    → Person + startdato
  Bestyrelsesmedlem     → Person + startdato
  Tegningsberettiget    → Person(er)
  Revisor               → Person/firma
  ```
- Advarsel hvis rolle er vakant eller person-kontrakt udløber

**Ansatte-fane:**
- Liste over klinikansatte med: navn, rolle/stilling, ansættelsestype, startdato, kontrakt-reference
- Filtrer: aktive / fratrådte / vikarer
- Ikke fuld HR-system — kontaktregister med kontrakt-tilknytning

**Aktivitetslog:**
- Alle handlinger på selskabet med dato og bruger

---

### 6.3 Persondatabase (central kontaktbog)

Én global personbog på tværs af alle selskaber.

- Felter: fuldt navn, email, tlf, adresse, CVR/CPR-reference (ingen CPR gemt i klar tekst — kun notat om at det forefindes)
- Tags: tandlæge, direktør, bestyrelsesmedlem, ansat, leverandør, rådgiver...
- En person kan have **tilknytninger til flere selskaber** med forskellige roller
- Aktivitetslog: alle sager, kontrakter, opgaver personen er tilknyttet
- **Outlook-import:** Importér kontakter fra Microsoft 365 adressebog

---

### 6.4 Kontraktstyring

Alle kontrakter organiseret pr. selskab og tilgængelige globalt.

**Kontrakttyper (`ContractSystemType`-enum — fuld liste):**
```
-- Lag 1: Universelle
EJERAFTALE              DIREKTØRKONTRAKT        OVERDRAGELSESAFTALE
AKTIONÆRLÅN             PANTSÆTNING             VEDTÆGTER
ANSÆTTELSE_FUNKTIONÆR   ANSÆTTELSE_IKKE_FUNKTIONÆR  VIKARAFTALE
UDDANNELSESAFTALE       FRATRÆDELSESAFTALE      KONKURRENCEKLAUSUL
PERSONALEHÅNDBOG        LEJEKONTRAKT_ERHVERV    LEASINGAFTALE
LEVERANDØRKONTRAKT      SAMARBEJDSAFTALE        NDA
IT_SYSTEMAFTALE         DBA                     FORSIKRING
GF_REFERAT              BESTYRELSESREFERAT      FORRETNINGSORDEN
DIREKTIONSINSTRUKS      VOA

-- Lag 2: Strukturtyper (kæde/co-ownership — aktiveres via chain_structure-flag)
INTERN_SERVICEAFTALE    ROYALTY_LICENS          OPTIONSAFTALE
TILTRÆDELSESDOKUMENT    KASSEKREDIT             CASH_POOL
INTERCOMPANY_LÅN
```

**Pr. kontrakt:**
- Titel, type (`system_type`), `display_name` (brugerens eget navn), status, parter (tilknyttet personer/selskaber i systemet)
- Startdato, udløbsdato, opsigelsesvarsel
- Upload fil (PDF/DOCX) — preview i browser
- Versionsstyring med historik
- Automatisk advisering: X dage før udløb (konfigurerbart pr. kontrakttype)
- Interne noter
- Sensitivitetsniveau (`STANDARD` som default)

**Kontraktstatus-flow (`ContractStatus`-enum):**
```
UDKAST → TIL_REVIEW → TIL_UNDERSKRIFT → AKTIV → UDLOBET / OPSAGT / FORNYET / ARKIVERET
```

**Globalt kontraktoverblik:**
- Se alle kontrakter på tværs af selskaber
- Filter: type, status, udløber inden for 30/60/90 dage
- Rød markering: udløbet eller udløber inden for 14 dage

---

### 6.5 Sagsstyring

Sager er strukturerede arbejdsopgaver/processer tilknyttet ét eller flere selskaber.

**Sagstyper (`SagsType`-enum) med undertyper (`SagsSubtype`-enum):**
```
TRANSAKTION   → VIRKSOMHEDSKØB, VIRKSOMHEDSSALG, FUSION, OMSTRUKTURERING, STIFTELSE
TVIST         → RETSSAG, VOLDGIFT, FORHANDLING_MED_MODPART, INKASSO
COMPLIANCE    → GDPR, ARBEJDSMILJØ, MYNDIGHEDSPÅBUD, SKATTEMÆSSIG
KONTRAKT      → FORHANDLING, OPSIGELSE, FORNYELSE, MISLIGHOLDELSE
GOVERNANCE    → GENERALFORSAMLING, BESTYRELSESMØDE, VEDTÆGTSÆNDRING, DIREKTØRSKIFTE
ANDET         → (ingen subtype — fritekst i beskrivelse)
```

**Pr. sag:**
- Titel, type (`case_type`), undertype (`case_subtype`), status, ansvarlig (intern bruger), tilknyttede selskaber/personer
- Beskrivelse og løbende noter
- Frister med advisering
- Sensitivitetsniveau (`INTERN` som default)
- Tilknyttede dokumenter
- Tilknyttede kontrakter
- Opgave-liste (delsager)
- Tidsregistrering (timer × timepris til intern fakturering)
- **Outlook email-sync:** Pin en email til sagen via BCC til sagsemail

**Sagsstatus (`CaseStatus`-enum):**
```
ÅBEN → I_GANG → AFVENTER → LUKKET / ANNULLERET
```

---

### 6.6 Opgave- & deadlinestyring

- Opgaver kan oprettes frit eller fra en sag
- Felter: titel, beskrivelse, ansvarlig, deadline, prioritet (lav/mellem/høj/kritisk), status
- **Opgavestatus (`TaskStatus`-enum):** `NY → AKTIV → AFVENTER → LUKKET`
- Visninger: **Kanban** (pr. status) + **Listevisning** + **Kalendervisning**
- Forfaldne opgaver fremhæves med rød markering overalt i systemet
- Daglig email-digest til bruger (via Outlook/Graph API)
- **Outlook Calendar push:** Deadlines synkroniseres til brugerens Outlook-kalender

---

### 6.7 Økonomi-overblik (light)

Ikke et regnskabssystem — et overblagsmodul til intern styring.

- Nøgletal pr. selskab: omsætning, resultat, egenkapital (manuelt indskrevet eller importeret)
- Tidsregistrering fra sager → intern fakturaoversigt (hvad koster vores tid på dette selskab)
- Udbyttenotering: log over udlodninger pr. selskab pr. år
- **Ikke:** bogføring, momsafregning, årsrapport — det er revisorens felt

---

### 6.8 Dokumenthåndtering

- Central dokumentmappe pr. selskab + global søgning
- Mappestruktur (vejledende — brugerdefineret pr. selskab via `folder_path`):
  ```
  /stiftelse
  /ejeraftaler
  /kontrakter
  /bestyrelsesmøder
  /regnskab
  /ansættelse
  ```
- Upload, in-browser PDF-preview, download, slet (soft delete)
- Tilknyt dokument til sag, kontrakt eller person
- Versionsstyring med historik
- Søg i filnavne og metadata på tværs af alle selskaber
- Sensitivitetsniveau (`STANDARD` som default)

---

### 6.9 Microsoft 365 / Outlook-integration

- **SSO:** Login med Microsoft-konto
- **Email til sag:** BCC til `[sags-id]@ind.chainhub.dk` → emailen dukker op under sagen
- **Send fra systemet:** Brug brugerens Outlook-konto via Graph API
- **Kalender-sync:** Push deadlines og møder til Outlook
- **Kontaktimport:** Importer fra Outlook adressebog

---

## 7. Onboarding-flow (pr. ny tenant)

```
1. Registrér gruppe (gruppenavn, CVR på holding/gruppen (valgfrit), email)
2. Vælg plan + antal seats → Stripe checkout (14 dages trial)
3. Invitér kolleger
4. Tilslut Microsoft 365 (valgfrit)
5. Opret første selskab (guidet: stamdata → ejerskab → governance)
6. Import af eksisterende kontakter (CSV)
```

---

## 8. Planer & priser

| Plan | Seats | Selskaber | Vejl. pris | Funktioner |
|---|---|---|---|---|
| Starter | 1–3 | Op til 5 | 299 kr/seat/md | Alle kernemoduler |
| Business | 4–10 | Op til 20 | 399 kr/seat/md | + M365-sync, tidsreg. |
| Enterprise | 10+ | Ubegrænset | Kontakt | + custom onboarding, SLA |

- 14 dages gratis trial — intet kort krævet
- Stripe Billing med automatisk seat-metering

---

## 9. Fase 2 (ikke MVP)

```
- AI-kontraktanalyse (naturlig integration med Retsklar.dk)
- E-signatur via Penneo
- Ekstern portal: tandlægen kan logge ind og se sin klinik
  (EXTERNAL_PARTNER / EXTERNAL_EMPLOYEE roller)
- E-conomic / Billy-integration (regnskabsdata trækkes automatisk)
- Generalforsamlings-modul (dagsorden, referat, afstemning)
- Mobil-app
- Avanceret rapportering / BI på tværs af portefølje
```

---

## 10. Time-estimat (vejledende)

```
Modul                              Lav    Høj
────────────────────────────────────────────
Projektopsætning & arkitektur       3      5
Database-schema (komplet fra dag 1) 4      6
Auth + multi-tenancy lag            4      6
Portfolio-dashboard                 4      6
Selskabsprofil (alle faner)         8     12
Persondatabase (global kontaktbog)  5      7
Kontraktstyring                     7     10
Sagsstyring                         8     12
Opgave- & deadlinestyring           5      8
Økonomi-overblik                    4      6
Dokumenthåndtering                  5      7
Microsoft 365-integration           8     12
Stripe + planer + onboarding        5      8
UI / designsystem + polish          6     10
Test, bugfix, edge cases            6     10
────────────────────────────────────────────
TOTAL MVP                          82    125 timer
```

---

## Changelog

```
v2.3:
  Fjernet sektion 11-12 (build-sekvens og aktivering).
  Fjernet forældede referencer fra sektion 10 og changelog.

v2.2 (opdateret):
  [K1] Sektion 10: Overskrift rettet.
  [M1] Changelog K3: "32 typer" rettet til "33 typer".

v2.1 (opdateret):
  [K1] Sektion 4: Rolleliste erstattet med kanoniske SCREAMING_SNAKE_CASE navne
       fra roller-og-tilladelser.md v0.2 — 4 generiske navne → 8 korrekte roller
       (GROUP_OWNER, GROUP_ADMIN, GROUP_LEGAL, GROUP_FINANCE, GROUP_READONLY,
        COMPANY_MANAGER, COMPANY_LEGAL, COMPANY_READONLY)
  [K2] Sektion 4: Selskabs-niveau roller tilføjet (COMPANY_*).
       Fase 2-roller (EXTERNAL_PARTNER, EXTERNAL_EMPLOYEE) adskilt tydeligt
  [K3] Sektion 5.4 (nu 6.4): Kontrakttype-liste erstattet med komplet
       ContractSystemType-enum (33 typer) fra DATABASE-SCHEMA.md v0.2
  [K4] Sektion 5.5 (nu 6.5): Sagstyper erstattet med SagsType + SagsSubtype
       enums fra DATABASE-SCHEMA.md v0.2
  [K5] Sektion 5.5 (nu 6.5): Sagsstatus rettet til CaseStatus-enum:
       ÅBEN | I_GANG | AFVENTER | LUKKET | ANNULLERET
  [K6] Sektion 11 (nu 12): Claude Code prompt — 'rolle' → 'user_role_assignment',
       UserRole-enum og korrekt tabelnavn tilføjet eksplicit
  [M1] Sektion 5.4 (nu 6.4): Kontraktstatus-flow tilføjet TIL_UNDERSKRIFT og
       ARKIVERET — matcher ContractStatus-enum
  [M2] Sektion 5.6 (nu 6.6): TaskStatus-enum værdier tilføjet eksplicit
  [M3] Sektion 3: 'Cloudflare R2 eller AWS S3' → 'Cloudflare R2'
  [M4] Sektion 6.4: Sensitivitetsniveau-sektion tilføjet som selvstændig sektion 5
  [M5] Sektion 6.8: Mappestruktur markeret som vejledende (ikke obligatorisk)
  [M6] Sektion 7 (nu 7): "CVR på holding" → "CVR på holding/gruppen (valgfrit)"
       Sektionsnumre justeret: 5.x → 6.x, 6–11 → 7–12

v2.0:
  Opdateret baseret på tandlægekæde-arkitektur

v1.0:
  Første udkast
```

---

*kravspec-legalhub.md v2.3*
