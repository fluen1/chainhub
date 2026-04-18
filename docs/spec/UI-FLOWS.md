# UI-FLOWS.md

# ChainHub — Brugerflows pr. modul

**Version:** 0.3 — QA-rettet
**Vedligeholdes af:** Philip
**Afhænger af:** kravspec-legalhub.md, ROLLER-OG-TILLADELSER.md, DATABASE-SCHEMA.md

---

## Læsevejledning

Hvert flow er beskrevet som en sekvens af **trin** med følgende struktur:

```
Trin N — [Handlingens navn]
  Skærmbillede/komponent: [hvad brugeren ser]
  Handling:               [hvad brugeren gør]
  System-respons:         [hvad systemet gør]
  Fejlscenarie:           [hvad sker der hvis noget går galt]
  Adgangskrav:            [hvilken rolle der kræves]
```

Flows er primære (happy path) med inline fejlscenarier.
Edge cases og permissionslogik er markeret med `[GUARD]`.

---

## Indholdsfortegnelse

1. [Onboarding](#1-onboarding)
2. [Auth — Login og session](#2-auth--login-og-session)
3. [Portfolio-dashboard](#3-portfolio-dashboard)
4. [Selskabsprofil](#4-selskabsprofil)
5. [Persondatabase](#5-persondatabase)
6. [Kontraktstyring](#6-kontraktstyring)
7. [Sagsstyring](#7-sagsstyring)
8. [Opgavestyring](#8-opgavestyring)
9. [Dokumenthåndtering](#9-dokumenthåndtering)
10. [Økonomi-overblik](#10-økonomi-overblik)
11. [Brugerstyring](#11-brugerstyring)
12. [Indstillinger og fakturering](#12-indstillinger-og-fakturering)

---

## 1. Onboarding

### 1.1 Ny tenant — registrering og setup

**Trigger:** Bruger besøger `/signup`
**Adgangskrav:** Ingen (uautoriseret)

```
Trin 1 — Registrér gruppe
  Skærmbillede:  Signup-side med formular
  Felter:        Gruppenavn (fx "TandlægeGruppen A/S")
                 CVR-nummer på holdingselskab
                 Email (bliver GROUP_OWNER)
                 Password + bekræft
  Handling:      Bruger udfylder og klikker "Opret konto"
  System:        Validér email (format + ikke allerede i brug)
                 Validér CVR-format (8 cifre)
                 Opret Organisation + User + user_role_assignments (GROUP_OWNER)
                 Send velkomst-email med bekræftelseslink
  Fejl:          Email allerede i brug → "Denne email er allerede registreret. Log ind?"
                 Ugyldigt CVR → "CVR skal være 8 cifre"
```

```
Trin 2 — Vælg plan
  Skærmbillede:  Plan-selector (Starter / Business / Enterprise)
                 Tabel med funktioner og priser pr. plan
  Handling:      Bruger vælger plan + antal seats → klikker "Start 14 dages gratis prøve"
  System:        Opret Stripe Customer + Subscription (trial, 14 dage, intet kort endnu)
                 Gem plan og seats på Organisation
                 Redirect til onboarding-wizard trin 3
  Note:          "Enterprise" → Redirect til kontaktformular (ingen Stripe-flow)
```

```
Trin 3 — Invitér kolleger (valgfrit)
  Skærmbillede:  Invitation-side med email-input og rolle-selector
  Handling:      Bruger indtaster email(s) og tildeler rolle (GROUP_ADMIN / GROUP_LEGAL etc.)
                 Klikker "Send invitation" eller "Spring over"
  System:        Opret pending UserInvitation-record pr. email
                 Send invitation-email med registreringslink (udløber 7 dage)
  Fejl:          Antal seats nået → "Du har nået dit seat-limit. Opgrader plan."
```

```
Trin 4 — Tilslut Microsoft 365 (valgfrit)
  Skærmbillede:  Microsoft-integration side med "Tilslut" knap og forklaring
  Handling:      Klik "Tilslut Microsoft 365" → OAuth-popup til Microsoft
                 Eller klik "Spring over — konfigurér senere"
  System:        Gem access_token + refresh_token på Organisation (krypteret)
                 Marker Organisation.ms365_connected = true
  Fejl:          OAuth fejl → "Tilslutning mislykkedes. Prøv igen eller spring over."
```

```
Trin 5 — Opret første selskab (guidet wizard)
  Skærmbillede:  3-trins wizard: Stamdata → Ejerskab → Governance

  Trin 5a — Stamdata
    Felter:      Selskabsnavn, CVR, selskabsform (ApS/A/S/I/S)
                 Adresse (gade, postnr, by)
                 Stiftelsesdato, regnskabsår-start (måned)
                 Status (default: Aktiv)
    System:      CVR-opslag (valgfrit — hent data fra CVR-API hvis tilgængeligt)

  Trin 5b — Ejerskab
    Felter:      Tilføj ejer: søg person i systemet ELLER opret ny
                 Pr. ejer: ejerandel %, ejertype (person/selskab), dato for erhvervelse
    Validering:  Advar hvis total ejerandel ≠ 100 % (ikke blokerende — kan gemmes)

  Trin 5c — Governance
    Felter:      Direktør: søg/opret person + startdato
                 Bestyrelsesformand: søg/opret person + startdato (valgfrit)
                 Bestyrelsesmedlem(mer): søg/opret person(er) (valgfrit)
    Handling:    Klik "Afslut og gå til selskab"
    System:      Opret Company + Ownership-records + CompanyRole-records
                 Opret aktivitetslog-entry: "Selskab oprettet via onboarding"
                 Redirect til selskabets profil-side
```

```
Trin 6 — Import af kontakter (valgfrit)
  Skærmbillede:  Import-modal på persondatabase-siden
  Valg A:        CSV-import — download skabelon, upload udfyldt fil
  Valg B:        Outlook-import (kun hvis M365 tilsluttet i trin 4)
  Valg C:        Spring over
  System (CSV):  Parse CSV, vis preview med fejl markeret (ukendt format etc.)
                 Bruger bekræfter → Opret Person-records
  System (M365): Hent kontakter via Graph API → vis liste til selektion
                 Bruger markerer kontakter → Opret Person-records
```

---

### 1.2 Invitation-flow (ny bruger accepterer invitation)

**Trigger:** Bruger klikker link i invitations-email
**URL:** `/invite/[token]`

```
Trin 1 — Valider token
  System:        Opslag på UserInvitation hvor token matcher og ikke udløbet
  Fejl:          Udløbet token → "Denne invitation er udløbet. Bed om en ny."
                 Allerede brugt → Redirect til login

Trin 2 — Udfyld profil
  Felter:        Fuldt navn, password + bekræft
                 (Email er pre-udfyldt fra invitation — read-only)
  System:        Opret User, marker invitation som brugt
                 Tildel rolle fra InvitationRecord
                 Log ind automatisk → Redirect til /app/dashboard
```

---

## 2. Auth — Login og session

### 2.1 Login med email/password

```
Trin 1 — Login-side (/login)
  Felter:        Email, password
  Handling:      "Log ind"
  System:        Valider credentials via NextAuth
                 Opret session (JWT + cookie)
                 Redirect til /app/dashboard
  Fejl:          Forkert password (1–4 forsøg) → "Forkert email eller password"
                 5+ forsøg → Lock account i 15 min + send email til bruger
                 Ikke-bekræftet email → "Bekræft din email. [Send ny bekræftelse]"
```

### 2.2 Login med Microsoft SSO

```
Trin 1 — Microsoft OAuth
  Handling:      Klik "Log ind med Microsoft" → Redirect til Microsoft login
  System:        Microsoft returnerer access token
                 Opslag: find User med matchende email
                 Hvis første gang: tilbyd at tilslutte Microsoft-konto til eksisterende bruger
                 Opret session → Redirect til /app/dashboard
  Fejl:          Email ikke registreret i systemet → "Ingen konto fundet for [email]. Kontakt din administrator."
```

### 2.3 Session og adgangskontrol

```
[GUARD] Alle routes under /app/* kræver gyldig session
  System:        Next.js middleware tjekker session ved hvert request
                 Ingen session → Redirect til /login med returnUrl

[GUARD] Tenantcheck
  System:        Alle Server Actions og API routes læser organizationId fra session
                 Data queries filtrerer ALTID på organization_id — aldrig på tværs af tenants

[GUARD] Permissioncheck
  System:        canAccessModule(), canAccessCompany(), canAccessSensitivity()
  Fejl:          Utilstrækkelig adgang → HTTP 403 + toast "Du har ikke adgang til denne ressource"
```

---

## 3. Portfolio-dashboard

**URL:** `/app/dashboard`
**Adgangskrav:** Alle roller (data filtreres efter scope)

### 3.1 Indlæs dashboard

```
Trin 1 — Indlæs siden
  Skærmbillede:  Grid/tabel af selskabskort
  System:        Hent alle selskaber inden for brugerens scope (getAccessibleCompanies())
                 Pr. selskab — aggregerede counts via én JOIN-query (ikke N+1):
                   - Status
                   - Ejerandel % (for gruppeejende part)
                   - Antal aktive sager
                   - Antal kontrakter der udløber inden for 90 dage
                   - Antal forfaldne opgaver (deadline < i dag, status ≠ LUKKET)
  Loading state: Skeleton-cards mens data hentes
  Tom state:     "Ingen selskaber endnu. [Opret dit første selskab]"
```

### 3.2 Filtrer og søg

```
Filtre (sidebar eller filter-bar):
  - Status: Alle / Aktiv / Under stiftelse / Under afvikling / Solgt
  - Region: (tag-baseret, valgfrit)
  - Ejerandel: alle / >50% / <50%
  - Vis kun selskaber med: aktive sager / udløbende kontrakter / forfaldne opgaver

Søgning (global søgebar øverst):
  Søger i: selskabsnavn, CVR, person-navn, kontrakttitel
  Resultater: Grupperet under "Selskaber", "Personer", "Kontrakter", "Sager"
  System:    PostgreSQL full-text search på tværs af tabeller (inden for tenant)
```

### 3.3 Naviger til selskab

```
Handling:      Klik på selskabskort
Redirect:      /app/companies/[companyId]
```

### 3.4 Hurtigopret selskab

```
Handling:      Klik "+ Nyt selskab" (kun GROUP_OWNER / GROUP_ADMIN)
System:        Åbn opret-selskab wizard (se 4.1)
[GUARD]        Øvrige roller → knap ikke vist
```

---

## 4. Selskabsprofil

**URL:** `/app/companies/[companyId]`
**Adgangskrav:** Alle roller med adgang til selskabet (scope-check)

Siden har seks faner: **Stamdata · Ejerskab · Governance · Ansatte · Dokumenter · Aktivitetslog**

---

### 4.1 Opret selskab

**Trigger:** Klik "+ Nyt selskab" fra dashboard eller sidebar
**Adgangskrav:** `GROUP_OWNER`, `GROUP_ADMIN`

```
Trin 1 — Formular (slide-over)
  Felter:        Selskabsnavn*
                 CVR* (8 cifre)
                 Selskabsform* (ApS / A/S / I/S / Holding ApS / Andet)
                 Adresse (gade*, postnr*, by*)
                 Stiftelsesdato
                 Regnskabsår-start (måned, default: januar)
                 Status (default: Aktiv)
                 Interne noter (textarea)
                 Tags (fri tekst, kommasepareret)
  Handling:      "Gem selskab"
  System:        Valider CVR ikke allerede i brug i tenant
                 Opret Company-record med organization_id
                 Opret aktivitetslog-entry
                 Redirect til /app/companies/[newId] (Stamdata-fane)
  Fejl:          CVR allerede registreret → "CVR [xxxx] er allerede registreret (se [Selskabsnavn])"
```

---

### 4.2 Stamdata-fane

```
Trin 1 — Se stamdata
  Skærmbillede:  Readonly visning af alle stamdata-felter
  Actions:       [Rediger] (kun GROUP_OWNER, GROUP_ADMIN, COMPANY_MANAGER)

Trin 2 — Rediger stamdata
  Handling:      Klik [Rediger] → felter bliver redigerbare (inline edit)
  Handling:      Ændr felter → klik [Gem]
  System:        Valider ændringer
                 Gem Company-record
                 Opret aktivitetslog-entry: "Stamdata opdateret af [bruger]"
                 Toast: "Ændringer gemt"
  Handling:      Klik [Annullér] → ingen ændringer gemt

Trin 3 — Arkivér / skift status
  Handling:      Dropdown "Skift status" → vælg ny status
  [GUARD]        Kun GROUP_OWNER / GROUP_ADMIN
  System:        Opdatér status
                 Hvis "Solgt": vis bekræftelsesdialog "Selskabet sættes til Solgt og arkiveres (readonly). Fortsæt?"
                 Gem + Aktivitetslog
```

---

### 4.3 Ejerskab-fane

**Adgangskrav:** `GROUP_OWNER`, `GROUP_ADMIN`, `GROUP_LEGAL` (STRENGT_FORTROLIG)

```
Trin 1 — Se ejerskab
  Skærmbillede:  Tabel: Navn | Ejerandel % | Ejertype | Erhvervelsesdato | Ejeraftale-link
                 Samlet ejerandel (summeret, advarsel hvis ≠ 100 %)
                 Historik: tidligere ejere (collapsible)

Trin 2 — Tilføj ejer
  Handling:      Klik "+ Tilføj ejer"
  Formular:      Søg person/selskab i systemet (typeahead) ELLER opret ny person
                 Ejerandel % *
                 Ejertype: Person / Holdingselskab / Andet selskab
                 Dato for erhvervelse *
                 Reference til ejeraftale (valgfrit — knyt eksisterende kontrakt)
  System:        Gem Ownership-record
                 Aktivitetslog

Trin 3 — Rediger ejer
  Handling:      Klik på ejer → inline-edit
  Felter:        Ejerandel %, dato (navn kan ikke ændres her — gå til person-profil)

Trin 4 — Afregistrér ejer (ejerskab ophørt)
  Handling:      Klik [Afregistrér] på ejer → bekræftelsesdialog
  System:        Sæt Ownership.end_date = i dag (soft end, ikke delete)
                 Ejer flyttes til historik-sektion
```

---

### 4.4 Governance-fane

**Adgangskrav:** Alle roller med selskabsadgang (FORTROLIG og lavere)

```
Trin 1 — Se governance
  Skærmbillede:  Tabel pr. rolle-type:
                   Direktør | Person | Startdato | Kontrakt-link | [Handlinger]
                   Bestyrelsesformand | ...
                   Bestyrelsesmedlem(mer) | ...
                   Tegningsberettigede | ...
                   Revisor | ...
  Advarsler:     Rød badge hvis rolle er vakant
                 Gul badge hvis tilknyttet kontrakt udløber inden for 90 dage

Trin 2 — Tilføj governance-rolle
  Handling:      Klik "+ Tilføj [rolle]"
  Formular:      Søg/opret person
                 Rolle (Direktør / Bestyrelsesformand / Bestyrelsesmedlem / Tegningsberettiget / Revisor)
                 Startdato *
                 Reference til kontrakt (valgfrit)
  System:        Gem CompanyRole-record
                 Aktivitetslog

Trin 3 — Afregistrér rolle
  Handling:      Klik [Afregistrér] → bekræftelsesdialog med slutdato-felt
  System:        Sæt CompanyRole.end_date + aktivitetslog
```

---

### 4.5 Ansatte-fane

**Adgangskrav:** Alle roller med selskabsadgang (STANDARD)

```
Trin 1 — Se ansatte
  Skærmbillede:  Tabel: Navn | Stilling | Ansættelsestype | Startdato | Kontrakt | Status
  Filter:        Alle / Aktive / Fratrådte / Vikarer

Trin 2 — Tilføj ansat
  Handling:      Klik "+ Tilføj ansat"
  Formular:      Søg/opret person *
                 Stilling (fritekst)
                 Ansættelsestype: Fuldtid / Deltid / Vikar / Freelance
                 Startdato *
                 Slutdato (valgfrit — udfyldes ved fratræden)
                 Reference til ansættelseskontrakt (valgfrit)
  System:        Gem Employment-record
                 Aktivitetslog

Trin 3 — Registrér fratræden
  Handling:      Klik [Registrér fratræden] på ansat
  Formular:      Slutdato *
  System:        Sæt Employment.end_date
                 Status ændres automatisk til "Fratrådt"
                 Aktivitetslog
```

---

### 4.6 Aktivitetslog-fane

```
Skærmbillede:  Kronologisk liste (nyeste øverst)
               Dato | Bruger | Handling | Detaljer
               Eksempler:
                 "Philip Larsen opdaterede ejerskab (Tandlæge ApS: 45% → 51%)"
                 "Rikke Jensen uploadede kontrakt: Lejekontrakt Østerbro 2024.pdf"
Filtrering:    Alle / Kontrakter / Sager / Ejerskab / Governance / Dokumenter
Søgning:       Fritekst i log-beskrivelse
```

---

## 5. Persondatabase

**URL:** `/app/people`
**Adgangskrav:** Alle roller

### 5.1 Se personoversigt

```
Skærmbillede:  Søgbar tabel: Navn | Email | Tlf | Tilknytninger | Tags
Søgning:       Fritekst på navn, email, CVR/notat
Filtrering:    Tag-filter (tandlæge, direktør, bestyrelsesmedlem, ansat, leverandør...)
               Selskabs-filter: "Vis kun personer tilknyttet [Selskab X]"
Tom state:     "Ingen personer endnu. [Opret person] eller [Importér]"
```

### 5.2 Opret person

```
Trin 1 — Formular (slide-over)
  Felter:        Fuldt navn *
                 Email
                 Telefon
                 Adresse (valgfrit)
                 CPR-notat (checkbox: "CPR-nummer forefindes i fysisk mappe" — CPR gemmes ALDRIG i klar tekst)
                 CVR (hvis personen repræsenterer et selskab)
                 Tags (multi-select: tandlæge / direktør / bestyrelsesmedlem / ansat / leverandør / rådgiver / andet)
                 Interne noter
  System:        Tjek for duplikat (samme email) → advar men blokér ikke
                 Gem Person-record
                 Toast: "Person oprettet"
```

### 5.3 Person-profil

**URL:** `/app/people/[personId]`

```
Skærmbillede:  Stamdata-panel øverst
               Tilknytninger-sektion:
                 Liste over alle selskaber personen er tilknyttet med rolle og periode
                 Eksempel:
                   "Tandlæge ApS — Direktør (01.01.2020 → nu)"
                   "Fysio Holding — Bestyrelsesmedlem (01.06.2021 → nu)"
               Relaterede kontrakter: alle kontrakter hvor personen er part
               Relaterede sager: alle sager personen er tilknyttet
               Relaterede opgaver: åbne opgaver tilknyttet personen
               Aktivitetslog

Rediger:       Samme felter som opret, inline-edit
Slet:          Soft delete — kun muligt hvis ingen aktive tilknytninger (kontrakter, sager, roller)
               Ellers: "Personen er tilknyttet aktive records. Afregistrér tilknytninger først."
```

### 5.4 Outlook-import

```
Trigger:       Klik "Importér fra Outlook" (kun hvis M365 tilsluttet)
Trin 1:        Hent kontakter fra Microsoft Graph API (/me/contacts)
               Vis liste: Navn | Email | Tlf | [Markér til import]
Trin 2:        Bruger markerer kontakter → klik "Importér [N] kontakter"
System:        Tjek for dubletter (email-match) → markér duplikater i listen
               Importer ikke-duplikater automatisk
               Dublikater: vis dialog "Disse [N] kontakter findes allerede. Overskriv / Spring over / Flet?"
Resultat:      Toast: "[N] kontakter importeret, [M] sprunget over"
```

---

## 6. Kontraktstyring

**URL:** `/app/contracts` (globalt) · `/app/companies/[id]/contracts` (pr. selskab)
**Adgangskrav:** `GROUP_OWNER`, `GROUP_ADMIN`, `GROUP_LEGAL`, `COMPANY_MANAGER`, `COMPANY_LEGAL`, `GROUP_READONLY` (se modul-adgangsmatrix)

### 6.1 Kontraktoversigt (globalt)

```
Skærmbillede:  Tabel: Titel | Type | Selskab | Status | Udløbsdato | Sensitivitet | [Handlinger]
Filtrering:    Type / Status / Selskab / Udløber inden: 30 / 60 / 90 dage
               Sensitivitet (STRENGT_FORTROLIG vises kun for berettigede)
Sortering:     Udløbsdato (standard: stigende)
Røde rækker:  Udløbet eller udløber inden for 14 dage
Gule rækker:  Udløber inden for 90 dage
```

### 6.2 Opret kontrakt

```
Trin 1 — Grunddata (slide-over, trin 1/3)
  Felter:        Titel *
                 Kontrakttype * (dropdown: alle 33 system_types fra CONTRACT-TYPES.md)
                 Tilknyttet selskab * (søg i accessible companies)
                 Status (default: UDKAST)
                 Sensitivitetsniveau * (default baseret på kontrakttype — se CONTRACT-TYPES.md)
                 [GUARD] Lag 2-typer (kædestruktur): vises kun hvis selskabet er del af kædestruktur

Trin 2 — Datoer og vilkår (trin 2/3)
  Felter:        Startdato *
                 Udløbsdato (blank = løbende)
                 Opsigelsesvarsel (antal dage — bruges til advis-beregning for løbende kontrakter)
                 Auto-renewal (checkbox — relevant for leverandørkontrakter)
                 Adviseringsregler: advis 90 / 30 / 7 dage før udløb (checkboxes, pre-aktiveret)
                 Interne noter

Trin 3 — Parter og underskrivere (trin 3/3)
  Felter:        Part 1: søg selskab i systemet (typisk gruppe-holding) *
                 Part 2: søg person/selskab i systemet *
                 Yderligere parter: [+ Tilføj part]
                 Underskriver(e): søg person (tilknyttet part)
  Handling:      "Gem kontrakt" → Opret Contract-record
                 Toast: "Kontrakt oprettet"
                 Redirect til kontrakt-detaljeside

  Fejl:          Sensitivitetsniveau lavere end type-minimum → advarsel "Ejeraftaler kræver minimum STRENGT_FORTROLIG"
```

### 6.3 Kontrakt-detaljeside

**URL:** `/app/contracts/[contractId]`

```
Skærmbillede:  Header: Titel + status-badge + type
               Panel venstre: Stamdata (alle felter fra opret)
               Panel højre: Relaterede records (parter, underskrivere, sag, dokument)

Faner:         Detaljer | Dokumenter | Versionshistorik | Aktivitetslog
```

### 6.4 Upload fil til kontrakt

```
Handling:      Klik "Upload fil" på Dokumenter-fanen
Dialog:        Drag-and-drop zone + file picker
               Accepterede formater: PDF, DOCX (max 50 MB)
System:        Upload til Cloudflare R2 / S3
               Gem Document-record med kontrakt-reference
               Generer PDF-preview (via signed URL)
               Aktivitetslog: "Fil uploadet: [filnavn]"
Preview:       In-browser PDF-preview (iframe med signed URL)
```

### 6.5 Kontrakt status-flow

```
UDKAST → TIL_REVIEW → TIL_UNDERSKRIFT → AKTIV → UDLOBET / OPSAGT / FORNYET / ARKIVERET

Trin: Opdatér status
  Handling:      Klik [Opdatér status] → dropdown med mulige næste statuser
  System:        Valider transition (UDKAST kan ikke springe til UDLOBET)
                 Gem + Aktivitetslog
  Ved AKTIV:     Aktivér advis-regler (beregn næste advis-dato og sæt cron-job)
  Ved OPSAGT:    Promptér: "Registrér opsigelsesdato" + optional note
```

### 6.6 Versionsstyring

```
Handling:      Upload ny version → "Er dette en ny version?" → [Ja, ny version] / [Erstat eksisterende]
System:        Hvis ny version: gem med version_number + 1, bevar tidligere version i historik
               Versionshistorik-fane: liste over alle versioner med dato, bruger, note
               Download: alle versioner tilgængelige
```

---

## 7. Sagsstyring

**URL:** `/app/cases` (globalt) · `/app/companies/[id]/cases`
**Adgangskrav:** `GROUP_OWNER`, `GROUP_ADMIN`, `GROUP_LEGAL`, `COMPANY_MANAGER`, `COMPANY_LEGAL`

### 7.1 Sagsoversigt

```
Skærmbillede:  Tabel: Sagsnr. | Titel | Type | Selskab | Status | Ansvarlig | Næste frist
Filtrering:    Type / Status / Ansvarlig / Selskab / Med forfaldne opgaver
Sortering:     Næste frist (standard: stigende)
```

### 7.2 Opret sag

```
Trin 1 — Grunddata
  Felter:        Titel *
                 Sagstype * (TRANSAKTION / TVIST / COMPLIANCE / KONTRAKT / GOVERNANCE / ANDET)
                 Sagsundertype * — dropdown filtreres dynamisk til relevante undertyper
                              baseret på valgt sagstype (påkrævet medmindre type = ANDET)
                              Eksempel: TRANSAKTION → VIRKSOMHEDSKØB / VIRKSOMHEDSSALG /
                              FUSION / OMSTRUKTURERING / STIFTELSE
                 Tilknyttet selskab * (multi-select — en sag kan involvere flere selskaber)
                 Ansvarlig bruger * (dropdown: brugere i tenant)
                 Status (default: ÅBEN)
                 Sensitivitetsniveau
                 Beskrivelse (rich text / textarea)
                 Interne noter

Trin 2 — Tilknytninger (valgfrit — kan tilføjes efter oprettelse)
  Felter:        Tilknyttede personer (søg i persondatabase)
                 Tilknyttede kontrakter (søg i contracts)
                 Frister: [+ Tilføj frist] → dato + beskrivelse + ansvarlig

  Handling:      "Opret sag" → Gem Case-record + Aktivitetslog
                 Redirect til sag-detaljeside
```

### 7.3 Sag-detaljeside

**URL:** `/app/cases/[caseId]`

```
Skærmbillede:  Header: Sagsnr. + Titel + Status-badge + Ansvarlig
Faner:         Overblik | Opgaver | Dokumenter | Tidsregistrering | Email | Aktivitetslog
```

### 7.4 Sagsstatus-flow

```
ÅBEN → I_GANG → AFVENTER → LUKKET / ANNULLERET

Handling:      Klik [Opdatér status] → vælg ny status
System:        Gem + Aktivitetslog
Ved LUKKET:    Bekræftelsesdialog: "Luk sagen? Åbne opgaver vil forblive åbne."
Ved ANNULLERET: Bekræftelsesdialog: "Annullér sagen? Handlingen kan ikke fortrydes."
```

### 7.5 Tilføj frist til sag

```
Handling:      Klik "+ Tilføj frist" på Overblik-fanen
Formular:      Titel * | Dato * | Ansvarlig * | Prioritet (lav/mellem/høj/kritisk) | Note
System:        Gem Deadline-record på sagen
               Aktivér advis (email til ansvarlig X dage før)
               Advarsel på sagen hvis frist er overskredet
```

### 7.6 Tidsregistrering

```
Handling:      Klik "+ Registrér tid" på Tidsregistrering-fanen
Formular:      Dato * | Antal timer * (decimaler: 0.5, 1.0, 1.5...) | Beskrivelse | Bruger (pre-udfyldt)
               Timepris (hentes fra brugerens sats, kan overskrives)
System:        Gem TimeEntry-record
               Vis summeret total (timer × timepris) pr. sag
               Opdatér intern fakturaoversigt
```

### 7.7 Email til sag (Microsoft Graph BCC-sync)

```
Forudsætning:  Microsoft 365 tilsluttet + bruger har koblet sin M365-konto
Metode:        Bruger BCC'er [caseId]@ind.chainhub.dk på email fra Outlook
System:        Webhook modtager email via Graph API
               Parser emne, afsender, modtager, tidspunkt, brødtekst
               Gem EmailThread-record tilknyttet sagen
               Vis på Email-fanen: Emne | Fra | Modtager | Dato | Preview
Send fra systemet:
  Handling:      Klik "Ny email" på Email-fanen
  Formular:      Til * | Emne * | Brødtekst
  System:        Send via Microsoft Graph API (bruger = afsender)
                 Gem kopi i EmailThread
```

---

## 8. Opgavestyring

**URL:** `/app/tasks`
**Adgangskrav:** Alle roller

### 8.1 Opgaveoversigt — tre visninger

```
Visning A — Kanban
  Kolonner:    Ny | Aktiv | Afventer | Lukket
  Kort:        Titel + Ansvarlig-avatar + Deadline + Prioritet-badge
  Rød ramme:   Forfaldne opgaver

Visning B — Liste
  Tabel:       Titel | Ansvarlig | Deadline | Prioritet | Status | Tilknyttet sag/selskab
  Sortering:   Deadline (standard) / Prioritet / Status
  Filtrering:  Ansvarlig / Selskab / Sag / Prioritet / Forfaldne

Visning C — Kalender
  Måneds-/ugesvisning med opgave-deadlines som events
  Klik på dato → filtrer liste til den dato
```

### 8.2 Opret opgave

```
Trigger:       Klik "+ Ny opgave" (fra alle visninger ELLER fra en sag)
Formular:      Titel *
               Beskrivelse
               Ansvarlig * (søg bruger)
               Deadline *
               Prioritet * (lav / mellem / høj / kritisk)
               Status (default: NY)
               Tilknyttet sag (valgfrit — typeahead)
               Tilknyttet selskab (valgfrit — typeahead)
System:        Gem Task-record
               Hvis fra sag-kontekst: auto-tilknyt til sag
               Aktivitetslog
```

### 8.3 Kanban — flyt opgave

```
Handling:      Drag-and-drop kort til ny kolonne
System:        Opdatér Task.status via Server Action
               Optimistisk update i UI (ingen loading state)
               Aktivitetslog
```

### 8.4 Rediger opgave

```
Handling:      Klik på opgave-kort → slide-over panel (ikke full-page navigation)
Indhold:       Alle felter redigerbare inline
               Aktivitetslog for opgaven
               [Luk opgave] → status = LUKKET + bekræftelse
```

### 8.5 Advis og notifikationer

```
Email-digest (daglig):
  System:        Cron job kl. 07:00 (dansk tid)
                 Find alle åbne opgaver pr. bruger med deadline <= i dag + 3 dage
                 Send email via Resend (eller Microsoft Graph hvis M365 tilsluttet)
                 Grupperét pr. prioritet: Kritisk → Høj → Mellem → Lav

Outlook Calendar push:
  System:        Ved oprettelse/opdatering af opgave med deadline
                 Opret Calendar Event via Microsoft Graph (kun hvis M365 tilsluttet)
                 Titel: "[ChainHub] [Opgavetitel]"
                 Beskrivelse: link til opgaven
```

---

## 9. Dokumenthåndtering

**URL:** `/app/companies/[id]/documents` · `/app/documents` (global søgning)
**Adgangskrav:** Alle roller med selskabsadgang

### 9.1 Dokumentoversigt pr. selskab

```
Skærmbillede:  Mappe-træ (venstre) + Fil-liste (højre)
Mapper:        /stiftelse / /ejeraftaler / /kontrakter / /bestyrelsesmøder / /regnskab / /ansættelse / (brugerdefinerede)
Fil-liste:     Navn | Type | Upload-dato | Uploadet af | Størrelse | Tilknytning | [Handlinger]
```

### 9.2 Upload dokument

```
Trigger:       Klik "Upload" (eller drag-and-drop til mappe)
Dialog:        Vælg mappe *
               Fil * (PDF / DOCX / XLSX — max 50 MB)
               Tilknyt til: Kontrakt / Sag / Person (valgfrit)
               Sensitivitetsniveau (default: INTERN)
               Note (valgfrit)
System:        Upload til R2/S3
               Gem Document-record
               Generer preview-URL
               Aktivitetslog
```

### 9.3 Vis / preview

```
Handling:      Klik på fil
System:        Åbn in-browser PDF-preview (iframe med signed URL — udløber 60 min)
               DOCX: tilbyd download (ingen in-browser preview)
               Signed URL genereres ved hvert klik (ikke permanent)
```

### 9.4 Opret mappe

```
Handling:      Klik "+ Ny mappe" i mappe-træet
Formular:      Mappenavn *
               Parent-mappe (valgfrit)
System:        Gem DocumentFolder-record
```

### 9.5 Slet dokument (soft delete)

```
Handling:      Klik [...] → Slet → bekræftelsesdialog
System:        Sæt Document.deleted_at = nu (soft delete)
               Filen bevares i R2/S3 i 30 dage → permanent sletning via batch-job
               Aktivitetslog: "Dokument slettet af [bruger]"
[GUARD]        Kun GROUP_OWNER, GROUP_ADMIN og uploader (inden 24 timer)
```

### 9.6 Global dokumentsøgning

```
URL:           /app/documents?q=...
System:        Full-text search på fil-navn og metadata (ikke indhold) inden for tenant
               Filtrer på selskab / mappe / type / sensitivitet
               Resultater viser: filnavn + selskab + mappe + upload-dato
```

---

## 10. Økonomi-overblik

**URL:** `/app/companies/[id]/finance`
**Adgangskrav:** `GROUP_OWNER`, `GROUP_ADMIN`, `GROUP_FINANCE`, `GROUP_READONLY`, `COMPANY_MANAGER`
**Ikke tilgængeligt for:** `GROUP_LEGAL`, `COMPANY_LEGAL`

### 10.1 Nøgletal

```
Skærmbillede:  Tabel / kort pr. regnskabsår:
               Omsætning | Resultat før skat | Egenkapital | Opdateret
Handling:      Klik [+ Tilføj nøgletal] → formular:
               Regnskabsår * | Omsætning | Resultat | Egenkapital | Kilde (manuel / importeret)
System:        Gem FinancialRecord
               Vis historik som simpel linjegraf (år for år)
```

### 10.2 Udbyttenotering

```
Skærmbillede:  Liste over udlodninger pr. år
Handling:      Klik "+ Registrér udbytte"
Formular:      Regnskabsår * | Beløb (DKK) * | Beslutningsdato | Note | Modtager(e)
System:        Gem DividendRecord
```

### 10.3 CSV-import af nøgletal

```
Trigger:       Klik "Importér fra CSV" på Nøgletal-siden
Trin 1:        Download CSV-skabelon (knap "Hent skabelon")
               Skabelon-kolonner: regnskabsaar | omsaetning | resultat | egenkapital
               (Én række pr. regnskabsår)
Trin 2:        Upload udfyldt CSV (max 1 MB)
System:        Parse CSV → vis preview-tabel med alle rækker
               Markér fejl: manglende felt, ikke-numerisk beløb, ugyldigt årstal
               Eksempel på fejlmarkering: rød celle + "Forventet tal, fik 'N/A'"
Trin 3:        Bruger gennemgår preview → klik "Importér [N] rækker"
               Dubletter (samme regnskabsår): vis dialog "Regnskabsår [YYYY] findes allerede. Overskriv?"
System:        Gem FinancialRecord-records
               Toast: "[N] nøgletal importeret"
               Aktivitetslog: "Nøgletal importeret fra CSV af [bruger]"
Fejl:          Forkert filformat → "Kun CSV-filer accepteres"
               Ingen gyldige rækker → "Ingen importerbare rækker fundet — tjek filen mod skabelonen"
```

### 10.4 Tidsregistrering (fra sagsstyring)

```
Skærmbillede:  Aggregeret oversigt: timer × timepris pr. sag pr. selskab
               Total intern omkostning pr. selskab (YTD)
Eksport:       Klik "Eksportér til CSV" → download CSV med alle tidsregistreringer
```

---

## 11. Brugerstyring

**URL:** `/app/settings/users`
**Adgangskrav:** `GROUP_OWNER`, `GROUP_ADMIN`

### 11.1 Oversigt over brugere

```
Skærmbillede:  Tabel: Navn | Email | Roller | Status (Aktiv/Inviteret/Deaktiveret) | Sidst aktiv
```

### 11.2 Invitér bruger

```
Handling:      Klik "+ Invitér bruger"
Formular:      Email *
               Rolle * (multi-select fra rolle-liste)
               Scope: ALL / ASSIGNED (vælg selskaber) / OWN (vælg ét selskab)
[GUARD]        Antal seats tjekket: hvis limit nået → "Opgrader plan for at tilføje flere brugere"
System:        Opret UserInvitation-record
               Send invitation-email
```

### 11.3 Rediger brugers roller

```
Handling:      Klik på bruger → slide-over
Formular:      Rolle-tildelinger (kan have flere)
               Pr. tildeling: rolle + scope + company_ids
System:        Opdatér user_role_assignments
               Aktivitetslog: "Roller opdateret for [bruger] af [admin]"
```

### 11.4 Deaktivér bruger

```
Handling:      Klik [Deaktivér] → bekræftelsesdialog
System:        User.active = false
               Invalider alle aktive sessions for brugeren
               Aktivitetslog
               [Genaktivér] muligt efterfølgende
```

---

## 12. Indstillinger og fakturering

**URL:** `/app/settings`

### 12.1 Organisation-indstillinger

```
Adgangskrav:   GROUP_OWNER, GROUP_ADMIN
Indhold:       Gruppenavn | CVR | Kontakt-email | Logo-upload (valgfrit)
               Advis-standarder: antal dage før kontraktudløb (90 / 30 / 7 — konfigurerbart)
               Regnskabsår-standard
```

### 12.2 Microsoft 365-integration

```
Adgangskrav:   GROUP_OWNER, GROUP_ADMIN
Skærmbillede:  Status (Tilsluttet / Ikke tilsluttet)
               Tilsluttet: vis organisationsnavn + tilsluttet dato + [Afbryd tilslutning]
               Ikke tilsluttet: [Tilslut Microsoft 365] knap → OAuth-flow (se 1.1 trin 4)
```

### 12.3 Fakturering og plan

```
Adgangskrav:   GROUP_OWNER (eksklusivt)
Skærmbillede:  Aktuel plan + antal seats + næste fakturadato + beløb
               [Opgradér / Nedgradér plan] → Stripe Billing Portal (hosted)
               [Administrér betalingsmetode] → Stripe Billing Portal
               Faktura-historik: liste over betalte fakturaer med download-link
System:        Stripe Customer Portal link genereres via Server Action
               Webhook: plan-ændringer reflekteres i Organisation.plan
```

---

## Appendix A — UX-regler

```
Slide-over (panel fra højre):
  Bruges til: opret, rediger og vis-detaljer for enkle records
  Eksempler:  Tilføj ejer, tilføj ansat, opret opgave, rediger person,
              rediger kontrakt-stamdata, tilføj frist, registrér tid,
              invitér bruger, rediger bruger-roller
  Princip:    Brugeren forbliver på den side de kom fra — ingen navigation

Full-page (eget URL):
  Bruges kun til: kontrakt-detaljeside, sag-detaljeside, person-profil
  (disse har faner og underindhold der kræver sin egen plads)

Modal (centered dialog):
  Bruges til: bekræftelsesdialog (slet, arkivér, luk sag, skift status)
  Maks. ét spørgsmål + to knapper

Principet bag valget:
  "Kan handlingen beskrives på ét skærmbillede uden scroll?"
  → Ja: slide-over
  → Nej, eller kræver faner: full-page
  Formålet er at ingen bruger nogensinde er i tvivl om, hvor de er,
  eller skal klikke sig igennem mere end ét trin ad gangen.
```

### Tomme tilstande (empty states)

Alle lister og tabeller har en tom tilstand med:

- Ikon + kort beskrivelse
- Primær CTA: opret-knap (hvis bruger har adgang) ELLER "Kontakt din administrator"

### Loading states

- Skeleton-loaders på alle lister og tabeller (ikke spinner)
- Optimistiske opdateringer på status-ændringer og kanban drag-and-drop

### Fejlhåndtering

```
Client-side validering:    Inline fejlbeskeder under hvert felt (rød tekst)
Server Action fejl:        Toast (rød) øverst til højre med fejlbeskrivelse
403 Unauthorized:          Toast "Du har ikke adgang til denne handling"
500 Server error:          Toast "Noget gik galt. Prøv igen eller kontakt support."
```

### Aktivitetslog — standard format

```
[Tidspunkt] [Bruger] [Handling] [Objekt]
Eksempel: "12. jan 2025 kl. 14:33 · Philip Larsen · Opdaterede · Kontrakt: Lejekontrakt Østerbro 2024"
```

### Advis-mails — standard indhold

```
Emne:   [ChainHub] Kontrakt udløber om 30 dage: [Kontrakttitel]
Indhold: Selskab | Type | Udløbsdato | Direkte link til kontrakt
Footer: "Du modtager denne email fordi du er [rolle] hos [Gruppenavn] på ChainHub"
        [Afmeld] / [Ændr advis-indstillinger]
```

---

## Appendix B — URL-struktur

```
/                              → Redirect til /login eller /app/dashboard
/login                         → Login-side
/signup                        → Registrering (ny tenant)
/invite/[token]                → Accept invitation

/app/dashboard                 → Portfolio-dashboard
/app/companies                 → Alle selskaber (list)
/app/companies/[id]            → Selskabsprofil (stamdata-fane)
/app/companies/[id]/ownership  → Ejerskab-fane
/app/companies/[id]/governance → Governance-fane
/app/companies/[id]/employees  → Ansatte-fane
/app/companies/[id]/contracts  → Kontrakter for selskab
/app/companies/[id]/cases      → Sager for selskab
/app/companies/[id]/documents  → Dokumenter for selskab
/app/companies/[id]/finance    → Økonomi for selskab
/app/companies/[id]/log        → Aktivitetslog for selskab

/app/people                    → Persondatabase
/app/people/[id]               → Person-profil

/app/contracts                 → Globalt kontraktoverblik
/app/contracts/[id]            → Kontrakt-detaljeside

/app/cases                     → Globalt sagsoversigt
/app/cases/[id]                → Sag-detaljeside

/app/tasks                     → Opgaveoversigt (alle visninger)

/app/documents                 → Global dokumentsøgning

/app/settings                  → Organisation-indstillinger
/app/settings/users            → Brugerstyring
/app/settings/billing          → Fakturering
/app/settings/integrations     → Microsoft 365 m.fl.
```

---

---

## Changelog

```
v0.3 (QA-rettet):
  [K1] Header: KRAVSPEC.md → kravspec-legalhub.md (korrekt filnavn)
  [K2] Sektion 1.1 Trin 1: user_roles → user_role_assignments
       (match med DATABASE-SCHEMA.md v0.2 [K4] og ROLLER-OG-TILLADELSER.md v0.2 [K2])
  [K3] Sektion 11.3: user_roles → user_role_assignments (samme som K2)
  [K4] Sagsstatus-flow rettet til at matche CaseStatus-enum i DATABASE-SCHEMA.md v0.2:
       7.2 Status default: NY → ÅBEN
       7.4 flow: NY → AKTIV → AFVENTER_EKSTERN → AFVENTER_KLIENT → LUKKET / ARKIVERET
             → ÅBEN → I_GANG → AFVENTER → LUKKET / ANNULLERET
  [K5] Login redirect: /dashboard → /app/dashboard (3 forekomster: 1.2, 2.1, 2.2)
       Match med Appendix B URL-struktur
  [K6] Kontraktstatus 6.5: UDLØBET → UDLOBET (match med ContractStatus-enum)
  [K7] Kontraktstatus 6.5: ARKIVERET tilføjet til flow
       (ARKIVERET er gyldig ContractStatus i DATABASE-SCHEMA.md)
  [M1] Sektion 6.2: "modal, trin 1/3" → "slide-over, trin 1/3"
       Opret-flow er slide-over per Appendix A UX-regel

v0.2 (QA-rettet):
  + Alle engelske sensitivity-værdier rettet til dansk:
    STRICTLY_CONFIDENTIAL → STRENGT_FORTROLIG
    CONFIDENTIAL → FORTROLIG, INTERNAL → INTERN (alle forekomster)
  + Sagstype-felt i 7.2 opdateret til to-kolonne model:
    SagsType (6 hovedtyper) + SagsSubtype (dynamisk filtreret dropdown)
  + Governance rolle-navne rettet til dansk (4.4):
    director/chairman/board_member/signatory/auditor →
    Direktør/Bestyrelsesformand/Bestyrelsesmedlem/Tegningsberettiget/Revisor
  + Opret-formularer rettet fra "modal" til "slide-over" (4.1, 5.2)
    i overensstemmelse med Appendix A UX-regel
  + 10.4 CSV-import-sektion flyttet til korrekt position som 10.3
    (umiddelbart efter 10.2 udbyttenotering)
  + 10.3 Tidsregistrering omnummereret til 10.4
  + Kontraktstatus-flow: TIL_UNDERSKRIFT tilføjet (6.5)
  + Alle rollenavne ensrettet til SCREAMING_SNAKE_CASE (GROUP_OWNER,
    GROUP_ADMIN etc.) igennem hele dokumentet
  + Footer opdateret

v0.1:
  Første udkast
```

_UI-FLOWS.md v0.3 — QA-rettet._
