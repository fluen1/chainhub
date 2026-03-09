# DECISIONS.md
# ChainHub — Arkitekturbeslutninger
**Skrives af:** Alle agenter (DEA + BA)
**Læses af:** BA-01 (Orchestrator)

## Statuser
PROPOSED / CHALLENGED / REVISED / ACCEPTED / WONT-FIX

## Rangering
KRITISK / VIGTIG / NICE-TO-HAVE

## Beslutninger

---

## DEC-001: Opbevaringspligt — must_retain_until mangler auto-beregning og lovhjemmel
**Status:** ACCEPTED
**Proposed by:** DEA-01 (Juridisk Rådgiver)
**Dato:** 2026-03-08
**Rangering:** KRITISK
**Orchestrators afgørelse:** ACCEPTED — Lovpligtig opbevaring er non-negotiable. Implementeres som retention_rules-konfiguration per system_type i CONTRACT-TYPES.md. Auto-beregning bygges i Sprint 3 (kontraktstyring). Brugeren kan forlænge men aldrig forkorte. Spec opdateres.

**Forslag/Indsigelse:**
CONTRACT-TYPES.md har feltet `must_retain_until` men overlader det til brugeren at sætte datoen manuelt. Det er en compliance-risiko. Systemet bør auto-beregne baseret på `system_type` og `signed_date` / `termination_date`:

- Bogføringsloven § 10: 5 år fra regnskabsårets udløb — gælder alle kontrakter med økonomisk indhold (lejekontrakter, leverandøraftaler, leasingaftaler, aktionærlån, intercompany-lån, kassekreditaftaler, forsikringer)
- Selskabsloven §§ 50-53: Vedtægter og ejerbog = permanent (så længe selskabet eksisterer)
- Forældelsesloven § 3/§ 4: Kontraktgrundlag = 10 år (ejeraftaler, direktørkontrakter, overdragelsesaftaler, optionsaftaler)
- Ansættelsesret: Ansættelseskontrakter = 5 år efter fratrædelse (ligebehandlingsloven, forskelsbehandlingsloven — kravforældelse)
- GF-referater: permanent (selskabsloven)
- GDPR: persondata anonymiseres når opbevaringspligt udløber

Systemet skal have en `retention_rules`-konfiguration per `system_type` der auto-beregner `must_retain_until`. Brugeren kan forlænge men aldrig forkorte under lovkravet.

---

## DEC-002: Allonge/tillæg mangler som kontraktændringsmekanisme
**Status:** ACCEPTED
**Proposed by:** DEA-01 (Juridisk Rådgiver)
**Dato:** 2026-03-08
**Rangering:** VIGTIG
**Orchestrators afgørelse:** ACCEPTED — Allonger er en reel juridisk mekanisme. Tilføj `amendment_type` enum (NY_VERSION | ALLONGE | RETTELSE) og `amends_clause` (TEXT) til ContractVersion i DATABASE-SCHEMA.md. Implementeres i Sprint 3.

**Forslag/Indsigelse:**
CONTRACT-TYPES.md skelner mellem "version" (nyt dokument) og "bilag" (attachments). Men i dansk kontraktret er en **allonge/tillæg** en tredje kategori: et selvstændigt dokument der ændrer en bestemt klausul i hovedkontrakten uden at erstatte hele dokumentet. Allonger er juridisk bindende og skal knyttes til den specifikke version de ændrer.

Nuværende `ContractVersion`-model understøtter ikke dette — den har kun `version_number` og `change_note`. En allonge er ikke en ny version men et supplement med egen underskrift og ikrafttrædelsesdato.

Forslag: Tilføj `amendment_type` felt på `ContractVersion` (ENUM: NY_VERSION | ALLONGE | RETTELSE) og `amends_clause` (TEXT) til at beskrive hvilken klausul der ændres.

---

## DEC-003: Selskabsgaranti / kaution mangler som selvstændig kontrakttype
**Status:** ACCEPTED
**Proposed by:** DEA-01 (Juridisk Rådgiver)
**Dato:** 2026-03-08
**Rangering:** VIGTIG
**Orchestrators afgørelse:** ACCEPTED — GuaranteeType enum eksisterer allerede i schema men bruges ikke. Tilføj KT-34 SELSKABSGARANTI til CONTRACT-TYPES.md og SELSKABSGARANTI til ContractSystemType enum. Placeres i SHOULD-prioritet (v1.1).

**Forslag/Indsigelse:**
KT-05 (Pantsætningsaftale) dækker tinglig sikkerhedsstillelse. Men i kædestrukturer stiller holdingselskabet typisk **selvskyldnerkaution** for datterselskabernes forpligtelser (lån, lejekontrakter). En kaution er juridisk fundamentalt forskellig fra en pantsætning — den er en personlig hæftelse, ikke en tinglig sikkerhed.

DATABASE-SCHEMA.md har allerede en `GuaranteeType` enum (SELVSKYLDNER | SIMPEL) men der er ingen kontrakttype der bruger den.

Forslag: Tilføj KT-34 Selskabsgaranti/Kaution med felter: `guarantee_type` (SELVSKYLDNER | SIMPEL), `guarantor_company_id`, `beneficiary_name`, `guaranteed_amount`, `guaranteed_obligation` (reference til den underliggende forpligtelse).

---

## DEC-004: Ny klinik-onboarding mangler defineret kontraktrækkefølge
**Status:** ACCEPTED
**Proposed by:** DEA-02 (Franchise & Kædestruktur)
**Dato:** 2026-03-08
**Rangering:** VIGTIG
**Orchestrators afgørelse:** ACCEPTED — Onboarding-rækkefølgen dokumenteres som ny sektion i CONTRACT-TYPES.md. Bruges som input til UI-FLOWS.md onboarding-flow i Sprint 2. Rækkefølgen er korrekt som beskrevet.

**Forslag/Indsigelse:**
CONTRACT-TYPES.md beskriver 33 kontrakttyper men definerer ikke den rækkefølge hvori kontrakter skal oprettes ved etablering af en ny klinik. I praksis er rækkefølgen juridisk bindende — fx kan man ikke underskrive en intern serviceaftale før selskabet er stiftet og vedtægter er registreret.

Anbefalet rækkefølge ved ny klinik-onboarding:
1. Vedtægter (KT-06) — selskabet stiftes
2. Ejeraftale (KT-01) — ejerskabsstruktur fastlægges
3. Tiltrædelsesdokument (KT-30) — ny partner bindes af ejeraftale
4. Direktørkontrakt (KT-02) + Direktionsinstruks (KT-25)
5. Intern serviceaftale (KT-27) — management fee fra dag 1
6. Lejekontrakt (KT-14) — lokale sikres
7. Forsikring (KT-21) — drift kan begynde
8. Ansættelseskontrakter (KT-07/08) — personale ansættes

Forslag: Tilføj en "onboarding checklist"-sektion i CONTRACT-TYPES.md eller som et separat dokument der kan drive et UI-flow.

---

## DEC-005: 100% ejede klinikker har ikke-distinkt håndtering
**Status:** WONT-FIX
**Proposed by:** DEA-02 (Franchise & Kædestruktur)
**Dato:** 2026-03-08
**Rangering:** NICE-TO-HAVE
**Orchestrators afgørelse:** WONT-FIX — Lag 2-typerne aktiveres allerede via `chain_structure` boolean på Organization. For 100% ejede klinikker vises co-ownership-typer simpelthen ikke. En ekstra `ownership_model` enum på Company tilføjer kompleksitet uden tilstrækkelig værdi i MVP. Kan genbesøges i fase 2.

**Forslag/Indsigelse:**
Kataloget er designet primært til co-ownership-modellen. Men mange kæder har en blanding af delejede og 100% ejede lokationer. For en 100% ejet klinik er ejeraftale (KT-01), tiltrædelsesdokument (KT-30) og optionsaftale (KT-29) irrelevante. Systemet bør kunne tilpasse den synlige kontrakttypeliste baseret på om klinikken har flere ejere eller ej.

Forslag: Tilføj `ownership_model` (ENUM: CO_OWNED | WHOLLY_OWNED) på `Company`-modellen. UI filtrerer kontakttyper baseret på dette.

---

## DEC-006: MVP-prioritering af 33 kontrakttyper mangler
**Status:** ACCEPTED
**Proposed by:** DEA-03 (Kommerciel Produktstrateg)
**Dato:** 2026-03-08
**Rangering:** KRITISK
**Orchestrators afgørelse:** ACCEPTED — Essentiel produktbeslutning. De 8 MUST-typer er korrekt identificeret og matcher det en ny bruger reelt behøver. CONTRACT-TYPES.md opdateres med MVP-prioritering. Schema beholder alle 33 typer (JSONB type_data tillader dette), men Sprint 3 UI bygger kun til MUST-typer. SHOULD-typer frigives i v1.1.

**Forslag/Indsigelse:**
33 kontrakttyper er for mange til en MVP-launch. Ingen ny bruger vil oprette 33 typer — de vil oprette 5-8 og opleve værdi. Uden en eksplicit MVP-prioritering risikerer vi at bygge UX for 33 typer der alle er middelmådige, frem for 10 typer der er exceptionelle.

Kategorisering (30-dages-kriteriet: "Har en ny bruger med 5 klinikker brug for denne type inden for 30 dage?"):

**MUST (MVP — dag 1-30):** EJERAFTALE, DIREKTØRKONTRAKT, ANSÆTTELSE_FUNKTIONÆR, LEJEKONTRAKT_ERHVERV, LEVERANDØRKONTRAKT, INTERN_SERVICEAFTALE, VEDTÆGTER, FORSIKRING — **8 typer**

**SHOULD (v1.1 — måned 2-3):** OVERDRAGELSESAFTALE, AKTIONÆRLÅN, ANSÆTTELSE_IKKE_FUNKTIONÆR, LEASINGAFTALE, NDA, GF_REFERAT, KONKURRENCEKLAUSUL, PERSONALEHÅNDBOG, ROYALTY_LICENS, KASSEKREDIT — **10 typer**

**COULD (fase 2):** PANTSÆTNING, VIKARAFTALE, UDDANNELSESAFTALE, FRATRÆDELSESAFTALE, SAMARBEJDSAFTALE, IT_SYSTEMAFTALE, DBA, BESTYRELSESREFERAT, FORRETNINGSORDEN, DIREKTIONSINSTRUKS, VOA, OPTIONSAFTALE, TILTRÆDELSESDOKUMENT, CASH_POOL, INTERCOMPANY_LÅN — **15 typer**

Forslag: Tilføj `mvp_priority` (MUST | SHOULD | COULD) til kontakttypekataloget. Build-agenterne implementerer kun MUST-typer i Sprint 3. Database-schema rummer alle 33 (JSONB type_data gør dette muligt), men UI og onboarding viser kun MUST.

---

## DEC-007: Starter pack til onboarding — aha-moment inden 10 minutter
**Status:** ACCEPTED
**Proposed by:** DEA-03 (Kommerciel Produktstrateg)
**Dato:** 2026-03-08
**Rangering:** VIGTIG
**Orchestrators afgørelse:** ACCEPTED — Stærkt produktforslag. Onboarding-flow bør auto-oprette UDKAST-kontrakter baseret på kædestruktur. Dokumenteres i UI-FLOWS.md. Implementeres i Sprint 2 (onboarding-flow).

**Forslag/Indsigelse:**
Onboarding-flowet bør indeholde en "starter pack" der automatisk opretter tomme kontrakt-skeletons for de mest sandsynlige typer baseret på brugerens svar i onboarding (antal klinikker, co-ownership ja/nej).

Foreslået starter pack (auto-oprettet som UDKAST):
- 1× Ejeraftale per co-owned klinik
- 1× Lejekontrakt per klinik
- 1× Intern serviceaftale (hvis kædestruktur)
- Systemet viser derefter: "Du har 3 kontrakter der mangler udfyldelse" — det er aha-momentet.

---

## DEC-008: FinancialMetric.metric_type bør være enum — ikke fri tekst
**Status:** ACCEPTED
**Proposed by:** DEA-04 (Finansiel Controller)
**Dato:** 2026-03-08
**Rangering:** KRITISK
**Orchestrators afgørelse:** ACCEPTED — Fri tekst på nøgletal er en designfejl der underminerer hele portfolio-dashboardet. Tre nye enums (MetricType, PeriodType, MetricSource) tilføjes til DATABASE-SCHEMA.md og FinancialMetric-modellen opdateres til typed kolonner.

**Forslag/Indsigelse:**
DATABASE-SCHEMA.md har `metric_type String` (fri tekst med kommentar "OMSÆTNING | EBITDA | RESULTAT | LIKVIDITET | ANDET") og `period_type String` (fri tekst med "HELÅR | H1 | H2 | Q1...Q4") og `source String` (fri tekst "REVIDERET | UREVIDERET | ESTIMAT").

Fri tekst gør nøgletal usammenlignelige på tværs af selskaber og år. Hvis én bruger skriver "Omsætning" og en anden "OMSÆTNING" eller "Revenue", kollapser hele portfolio-dashboardets konsolideringsoverblik.

Forslag: Opret tre enums:
```
enum MetricType { OMSÆTNING, EBITDA, RESULTAT, LIKVIDITET, EGENKAPITAL, ANDET }
enum PeriodType { HELÅR, H1, H2, Q1, Q2, Q3, Q4, MÅNED }
enum MetricSource { REVIDERET, UREVIDERET, ESTIMAT }
```
Og anvend dem som typed kolonner i stedet for String.

---

## DEC-009: Transfer pricing-felter på KT-27/KT-28 utilstrækkelige til TP-dokumentation
**Status:** ACCEPTED
**Proposed by:** DEA-04 (Finansiel Controller)
**Dato:** 2026-03-08
**Rangering:** VIGTIG
**Orchestrators afgørelse:** ACCEPTED — TP-dokumentation er revisionskritisk for koncerninterne aftaler. Tilføj `tp_method`, `tp_last_reviewed`, `tp_document_id` til KT-27 og KT-28 type_data-specifikation i CONTRACT-TYPES.md. TpMethod enum tilføjes til DATABASE-SCHEMA.md.

**Forslag/Indsigelse:**
KT-27 (Intern serviceaftale) har `transfer_pricing_doc BOOLEAN` — et ja/nej-felt. Men TP-dokumentation jf. LL § 2 kræver: (1) beskrivelse af sammenlignelige transaktioner, (2) valgt TP-metode (CUP, cost plus, TNMM), (3) dokumentation af armslængdeprincippet, (4) årlig opdatering.

Et boolean-felt er utilstrækkeligt. Systemet behøver ikke selv være TP-dokumentationsværktøjet, men bør gemme: `tp_method` (ENUM: CUP | COST_PLUS | TNMM | PROFIT_SPLIT | ANDET), `tp_last_reviewed` (DATE), `tp_document_id` (reference til uploaded TP-dokumentation).

---

## DEC-010: Freelance/konsulentkontrakt som B-honorar mangler
**Status:** WONT-FIX
**Proposed by:** DEA-05 (HR & Ansættelsesret)
**Dato:** 2026-03-08
**Rangering:** VIGTIG
**Orchestrators afgørelse:** WONT-FIX — KT-16 (Leverandørkontrakt) med display_name "Konsulentaftale" dækker dette scenarie. Freelance-specifikke felter (cvr_number, vat_registered) kan gemmes i type_data JSONB. At oprette en ny kontrakttype for dette tilfører unødvendig kompleksitet når den eksisterende type med fri display_name allerede rummer det. Kan genbesøges hvis brugerfeedback viser behov.

**Forslag/Indsigelse:**
CONTRACT-TYPES.md har fire ansættelsestyper (funktionær, ikke-funktionær, vikar, uddannelse) men mangler den femte hyppige type: **freelance/konsulentkontrakt med B-indkomst**. I tandlægekæder er dette relevant for:
- Vikartandlæger der fakturerer som selvstændige
- Specialister der kommer på deltid (fx kirurger, ortodontister)
- IT-konsulenter, marketingfolk

Disse er IKKE ansættelseskontrakter (ingen ansættelsesretlig beskyttelse) men de har arbejdsretlige risici: SKAT kan omkvalificere til lønmodtager hvis kriterier for selvstændighed ikke er opfyldt.

KT-16 (Leverandørkontrakt) kan teknisk rumme dette, men display_name-frihed er ikke nok — der mangler felter til: `hourly_or_fixed`, `vat_registered`, `cvr_number`, `deemed_employee_risk` (boolean — systemet bør advare).

Forslag: Enten tilføj en subtype på KT-16 specifikt til konsulentaftaler med personer, eller opret KT-35 KONSULENTAFTALE_PERSON med relevante felter. Sensitivity bør være FORTROLIG (da den indeholder honorarinfo).

---

## DEC-011: Automatisk opsigelsesvarsel-beregning baseret på anciennitet
**Status:** ACCEPTED
**Proposed by:** DEA-05 (HR & Ansættelsesret)
**Dato:** 2026-03-08
**Rangering:** NICE-TO-HAVE
**Orchestrators afgørelse:** ACCEPTED — Ren beregningslogik, ingen schema-ændring nødvendig. Implementeres som helper-funktion i koden (Sprint 3). Vises som beregnet felt i UI, ikke gemt i database.

**Forslag/Indsigelse:**
KT-07 (funktionær) har `anciennity_start` og der er systemadvis ved 6 mdr, 3 år, 6 år, 9 år. Men systemet bør gå et skridt videre og beregne det aktuelle opsigelsesvarsel dynamisk:
- 0-6 mdr: 1 måned (FL § 2, stk. 2)
- 6 mdr-3 år: 3 måneder
- 3-6 år: 4 måneder
- 6-9 år: 5 måneder
- 9+ år: 6 måneder

Samt § 2a godtgørelse ved 12/17 års anciennitet. Denne beregning er ren logik baseret på `anciennity_start` og `today()` — ingen ny data behøves, kun en beregnings-helper i koden.

---

## DEC-012: Godkendelsesflow bør variere per sensitivity-niveau
**Status:** WONT-FIX
**Proposed by:** DEA-06 (Kontraktstyring-specialist)
**Dato:** 2026-03-08
**Rangering:** VIGTIG
**Orchestrators afgørelse:** WONT-FIX — Korrekt observation, men for komplekst til MVP. Approval workflows er en v2-feature. I MVP er statusændringer til TIL_UNDERSKRIFT tilgængelige for alle med skriveadgang til kontrakten (styret af eksisterende rolle/sensitivity-model). STRENGT_FORTROLIG kontrakter er allerede kun synlige for GROUP_OWNER/ADMIN/LEGAL, hvilket giver implicit godkendelseskontrol. Genbesøges i Sprint 5+.

**Forslag/Indsigelse:**
Kontraktstatus-flowet (UDKAST → TIL_REVIEW → TIL_UNDERSKRIFT → AKTIV) er ens for alle kontrakttyper og sensitivitetsniveauer. Men en STRENGT_FORTROLIG ejeraftale bør kræve godkendelse af GROUP_OWNER/GROUP_ADMIN før status kan ændres til TIL_UNDERSKRIFT, mens en STANDARD vikaraftale kan godkendes af COMPANY_MANAGER alene.

Forslag: Tilføj `required_approver_role` (nullable UserRole) til contracts-tabellen eller som en konfiguration per `system_type` og `sensitivity` kombination. Default:
- STRENGT_FORTROLIG: GROUP_OWNER eller GROUP_ADMIN
- FORTROLIG: GROUP_LEGAL eller COMPANY_MANAGER
- INTERN/STANDARD: COMPANY_MANAGER eller højere

---

## DEC-013: Versionering mangler klassificering af ændringens karakter
**Status:** ACCEPTED
**Proposed by:** DEA-06 (Kontraktstyring-specialist)
**Dato:** 2026-03-08
**Rangering:** VIGTIG
**Orchestrators afgørelse:** ACCEPTED — Sammenhæng med DEC-002. Tilføj `change_type` enum (REDAKTIONEL | MATERIEL | ALLONGE) på ContractVersion. Implementeres sammen med DEC-002 i Sprint 3.

**Forslag/Indsigelse:**
`ContractVersion` har `change_note` som fri tekst. Men i kontraktstyring er der juridisk forskel på:
- **Redaktionel rettelse** (stavefejl, formattering) — ikke en ny version juridisk
- **Materiel ændring** (ny klausul, ændret beløb) — ny version der kræver ny underskrift
- **Allonge/tillæg** — supplement uden erstatning af hovedtekst

Uden denne distinktion kan systemet ikke advare brugeren om at en "ændring" kræver ny underskrift, og audit trail kan ikke skelne mellem trivielle og væsentlige ændringer.

Forslag: Tilføj `change_type` (ENUM: REDAKTIONEL | MATERIEL | ALLONGE) på `ContractVersion`. Ved MATERIEL: status resættes automatisk til TIL_REVIEW.

---

## DEC-014: Reminder-defaults bør konfigureres per kontrakttype
**Status:** WONT-FIX
**Proposed by:** DEA-06 (Kontraktstyring-specialist)
**Dato:** 2026-03-08
**Rangering:** NICE-TO-HAVE
**Orchestrators afgørelse:** WONT-FIX — Korrekt observation, men en konfigurationstabel tilføjer kompleksitet. I MVP bruger alle typer 90/30/7-dages defaults. Brugeren kan manuelt justere per kontrakt. Type-specifikke defaults kan tilføjes som application-logik i v1.1 uden schema-ændring (hardcodet i koden per system_type).

**Forslag/Indsigelse:**
Alle kontrakttyper har default `reminder_90_days=true, reminder_30_days=true, reminder_7_days=true`. Men det giver ikke mening for alle typer:

- EJERAFTALE: 7-dages reminder er for sent til at agere på forkøbsret (kræver strategisk beslutning). Bør have 180/90/30 dage.
- LEJEKONTRAKT_ERHVERV: auto_renewal kræver opsigelse typisk 6-12 måneder før. Standard 90 dage er for sent.
- UDDANNELSESAFTALE: 2 ugers prøvetid — 7-dages reminder giver mere mening end 90-dages.
- FRATRÆDELSESAFTALE: 14 dages fortrydelsesret — kun 14/7/3-dages reminders er relevante.

Forslag: Tilføj en konfigurationstabel `contract_type_defaults` med anbefalede reminder-profiler per system_type. Brugeren kan override, men defaults er intelligente.

---

## DEC-015: Anonymiseringsstrategi mangler — GDPR vs. opbevaringspligt-konflikt
**Status:** ACCEPTED
**Proposed by:** DEA-07 (Sikkerhed & Compliance)
**Dato:** 2026-03-08
**Rangering:** KRITISK
**Orchestrators afgørelse:** ACCEPTED — GDPR-compliance er non-negotiable. Anonymiseringsstrategien dokumenteres i CONTRACT-TYPES.md som en ny sektion. Implementering (cron-job, anonymiseringslogik) udskydes til Sprint 6 men spec-designet fastlægges nu. Tre strategier per system_type: FULD_SLETNING, ANONYMISERING, INGEN (for typer uden persondata).

**Forslag/Indsigelse:**
CONTRACT-TYPES.md har `must_retain_until` for opbevaringspligt, men der er ingen strategi for hvad der sker med persondata NÅR opbevaringspligten udløber. GDPR art. 17 kræver sletning når formålet er opfyldt, men art. 17(3)(b) tillader opbevaring til opfyldelse af retlig forpligtelse.

Problemet opstår specifikt ved: ansættelseskontrakter med løndata, direktørkontrakter med kompensationsdetaljer, ejeraftaler med ejerskabsandele knyttet til personer.

Systemet har ingen:
1. Automatisk anonymiseringsmekanisme ved retention expiry
2. Distinktion mellem "data der skal bevares" (beløb, vilkår) og "data der skal anonymiseres" (personnavne, CPR-referencer)
3. Slettelogik for persondata i `type_data` (JSONB) — ustruktureret data er sværere at anonymisere

Forslag: Tilføj `anonymization_strategy` felt på `ContractSystemType`-konfiguration (ENUM: FULD_SLETNING | ANONYMISERING | INGEN). Ved ANONYMISERING: person-referencer erstattes med "Anonymiseret person [hash]", beløb og vilkår bevares. Implementer en cron-job der kører dagligt og tjekker `must_retain_until < today() AND deleted_at IS NULL`.

---

## DEC-016: Junction-tabeller mangler organization_id — tenant isolation brudt
**Status:** ACCEPTED
**Proposed by:** DEA-07 (Sikkerhed & Compliance)
**Dato:** 2026-03-08
**Rangering:** KRITISK
**Orchestrators afgørelse:** ACCEPTED — Klart brud på princip 1 (multi-tenancy) og princip 3 (audit). organization_id, created_at, created_by tilføjes til CaseCompany, CaseContract, CasePerson i DATABASE-SCHEMA.md. Indexes tilføjes. Skal være på plads inden Sprint 1 schema-migration.

**QA-verifikation Sprint 4:** IMPLEMENTERET ✅
- CaseCompany, CaseContract, CasePerson har alle organization_id, created_at, created_by
- Alle create-kald i cases.ts sætter organization_id korrekt
- Indexes bekræftet i schema

**Forslag/Indsigelse:**
DATABASE-SCHEMA.md princip 1 siger: "Multi-tenancy: organization_id på ALLE tabeller — ingen undtagelse". Men tre junction-tabeller bryder dette:

- `CaseCompany` — mangler organization_id, created_at, created_by
- `CaseContract` — mangler organization_id, created_at, created_by
- `CasePerson` — mangler organization_id, created_at, created_by

Uden organization_id på disse tabeller kan application-laget ikke enforcing tenant isolation i queries. En forkert JOIN kan lække data på tværs af tenants. Desuden mangler disse tabeller audit-felter (created_at, created_by) som er påkrævet per princip 3.

Forslag: Tilføj `organization_id`, `created_at`, `created_by` til alle tre tabeller. Tilføj composite indexes på `[organization_id, case_id]`. Ændr primary key til at inkludere organization_id eller behold composite PK men tilføj organization_id som required felt.

---

## DEC-017: Audit log bør inkludere feltændringer for STRENGT_FORTROLIG
**Status:** ACCEPTED
**Proposed by:** DEA-07 (Sikkerhed & Compliance)
**Dato:** 2026-03-08
**Rangering:** VIGTIG
**Orchestrators afgørelse:** ACCEPTED — `changes` (Json?) tilføjes til AuditLog i DATABASE-SCHEMA.md. Application-laget populerer feltet ved UPDATE på STRENGT_FORTROLIG og FORTROLIG records. Implementeres i Sprint 3 sammen med kontraktstyring.

**QA-verifikation Sprint 4:** IMPLEMENTERET ✅
- cases.ts updateCase(): changes-objekt bygges og gemmes for FORTROLIG/STRENGT_FORTROLIG
- updateCaseStatus(): altid gemmer status-ændring i changes
- Mønsteret er konsistent med contracts.ts

**Forslag/Indsigelse:**
`AuditLog`-tabellen logger hvem der tilgik hvad hvornår, men ikke HVAD der blev ændret. For STRENGT_FORTROLIG records (ejeraftaler, direktørkontrakter) kræver revisorer og tilsynsmyndigheder at man kan se: "Bruger X ændrede `ownership_percentage` fra 40% til 60% den [dato]".

Nuværende `action` felt (VIEW | CREATE | UPDATE | DELETE | DOWNLOAD) fortæller at noget blev ændret, men ikke hvad.

Forslag: Tilføj `changes` (JSONB, nullable) til `AuditLog`. Ved UPDATE på STRENGT_FORTROLIG og FORTROLIG records: gem `{ field: "ownership_percentage", old: "40", new: "60" }`. Ved VIEW/DELETE: null. Dette er et velkendt pattern (event sourcing light).

---

## DEC-018: ChainHub databehandlervilkår (DPA) mangler som spec-krav
**Status:** ACCEPTED
**Proposed by:** DEA-07 (Sikkerhed & Compliance)
**Dato:** 2026-03-08
**Rangering:** VIGTIG
**Orchestrators afgørelse:** ACCEPTED — Forretningskritisk men ikke en spec-fil-ændring. DPA-template er et operationelt krav for launch. Noteres i PROGRESS.md under Sprint 6 som pre-launch krav. Blokerer ikke Sprint 1-gaten.

**Forslag/Indsigelse:**
Systemet gemmer ejeraftaler, direktørkontrakter, løndata og potentielt CPR-referencer. ChainHub er databehandler, kunden er dataansvarlig. GDPR art. 28 kræver en databehandleraftale mellem ChainHub og hver tenant.

Dette er ikke en teknisk spec-ændring men et forretningskrav der bør være adresseret inden launch:
1. ChainHub DPA-template skal udarbejdes (standardkontraktvilkår)
2. DPA skal accepteres som del af signup-flow
3. Sub-processors skal listes (Vercel, Supabase, Stripe)
4. Data transfer basis for non-EU sub-processors (SCCs)

Forslag: Tilføj som krav i kravspec-legalhub.md under "Compliance" — ikke som kontrakttype men som operationelt krav for ChainHub selv.

---

## DEC-019: FinancialMetric og TimeEntry mangler Organization-relation
**Status:** ACCEPTED
**Proposed by:** DEA-07 (Sikkerhed & Compliance)
**Dato:** 2026-03-08
**Rangering:** VIGTIG
**Orchestrators afgørelse:** ACCEPTED — Referential integrity er essentielt. Organization-relation tilføjes til begge modeller i DATABASE-SCHEMA.md. Organization.created_by tilføjes. Skal være på plads inden Sprint 1 schema-migration.

**Forslag/Indsigelse:**
DATABASE-SCHEMA.md: `FinancialMetric` og `TimeEntry` har `organization_id` som felt men ingen eksplicit `@relation` til `Organization`-modellen. Uden relation kan Prisma ikke enforce referential integrity, og Organization-modellen lister ikke disse i sine relations.

Desuden: `Organization`-modellen mangler `created_by` felt (princip 3: "created_at, updated_at, created_by på alle tabeller").

Forslag: Tilføj `organization Organization @relation(...)` på begge modeller. Tilføj `created_by` på Organization. Tilføj `financialMetrics FinancialMetric[]` og `timeEntries TimeEntry[]` til Organization-modellens relations.

---

## DEC-020: Prisma enum-værdier bruger ASCII-erstatninger — matcher ikke spec
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-13
**Rangering:** KRITISK

**Forslag/Indsigelse:**
prisma/schema.prisma bruger ASCII-erstatninger for danske tegn i enum-værdier:
- `UDLOEBET` i stedet for `UDLØBET`
- `DIREKTOERKONTRAKT` i stedet for `DIREKTØRKONTRAKT`
- `AKTIONERLAN` i stedet for `AKTIONÆRLÅN`
- `VEDTAEGTER` i stedet for `VEDTÆGTER`
- `VIRKSOMHEDSKOEB` i stedet for `VIRKSOMHEDSKØB`
- Og 20+ andre forekomster

DATABASE-SCHEMA.md v0.4 bruger konsekvent danske tegn (Æ, Ø, Å).
API-SPEC.md v0.3 bruger konsekvent danske tegn.
CONTRACT-TYPES.md bruger konsekvent danske tegn.

PostgreSQL og Prisma understøtter fuldt UTF-8 i enum-værdier. ASCII-erstatningerne:
1. Bryder konsistens mellem spec og implementation
2. Gør koden sværere at læse og vedligeholde
3. Kræver konvertering i application-laget

**Sprint 5 QA-observationer:**
- dashboard.ts Query 3 (revenueRows): bruger `fm.metric_type = 'OMSAETNING'` og `fm.period_type = 'HELAAR'` som $queryRaw string-literals. Hvis databasen har OMSÆTNING/HELÅR (spec-korrekt), returnerer disse queries ALTID 0 rækker — dashboard viser ingen omsætningsdata for nogen selskaber.
- finance.ts: bruger `PeriodType.HELAAR` (importeret fra @prisma/client) — matcher hvad Prisma genererer, men ikke spec.
- Konsekvensen er binær: enten er DEC-020 løst (dansk tegn i DB) og dashboard er brudt, eller DEC-020 ikke er løst (ASCII i DB) og finance.ts er brudt.

**Anbefaling:** Ret alle enum-værdier til at matche spec (brug danske tegn). Koordinér med dashboard.ts og finance.ts at opdatere hardkodede string-literals til matchende værdier.

---

## DEC-021: getUserRoleAssignments mangler organization_id filter
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-13
**Rangering:** KRITISK

**Forslag/Indsigelse:**
src/lib/permissions/index.ts linje 65-68:

```typescript
async function getUserRoleAssignments(userId: string) {
  return prisma.userRoleAssignment.findMany({
    where: { userId },  // ← Mangler organizationId filter!
  })
}
```

Problemet: Hvis en bruger på ukendt vis har rolle-tildelinger i en anden organisation (data-korruption, bug, eller fremtidig multi-org feature), vil disse blive inkluderet i adgangstjek.

For defense-in-depth bør funktionen også validere at rolle-tildelingerne tilhører brugerens aktuelle organisation.

**Anbefaling:** Ændr til:
```typescript
async function getUserRoleAssignments(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  })
  if (!user) return []
  
  return prisma.userRoleAssignment.findMany({
    where: { 
      userId,
      organizationId: user.organizationId,
    },
  })
}
```

**Sprint 5 QA-status:** STADIG ÅBEN — ingen ændring i permissions/index.ts.

---

## DEC-022: Auth config fil mangler — session-struktur kan ikke valideres
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-13
**Rangering:** KRITISK

**Forslag/Indsigelse:**
src/lib/auth/index.ts importerer `authOptions` fra './config', men src/lib/auth/config.ts er IKKE inkluderet i de leverede filer.

CONVENTIONS.md §4 og API-SPEC.md kræver at session indeholder:
- `session.user.id` (userId)
- `session.user.organizationId`

Uden auth config-filen kan vi ikke verificere at:
1. NextAuth callbacks korrekt populerer organizationId på session
2. JWT/session strategy er korrekt konfigureret
3. Microsoft OAuth provider er korrekt sat op

**Sprint 5 QA-status:** STADIG ÅBEN — fil ikke leveret.

---

## DEC-023: Middleware validerer ikke organizationId i token
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-13
**Rangering:** VIGTIG

**Forslag/Indsigelse:**
src/middleware.ts linje 20-32 tjekker kun om token eksisterer:

```typescript
authorized: ({ token, req }) => {
  // ...
  return !!token  // ← Tjekker kun eksistens, ikke indhold
}
```

En bruger med et gyldigt token men uden organizationId (fx fejl i auth-flow) kunne potentielt tilgå beskyttede routes og forårsage null-reference fejl i downstream kode.

**Anbefaling:** Tilføj validering: `return !!token && !!token.organizationId`

**Sprint 5 QA-status:** STADIG ÅBEN — fil ikke leveret til review.

---

## DEC-024: Zod validation schemas leveret og valideret
**Status:** ACCEPTED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-13
**Rangering:** VIGTIG
**QA-resultat:** Zod schemas findes i src/lib/validations/ og importeres korrekt i server actions.

**Forslag/Indsigelse:**
OPRINDELIGT CHALLENGED fordi schemas ikke var inkluderet i review.

Efter gennemgang af imports i companies.ts og persons.ts:
- src/lib/validations/company.ts importeres med alle påkrævede schemas
- src/lib/validations/person.ts importeres med alle påkrævede schemas
- Alle server actions bruger safeParse() korrekt
- Fejlbeskeder på dansk

**Status opdateret til ACCEPTED** — Zod validation er implementeret korrekt.

---

## DEC-025: companies.ts bruger `any` type i where-clauses
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-13
**Rangering:** VIGTIG

**Forslag/Indsigelse:**
src/actions/companies.ts linje 288 og 497:

```typescript
const where: any = {
  companyId,
  organizationId: session.user.organizationId,
}
```

`any` type underminerer TypeScript's typesikkerhed. Prisma genererer typede where-clauses der bør bruges.

**Anbefaling:** Brug Prisma.CompanyPersonWhereInput eller lignende typed interface.

---

## DEC-026: persons.ts bruger `any` type i where-clause
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-13
**Rangering:** VIGTIG

**Forslag/Indsigelse:**
src/actions/persons.ts linje 168-190:

```typescript
const where: any = {
  organizationId: session.user.organizationId,
  deletedAt: null,
}

if (query && query.trim()) {
  // ...
  where.OR = [...]
}
```

`any` type underminerer TypeScript's typesikkerhed.

**Anbefaling:** Brug Prisma.PersonWhereInput typed interface.

---

## DEC-027: Validation-fil src/lib/validations/contract.ts ikke leveret til review
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-14
**Rangering:** KRITISK

**Forslag/Indsigelse:**
src/actions/contracts.ts importerer fra '@/lib/validations/contract':
- createContractSchema
- updateContractSchema
- updateContractStatusSchema
- getMinSensitivity
- meetsMinimumSensitivity
- isValidStatusTransition
- VALID_STATUS_TRANSITIONS

Disse er centrale for:
1. Status-flow validering (spec: UDKAST → TIL_REVIEW → TIL_UNDERSKRIFT → AKTIV → ...)
2. Sensitivity-minimum enforcement per system_type
3. Input-validering

Uden denne fil kan vi ikke verificere at implementationen matcher spec.

**Anbefaling:** Validation-fil skal leveres og valideret mod CONTRACT-TYPES.md og DATABASE-SCHEMA.md.

**Sprint 5 QA-status:** STADIG ÅBEN — fil ikke leveret.

---

## DEC-028: Validation-fil src/lib/validations/document.ts ikke leveret til review
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-14
**Rangering:** VIGTIG

**Forslag/Indsigelse:**
src/actions/documents.ts importerer fra '@/lib/validations/document':
- createDocumentSchema
- updateDocumentSchema
- listDocumentsFilterSchema
- requestUploadUrlSchema

Uden denne fil kan vi ikke verificere at input-validering er korrekt.

**Anbefaling:** Validation-fil skal leveres og valideret.

**Sprint 5 QA-status:** STADIG ÅBEN — fil ikke leveret.

---

## DEC-029: Retention helper src/lib/contracts/retention.ts ikke leveret til review
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-14
**Rangering:** VIGTIG

**Forslag/Indsigelse:**
src/actions/contracts.ts linje 6 importerer:
```typescript
import { calculateRetentionDate } from '@/lib/contracts/retention'
```

Denne funktion skal implementere DEC-001 (auto-beregning af must_retain_until baseret på system_type og datoer).

Uden denne fil kan vi ikke verificere at opbevaringspligt-logikken matcher CONTRACT-TYPES.md "Lovpligtig opbevaringsperiode per system_type".

**Anbefaling:** Retention helper skal leveres og valideret mod spec.

**Sprint 5 QA-status:** STADIG ÅBEN — fil ikke leveret.

---

## DEC-030: Storage helper src/lib/storage/index.ts ikke leveret til review
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-14
**Rangering:** VIGTIG

**Forslag/Indsigelse:**
src/actions/documents.ts importerer fra '@/lib/storage':
- isStorageConfigured
- generateStoragePath
- getSignedUploadUrl
- getSignedDownloadUrl
- deleteFile

Uden denne fil kan vi ikke verificere at fil-håndtering er korrekt implementeret.

**Anbefaling:** Storage helper skal leveres.

**Sprint 5 QA-status:** STADIG ÅBEN — fil ikke leveret.

---

## DEC-031: Adviserings-cron og Reminder-tabel ikke implementeret
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-14
**Rangering:** KRITISK

**Forslag/Indsigelse:**
DATABASE-SCHEMA.md definerer `Reminder`-tabellen:
```prisma
model Reminder {
  id                String    @id @default(uuid())
  organization_id   String
  contract_id       String
  reminder_type     String    // DAYS_90 | DAYS_30 | DAYS_7 | ABSOLUT
  trigger_date      DateTime
  sent_at           DateTime?
  recipient_ids     String[]
  // ...
}
```

CONTRACT-TYPES.md specificerer adviseringslogik:
- Løbende kontrakter (expiry_date=NULL): adviseres baseret på notice_period_days
- Fast udløb: 90/30/7 dage før expiry_date
- Auto-renewal: expiry_date − auto_renewal_days − 14

**Implementationen mangler:**
1. Reminder-generering ved kontraktoprettelse/-opdatering
2. Cron-job til at sende advisering når trigger_date nås
3. advise_sent_at tjek inden afsendelse (undgå duplikater)

Kontrakten gemmes med reminder_90_days, reminder_30_days, reminder_7_days flags, men ingen kode genererer faktiske Reminder-records eller sender dem.

**Anbefaling:** Implementér reminder-generering og cron-job, eller dokumentér at dette er planlagt til senere sprint.

**Sprint 5 QA-status:** STADIG ÅBEN — ikke adresseret.

---

## DEC-032: Type-filer src/types/contract.ts og src/types/document.ts ikke leveret
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-14
**Rangering:** VIGTIG

**Forslag/Indsigelse:**
Imports i contracts.ts og documents.ts refererer til type-filer:
```typescript
import { ActionResult, ContractWithRelations, ContractWithCounts, ... } from '@/types/contract'
import { ActionResult, DocumentWithRelations, UploadUrlResponse, ... } from '@/types/document'
```

Uden disse filer kan vi ikke verificere at return-typer er korrekt defineret.

**Anbefaling:** Type-filer skal leveres.

**Sprint 5 QA-status:** STADIG ÅBEN — filer ikke leveret.

---

## QA-RAPPORT — Sprint 3 Kontraktstyring og Dokumentmodul

### GODKENDT:
- src/actions/contracts.ts — hovedstruktur korrekt
  - organization_id på alle queries: ✅
  - deleted_at: null på list-queries: ✅
  - canAccessCompany() kaldt: ✅
  - canAccessSensitivity() kaldt: ✅
  - Sensitivity-minimum tjek ved oprettelse: ✅
  - Sensitivity-minimum tjek ved redigering: ✅
  - Status-transition validering (kalder isValidStatusTransition): ✅
  - Audit log med changes for STRENGT_FORTROLIG/FORTROLIG: ✅
  - Alle fejlbeskeder på dansk: ✅

- src/actions/documents.ts — hovedstruktur korrekt
  - organization_id på alle queries: ✅
  - deleted_at: null på list-queries: ✅
  - canAccessCompany() kaldt: ✅
  - canAccessSensitivity() kaldt på download/preview: ✅
  - Sensitivity-arv fra tilknyttet sag/kontrakt: ✅
  - Audit log på DOWNLOAD: ✅
  - Alle fejlbeskeder på dansk: ✅

- src/lib/permissions/index.ts — struktur matcher spec
  - ROLE_SENSITIVITY_ACCESS matcher roller-og-tilladelser.md: ✅
  - ROLE_MODULE_ACCESS matcher spec: ✅
  - ModuleType defineret: ✅

### MANGLER (blokerende — filer ikke leveret):
- src/lib/validations/contract.ts (DEC-027)
  - VALID_STATUS_TRANSITIONS
  - getMinSensitivity()
  - meetsMinimumSensitivity()
  - isValidStatusTransition()
- src/lib/validations/document.ts (DEC-028)
- src/lib/contracts/retention.ts (DEC-029)
- src/lib/storage/index.ts (DEC-030)
- src/types/contract.ts (DEC-032)
- src/types/document.ts (DEC-032)

### MANGLER (funktionalitet):
- Reminder-generering og cron-job (DEC-031)

### TIDLIGERE UDESTÅENDE (fra Sprint 2):
- DEC-021: getUserRoleAssignments mangler organizationId filter — STADIG ÅBEN
- DEC-022: Auth config fil mangler — STADIG ÅBEN
- DEC-023: Middleware organizationId validering — STADIG ÅBEN

---

## QA-RAPPORT — Sprint 4 Sags- og Opgavemodul

### GODKENDT:

**src/actions/cases.ts:**
- organization_id på alle Prisma queries: ✅
- deleted_at: null på alle list-queries: ✅
- canAccessCompany() kaldt via verifyCaseAccess(): ✅
- canAccessSensitivity() kaldt korrekt: ✅
- Junction-tabeller CaseCompany/CaseContract/CasePerson — organization_id sat korrekt i alle create-kald: ✅ (DEC-016 implementeret)
- Audit log med changes på FORTROLIG/STRENGT_FORTROLIG: ✅ (DEC-017 implementeret)
- Soft delete på sager, opgaver, frister: ✅
- Zod safeParse() på alle actions: ✅
- Fejlbeskeder på dansk: ✅
- Sensitivity-filter i listCases() — kun viser niveauer brugeren har adgang til: ✅
- organization_id filter i junction-table queries (companyId-filter bruger organizationId): ✅
- updateCaseStatus() sætter closedAt korrekt for LUKKET/ARKIVERET: ✅
- Status-transition validering via isValidCaseStatusTransition(): ✅ (struktur korrekt — indhold ikke verificerbart, se DEC-035)

**src/actions/tasks.ts (standalone):**
- organization_id på alle Prisma queries: ✅
- deleted_at: null på alle list-queries: ✅
- canAccessCompany() kaldt via verifyTaskAccess(): ✅
- canAccessModule('tasks') tjekket på alle offentlige actions: ✅
- Soft delete: ✅
- Zod safeParse() på alle actions: ✅
- Fejlbeskeder på dansk: ✅
- Typesikre where-clauses (Prisma.TaskWhereInput): ✅

**src/lib/permissions/index.ts:**
- Ingen ændringer fra Sprint 3 — fortsat CHALLENGED på DEC-021

### FEJL OG MANGLER:

#### KRITISK:

**DEC-033: getTasksForDigest() mangler organization_id filter og tenant-isolation (NY)**
Se separat entry nedenfor.

**DEC-034: Sager uden tilknyttede selskaber omgår canAccessCompany()-tjek (NY)**
Se separat entry nedenfor.

**DEC-035: Validation-fil src/lib/validations/case.ts ikke leveret til review (NY)**
Se separat entry nedenfor.

**DEC-036: Type-fil src/types/case.ts ikke leveret — CaseStatus-flow uverificerbart (NY)**
Se separat entry nedenfor.

#### VIGTIG:

**DEC-037: Task-model i DATABASE-SCHEMA.md mangler priority-felt — tasks.ts antager det eksisterer (NY)**
Se separat entry nedenfor.

**DEC-038: getTasksForDigest() tjekker ikke advise_sent_at på Deadline-records (NY)**
Se separat entry nedenfor.

**DEC-039: Validation-fil src/lib/validations/task.ts ikke leveret til review (NY)**
Se separat entry nedenfor.

### TIDLIGERE UDESTÅENDE (fra Sprint 2+3 — fortsat åbne):
- DEC-021: getUserRoleAssignments mangler organizationId filter — STADIG ÅBEN
- DEC-022: Auth config fil mangler — STADIG ÅBEN
- DEC-023: Middleware organizationId validering — STADIG ÅBEN
- DEC-027: src/lib/validations/contract.ts ikke leveret — STADIG ÅBEN
- DEC-028: src/lib/validations/document.ts ikke leveret — STADIG ÅBEN
- DEC-029: src/lib/contracts/retention.ts ikke leveret — STADIG ÅBEN
- DEC-030: src/lib/storage/index.ts ikke leveret — STADIG ÅBEN
- DEC-031: Adviserings-cron ikke implementeret — STADIG ÅBEN
- DEC-032: src/types/contract.ts og document.ts ikke leveret — STADIG ÅBEN

---

## DEC-033: getTasksForDigest() mangler organization_id filter — tenant data-lækage
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-15
**Rangering:** KRITISK

**Forslag/Indsigelse:**
src/actions/tasks.ts — `getTasksForDigest()` linje ca. 394-430:

```typescript
const tasks = await prisma.task.findMany({
  where: {
    deletedAt: null,
    status: { notIn: ['LUKKET'] },
    assignedTo: { not: null },
    dueDate: {
      gte: now,
      lte: sevenDaysFromNow,
    },
    // ← MANGLER: organizationId filter!
  },
  // ...
})
```

Denne funktion henter tasks på tværs af ALLE organisationer. En cron-job der bruger denne funktion vil:
1. Sende digest-emails til brugere med tasks fra andre organisationers data
2. Potentielt eksponere task-titler/-beskrivelser på tværs af tenants i email-indhold

CONVENTIONS.md §4: "ALTID: organization_id på ALLE queries — ingen undtagelse"

Digest-cron skal enten:
a) Iterere over alle aktive organisationer og kalde en organisation-scoped version, eller
b) Gruppere resultater per organisation og sende organisation-specifik email

**Anbefaling:** Omskriv til organisation-scopet version:

```typescript
export async function getTasksForDigest(organizationId: string): Promise<...> {
  const tasks = await prisma.task.findMany({
    where: {
      organizationId,  // ← PÅKRÆVET
      deletedAt: null,
      status: { notIn: ['LUKKET'] },
      assignedTo: { not: null },
      dueDate: { gte: now, lte: sevenDaysFromNow },
    },
    include: {
      assignee: {
        select: { id: true, name: true, email: true },
      },
    },
  })
  // ...
}
```

Cron-job ansvar: hente alle aktive organisationer og kalde getTasksForDigest(org.id) per organisation.

**Sprint 5 QA-status:** STADIG ÅBEN — ikke adresseret.

---

## DEC-034: Sager uden tilknyttede selskaber omgår canAccessCompany()-tjek
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-15
**Rangering:** KRITISK

**Forslag/Indsigelse:**
src/actions/cases.ts — `verifyCaseAccess()` linje ca. 60-80:

```typescript
// Selskabsadgang — tjek mindst ét tilknyttet selskab
if (caseBase.caseCompanies.length > 0) {
  let hasAnyCompanyAccess = false
  for (const { companyId } of caseBase.caseCompanies) {
    const hasAccess = await canAccessCompany(userId, companyId)
    if (hasAccess) {
      hasAnyCompanyAccess = true
      break
    }
  }
  if (!hasAnyCompanyAccess) {
    return { ok: false, error: '...' }
  }
}
// ← Hvis caseCompanies.length === 0: canAccessCompany() ALDRIG kaldt!
// Alle brugere i organisationen (inkl. scope=ASSIGNED med begrænset adgang)
// kan tilgå sagen.
```

Scenariet: En COMPANY_MANAGER med scope=ASSIGNED til selskab A opretter en sag uden at tilknytte noget selskab. En anden COMPANY_MANAGER med scope=ASSIGNED til selskab B kan nu tilgå denne sag — fordi company-tjekket springes over.

Per CONVENTIONS.md §10: "Enhver server action og API route der returnerer data SKAL kalde mindst canAccessCompany() eller canAccessSensitivity() FØR data returneres".

Sensitivity-tjekket klarer den ene del, men company-isolation er ikke garanteret for sager uden selskaber.

**Anbefaling:** To mulige løsninger:
1. Kræv mindst ét selskab ved sagsoprettelse (Zod-validering: `companyIds: z.array(z.string().uuid()).min(1, 'Mindst ét selskab skal tilknyttes')`)
2. Fald tilbage til rolle-baseret tjek: brugere med scope=ASSIGNED til ingen relevante selskaber får ikke adgang til "løse" sager medmindre de har GROUP_*-rolle med scope=ALL

**Anbefaling:** Option 1 foretrækkes — tilføj `.min(1)` validering på companyIds i createCaseSchema. Dokumentér at sager altid skal have mindst ét tilknyttet selskab.

**Sprint 5 QA-status:** STADIG ÅBEN — ikke adresseret.

---

## DEC-035: Validation-fil src/lib/validations/case.ts ikke leveret til review
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-15
**Rangering:** KRITISK

**Forslag/Indsigelse:**
src/actions/cases.ts importerer fra '@/lib/validations/case':
- createCaseSchema
- updateCaseSchema
- updateCaseStatusSchema
- deleteCaseSchema
- getCaseSchema
- listCasesSchema
- addCaseCompanySchema / removeCaseCompanySchema
- addCaseContractSchema / removeCaseContractSchema
- addCasePersonSchema / removeCasePersonSchema / updateCasePersonRoleSchema
- createTaskSchema / updateTaskSchema / deleteTaskSchema / listTasksSchema
- createDeadlineSchema / updateDeadlineSchema / deleteDeadlineSchema / listDeadlinesSchema
- createTimeEntrySchema / listTimeEntriesSchema

Disse schemas er centrale for:
1. Input-validering af alle sags-operationer
2. Validering af companyIds (min-length — se DEC-034)
3. Validering af SagsType/SagsSubtype kombinationer (case_type=ANDET kræver ingen subtype)
4. Validering af CaseStatus ved oprettelse (altid NY)

Uden denne fil kan vi ikke verificere at implementationen er korrekt.

**Anbefaling:** Validation-fil skal leveres til næste review-runde.

**Sprint 5 QA-status:** STADIG ÅBEN — fil ikke leveret.

---

## DEC-036: Type-fil src/types/case.ts ikke leveret — CaseStatus-flow uverificerbart
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-15
**Rangering:** KRITISK

**Forslag/Indsigelse:**
src/actions/cases.ts importerer fra '@/types/case':
- `isValidCaseStatusTransition`
- `VALID_CASE_STATUS_TRANSITIONS`

`VALID_CASE_STATUS_TRANSITIONS` definerer det faktiske status-flow. Spec (DATABASE-SCHEMA.md) angiver 6 statusser:
`NY | AKTIV | AFVENTER_EKSTERN | AFVENTER_KLIENT | LUKKET | ARKIVERET`

Vi kan ikke verificere at alle gyldige transitions er implementeret, herunder:
- NY → AKTIV ✓ (forventet)
- AKTIV → AFVENTER_EKSTERN ✓ (forventet)
- AKTIV → AFVENTER_KLIENT ✓ (forventet)
- AFVENTER_EKSTERN → AKTIV ✓ (genåbning — er dette implementeret?)
- AFVENTER_KLIENT → AKTIV ✓ (genåbning — er dette implementeret?)
- AKTIV → LUKKET ✓ (forventet)
- LUKKET → ARKIVERET ✓ (forventet)
- ARKIVERET → ? (bør ingen transitions have — er dette enforced?)

Særligt genåbnings-flows (AFVENTER_* → AKTIV) er kritiske for korrekt sagsstyring og ikke-trivielle at implementere korrekt.

**Anbefaling:** Type-fil skal leveres. Verificér specifikt at:
1. Alle 6 statusser er repræsenteret i VALID_CASE_STATUS_TRANSITIONS
2. ARKIVERET er en terminal status (ingen udgående transitions)
3. AFVENTER_EKSTERN og AFVENTER_KLIENT begge kan genåbnes til AKTIV

**Sprint 5 QA-status:** STADIG ÅBEN — fil ikke leveret.

---

## DEC-037: Task-model mangler priority-felt — tasks.ts antager det eksisterer
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-15
**Rangering:** VIGTIG

**Forslag/Indsigelse:**
DATABASE-SCHEMA.md Task-model:
```prisma
model Task {
  id              String     @id @default(uuid())
  organization_id String
  title           String
  description     String?
  status          TaskStatus @default(NY)
  due_date        DateTime?
  assigned_to     String?
  case_id         String?
  company_id      String?
  contract_id     String?
  created_at      DateTime   @default(now())
  updated_at      DateTime   @updatedAt
  created_by      String
  deleted_at      DateTime?
  // ← INGEN priority-felt!
}
```

src/actions/tasks.ts (standalone) refererer til `priority` på Task:
- `createTask()`: `data: { ..., priority: data.priority, ... }`
- `listTasks()`: `...(priority && { priority })`
- `updateTask()`: `...(updateData.priority !== undefined && { priority: updateData.priority })`
- `updateTaskStatusSchema` importerer `priority` fra validations

`Prioritet`-enum er kun tilknyttet `Deadline`-modellen i spec. Task-modellen har ingen prioritet i DATABASE-SCHEMA.md.

Dette er en diskrepans mellem spec og implementation. Enten:
1. DATABASE-SCHEMA.md skal opdateres til at inkludere `priority Prioritet?` på Task, eller
2. tasks.ts skal fjerne alle priority-referencer og validation-schema skal opdateres

**Anbefaling:** Afklar med Orchestrator om Task-modellen skal have priority. Hvis ja: tilføj `priority Prioritet? @default(MELLEM)` til Task-modellen i DATABASE-SCHEMA.md og opret migration. Hvis nej: fjern priority fra tasks.ts.

**Sprint 5 QA-status:** STADIG ÅBEN — ikke adresseret.

---

## DEC-038: getTasksForDigest() tjekker ikke advise_sent_at — Deadline-records ignoreres
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-15
**Rangering:** VIGTIG

**Forslag/Indsigelse:**
Spec (DATABASE-SCHEMA.md) definerer `advise_sent_at` på `Deadline`-modellen:
```prisma
model Deadline {
  // ...
  advise_days_before Int       @default(3)
  advise_sent_at    DateTime?
  // ...
  @@index([due_date, advise_sent_at])   // advis-cron query
}
```

Index-kommentaren `// advis-cron query` indikerer at dette felt er designet til at forhindre duplikate adviserings-emails.

Problemerne med den nuværende `getTasksForDigest()`:

1. **Manglende advise_sent_at check**: Funktionen returnerer tasks i et 7-dages vindue, men tjekker ikke om en advis allerede er sendt. En bruger vil modtage daglige emails om samme task i op til 7 dage.

2. **Forkert model**: Digest er baseret på `Task`-modellen, men spec's adviseringsmekanisme (`advise_sent_at`) er på `Deadline`-modellen. Der er ingen digest-funktion for Deadline-records.

3. **Manglende opdatering af advise_sent_at**: Selv hvis check var implementeret, opdaterer funktionen aldrig `advise_sent_at` — så næste kørsel vil sende igen.

**Anbefaling:**
- Tilføj separat `getDeadlinesForDigest()` funktion der:
  1. Filtrerer på `advise_sent_at IS NULL`
  2. Filtrerer på `due_date <= NOW() + advise_days_before * 24h`
  3. Opdaterer `advise_sent_at = NOW()` ved afsendelse (i cron-job, ikke i query-funktionen)
- Overvej om Task-digest skal have tilsvarende "sent_at"-mekanisme, eller om 7-dages vindue er acceptabelt

**Sprint 5 QA-status:** STADIG ÅBEN — ikke adresseret.

---

## DEC-039: Validation-fil src/lib/validations/task.ts ikke leveret til review
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-15
**Rangering:** VIGTIG

**Forslag/Indsigelse:**
src/actions/tasks.ts (standalone) importerer fra '@/lib/validations/task':
- createTaskSchema
- updateTaskSchema
- deleteTaskSchema
- getTaskSchema
- listTasksSchema
- updateTaskStatusSchema

Disse schemas er kritiske for at verificere:
1. At `priority`-feltet er med (se DEC-037 — diskrepans med schema)
2. At `status`-feltet ved oprettelse defaulter korrekt (NY per spec)
3. At TaskStatus enum-værdier matcher spec (NY | AKTIV | AFVENTER | LUKKET)
4. At input-validering er korrekt for alle task-operationer

**Anbefaling:** Validation-fil skal leveres til næste review-runde. Verificér specifikt at TaskStatus-enum-værdier matcher DATABASE-SCHEMA.md.

**Sprint 5 QA-status:** STADIG ÅBEN — fil ikke leveret.

---

## QA-RAPPORT — Sprint 5 Dashboard og Økonomimodul

### GODKENDT:

**src/actions/finance.ts:**
- requireFinanceAccess() (canAccessModule + canAccessSensitivity('FORTROLIG')) kaldt på ALLE offentlige actions: ✅
- organization_id på alle findFirst/findMany/count queries: ✅
- canAccessCompany() kaldt ved selskabsspecifikke operationer: ✅
- Audit log med sensitivity: 'FORTROLIG' på alle operationer: ✅
- Fejlbeskeder på dansk: ✅
- Pagination implementeret (listFinancialMetrics, listTimeEntries, listInvoices, listDividends): ✅
- MAX_PAGE_SIZE enforced: ✅
- P2002-fejlhåndtering (unique constraint): ✅

**src/actions/dashboard.ts:**
- Ingen N+1 queries — 3 queries total via $queryRaw aggregering: ✅
- organization_id på alle $queryRaw parametre: ✅
- unstable_cache med TTL og tags: ✅
- Promise.all til parallelisering: ✅
- Fejlbesked på dansk: ✅

### FEJL OG MANGLER:

#### KRITISK:

**DEC-040: dashboard.ts bruger ugyldig ModuleType 'dashboard' — canAccessModule fejler altid**
Se separat entry nedenfor.

**DEC-041: dashboard.ts revenueRows $queryRaw bruger ASCII enum-værdier — returnerer altid 0 rækker ved korrekt DB**
Se separat entry nedenfor.

#### VIGTIG:

**DEC-042: finance.ts update/delete Prisma-kald mangler organization_id i where-clause**
Se separat entry nedenfor.

**DEC-043: createTimeEntry mangler canAccessCompany()-tjek**
Se separat entry nedenfor.

**DEC-044: finance.ts PeriodType.HELAAR matcher ikke spec-enum HELÅR**
Se separat entry nedenfor.

**DEC-045: finance.ts listFinancialMetrics pagination-parametre uden for Zod-schema**
Se separat entry nedenfor.

#### NICE-TO-HAVE:

**DEC-046: Manglende filer — src/lib/validations/finance.ts, src/lib/cache/finance.ts, src/types/finance.ts**
Se separat entry nedenfor.

### TIDLIGERE UDESTÅENDE (fra Sprint 2+3+4 — fortsat åbne):
- DEC-021: getUserRoleAssignments mangler organizationId filter — STADIG ÅBEN
- DEC-022: Auth config fil mangler — STADIG ÅBEN
- DEC-023: Middleware organizationId validering — STADIG ÅBEN
- DEC-027: src/lib/validations/contract.ts ikke leveret — STADIG ÅBEN
- DEC-028: src/lib/validations/document.ts ikke leveret — STADIG ÅBEN
- DEC-029: src/lib/contracts/retention.ts ikke leveret — STADIG ÅBEN
- DEC-030: src/lib/storage/index.ts ikke leveret — STADIG ÅBEN
- DEC-031: Adviserings-cron ikke implementeret — STADIG ÅBEN
- DEC-032: src/types/contract.ts og document.ts ikke leveret — STADIG ÅBEN
- DEC-033: getTasksForDigest() mangler organization_id — STADIG ÅBEN
- DEC-034: Sager uden selskaber omgår canAccessCompany() — STADIG ÅBEN
- DEC-035: src/lib/validations/case.ts ikke leveret — STADIG ÅBEN
- DEC-036: src/types/case.ts ikke leveret — STADIG ÅBEN
- DEC-037: Task-model mangler priority-felt — STADIG ÅBEN
- DEC-038: getTasksForDigest() tjekker ikke advise_sent_at — STADIG ÅBEN
- DEC-039: src/lib/validations/task.ts ikke leveret — STADIG ÅBEN

---

## DEC-040: dashboard.ts bruger ugyldig ModuleType 'dashboard' — canAccessModule fejler altid
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-16
**Rangering:** KRITISK

**Forslag/Indsigelse:**
src/actions/dashboard.ts linje ca. 210:

```typescript
const hasModule = await canAccessModule(session.user.id, 'dashboard')
if (!hasModule) return { error: 'Du har ikke adgang til dashboardet' }
```

`'dashboard'` er **ikke** en gyldig `ModuleType` i `src/lib/permissions/index.ts`. Gyldige værdier (fra CONVENTIONS.md §10 og permissions/index.ts) er:
```typescript
type ModuleType =
  | 'companies'
  | 'contracts'
  | 'cases'
  | 'tasks'
  | 'persons'
  | 'documents'
  | 'finance'
  | 'settings'
  | 'user_management'
```

TypeScript vil fange dette som en compile-fejl hvis `canAccessModule` er korrekt typet med `module: ModuleType`. Hvis den accepterer `string`, vil `ROLE_MODULE_ACCESS[role]` aldrig indeholde `'dashboard'`, og `canAccessModule` returnerer **altid `false`**.

Konsekvensen: **Ingen bruger kan tilgå dashboardet** — `getDashboardData()` returnerer altid `{ error: 'Du har ikke adgang til dashboardet' }`.

**Anbefaling:** Ændr til en gyldig ModuleType. Dashboard er en portals-visning af data der kræver adgang til `'companies'` (og evt. `'finance'`). Anvend:

```typescript
const hasModule = await canAccessModule(session.user.id, 'companies')
if (!hasModule) return { error: 'Du har ikke adgang til dashboardet' }
```

Alternativt: Tilføj `'dashboard'` til `ModuleType` i CONVENTIONS.md og `ROLE_MODULE_ACCESS` i permissions/index.ts, og tildel det til alle roller der i dag har `'companies'`.

---

## DEC-041: dashboard.ts revenueRows $queryRaw bruger ASCII enum-værdier — bryder ved korrekt DB
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-16
**Rangering:** KRITISK

**Forslag/Indsigelse:**
src/actions/dashboard.ts `computeCompanyRows()` Query 3:

```typescript
const revenueRows = await prisma.$queryRaw<...>(
  Prisma.sql`
    SELECT DISTINCT ON (fm.company_id)
      fm.company_id,
      fm.value::text AS value,
      fm.period_year
    FROM financial_metrics fm
    WHERE fm.company_id = ANY(${companyIds}::uuid[])
      AND fm.organization_id = ${organizationId}
      AND fm.metric_type = 'OMSAETNING'     -- ← ASCII-erstatning for OMSÆTNING
      AND fm.period_type = 'HELAAR'          -- ← ASCII-erstatning for HELÅR
    ORDER BY fm.company_id, fm.period_year DESC
  `
)
```

Spec (DATABASE-SCHEMA.md) definerer:
```
enum MetricType { OMSÆTNING, EBITDA, RESULTAT, LIKVIDITET, EGENKAPITAL, ANDET }
enum PeriodType { HELÅR, H1, H2, Q1, Q2, Q3, Q4, MÅNED }
```

Hvis databasen er migreret korrekt med danske tegn (spec-compliant), vil disse $queryRaw string-literals **aldrig matche** nogen rækker. Dashboard viser `latestRevenue: null` for alle selskaber — omsætningsdata er komplet usynlig.

Hvis databasen bruger ASCII (DEC-020 ikke løst), matcher de — men er spec-inkonsistente.

Dette er det mest synlige runtime-symptom på DEC-020-problematikken og påvirker direkte brugeroplevelsen på portfolio-dashboardet.

**Anbefaling:** Koordinér med DEC-020-resolution:
- Hvis DB bruger danske tegn: ret til `'OMSÆTNING'` og `'HELÅR'`
- Hvis DB bruger ASCII: ret til `'OMSAETNING'` og `'HELAAR'` midlertidigt, men planlæg migration til dansk

Brug om muligt Prisma-enums i stedet for string-literals for at undgå fremtidige mismatch:
```typescript
-- Kan ikke bruges direkte i $queryRaw, men definer konstanter:
const METRIC_TYPE_REVENUE = 'OMSÆTNING' as const  // eller hent fra Prisma enum
```

---

## DEC-042: finance.ts update/delete Prisma-kald mangler organization_id i where-clause
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-16
**Rangering:** VIGTIG

**Forslag/Indsigelse:**
Følgende Prisma-kald i src/actions/finance.ts bruger **kun ID** i where-clause på `update` og `delete`:

```typescript
// updateFinancialMetric
const updated = await prisma.financialMetric.update({
  where: { id: metricId },  // ← Mangler organizationId
  data: { ... },
})

// deleteFinancialMetric
await prisma.financialMetric.delete({ where: { id: metricId } })  // ← Mangler organizationId

// updateInvoice
const updated = await prisma.financialMetric.update({
  where: { id: invoiceId },  // ← Mangler organizationId
  data: { notes: updatedNotes },
})

// deleteInvoice
await prisma.financialMetric.delete({ where: { id: invoiceId } })  // ← Mangler organizationId

// updateDividend
const updated = await prisma.financialMetric.update({
  where: { id: dividendId },  // ← Mangler organizationId
  data: { ... },
})

// deleteDividend
await prisma.financialMetric.delete({ where: { id: dividendId } })  // ← Mangler organizationId

// updateTimeEntry
const updated = await prisma.timeEntry.update({
  where: { id: timeEntryId },  // ← Mangler organizationId
  data: { ... },
})

// deleteTimeEntry
await prisma.timeEntry.delete({ where: { id: timeEntryId } })  // ← Mangler organizationId
```

Mønsteret er at `findFirst` med `organizationId`-filter verificerer ejerskab inden `update/delete`. Dette er **funktionelt tilstrækkeligt** men bryder CONVENTIONS.md §4: "ALTID: organization_id på ALLE queries — ingen undtagelse".

Risikoscenariet: En race condition mellem `findFirst`-verificering og `update/delete` kan i teorien lade en anden tenant mutere data. I praksis er risikoen lav, men princippet skal overholdes.

**Anbefaling:** Tilføj `organizationId` til alle `update`/`delete` where-clauses:

```typescript
await prisma.financialMetric.update({
  where: {
    id: metricId,
    organizationId: session.user.organizationId,  // ← Tilføj dette
  },
  data: { ... },
})
```

Note: Prisma understøtter composite where på update/delete hvis der er et unikt index eller compound unique constraint der inkluderer `organizationId`.

---

## DEC-043: createTimeEntry mangler canAccessCompany()-tjek
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-16
**Rangering:** VIGTIG

**Forslag/Indsigelse:**
src/actions/finance.ts `createTimeEntry()`:

```typescript
export async function createTimeEntry(input) {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const accessError = await requireFinanceAccess(session.user.id)
  if (accessError) return { error: accessError }

  // ... Zod parsing ...

  const caseRecord = await prisma.case.findUnique({
    where: {
      id: caseId,
      organizationId: session.user.organizationId,
      deletedAt: null,
    },
    select: { id: true, title: true },
  })
  if (!caseRecord) return { error: 'Sagen blev ikke fundet' }

  // ← Ingen canAccessCompany() for de tilknyttede selskaber!
  // En GROUP_FINANCE bruger med scope=ASSIGNED til selskab A kan registrere tid
  // på en sag der tilhører selskab B, hvis begge selskaber er i samme organisation.
```

Per CONVENTIONS.md §10: "Enhver server action der returnerer data SKAL kalde mindst canAccessCompany() eller canAccessSensitivity()".

`requireFinanceAccess()` kalder `canAccessSensitivity('FORTROLIG')` — dette er én del af kravet. Men for en bruger med `scope=ASSIGNED` er der ingen garanti for at de har adgang til det specifikke selskab som sagen tilhører.

**Anbefaling:** Hent sagernes tilknyttede selskaber og kald `canAccessCompany()`:

```typescript
const caseRecord = await prisma.case.findUnique({
  where: {
    id: caseId,
    organizationId: session.user.organizationId,
    deletedAt: null,
  },
  select: {
    id: true,
    title: true,
    caseCompanies: { select: { companyId: true } },
  },
})
if (!caseRecord) return { error: 'Sagen blev ikke fundet' }

// Tjek adgang til mindst ét tilknyttet selskab
if (caseRecord.caseCompanies.length > 0) {
  let hasAccess = false
  for (const { companyId } of caseRecord.caseCompanies) {
    if (await canAccessCompany(session.user.id, companyId)) {
      hasAccess = true
      break
    }
  }
  if (!hasAccess) return { error: 'Du har ikke adgang til denne sag' }
}
```

---

## DEC-044: finance.ts PeriodType.HELAAR matcher ikke spec-enum HELÅR
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-16
**Rangering:** VIGTIG

**Forslag/Indsigelse:**
src/actions/finance.ts bruger `PeriodType.HELAAR` (importeret fra `@prisma/client`) i `createInvoice()` og `createDividend()`:

```typescript
metricType: MetricType.ANDET,
periodType: PeriodType.HELAAR,   // ← ASCII-erstatning
```

DATABASE-SCHEMA.md v0.4 definerer:
```prisma
enum PeriodType {
  HELÅR    // ← Dansk tegn — spec-korrekt
  H1
  H2
  // ...
}
```

Dette er en direkte konsekvens af DEC-020. Prisma genererer `PeriodType.HELAAR` fordi schema.prisma bruger ASCII-erstatninger. Hvis schema.prisma rettes til at bruge `HELÅR`, genererer Prisma `PeriodType.HELÅR` og denne linje skal opdateres til `PeriodType.HELÅR`.

Tilsvarende for `source: 'UREVIDERET'` — bruges som string-literal i stedet for `MetricSource.UREVIDERET`. Selv om dette matcher spec-enum-værdien, bør det bruges som `MetricSource.UREVIDERET` for typesikkerhed.

**Anbefaling:**
1. Løs DEC-020 (Danish tegn i Prisma schema)
2. Opdater alle Prisma-enum-referencer i finance.ts til at bruge dansk-tegn-versioner
3. Brug `MetricSource.UREVIDERET` i stedet for string-literal `'UREVIDERET'`

---

## DEC-045: finance.ts listFinancialMetrics/listTimeEntries/listDividends pagination-parametre uden for Zod-schema
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-16
**Rangering:** VIGTIG

**Forslag/Indsigelse:**
src/actions/finance.ts henter `page` og `pageSize` via type assertion uden for de validerede Zod-schemas:

```typescript
// listFinancialMetrics
const page = Math.max(1, (input as { page?: number }).page ?? 1)
const pageSize = Math.min(
  MAX_PAGE_SIZE,
  Math.max(1, (input as { pageSize?: number }).pageSize ?? DEFAULT_PAGE_SIZE)
)
```

Dette mønster gentages i `listTimeEntries()` og `listDividends()`.

Problemet: `input as { page?: number }` er en usikker type assertion der omgår Zod-validering. Brugeren kan sende:
- `page: -1` — `Math.max(1, -1)` giver 1, men `skip: (1-1)*20 = 0` (OK)
- `page: 99999` — `Math.max(1, 99999)` giver 99999, `skip: 99999*20 = 1.999.980` — ingen fejl, men potentielt ineffektivt
- `pageSize: "abc"` — `(input as ...).pageSize` er `"abc"`, `Math.max(1, NaN)` er `1` (OK men tilfældig)
- `pageSize: 0` — `Math.max(1, 0)` = 1 (OK)

Korrekt mønster per CONVENTIONS.md §5 er at inkludere `page` og `pageSize` i Zod-schema:

```typescript
const listFinancialMetricsSchema = z.object({
  companyId: z.string().uuid(),
  periodYear: z.number().int().optional(),
  metricType: z.nativeEnum(MetricType).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
})
```

**Anbefaling:** Tilføj `page` og `pageSize` til `listFinancialMetricsSchema`, `listTimeEntriesSchema` og `listDividendsSchema` i `src/lib/validations/finance.ts`. Brug de Zod-validerede værdier direkte i stedet for type assertions.

---

## DEC-046: Manglende filer — src/lib/validations/finance.ts, src/lib/cache/finance.ts, src/types/finance.ts
**Status:** CHALLENGED
**Proposed by:** BA-07 (QA-agent)
**Dato:** 2025-01-16
**Rangering:** VIGTIG

**Forslag/Indsigelse:**
src/actions/finance.ts importerer fra tre filer der ikke er leveret til review:

**1. src/lib/validations/finance.ts** — indeholder alle Zod-schemas:
- createFinancialMetricSchema, updateFinancialMetricSchema, deleteFinancialMetricSchema, listFinancialMetricsSchema
- createTimeEntrySchema, updateTimeEntrySchema, deleteTimeEntrySchema, listTimeEntriesSchema
- createInvoiceSchema, updateInvoiceSchema, deleteInvoiceSchema, listInvoicesSchema
- createDividendSchema, updateDividendSchema, deleteDividendSchema, listDividendsSchema

Uden denne fil kan vi ikke verificere:
- At MetricType/PeriodType/MetricSource nativeEnum bruges korrekt i Zod
- At pagination-felter er med (se DEC-045)
- At numeriske validationer (value > 0, periodYear range, minutes > 0) er korrekte

**2. src/lib/cache/finance.ts** — indeholder caching-logik:
- getCachedFinancialMetrics() — Prisma-query med caching
- getCachedFinancialOverview() — aggregeret overblik
- invalidateFinanceCache() — cache-invalidering

Uden denne fil kan vi ikke verificere:
- At organization_id anvendes korrekt inde i de cachede queries
- At cache-nøgler er organisation-scopede (tenant isolation i cache)
- At TTL er konfigureret passende

**3. src/types/finance.ts** — indeholder TypeScript-typer:
- ActionResult, FinancialMetricWithCompany, TimeEntryWithUser, TimeEntrySummary
- InvoiceWithCompany, InvoiceSummary, DividendWithCompany

Uden denne fil kan vi ikke verificere at return-typer matcher hvad funktionerne faktisk returnerer.

**Anbefaling:** Alle tre filer skal leveres til næste review-runde. Særlig høj prioritet på `src/lib/cache/finance.ts` da cache-logikken er kritisk for korrekt tenant isolation og korrekt brug af organization_id.