# Adgangs- og rollemodel — ChainHub
**Version 0.3 — QA-R2-rettet**

---

## Overordnet princip

Adgang styres på **tre uafhængige lag** der kombineres:
1. **Scope** — hvilke selskaber kan brugeren se?
2. **Modul-adgang** — hvilke moduler har brugeren adgang til?
3. **Data-sensitivitet** — hvilke følsomhedsniveauer må brugeren se?

En bruger får adgang til data der er inden for ALLE tre lag på én gang.

---

## Lag 1: Scope — Hvilke selskaber?

| Scope-type | Beskrivelse | Typisk bruger |
|---|---|---|
| `ALL` | Ser alle selskaber i gruppen | Gruppe-ejer, juridisk ansvarlig |
| `ASSIGNED` | Ser kun tildelte selskaber | Klinikchef med ansvar for 2 klinikker |
| `OWN` | Ser kun ét bestemt selskab | Lokal direktør |

---

## Lag 2: Systemroller (modul-adgang)

### Gruppe-niveau roller

| Rolle | Scope | Beskrivelse |
|---|---|---|
| `GROUP_OWNER` | ALL | Fuld adgang til alt inkl. fakturering, brugerstyring |
| `GROUP_ADMIN` | ALL | Fuld adgang, ingen fakturering |
| `GROUP_LEGAL` | ALL | Kontrakter + sager på tværs — ingen økonomi |
| `GROUP_FINANCE` | ALL | Økonomi-overblik på tværs — ingen kontrakter |
| `GROUP_READONLY` | ALL | Kun se — typisk revisor eller ekstern rådgiver |

### Selskabs-niveau roller

| Rolle | Scope | Beskrivelse |
|---|---|---|
| `COMPANY_MANAGER` | ASSIGNED/OWN | Fuld adgang til tildelte selskaber |
| `COMPANY_LEGAL` | ASSIGNED/OWN | Kontrakter + sager for tildelte selskaber |
| `COMPANY_READONLY` | ASSIGNED/OWN | Kun se for tildelte selskaber |

### Person/ekstern adgang (fase 2 — ikke MVP)
| Rolle | Scope | Beskrivelse |
|---|---|---|
| `EXTERNAL_PARTNER` | OWN | Tandlæge-medejer ser sin klinik (begrænset) |
| `EXTERNAL_EMPLOYEE` | OWN | Ansat ser egne dokumenter |

---

## Lag 3: Data-sensitivitetsniveauer

Alle records i systemet tildeles ét af disse niveauer:

| Niveau | Kode | Eksempler | Synlig for |
|---|---|---|---|
| Strengt fortroligt | `STRENGT_FORTROLIG` | Ejeraftale, aktionæroverenskomst, M&A-dokumenter, direktørkontrakt | `GROUP_OWNER`, `GROUP_ADMIN`, `GROUP_LEGAL` |
| Fortroligt | `FORTROLIG` | Bestyrelsesreferater, økonominøgletal | Alle gruppe-roller + `COMPANY_MANAGER` |
| Internt | `INTERN` | Lejekontrakt, leverandøraftaler, sager | Alle med adgang til det pågældende selskab |
| Normalt | `STANDARD` | Ansættelseskontrakter, opgaver, kontaktinfo | Alle med selskabsadgang |
| Offentligt | `PUBLIC` | Stamdata (CVR, adresse, selskabsnavn) | Alle brugere |

---

## Kombinationsmatrix — hvad ser hvem?

```
                        STRENGT_    FORTRO-  INTERN   STAND-  PUBLIC
ROLLE                   FORTROLIG   LIG               ARD
─────────────────────────────────────────────────────────────────────
GROUP_OWNER             ✅          ✅       ✅       ✅      ✅
GROUP_ADMIN             ✅          ✅       ✅       ✅      ✅
GROUP_LEGAL             ✅          ✅       ✅       ✅      ✅
GROUP_FINANCE           ❌          ✅       ✅       ✅      ✅
GROUP_READONLY          ❌          ✅       ✅       ✅      ✅
COMPANY_MANAGER         ❌          ✅       ✅       ✅      ✅
COMPANY_LEGAL           ❌          ❌       ✅       ✅      ✅
COMPANY_READONLY        ❌          ❌       ✅       ✅      ✅
─────────────────────────────────────────────────────────────────────
```

---

## Konkrete eksempler fra tandlægekæden

### Eksempel A: Juridisk ansvarlig i gruppen (Philip)
```
Rolle:  GROUP_LEGAL
Scope:  ALL
Ser:    Alle kontrakter inkl. ejeraftaler på tværs af alle klinikker
        Alle sager
        Alle personer og governance-strukturer
Ser ikke: Økonomi-nøgletal (hører under GROUP_FINANCE)
```

### Eksempel B: CFO / økonomiansvarlig
```
Rolle:  GROUP_FINANCE
Scope:  ALL
Ser:    Økonominøgletal, udbyttelogger, tidsregistrering
        Fortrolige data (bestyrelsesreferater, økonominøgletal)
Ser ikke: Ejeraftaler, direktørkontrakter, M&A-dokumenter (STRENGT_FORTROLIG)
```

### Eksempel C: Klinikchef (ansvarlig for 2 klinikker)
```
Rolle:  COMPANY_MANAGER
Scope:  ASSIGNED (Klinik Østerbro + Klinik Aarhus)
Ser:    Alt FORTROLIG og lavere for sine to klinikker
        Lejekontrakter, leverandøraftaler, ansættelseskontrakter
Ser ikke: Ejeraftaler, andre klinikers data
```

### Eksempel D: Ekstern revisor
```
Rolle:  GROUP_READONLY
Scope:  ALL
Ser:    Kan se økonomidata og FORTROLIG på tværs
Ser ikke: Ejeraftaler (STRENGT_FORTROLIG)
Kan ikke: Oprette, redigere eller slette noget
```

---

## Modul-adgang pr. rolle (MVP)

```
MODUL                   G_OWNER  G_ADMIN  G_LEGAL  G_FIN  G_RO  C_MGR  C_LEGAL  C_RO
──────────────────────────────────────────────────────────────────────────────────────
Dashboard (portfolio)   ✅       ✅       ✅       ✅     ✅    ✅*    ✅*      ✅*
Selskabsprofil          ✅       ✅       ✅       ✅     ✅    ✅*    ✅*      ✅*
Ejerskab-fane           ✅       ✅       ✅       ❌     ❌    ❌     ❌       ❌
Governance-fane         ✅       ✅       ✅       ✅     ✅    ✅*    ✅*      ✅*
Ansatte-fane            ✅       ✅       ✅       ✅     ✅    ✅*    ✅*      ✅*
Kontrakter              ✅       ✅       ✅       ❌     ✅    ✅*    ✅*      ✅*
  - STRENGT_FORT.       ✅       ✅       ✅       ❌     ❌    ❌     ❌       ❌
Sager                   ✅       ✅       ✅       ❌     ✅    ✅*    ✅*      ✅*
Opgaver                 ✅       ✅       ✅       ✅     ✅    ✅*    ✅*      ✅*
Økonomi-overblik        ✅       ✅       ❌       ✅     ✅    ✅*    ❌       ✅*
Dokumenter              ✅       ✅       ✅       ✅     ✅    ✅*    ✅*      ✅*
Brugerstyring           ✅       ✅       ❌       ❌     ❌    ❌     ❌       ❌
Fakturering/plan        ✅       ❌       ❌       ❌     ❌    ❌     ❌       ❌
──────────────────────────────────────────────────────────────────────────────────────
* = kun for tildelte selskaber (scope: ASSIGNED/OWN)
```

---

## Implementering i databasen

```sql
-- Én bruger kan have FLERE rolle-tildelinger
-- (fx GROUP_LEGAL på tværs + COMPANY_MANAGER på én specifik klinik)

CREATE TABLE user_role_assignments (
  id              UUID PRIMARY KEY,
  organization_id UUID NOT NULL,          -- tenant
  user_id         UUID NOT NULL,
  role            TEXT NOT NULL,          -- UserRole enum: 'GROUP_OWNER', 'COMPANY_MANAGER' etc.
  scope           TEXT NOT NULL,          -- UserScope enum: 'ALL', 'ASSIGNED', 'OWN'
  company_ids     UUID[],                 -- NULL = alle, ellers specifikke
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  created_by      UUID
);

-- Sensitivitetsniveau på alle records
-- Tilføjes som kolonne på: kontrakter, sager, dokumenter
ALTER TABLE contracts    ADD COLUMN sensitivity TEXT DEFAULT 'STANDARD'; -- SensitivityLevel enum
ALTER TABLE cases        ADD COLUMN sensitivity TEXT DEFAULT 'INTERN';    -- SensitivityLevel enum
ALTER TABLE documents    ADD COLUMN sensitivity TEXT DEFAULT 'STANDARD'; -- SensitivityLevel enum
```

---

## Åbne spørgsmål til afklaring

1. **Kan én person have to roller?**
   Fx Philip har `GROUP_LEGAL` (ser alle kontrakter) OG `GROUP_FINANCE` (ser økonomi)?
   → **AFKLARET:** Ja — `user_role_assignments` understøtter flere rækker pr. bruger.
   Kilde: DATABASE-SCHEMA.md (`user_role_assignments`-tabel)

2. **Kan GROUP_LEGAL brugere oprette brugere på selskabsniveau?**
   → **AFKLARET:** Nej — kun `GROUP_OWNER` og `GROUP_ADMIN`.
   Kilde: Modul-adgangstabellen ovenfor (Brugerstyring-række)

3. **Hvad sker der når et selskab skifter status til "Solgt"?**
   → Anbefaling: Data arkiveres, readonly for alle, kan kun ses af `GROUP_OWNER`
   (ikke endeligt afklaret i andre dokumenter — afventer DECISIONS.md)

4. **Skal der være audit log på sensitive adgange?**
   → **AFKLARET:** Ja — `audit_log`-tabel + `last_viewed_at`/`last_viewed_by` på
   kontrakter og dokumenter.
   Kilde: DATABASE-SCHEMA.md (`audit_log`-tabel, linje ~840)

---

## Changelog

```
v0.3 (QA-R2-rettet):
  [K1] Lag 3-tabel: direktørkontrakt flyttet fra FORTROLIG → STRENGT_FORTROLIG.
       Kilde: CONTRACT-TYPES.md KT-02 (autoritativ).
       Eksempel B rettet tilsvarende — parentetisk korrektion fjernet.
  [K2] SQL DDL: cases sensitivity default rettet:
       DEFAULT 'STANDARD' → DEFAULT 'INTERN'
       Kilde: DATABASE-SCHEMA.md (linje ~637) og kravspec-legalhub.md (sektion 6.5).
  [M1] Åbne spørgsmål: spørgsmål 1, 2 og 4 markeret AFKLARET med kildehenvisning.
       Spørgsmål 3 (solgt selskab) afventer fortsat DECISIONS.md-afklaring.

v0.2 (QA-rettet):
  [K1] Sensitivity enum-værdier oversat til dansk igennem hele dokumentet:
       STRICTLY_CONFIDENTIAL → STRENGT_FORTROLIG (linje 61, 105, 123, 140, 192)
       CONFIDENTIAL → FORTROLIG (linje 62, 113, 122)
       INTERNAL → INTERN (linje 63)
       Kombinationsmatrix-header opdateret tilsvarende
  [K2] Tabel-navn rettet: user_roles → user_role_assignments (3 forekomster)
  [K3] Alle rollenavne konverteret til SCREAMING_SNAKE_CASE
       (group_owner → GROUP_OWNER, company_manager → COMPANY_MANAGER, osv.)
       Berørte sektioner: rolle-tabeller, kombinationsmatrix, eksempler A–D,
       modul-adgang header, åbne spørgsmål
       Fase 2-roller: external_partner → EXTERNAL_PARTNER,
       external_employee → EXTERNAL_EMPLOYEE
  [M1] SQL DDL: role og scope kolonner annoteret med enum-type kommentar
  [M2] SQL DDL: sensitivity kolonner annoteret med enum-type kommentar
  [M3] Versionsnummer: 1.0 → 0.2 (konsistent med øvrige QA-rettede spec-dokumenter)

v0.1:
  Første udkast
```
