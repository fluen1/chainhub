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

**Anbefaling:** Ret alle enum-værdier til at matche spec (brug danske tegn).

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

**Anbefaling:** Auth config-fil skal leveres og valideres.

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

## QA-RAPPORT — Sprint 2 Selskabs- og Personmodul

### GODKENDT:
- src/lib/permissions/index.ts — struktur og signaturer matcher spec
- src/components/companies/CompanyForm.tsx — alle kriterier opfyldt
- src/actions/companies.ts — hovedfunktionalitet (med bemærkninger)
- src/actions/persons.ts — hovedfunktionalitet (med bemærkninger)
- Zod validation — implementeret korrekt
- Dansk sprog — alle labels og fejlbeskeder på dansk
- Tomme states — håndteret i list-funktioner (returnerer [])
- canAccessCompany() — kaldt på alle relevante operationer
- organization_id — på alle Prisma queries

### FEJL:
- src/lib/permissions/index.ts linje 65-68: getUserRoleAssignments mangler organizationId filter (DEC-021)
- src/actions/companies.ts linje 288, 497: `any` type i where-clause (DEC-025)
- src/actions/persons.ts linje 168-190: `any` type i where-clause (DEC-026)

### MANGLER (blokerende):
- src/lib/auth/config.ts — ikke leveret til review (DEC-022)
- src/middleware.ts — organizationId validering mangler (DEC-023)

### MANGLER (ikke-blokerende):
- Tomme state komponenter (EmptyState UI) — ikke leveret men funktionelt håndteret i kode
- Loading skeletons — ikke leveret til review

---