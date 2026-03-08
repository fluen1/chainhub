# CONTRACT-TYPES.md
# ChainHub — Kontrakttyper og metadata
**Version 0.5 — DEA-challenge-rettet**
**Status: ACCEPTED efter DEA-challenge-runde**

---

## Designbeslutninger (v0.2 → v0.3)

```
FJERNET (for branchespecifik til generisk SaaS):
  Ydernummerkontrakt / Regionoverenskomst
  Laboratorieaftale
  Kautionserklæring
  Patientfinansieringsaftale

FLETTET:
  Konsulentaftale → Leverandørkontrakt (samme juridiske struktur)

NAVNGIVNING:
  system_type   = systemets interne enum (bruges til logik, advisering, relationer)
  display_name  = brugerens eget navn (fri tekst, vises i UI)
  Eksempel: system_type=INTERN_SERVICEAFTALE,
            display_name="Tilrådighedsaftale" / "Management Fee-aftale" /
            "Management Service Agreement" — brugerens valg

TO-LAGS KATALOG:
  Lag 1 — Universelle typer   aktiveres for alle brugere
  Lag 2 — Strukturtyper       aktiveres når brugeren har kæde/co-ownership
```

---

## Grundstruktur — fælles for alle kontrakttyper

```
STAMFELTER
  id                    UUID
  organization_id       UUID                multi-tenancy
  company_id            UUID                tilknyttet selskab
  system_type           ENUM                se katalog — bruges til systemlogik
  display_name          TEXT                brugerens eget navn — vises i UI
  status                ENUM                se statuser
  sensitivity           ENUM                STRENGT_FORTROLIG /
                                            FORTROLIG / INTERN /
                                            STANDARD / PUBLIC
  deadline_type         ENUM                ABSOLUT | OPERATIONEL | INGEN
  parent_contract_id    UUID NULL           reference til overordnet kontrakt
  triggered_by_id       UUID NULL           udløsende kontrakt/hændelse
  version_source        ENUM                BRANCHESTANDARD | INTERNT |
                                            EKSTERNT_STANDARD | CUSTOM
  must_retain_until     DATE NULL           lovpligtig opbevaringsperiode

PARTER
  parties[]             Relation → persons  kontraktparter
  signed_by[]           Relation → persons  faktiske underskrivere
  counterparty_name     TEXT NULL           ekstern part uden profil

DATOER
  effective_date        DATE
  expiry_date           DATE NULL           NULL = løbende lejemål / ubestemt
  signed_date           DATE NULL
  notice_period_days    INTEGER NULL        varselfrist i dage
  termination_date      DATE NULL           faktisk opsigelsesdato
  anciennity_start      DATE NULL           separat fra kontraktdato

ADVISERING
  reminder_90_days      BOOLEAN default true
  reminder_30_days      BOOLEAN default true
  reminder_7_days       BOOLEAN default true
  reminder_recipients   UUID[] NULL         NULL = owner

DOKUMENTER
  current_version_id    UUID
  versions[]            Relation → filer
  attachments[]         Relation → filer    bilag ≠ versioner

AUDIT
  created_at, updated_at, created_by
  last_viewed_at, last_viewed_by
  deleted_at                                soft delete
```

**Note om løbende kontrakter uden udløbsdato:**
`expiry_date = NULL` + `notice_period_days` er standardscenariet for
erhvervslejekontrakter og de fleste løbende aftaler. Systemet viser
ikke "udløber om X dage" men "løbende — opsigelsesvarsel X dage".
Advisering baseres på `notice_period_days`, ikke på `expiry_date`.

---

## Kontraktstatus-flow

```
UDKAST → TIL_REVIEW → TIL_UNDERSKRIFT → AKTIV
                                              ↓
                             UDLØBET | OPSAGT | FORNYET | ARKIVERET
```

---

## LAG 1 — Universelle typer

*Tilgængelige for alle brugere uanset virksomhedstype.*

---

### KATEGORI A: Ejerskab og selskabsret

#### KT-01: Ejeraftale
**system_type:** `EJERAFTALE`
**Sensitivitet:** `STRENGT_FORTROLIG` · **Deadline:** `ABSOLUT`
**Display navn eksempel:** "Ejeraftale", "Aktionæroverenskomst", "Anpartshaveroverenskomst"

```
ownership_percentage    JSONB       { person_id: % }
pre_emption_right       BOOLEAN
pre_emption_days        INTEGER     ABSOLUT deadline ved overdragelse
drag_along              BOOLEAN
tag_along               BOOLEAN
exit_procedure_days     INTEGER
non_compete_months      INTEGER
dividend_policy         TEXT
bad_leaver_definition   TEXT
good_leaver_definition  TEXT
```

#### KT-02: Direktørkontrakt
**system_type:** `DIREKTØRKONTRAKT`
**Sensitivitet:** `STRENGT_FORTROLIG` · **Deadline:** `OPERATIONEL`
**Note:** Direktøren er IKKE funktionær — selskabsretlig, ikke ansættelsesretlig.

```
base_salary             INTEGER
bonus_structure         TEXT
notice_period_director  INTEGER     dage
notice_period_company   INTEGER     dage
non_compete_months      INTEGER
severance_months        INTEGER
```

#### KT-03: Overdragelsesaftale (anparter/aktier)
**system_type:** `OVERDRAGELSESAFTALE`
**Sensitivitet:** `STRENGT_FORTROLIG` · **Deadline:** `ABSOLUT`
**Display navn eksempel:** "SPA", "Anpartsoverdragelse", "Share Purchase Agreement"

```
shares_pct_transferred  DECIMAL
purchase_price          INTEGER
completion_date         DATE
conditions_precedent    TEXT
warranties_months       INTEGER
earn_out                BOOLEAN
```

#### KT-04: Aktionærlåneaftale
**system_type:** `AKTIONÆRLÅN`
**Sensitivitet:** `STRENGT_FORTROLIG` · **Deadline:** `ABSOLUT`
**Kritisk:** GF-vedtagelse af markedsrente hvert år (LL § 16E).
Manglende dokumentation → skattemæssig omklassificering til løn/udbytte.

```
loan_amount             INTEGER
interest_rate_pct       DECIMAL     systemadvis hvis = 0
gf_approved_date        DATE
subordination           BOOLEAN
```

#### KT-05: Pantsætningsaftale
**system_type:** `PANTSÆTNING`
**Sensitivitet:** `STRENGT_FORTROLIG`

```
creditor_name           TEXT
pledged_asset           TEXT
loan_amount_secured     INTEGER
pledge_release_date     DATE NULL
```

#### KT-06: Vedtægter
**system_type:** `VEDTÆGTER`
**Sensitivitet:** `INTERN`
**Note:** Skal synkroniseres med KT-01 ved enhver ændring.

```
cvr_registered_version  BOOLEAN
registration_date       DATE
share_classes           TEXT[]
```

---

### KATEGORI B: Ansættelse og personale

#### KT-07: Ansættelseskontrakt — Funktionær
**system_type:** `ANSÆTTELSE_FUNKTIONÆR`
**Sensitivitet:** `FORTROLIG`
**Display navn eksempel:** "Ansættelseskontrakt", "Funktionærkontrakt"

```
probation_end_date      DATE        systemadvis 14 dage før
anciennity_start        DATE        separat fra kontraktdato — kritisk
collective_agreement    TEXT NULL   navn på OA hvis relevant
version_source          ENUM        BRANCHESTANDARD | INTERNT | EKSTERNT_STANDARD | CUSTOM
```

**Systemadvis:** ved anciennitet 6 mdr, 3 år, 6 år, 9 år (FL opsigelsesvarsel).
**OA-logik:** `version_source = BRANCHESTANDARD` + `collective_agreement` feltet
identificerer kontrakter der skal markeres ved overenskomstfornyelse.

#### KT-08: Ansættelseskontrakt — Ikke-funktionær
**system_type:** `ANSÆTTELSE_IKKE_FUNKTIONÆR`
**Sensitivitet:** `FORTROLIG`

```
hourly_rate             INTEGER
scheduled_hours_weekly  DECIMAL
anciennity_start        DATE
```

#### KT-09: Vikaraftale
**system_type:** `VIKARAFTALE`
**Sensitivitet:** `STANDARD`

```
assignment_start        DATE
assignment_end          DATE NULL
via_agency              BOOLEAN
hourly_rate             INTEGER
```

#### KT-10: Uddannelsesaftale (elev/EUD)
**system_type:** `UDDANNELSESAFTALE`
**Sensitivitet:** `STANDARD` · **Deadline:** `ABSOLUT`
**Kritisk:** Prøvetid 2 uger → herefter fuld uddannelsesbeskyttelse.

```
educational_institution TEXT
programme_start         DATE
programme_end           DATE
probation_end_date      DATE        ABSOLUT — 2 uger
```

#### KT-11: Fratrædelsesaftale
**system_type:** `FRATRÆDELSESAFTALE`
**Sensitivitet:** `FORTROLIG` · **Deadline:** `ABSOLUT`
**Kritisk:** Fortrydelsesret 14 dage (ansættelsesbevisloven § 5a).

```
termination_date        DATE
severance_amount        INTEGER
right_of_withdrawal_expires DATE   ABSOLUT
ll_7u_applicable        BOOLEAN
```

#### KT-12: Konkurrenceklausulaftale
**system_type:** `KONKURRENCEKLAUSUL`
**Sensitivitet:** `FORTROLIG` · **Deadline:** `ABSOLUT`
**Kritisk:** Manglende månedlig kompensation → klausul bortfalder (FUL § 18c).
Kan sidde som bilag til KT-07 eller som selvstændigt dokument.

```
parent_contract_id      UUID NULL   reference til ansættelseskontrakt
geographic_scope        TEXT
duration_months         INTEGER     max 12 jf. FUL § 18a
monthly_compensation    INTEGER
compensation_pct        DECIMAL     min. 60% jf. FUL § 18b
customer_clause         BOOLEAN
```

#### KT-13: Personalehåndbog
**system_type:** `PERSONALEHÅNDBOG`
**Sensitivitet:** `INTERN`
**Note:** Styrende dokument med kontraktuel status via inkorporering i ansættelseskontrakter.

```
version_number          TEXT
applicable_locations    UUID[]
incorporated_in         UUID[]      reference til ansættelseskontrakter
next_review_date        DATE
```

---

### KATEGORI C: Lokaler og udstyr

#### KT-14: Lejekontrakt — Erhverv
**system_type:** `LEJEKONTRAKT_ERHVERV`
**Sensitivitet:** `INTERN` · **Deadline:** `ABSOLUT`
**Kritisk:** Automatisk forlængelse ved manglende opsigelse (typisk 3-5 år).
Mange lejemål er løbende uden fast udløbsdato — brug `notice_period_days`.

```
property_address        TEXT
monthly_rent            INTEGER
annual_rent_adjustment  TEXT        NPI / fast % / forhandling
auto_renewal            BOOLEAN
auto_renewal_period_yrs INTEGER NULL
deposit_months          INTEGER NULL
```

#### KT-15: Leasingaftale
**system_type:** `LEASINGAFTALE`
**Sensitivitet:** `INTERN` · **Deadline:** `ABSOLUT`
**Display navn eksempel:** "Leasingaftale — Udstyr", "Billeasing", "IT-leasing"

```
lessor_name             TEXT
asset_description       TEXT
monthly_leasing_fee     INTEGER
lease_type              ENUM        FINANSIEL | OPERATIONEL
residual_value          INTEGER NULL
purchase_option         BOOLEAN
termination_window_days INTEGER     dage inden udløb til opsigelse
```

---

### KATEGORI D: Kommercielle aftaler

#### KT-16: Leverandørkontrakt
**system_type:** `LEVERANDØRKONTRAKT`
**Sensitivitet:** `INTERN`
**Display navn eksempel:** "Leverandørkontrakt", "Konsulentaftale",
"Serviceaftale", "Rengøringsaftale", "Vedligeholdelsesaftale"
**Note:** Konsulentaftaler er varianter af denne type.

```
vendor_name             TEXT
vendor_cvr              TEXT NULL
auto_renewal            BOOLEAN
auto_renewal_days       INTEGER NULL
monthly_cost            INTEGER NULL
annual_cost             INTEGER NULL
```

**Systemlogik:** `auto_renewal = true` →
reminder sættes til `expiry_date − auto_renewal_days − 14`.

#### KT-17: Samarbejdsaftale
**system_type:** `SAMARBEJDSAFTALE`
**Sensitivitet:** `FORTROLIG`
**Display navn eksempel:** "Samarbejdsaftale", "Partnerskabsaftale", "Konsortieaftale"

```
exclusivity             BOOLEAN
revenue_share           BOOLEAN
revenue_share_pct       DECIMAL NULL
```

#### KT-18: Fortrolighedsaftale (NDA)
**system_type:** `NDA`
**Sensitivitet:** `FORTROLIG`

```
nda_type                ENUM        GENSIDIG | ENSIDIG
confidentiality_years   INTEGER
purpose                 TEXT
```

#### KT-19: IT-/Systemaftale
**system_type:** `IT_SYSTEMAFTALE`
**Sensitivitet:** `INTERN` · **Deadline:** `ABSOLUT`
**Display navn eksempel:** "Journalsystemaftale", "ERP-aftale",
"Bogføringssystem", "HR-systemaftale"
**Note:** Indeholder typisk databehandlerelementer — DBA oprettes som bilag.

```
system_name             TEXT
vendor_name             TEXT
dba_reference_id        UUID NULL   reference til KT-20
data_portability_terms  TEXT NULL
```

#### KT-20: Databehandleraftale (DBA)
**system_type:** `DBA`
**Sensitivitet:** `INTERN`
**Note:** Aldrig standalone — altid bilag til primær aftale (KT-16, KT-19, KT-17).

```
processor_name          TEXT
data_categories         TEXT[]
sub_processors          BOOLEAN
transfer_outside_eu     BOOLEAN
transfer_basis          TEXT NULL   SCCs / adequacy / andet
```

---

### KATEGORI E: Forsikring og governance

#### KT-21: Forsikringsaftale
**system_type:** `FORSIKRING`
**Sensitivitet:** `INTERN`

```
insurance_type          ENUM        ERHVERVSANSVAR | ARBEJDSSKADE |
                                    TINGSFORSIKRING | LEDELSESANSVAR |
                                    ANDET
policy_number           TEXT
annual_premium          INTEGER
coverage_amount         INTEGER
```

#### KT-22: Generalforsamlingsreferat
**system_type:** `GF_REFERAT`
**Sensitivitet:** `FORTROLIG`

```
meeting_date            DATE
meeting_type            ENUM        ORDINÆR | EKSTRAORDINÆR
resolutions             TEXT[]
quorum_met              BOOLEAN
```

#### KT-23: Bestyrelsesreferat
**system_type:** `BESTYRELSESREFERAT`
**Sensitivitet:** `FORTROLIG`

```
meeting_date            DATE
attendees               UUID[]
resolutions             TEXT[]
```

#### KT-24: Forretningsorden for bestyrelse
**system_type:** `FORRETNINGSORDEN`
**Sensitivitet:** `FORTROLIG`
**Note:** Selvstændig livscyklus — opdateres uafhængigt af ejeraftalen.

```
board_size              INTEGER
meeting_frequency       TEXT
quorum_requirement      TEXT
```

#### KT-25: Direktionsinstruks
**system_type:** `DIREKTIONSINSTRUKS`
**Sensitivitet:** `FORTROLIG`
**Note:** Opdateres ved direktørskifte — ikke kun ved ejeraftalerevision.

```
parent_contract_id      UUID NULL   reference til KT-02
approval_threshold      INTEGER NULL
signing_authority       TEXT
```

#### KT-26: Virksomhedsoverdragelsesaftale (VOA)
**system_type:** `VOA`
**Sensitivitet:** `STRENGT_FORTROLIG` · **Deadline:** `ABSOLUT`
**Note:** Overdragelse af drift — ikke anparter. Udløser medarbejderrettigheder (VOA-loven).

```
transferred_assets      TEXT[]
employee_transfer_count INTEGER
voa_notice_date         DATE        meddelelse til ansatte (ABSOLUT)
completion_date         DATE
```

---

## LAG 2 — Strukturtyper (kæde / co-ownership)

*Aktiveres i onboarding når bruger angiver kædestruktur med delejede selskaber.*
*Alle navne er bruger-definerede via `display_name`.*

---

#### KT-27: Intern serviceaftale
**system_type:** `INTERN_SERVICEAFTALE`
**Sensitivitet:** `STRENGT_FORTROLIG`
**Display navn eksempel:** "Tilrådighedsaftale", "Management Fee-aftale",
"Shared Service-aftale", "Management Service Agreement"
**Kritisk:** Armslængevilkår krævet (LL § 2). Eksisterer typisk som løse
e-mails — systemet bør prompte brugeren til at formalisere den.

```
service_provider_id     UUID        holdingselskab / head office
service_recipient_id    UUID        lokationsselskab
services_description    TEXT[]      liste af ydelser
annual_fee              INTEGER
fee_adjustment_basis    TEXT        CPI / fast % / forhandling
transfer_pricing_doc    BOOLEAN     TP-dokumentation udarbejdet?
tp_method               ENUM NULL   CUP | COST_PLUS | TNMM | PROFIT_SPLIT | ANDET
tp_last_reviewed        DATE NULL   seneste TP-review dato
tp_document_id          UUID NULL   reference til uploaded TP-dokumentation
```

#### KT-28: Royalty- / Licensaftale
**system_type:** `ROYALTY_LICENS`
**Sensitivitet:** `STRENGT_FORTROLIG`
**Display navn eksempel:** "Royaltyaftale", "Brandlicensaftale", "Konceptlicens"
**Note:** Adskilt fra KT-27 — forskellig skattemæssig behandling og TP-krav.

```
licensor_id             UUID
licensee_id             UUID
licensed_asset          TEXT        brand / koncept / systemer / know-how
royalty_rate_pct        DECIMAL
royalty_basis           TEXT        omsætning / resultat / fast beløb
tp_method               ENUM NULL   CUP | COST_PLUS | TNMM | PROFIT_SPLIT | ANDET
tp_last_reviewed        DATE NULL   seneste TP-review dato
tp_document_id          UUID NULL   reference til uploaded TP-dokumentation
```

#### KT-29: Optionsaftale (andele)
**system_type:** `OPTIONSAFTALE`
**Sensitivitet:** `STRENGT_FORTROLIG` · **Deadline:** `ABSOLUT`
**Display navn eksempel:** "Optionsaftale", "Købsoptionsaftale", "Partner-option"
**Formål:** Giver retten (men ikke pligten) til at købe/sælge en ejerandel
til aftalt pris inden for et bestemt tidsvindue. Bruges typisk ved
direktør-/partner-onboarding (gradvis indtrædelse) og ved exit-klausuler.
**Kritisk:** Bortfalder uigenkaldeligt ved udløb af udnyttelsesvindue.

```
option_type             ENUM        CALL | PUT | BOTH
option_holder_id        UUID
exercise_price          INTEGER NULL  NULL = prisformel
exercise_price_formula  TEXT NULL
exercise_window_start   DATE
exercise_window_end     DATE          ABSOLUT deadline
trigger_event           TEXT NULL     hvad aktiverer optionen
```

#### KT-30: Tiltrædelsesdokument til ejeraftale
**system_type:** `TILTRÆDELSESDOKUMENT`
**Sensitivitet:** `STRENGT_FORTROLIG`
**Display navn eksempel:** "Tiltrædelsesdokument", "Accession Agreement"
**Formål:** Ny partner skriver under på at være bundet af eksisterende ejeraftale.
Alternativet er at lave en ny ejeraftale fra bunden ved hvert ejerskifte.

```
parent_contract_id      UUID        reference til KT-01 (ejeraftale)
acceding_party_id       UUID
accession_date          DATE
```

#### KT-31: Kassekreditaftale / Bankfacilitet
**system_type:** `KASSEKREDIT`
**Sensitivitet:** `FORTROLIG` · **Deadline:** `ABSOLUT`
**Display navn eksempel:** "Kassekreditaftale", "Driftskredit", "Bankfacilitet"

```
creditor_name           TEXT
facility_amount         INTEGER
review_date             DATE        ABSOLUT — bank kan opsige ved passivitet
covenants               TEXT[] NULL
```

#### KT-32: Cash pool-aftale
**system_type:** `CASH_POOL`
**Sensitivitet:** `STRENGT_FORTROLIG`
**Display navn eksempel:** "Cash Pool-aftale", "Koncernkontoaftale"
**Formål:** Regulerer topkonto (typisk holdingselskabet) over for underkontohavere
(lokationsselskaberne). Intern likviditetsudligning. Adskilt fra KT-04
(aktionærlån) — to juridisk vidt forskellige konstruktioner.

```
pool_manager_id         UUID        topkontohaver
participant_ids         UUID[]      underkontohavere
interest_rate_pct       DECIMAL     skal dokumenteres (armslængde)
sweep_frequency         TEXT        daglig / ugentlig / månedlig
```

#### KT-33: Intercompany-lån
**system_type:** `INTERCOMPANY_LÅN`
**Sensitivitet:** `STRENGT_FORTROLIG` · **Deadline:** `ABSOLUT`
**Display navn eksempel:** "Koncernlån", "Intercompany-lån", "Datterselskabslån"
**Note:** Selskab-til-selskab lån. Adskilt fra KT-04 (aktionærlån — person til selskab).

```
lender_company_id       UUID
borrower_company_id     UUID
loan_amount             INTEGER
interest_rate_pct       DECIMAL
repayment_date          DATE
subordination           BOOLEAN
```

---

## Minimum-sensitivitet pr. system_type

```
STRENGT_FORTROLIG:
  EJERAFTALE, DIREKTØRKONTRAKT, OVERDRAGELSESAFTALE,
  AKTIONÆRLÅN, PANTSÆTNING, VOA,
  INTERN_SERVICEAFTALE, ROYALTY_LICENS, OPTIONSAFTALE,
  TILTRÆDELSESDOKUMENT, CASH_POOL, INTERCOMPANY_LÅN,
  SELSKABSGARANTI

FORTROLIG:
  ANSÆTTELSE_FUNKTIONÆR, ANSÆTTELSE_IKKE_FUNKTIONÆR,
  SAMARBEJDSAFTALE, NDA, GF_REFERAT, BESTYRELSESREFERAT,
  FORRETNINGSORDEN, DIREKTIONSINSTRUKS,
  FRATRÆDELSESAFTALE, KONKURRENCEKLAUSUL, KASSEKREDIT

INTERN:
  LEJEKONTRAKT_ERHVERV, LEASINGAFTALE, LEVERANDØRKONTRAKT,
  IT_SYSTEMAFTALE, DBA, VEDTÆGTER, FORSIKRING,
  PERSONALEHÅNDBOG

STANDARD:
  VIKARAFTALE, UDDANNELSESAFTALE
```

---

## ABSOLUT deadline-register

```
EJERAFTALE              Forkøbsret-udøvelse    20-60 dage fra underretning
LEJEKONTRAKT_ERHVERV    Opsigelse              Notice_period_days → automatisk forlængelse
AKTIONÆRLÅN             GF-markedsrente        Hvert år → skatteomklassificering
OVERDRAGELSESAFTALE     Closing-deadline       Kontraktspecifik → aftale bortfalder
OPTIONSAFTALE           Udnyttelsesvindue      exercise_window_end → bortfalder uigenkaldeligt
KASSEKREDIT             Review-dato            → bank kan opsige med kort varsel
LEASINGAFTALE           Opsigelsesvindue       termination_window_days inden udløb
FRATRÆDELSESAFTALE      Fortrydelsesret        14 dage → bindende
KONKURRENCEKLAUSUL      Kompensationsbetaling  Månedlig → klausul bortfalder (FUL § 18c)
UDDANNELSESAFTALE       Prøvetid               2 uger → fuld uddannelsesbeskyttelse
VOA                     Meddelelse til ansatte Inden overdragelse → erstatningsansvar
```

---

## Indbyrdes relationer

```
EJERAFTALE
  STYRER → OVERDRAGELSESAFTALE, OPTIONSAFTALE, TILTRÆDELSESDOKUMENT
  SYNKRONISERES MED → VEDTÆGTER (ved enhver ændring)
  GENERERER → FORRETNINGSORDEN, DIREKTIONSINSTRUKS

DIREKTØRKONTRAKT
  FORUDSÆTTER → BESTYRELSESREFERAT (vedtagelse)
  SUPPLERES AF → DIREKTIONSINSTRUKS, KONKURRENCEKLAUSUL
  AFLØSES AF → FRATRÆDELSESAFTALE

DBA
  BILAG TIL → LEVERANDØRKONTRAKT, IT_SYSTEMAFTALE, SAMARBEJDSAFTALE
  (aldrig standalone)

AKTIONÆRLÅN
  FORUDSÆTTER → GF_REFERAT (godkendelse, SL § 210)
  ADSKILT FRA → INTERCOMPANY_LÅN (selskab-til-selskab)
  ADSKILT FRA → CASH_POOL (intern likviditetsudligning)

PANTSÆTNING
  SIKRER → KASSEKREDIT (hører altid sammen)

OVERDRAGELSESAFTALE
  FORUDSÆTTER → NDA (due diligence), TILTRÆDELSESDOKUMENT
  UDLØSER → KASSEKREDIT revision, DIREKTØRKONTRAKT revision

INTERN_SERVICEAFTALE
  RELATERET TIL → DIREKTØRKONTRAKT
  (fee påvirker reel direktørkompensation — ændring i fee
  ændrer kompensation uden at røre direktørkontrakten)
```

---

## DEA-challenge — besvarede spørgsmål

```
[Q1] BESVARET (DEC-001 ACCEPTED): Opbevaringspligt auto-beregnes.
     Se "Lovpligtig opbevaringsperiode" nedenfor.

[Q2] BESVARET: Lag 2-typerne er dækkende for co-ownership strukturer.
     KT-34 (Selskabsgaranti) tilføjes (DEC-003).

[Q3] BESVARET (DEC-006 ACCEPTED): MVP starter pack = 8 MUST-typer.
     Se "MVP-prioritering" nedenfor.

[Q4] BESVARET: OA-logikken (version_source + collective_agreement)
     er tilstrækkelig til MVP. Automatisk markering ved OA-fornyelse
     er en v1.1-feature.

[Q5] BESVARET: Løbende kontrakter med expiry_date=NULL adviseres
     baseret på notice_period_days. Systemet viser "løbende —
     opsigelsesvarsel X dage". Logikken er korrekt.

[Q6] BESVARET (DEC-017 ACCEPTED): Cash pool og intercompany-lån
     kræver audit log ved alle adgange (STRENGT_FORTROLIG).
     Ingen GDPR-særkrav udover standard anonymisering.
```

---

## Lovpligtig opbevaringsperiode per system_type (DEC-001)

*Auto-beregnet af systemet. Brugeren kan forlænge men aldrig forkorte.*

```
PERMANENT (så længe selskabet eksisterer):
  VEDTÆGTER                   Selskabsloven §§ 50-53
  GF_REFERAT                  Selskabsloven § 100

10 ÅR (fra kontraktophør/underskrift):
  EJERAFTALE                  Forældelsesloven § 4
  DIREKTØRKONTRAKT            Forældelsesloven § 4
  OVERDRAGELSESAFTALE         Forældelsesloven § 4
  OPTIONSAFTALE               Forældelsesloven § 4
  VOA                         Forældelsesloven § 4
  TILTRÆDELSESDOKUMENT        Forældelsesloven § 4

5 ÅR (fra regnskabsårets udløb / fratrædelse):
  AKTIONÆRLÅN                 Bogføringsloven § 10
  PANTSÆTNING                 Bogføringsloven § 10
  LEJEKONTRAKT_ERHVERV        Bogføringsloven § 10
  LEASINGAFTALE               Bogføringsloven § 10
  LEVERANDØRKONTRAKT          Bogføringsloven § 10
  IT_SYSTEMAFTALE             Bogføringsloven § 10
  FORSIKRING                  Bogføringsloven § 10
  KASSEKREDIT                 Bogføringsloven § 10
  INTERCOMPANY_LÅN            Bogføringsloven § 10
  CASH_POOL                   Bogføringsloven § 10
  INTERN_SERVICEAFTALE        Bogføringsloven § 10
  ROYALTY_LICENS              Bogføringsloven § 10
  ANSÆTTELSE_FUNKTIONÆR       5 år efter fratrædelse
  ANSÆTTELSE_IKKE_FUNKTIONÆR  5 år efter fratrædelse
  VIKARAFTALE                 5 år efter ophør
  UDDANNELSESAFTALE           5 år efter ophør
  FRATRÆDELSESAFTALE          5 år efter indgåelse
  KONKURRENCEKLAUSUL          5 år efter udløb
  PERSONALEHÅNDBOG            5 år efter erstatning

3 ÅR (fra ophør):
  NDA                         Forældelsesloven § 3
  SAMARBEJDSAFTALE            Forældelsesloven § 3
  DBA                         Følger hovedaftalen

INGEN LOVKRAV (bruger-defineret):
  BESTYRELSESREFERAT          Anbefaling: permanent
  FORRETNINGSORDEN            Anbefaling: permanent
  DIREKTIONSINSTRUKS          Anbefaling: 10 år
```

---

## MVP-prioritering (DEC-006)

```
MUST (MVP — dag 1-30, 8 typer):
  EJERAFTALE, DIREKTØRKONTRAKT, ANSÆTTELSE_FUNKTIONÆR,
  LEJEKONTRAKT_ERHVERV, LEVERANDØRKONTRAKT,
  INTERN_SERVICEAFTALE, VEDTÆGTER, FORSIKRING

SHOULD (v1.1 — måned 2-3, 10 typer):
  OVERDRAGELSESAFTALE, AKTIONÆRLÅN, ANSÆTTELSE_IKKE_FUNKTIONÆR,
  LEASINGAFTALE, NDA, GF_REFERAT, KONKURRENCEKLAUSUL,
  PERSONALEHÅNDBOG, ROYALTY_LICENS, KASSEKREDIT

COULD (fase 2, 16 typer):
  PANTSÆTNING, VIKARAFTALE, UDDANNELSESAFTALE, FRATRÆDELSESAFTALE,
  SAMARBEJDSAFTALE, IT_SYSTEMAFTALE, DBA, BESTYRELSESREFERAT,
  FORRETNINGSORDEN, DIREKTIONSINSTRUKS, VOA, OPTIONSAFTALE,
  TILTRÆDELSESDOKUMENT, CASH_POOL, INTERCOMPANY_LÅN,
  SELSKABSGARANTI

Note: Database-schema rummer alle 34 typer (JSONB type_data).
      UI og onboarding viser kun MUST-typer i MVP.
```

---

## Onboarding-rækkefølge for ny klinik (DEC-004)

```
Ved etablering af en ny klinik oprettes kontrakter i denne rækkefølge:

1. VEDTÆGTER (KT-06)               Selskabet stiftes
2. EJERAFTALE (KT-01)              Ejerskabsstruktur fastlægges
3. TILTRÆDELSESDOKUMENT (KT-30)    Ny partner bindes (hvis co-owned)
4. DIREKTØRKONTRAKT (KT-02)        + DIREKTIONSINSTRUKS (KT-25)
5. INTERN_SERVICEAFTALE (KT-27)    Management fee fra dag 1
6. LEJEKONTRAKT_ERHVERV (KT-14)    Lokale sikres
7. FORSIKRING (KT-21)              Drift kan begynde
8. ANSÆTTELSE_FUNKTIONÆR (KT-07)   Personale ansættes

Systemet bør guide brugeren igennem denne rækkefølge ved
oprettelse af et nyt selskab (starter pack, jf. DEC-007).
```

---

## Anonymiseringsstrategi per system_type (DEC-015)

```
ANONYMISERING (personreferencer fjernes, beløb/vilkår bevares):
  Alle ansættelseskontrakter, direktørkontrakter, fratrædelsesaftaler,
  konkurrenceklausuler — indeholder persondata (navne, løn, CPR-ref)

FULD_SLETNING (hele kontrakten slettes):
  Ingen typer — alle kontrakter har et minimum af opbevaringsværdi

INGEN (ingen persondata at anonymisere):
  VEDTÆGTER, FORSIKRING, LEJEKONTRAKT_ERHVERV, LEASINGAFTALE,
  LEVERANDØRKONTRAKT (uden personreferencer), IT_SYSTEMAFTALE

Mekanisme: Cron-job kører dagligt.
  Tjekker: must_retain_until < today() AND deleted_at IS NOT NULL
  Handling: person-referencer erstattes med "Anonymiseret [hash]"
  Beløb, vilkår og kontraktstruktur bevares til historisk reference.
```

---

## KT-34: Selskabsgaranti / Kaution (DEC-003)

**system_type:** `SELSKABSGARANTI`
**Sensitivitet:** `STRENGT_FORTROLIG`
**MVP-prioritering:** COULD
**Display navn eksempel:** "Selvskyldnerkaution", "Selskabsgaranti", "Corporate Guarantee"
**Note:** Juridisk adskilt fra pantsætning (KT-05). Personlig hæftelse, ikke tinglig sikkerhed.

```
guarantee_type          ENUM        SELVSKYLDNER | SIMPEL
guarantor_company_id    UUID        selskabet der stiller garanti
beneficiary_name        TEXT        modtager (typisk bank/udlejer)
guaranteed_amount       INTEGER
guaranteed_obligation   TEXT        beskrivelse af underliggende forpligtelse
related_contract_id     UUID NULL   reference til den sikrede kontrakt
```

---

## Changelog

```
v0.5 (DEA-challenge-rettet):
  [K1] DEC-001: Lovpligtig opbevaringsperiode tilføjet per system_type
       med lovhjemmel (bogføringsloven, selskabsloven, forældelsesloven)
  [K2] DEC-006: MVP-prioritering tilføjet (MUST/SHOULD/COULD)
       8 MUST-typer, 10 SHOULD-typer, 16 COULD-typer
  [K3] DEC-015: Anonymiseringsstrategi tilføjet per system_type
  [K4] DEC-003: KT-34 Selskabsgaranti tilføjet som ny kontrakttype
  [K5] DEC-004: Onboarding-rækkefølge for ny klinik tilføjet
  [K6] DEC-002/013: Allonge-mekanisme dokumenteret (spec for ContractVersion)
  [K7] DEC-009: TP-felter tilføjes til KT-27/KT-28 type_data
  [K8] Åbne spørgsmål besvaret (Q1-Q6)

v0.4 (QA-rettet):
  [K1] Sensitivity enum-værdier oversat til dansk igennem hele dokumentet
       (alle 33 kontrakttyper + grundstruktur + minimum-sensitivitet-sektion):
       STRICTLY_CONFIDENTIAL → STRENGT_FORTROLIG
       CONFIDENTIAL → FORTROLIG
       INTERNAL → INTERN
  [K2] NdaType enum oversat til dansk:
       MUTUAL → GENSIDIG, ONE_WAY → ENSIDIG
       (match med DATABASE-SCHEMA.md v0.2 [M1])
  [K3] Version bumped 0.3 → 0.4 (API-SPEC.md Appendix A angiver v0.4
       som autoritativ kilde)
  [K4] KT-07 version_source: EKSTERNT_STANDARD tilføjet til enum
       (match med grundstruktur linje 50 og VersionSource-enum i DATABASE-SCHEMA.md)
  [M1] Deadline-register: forkortede system_type-navne erstattet med
       korrekte enum-værdier:
       LEJEKONTRAKT → LEJEKONTRAKT_ERHVERV
       OVERDRAGELSE → OVERDRAGELSESAFTALE
       FRATRÆDELSE → FRATRÆDELSESAFTALE
  [M2] Indbyrdes relationer: TRIGGERS → UDLØSER
       (match med RelationType-enum i DATABASE-SCHEMA.md v0.2 [M2])
  [M3] Stavefejl: GENERER → GENERERER

v0.3:
  Generisk to-lags katalog — klar til DEA-challenge-runde
```
