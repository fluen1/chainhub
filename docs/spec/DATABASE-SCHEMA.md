# DATABASE-SCHEMA.md
# ChainHub — Databaseskema
**Version:** 0.2 — QA-rettet
**Status:** PROPOSED — afventer challenge fra DEA-04 og DEA-07
**Læses af:** BA-02 (Schema-agent) — må ikke starte migration før ACCEPTED

---

## Principper

```
1. Multi-tenancy: organization_id på ALLE tabeller — ingen undtagelse
2. Soft delete: deleted_at på alle kritiske tabeller
3. Audit: created_at, updated_at, created_by på alle tabeller
4. Sensitivity: ENUM kolonne på contracts, cases, documents
5. Tenant isolation: CHECK constraints + application-lag validering
6. Performance: Index på organization_id + deleted_at kombinationer
```

---

## Enums

```prisma
enum SensitivityLevel {
  PUBLIC
  STANDARD
  INTERN
  FORTROLIG
  STRENGT_FORTROLIG
}

enum ContractStatus {
  UDKAST
  TIL_REVIEW
  TIL_UNDERSKRIFT
  AKTIV
  UDLØBET
  OPSAGT
  FORNYET
  ARKIVERET
}

enum ContractSystemType {
  // Lag 1 — Universelle
  EJERAFTALE
  DIREKTØRKONTRAKT
  OVERDRAGELSESAFTALE
  AKTIONÆRLÅN
  PANTSÆTNING
  VEDTÆGTER
  ANSÆTTELSE_FUNKTIONÆR
  ANSÆTTELSE_IKKE_FUNKTIONÆR
  VIKARAFTALE
  UDDANNELSESAFTALE
  FRATRÆDELSESAFTALE
  KONKURRENCEKLAUSUL
  PERSONALEHÅNDBOG
  LEJEKONTRAKT_ERHVERV
  LEASINGAFTALE
  LEVERANDØRKONTRAKT
  SAMARBEJDSAFTALE
  NDA
  IT_SYSTEMAFTALE
  DBA
  FORSIKRING
  GF_REFERAT
  BESTYRELSESREFERAT
  FORRETNINGSORDEN
  DIREKTIONSINSTRUKS
  VOA
  // Lag 2 — Strukturtyper (kæde/co-ownership)
  INTERN_SERVICEAFTALE
  ROYALTY_LICENS
  OPTIONSAFTALE
  TILTRÆDELSESDOKUMENT
  KASSEKREDIT
  CASH_POOL
  INTERCOMPANY_LÅN
}

enum DeadlineType {
  ABSOLUT
  OPERATIONEL
  INGEN
}

enum UserRole {
  GROUP_OWNER
  GROUP_ADMIN
  GROUP_LEGAL
  GROUP_FINANCE
  GROUP_READONLY
  COMPANY_MANAGER
  COMPANY_LEGAL
  COMPANY_READONLY
}

enum UserScope {
  ALL
  ASSIGNED
  OWN
}

enum SagsType {
  TRANSAKTION       // Virksomhedskøb/-salg, omstrukturering
  TVIST             // Retssag, voldgift, forhandling med modpart
  COMPLIANCE        // GDPR, arbejdsmiljø, myndighedspåbud
  KONTRAKT          // Forhandling, opsigelse, misligholdelse
  GOVERNANCE        // Generalforsamling, bestyrelsesmøde, vedtægtsændring
  ANDET             // Ingen subtype — fritekst i description
}

enum SagsSubtype {
  // TRANSAKTION
  VIRKSOMHEDSKØB
  VIRKSOMHEDSSALG
  FUSION
  OMSTRUKTURERING
  STIFTELSE
  // TVIST
  RETSSAG
  VOLDGIFT
  FORHANDLING_MED_MODPART
  INKASSO
  // COMPLIANCE
  GDPR
  ARBEJDSMILJØ
  MYNDIGHEDSPÅBUD
  SKATTEMÆSSIG
  // KONTRAKT
  FORHANDLING
  OPSIGELSE
  FORNYELSE
  MISLIGHOLDELSE
  // GOVERNANCE
  GENERALFORSAMLING
  BESTYRELSESMØDE
  VEDTÆGTSÆNDRING
  DIREKTØRSKIFTE
}

enum CaseStatus {
  NY
  AKTIV
  AFVENTER_EKSTERN
  AFVENTER_KLIENT
  LUKKET
  ARKIVERET
}

enum TaskStatus {
  NY
  AKTIV
  AFVENTER
  LUKKET
}

enum VersionSource {
  BRANCHESTANDARD
  INTERNT
  EKSTERNT_STANDARD
  CUSTOM
}

enum LeaseType {
  FINANSIEL
  OPERATIONEL
}

enum NdaType {
  GENSIDIG
  ENSIDIG
}

enum InsuranceType {
  ERHVERVSANSVAR
  ARBEJDSSKADE
  TINGSFORSIKRING
  LEDELSESANSVAR
  ANDET
}

enum MeetingType {
  ORDINÆR
  EKSTRAORDINÆR
}

enum OptionType {
  CALL
  PUT
  BOTH
}

enum GuaranteeType {
  SELVSKYLDNER
  SIMPEL
}

enum RelationType {
  REGULERER
  KRÆVER
  UDLØSER
  SUPPLERER
  SIKRER
}

enum AktivitetsEntitet {
  SELSKAB
  KONTRAKT
  SAG
  OPGAVE
  PERSON
  DOKUMENT
}

enum AktivitetsHandling {
  OPRETTET
  OPDATERET
  STATUS_ÆNDRET
  SLETTET
  TILGÅET
  DOWNLOADET
}

enum Prioritet {
  LAV
  MELLEM
  HØJ
  KRITISK
}
```

---

## Kerntabeller

### organizations
```prisma
model Organization {
  id                String    @id @default(uuid())
  name              String
  cvr               TEXT?
  plan              String    @default("trial")  // trial | starter | business | enterprise
  plan_expires_at   DateTime?
  chain_structure   Boolean   @default(false)     // aktiverer Lag 2 kontrakttyper
  created_at        DateTime  @default(now())
  updated_at        DateTime  @updatedAt

  // Relations
  users             User[]
  companies         Company[]
  persons           Person[]
  contracts         Contract[]
  cases             Case[]
  tasks             Task[]
  documents         Document[]
  user_role_assignments UserRoleAssignment[]

  @@index([id])
}
```

### users
```prisma
model User {
  id                String    @id @default(uuid())
  organization_id   String
  email             String
  name              String
  avatar_url        String?
  microsoft_id      String?   // Azure AD object ID
  created_at        DateTime  @default(now())
  updated_at        DateTime  @updatedAt
  deleted_at        DateTime?

  // Relations
  organization      Organization  @relation(fields: [organization_id], references: [id])
  roles             UserRoleAssignment[]
  created_contracts Contract[]    @relation("ContractCreatedBy")
  assigned_tasks    Task[]        @relation("TaskAssignedTo")

  @@unique([organization_id, email])
  @@index([organization_id, deleted_at])
}
```

### user_role_assignments
```prisma
model UserRoleAssignment {
  id                String    @id @default(uuid())
  organization_id   String
  user_id           String
  role              UserRole
  scope             UserScope
  company_ids       String[]  // kun relevant ved scope = ASSIGNED
  created_at        DateTime  @default(now())
  created_by        String

  // Relations
  user              User      @relation(fields: [user_id], references: [id])

  @@index([organization_id, user_id])
}
```

---

## Selskab og ejerskab

### companies
```prisma
model Company {
  id                String    @id @default(uuid())
  organization_id   String
  name              String
  cvr               String?
  company_type      String?   // ApS, A/S, I/S, enkeltmandsvirksomhed
  address           String?
  city              String?
  postal_code       String?
  founded_date      DateTime?
  status            String    @default("aktiv")  // aktiv | inaktiv | under_stiftelse | opløst
  notes             String?
  created_at        DateTime  @default(now())
  updated_at        DateTime  @updatedAt
  created_by        String
  deleted_at        DateTime?

  // Relations
  organization      Organization    @relation(fields: [organization_id], references: [id])
  ownerships        Ownership[]
  company_persons   CompanyPerson[]
  contracts         Contract[]
  cases             Case[]
  documents         Document[]

  @@index([organization_id, deleted_at])
  @@index([organization_id, status])
}
```

### ownerships
```prisma
// Ejerskab: hvem ejer hvad i et selskab
model Ownership {
  id                String    @id @default(uuid())
  organization_id   String
  company_id        String
  owner_person_id   String?   // person som ejer
  owner_company_id  String?   // selskab som ejer (holdingstruktur)
  ownership_pct     Decimal   @db.Decimal(5, 2)
  share_class       String?   // A-anparter, B-anparter
  effective_date    DateTime?
  contract_id       String?   // reference til ejeraftalen
  created_at        DateTime  @default(now())
  created_by        String

  // Relations
  company           Company   @relation(fields: [company_id], references: [id])
  owner_person      Person?   @relation(fields: [owner_person_id], references: [id])
  contract          Contract? @relation(fields: [contract_id], references: [id])

  @@index([organization_id, company_id])
}
```

---

## Persons

### persons
```prisma
// Global kontaktbog — én person kan have roller i flere selskaber
model Person {
  id                String    @id @default(uuid())
  organization_id   String
  first_name        String
  last_name         String
  email             String?
  phone             String?
  notes             String?
  microsoft_contact_id String? // Outlook/Graph contact ID
  created_at        DateTime  @default(now())
  updated_at        DateTime  @updatedAt
  created_by        String
  deleted_at        DateTime?

  // Relations
  organization      Organization    @relation(fields: [organization_id], references: [id])
  company_persons   CompanyPerson[]
  contract_parties  ContractParty[]
  ownerships        Ownership[]

  @@index([organization_id, deleted_at])
}
```

### company_persons
```prisma
// En persons rolle i et bestemt selskab
model CompanyPerson {
  id                String    @id @default(uuid())
  organization_id   String
  company_id        String
  person_id         String
  role              String    // direktør | bestyrelsesmedlem | ansat | revisor
  employment_type   String?   // funktionær | ikke-funktionær | vikar | elev
  start_date        DateTime?
  end_date          DateTime?
  anciennity_start  DateTime? // separat fra start_date
  contract_id       String?   // reference til ansættelseskontrakten
  created_at        DateTime  @default(now())
  created_by        String

  // Relations
  company           Company   @relation(fields: [company_id], references: [id])
  person            Person    @relation(fields: [person_id], references: [id])
  contract          Contract? @relation(fields: [contract_id], references: [id])

  @@index([organization_id, company_id])
  @@index([organization_id, person_id])
}
```

---

## Kontrakter

### contracts
```prisma
model Contract {
  id                    String              @id @default(uuid())
  organization_id       String
  company_id            String
  system_type           ContractSystemType
  display_name          String              // brugerens eget navn
  status                ContractStatus      @default(UDKAST)
  sensitivity           SensitivityLevel    @default(STANDARD)
  deadline_type         DeadlineType        @default(INGEN)
  version_source        VersionSource       @default(CUSTOM)
  collective_agreement  String?             // OA-navn ved BRANCHESTANDARD
  parent_contract_id    String?             // overordnet kontrakt
  triggered_by_id       String?             // udløsende kontrakt

  // Datoer
  effective_date        DateTime?
  expiry_date           DateTime?           // NULL = løbende
  signed_date           DateTime?
  notice_period_days    Int?                // varselfrist
  termination_date      DateTime?
  anciennity_start      DateTime?

  // Advisering
  reminder_90_days      Boolean             @default(true)
  reminder_30_days      Boolean             @default(true)
  reminder_7_days       Boolean             @default(true)
  reminder_recipients   String[]            // user IDs — [] = owner

  // Opbevaring
  must_retain_until     DateTime?

  // Typespecifikke data (JSONB — fleksibel pr. system_type)
  type_data             Json?

  notes                 String?
  created_at            DateTime            @default(now())
  updated_at            DateTime            @updatedAt
  created_by            String
  last_viewed_at        DateTime?
  last_viewed_by        String?
  deleted_at            DateTime?

  // Relations
  organization          Organization        @relation(fields: [organization_id], references: [id])
  company               Company             @relation(fields: [company_id], references: [id])
  parent_contract       Contract?           @relation("ContractHierarchy", fields: [parent_contract_id], references: [id])
  child_contracts       Contract[]          @relation("ContractHierarchy")
  parties               ContractParty[]
  versions              ContractVersion[]
  attachments           ContractAttachment[]
  relations_from        ContractRelation[]  @relation("RelationFrom")
  relations_to          ContractRelation[]  @relation("RelationTo")
  case_contracts        CaseContract[]
  ownerships            Ownership[]
  company_persons       CompanyPerson[]

  @@index([organization_id, deleted_at])
  @@index([organization_id, company_id, deleted_at])
  @@index([organization_id, system_type, deleted_at])
  @@index([organization_id, status, deleted_at])
  @@index([expiry_date])                    // adviserings-queries
}
```

### contract_parties
```prisma
model ContractParty {
  id                String    @id @default(uuid())
  organization_id   String
  contract_id       String
  person_id         String?
  is_signer         Boolean   @default(false)
  counterparty_name String?   // ekstern part uden profil
  role_in_contract  String?   // køber | sælger | arbejdsgiver | lejer
  created_at        DateTime  @default(now())

  contract          Contract  @relation(fields: [contract_id], references: [id])
  person            Person?   @relation(fields: [person_id], references: [id])

  @@index([organization_id, contract_id])
}
```

### contract_versions
```prisma
model ContractVersion {
  id                String    @id @default(uuid())
  organization_id   String
  contract_id       String
  version_number    Int
  file_url          String
  file_name         String
  file_size_bytes   Int
  is_current        Boolean   @default(false)
  change_note       String?
  uploaded_at       DateTime  @default(now())
  uploaded_by       String

  contract          Contract  @relation(fields: [contract_id], references: [id])

  @@index([organization_id, contract_id])
}
```

### contract_attachments
```prisma
// Bilag — adskilt fra versioner
model ContractAttachment {
  id                String    @id @default(uuid())
  organization_id   String
  contract_id       String
  file_url          String
  file_name         String
  file_size_bytes   Int
  description       String?
  uploaded_at       DateTime  @default(now())
  uploaded_by       String
  deleted_at        DateTime?

  contract          Contract  @relation(fields: [contract_id], references: [id])

  @@index([organization_id, contract_id])
}
```

### contract_relations
```prisma
// Eksplicitte relationer mellem kontrakter
model ContractRelation {
  id                String        @id @default(uuid())
  organization_id   String
  from_contract_id  String
  to_contract_id    String
  relation_type     RelationType  // REGULERER | KRÆVER | UDLØSER | SUPPLERER | SIKRER
  created_at        DateTime      @default(now())
  created_by        String

  from_contract     Contract  @relation("RelationFrom", fields: [from_contract_id], references: [id])
  to_contract       Contract  @relation("RelationTo", fields: [to_contract_id], references: [id])

  @@unique([from_contract_id, to_contract_id, relation_type])
  @@index([organization_id, from_contract_id])
  @@index([organization_id, to_contract_id])
}
```

---

## Sager og opgaver

### cases
```prisma
model Case {
  id                String      @id @default(uuid())
  organization_id   String
  title             String
  case_type         SagsType
  case_subtype      SagsSubtype?    // påkrævet medmindre case_type = ANDET
  status            CaseStatus  @default(NY)
  sensitivity       SensitivityLevel @default(INTERN)
  description       String?
  responsible_id    String?     // user ID
  due_date          DateTime?
  closed_at         DateTime?
  created_at        DateTime    @default(now())
  updated_at        DateTime    @updatedAt
  created_by        String
  deleted_at        DateTime?

  // Relations
  organization      Organization    @relation(fields: [organization_id], references: [id])
  case_companies    CaseCompany[]
  case_contracts    CaseContract[]
  case_persons      CasePerson[]
  tasks             Task[]
  documents         Document[]
  time_entries      TimeEntry[]
  deadlines         Deadline[]

  @@index([organization_id, deleted_at])
  @@index([organization_id, status, deleted_at])
}
```

### case_companies / case_contracts / case_persons
```prisma
model CaseCompany {
  case_id     String
  company_id  String
  case        Case    @relation(fields: [case_id], references: [id])
  company     Company @relation(fields: [company_id], references: [id])
  @@id([case_id, company_id])
}

model CaseContract {
  case_id     String
  contract_id String
  case        Case     @relation(fields: [case_id], references: [id])
  contract    Contract @relation(fields: [contract_id], references: [id])
  @@id([case_id, contract_id])
}

model CasePerson {
  case_id   String
  person_id String
  role      String?
  case      Case   @relation(fields: [case_id], references: [id])
  person    Person @relation(fields: [person_id], references: [id])
  @@id([case_id, person_id])
}
```

### tasks
```prisma
model Task {
  id                String      @id @default(uuid())
  organization_id   String
  title             String
  description       String?
  status            TaskStatus  @default(NY)
  due_date          DateTime?
  assigned_to       String?     // user ID
  case_id           String?
  company_id        String?
  contract_id       String?
  created_at        DateTime    @default(now())
  updated_at        DateTime    @updatedAt
  created_by        String
  deleted_at        DateTime?

  organization      Organization @relation(fields: [organization_id], references: [id])
  assignee          User?        @relation("TaskAssignedTo", fields: [assigned_to], references: [id])
  case              Case?        @relation(fields: [case_id], references: [id])

  @@index([organization_id, deleted_at])
  @@index([organization_id, assigned_to, deleted_at])
  @@index([organization_id, due_date])
}
```

### deadlines
```prisma
// Juridiske frister — adskilt fra opgaver (Tasks er arbejdsopgaver)
model Deadline {
  id                String      @id @default(uuid())
  organization_id   String
  title             String
  due_date          DateTime
  priority          Prioritet   // LAV | MELLEM | HØJ | KRITISK
  assigned_to       String?     // user ID
  case_id           String?
  contract_id       String?
  note              String?
  advise_days_before Int        @default(3)
  advise_sent_at    DateTime?
  completed_at      DateTime?
  created_at        DateTime    @default(now())
  updated_at        DateTime    @updatedAt
  created_by        String
  deleted_at        DateTime?

  organization      Organization @relation(fields: [organization_id], references: [id])
  case              Case?        @relation(fields: [case_id], references: [id])

  @@index([organization_id, deleted_at])
  @@index([organization_id, due_date])
  @@index([due_date, advise_sent_at])   // advis-cron query
}
```

---

## Dokumenter og økonomi

### documents
```prisma
model Document {
  id                String          @id @default(uuid())
  organization_id   String
  company_id        String?
  case_id           String?
  title             String
  file_url          String
  file_name         String
  file_size_bytes   Int
  file_type         String          // pdf | docx | xlsx
  sensitivity       SensitivityLevel @default(STANDARD)
  folder_path       String?         // brugerdefineret mappestruktur
  description       String?
  uploaded_at       DateTime        @default(now())
  uploaded_by       String
  last_viewed_at    DateTime?
  last_viewed_by    String?
  deleted_at        DateTime?

  organization      Organization @relation(fields: [organization_id], references: [id])
  company           Company?     @relation(fields: [company_id], references: [id])
  case              Case?        @relation(fields: [case_id], references: [id])

  @@index([organization_id, deleted_at])
  @@index([organization_id, company_id, deleted_at])
}
```

### financial_metrics
```prisma
// Økonomi-overblik (light) — ikke et regnskabssystem
model FinancialMetric {
  id                String    @id @default(uuid())
  organization_id   String
  company_id        String
  metric_type       String    // OMSÆTNING | EBITDA | RESULTAT | LIKVIDITET | ANDET
  period_type       String    // HELÅR | H1 | H2 | Q1 | Q2 | Q3 | Q4
  period_year       Int
  value             Decimal   @db.Decimal(15, 2)
  currency          String    @default("DKK")
  source            String    // REVIDERET | UREVIDERET | ESTIMAT
  notes             String?
  created_at        DateTime  @default(now())
  created_by        String

  company           Company   @relation(fields: [company_id], references: [id])

  @@unique([organization_id, company_id, metric_type, period_type, period_year])
  @@index([organization_id, company_id])
}
```

### time_entries
```prisma
model TimeEntry {
  id                String    @id @default(uuid())
  organization_id   String
  case_id           String
  user_id           String
  description       String?
  minutes           Int
  date              DateTime
  billable          Boolean   @default(true)
  hourly_rate       Int?
  created_at        DateTime  @default(now())

  case              Case      @relation(fields: [case_id], references: [id])

  @@index([organization_id, case_id])
}
```

### audit_log
```prisma
// Obligatorisk for STRENGT_FORTROLIG og FORTROLIG adgange
model AuditLog {
  id                String    @id @default(uuid())
  organization_id   String
  user_id           String
  action            String    // VIEW | CREATE | UPDATE | DELETE | DOWNLOAD
  resource_type     String    // contract | document | case | company
  resource_id       String
  sensitivity       SensitivityLevel?
  ip_address        String?
  created_at        DateTime  @default(now())

  @@index([organization_id, resource_type, resource_id])
  @@index([organization_id, user_id])
  @@index([created_at])      // retention queries
}
```

---

## Advisering

### reminders
```prisma
// Genererede adviserings-records — køres af cron job
model Reminder {
  id                String    @id @default(uuid())
  organization_id   String
  contract_id       String
  reminder_type     String    // DAYS_90 | DAYS_30 | DAYS_7 | ABSOLUT
  trigger_date      DateTime  // hvornår skal den sendes
  sent_at           DateTime?
  recipient_ids     String[]
  created_at        DateTime  @default(now())

  contract          Contract  @relation(fields: [contract_id], references: [id])

  @@index([trigger_date, sent_at])  // cron query
  @@index([organization_id, contract_id])
}
```

---

## Stripe (billing)

### subscriptions
```prisma
model Subscription {
  id                    String    @id @default(uuid())
  organization_id       String    @unique
  stripe_customer_id    String    @unique
  stripe_subscription_id String   @unique
  plan                  String    // starter | business | enterprise
  seat_count            Int
  status                String    // active | trialing | past_due | canceled
  current_period_start  DateTime
  current_period_end    DateTime
  trial_ends_at         DateTime?
  created_at            DateTime  @default(now())
  updated_at            DateTime  @updatedAt

  organization          Organization @relation(fields: [organization_id], references: [id])

  @@index([stripe_customer_id])
  @@index([status])
}
```

---

## Changelog

```
v0.3 (QA-R2-rettet):
  [K1] CaseStatus: 5-værdier-model erstattet med 6-værdier-model
       ÅBEN|I_GANG|AFVENTER|LUKKET|ANNULLERET →
       NY|AKTIV|AFVENTER_EKSTERN|AFVENTER_KLIENT|LUKKET|ARKIVERET
       (match med API-SPEC.md v0.3 updateCaseStatus-transitioner)
       cases-model @default(ÅBEN) → @default(NY)
  [K2] ContractStatus: UDLOBET → UDLØBET (match med API-SPEC.md + CONTRACT-TYPES.md)
  [K3] AktivitetsEntitet + AktivitetsHandling enums tilføjet
       (SELSKAB|KONTRAKT|SAG|OPGAVE|PERSON|DOKUMENT og
        OPRETTET|OPDATERET|STATUS_ÆNDRET|SLETTET|TILGÅET|DOWNLOADET)
       Løser API-SPEC.md v0.3 [M5] blocker
  [K4] Deadline-model tilføjet som separat tabel
       (frister er juridiske forpligtelser — ikke arbejdsopgaver/Tasks)
       Felter: due_date, priority (Prioritet enum), case_id, contract_id,
       advise_days_before, advise_sent_at, completed_at
       Indexes: organization_id+deleted_at, organization_id+due_date,
       due_date+advise_sent_at (cron-query)
  [K5] Prioritet enum tilføjet: LAV|MELLEM|HØJ|KRITISK
       (bruges af Deadline-model — match med API-SPEC.md §11)
  [K6] cpr_ref fjernet fra Person-model
       CPR-håndtering udskydes til en fremtidig, dedikeret beslutning

v0.2 (QA-rettet):
  [K1] SensitivityLevel enum: INTERNAL → INTERN, CONFIDENTIAL → FORTROLIG,
       STRICTLY_CONFIDENTIAL → STRENGT_FORTROLIG
  [K2] cases-model @default(INTERNAL) → @default(INTERN)
  [K3] audit_log-kommentar: engelske sensitivity-navne rettet til dansk
  [K4] Organization-relation: user_roles UserRole[] →
       user_role_assignments UserRoleAssignment[]
  [K5] CaseType-enum erstattet med SagsType + SagsSubtype
  [K6] TaskStatus: IKKE_STARTET|I_GANG|FÆRDIG|ANNULLERET →
       NY|AKTIV|AFVENTER|LUKKET
  [M1] NdaType: MUTUAL → GENSIDIG, ONE_WAY → ENSIDIG
  [M2] RelationType: alle 5 værdier oversat til dansk

v0.1:
  Første udkast
```

---

## Åbne spørgsmål til DEA-review

```
[Q1] DEA-04: type_data (Json) på contracts-tabellen bruges til
     typespecifikke felter (fx exercise_window_end på optionsaftale).
     Er det acceptabelt at typespecifikke felter er i JSONB frem for
     separate kolonner? Trade-off: fleksibilitet vs. query-muligheder.

[Q2] DEA-07: cpr_ref på persons er beskrevet som "krypteret reference".
     Skal CPR gemmes overhovedet, eller er en reference-nøgle til et
     eksternt krypteret vault den rigtige løsning?

[Q3] DEA-07: audit_log tabel — er de valgte actions og resource_types
     tilstrækkelige, eller mangler der hændelser der skal logges?

[Q4] DEA-01: must_retain_until på contracts — hvem sætter denne dato?
     Skal systemet auto-beregne den baseret på system_type og signed_date,
     eller er det altid manuelt?

[Q5] BA-02: FinancialMetric-tabellen har fri metric_type som TEXT.
     Skal dette være en ENUM for at sikre sammenlignelighed på tværs
     af selskaber og år?

[Q6] BA-09: Reminder-tabellen genereres af cron.
     Hvad er den forventede volumen? Med 100 organisationer × 20 selskaber
     × 30 kontrakter = 60.000 kontrakter → potentielt 180.000 reminder-records.
     Er tabel-design skalerbart?
```
