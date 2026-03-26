# API-SPEC.md
# ChainHub — API-specifikation
**Version:** 0.3 — QA-rettet
**Vedligeholdes af:** Philip
**Afhænger af:** CONVENTIONS.md, DATABASE-SCHEMA.md, ROLLER-OG-TILLADELSER.md, UI-FLOWS.md

---

## Arkitekturprincip

```
Server Actions  →  Al forretningslogik og datamutation (CRUD)
                   Placering: /src/actions/[modul].ts
                   Returnerer altid: ActionResult<T>

API Routes      →  Kun tre formål:
                   1. Fil-upload        /api/upload/route.ts
                   2. Webhooks          /api/webhooks/[service]/route.ts
                   3. Microsoft Graph   /api/integrations/microsoft/route.ts

Alt andet er Server Actions — aldrig API routes til CRUD.
```

---

## Fælles typer og mønstre

### ActionResult\<T\>

Alle Server Actions returnerer denne type:

```typescript
type ActionResult<T> =
  | { data: T; error?: never }
  | { error: string; data?: never }
```

### Obligatorisk action-skabelon

Enhver server action SKAL følge dette mønster i denne rækkefølge:

```typescript
'use server'

export async function [actionName](
  input: z.infer<typeof [actionName]Schema>
): Promise<ActionResult<T>> {
  // 1. Session
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  // 2. Zod-validering
  const parsed = [actionName]Schema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  // 3. Adgangstjek (canAccessCompany / canAccessModule)
  // 4. Sensitivity-tjek (canAccessSensitivity) hvis relevant
  // 5. Udfør database-operation
  // 6. revalidatePath() på berørte routes
  // 7. Aktivitetslog-entry
  // 8. Return { data: result }
}
```

### HTTP-statuskoder (API routes)

```
200  OK
201  Created
400  Ugyldigt input (Zod-fejl)
401  Ikke autentificeret (ingen session)
403  Ikke autoriseret (har session, mangler adgang)
404  Ressource ikke fundet
409  Konflikt (fx duplikat CVR)
413  Fil for stor
422  Ubehandlelig entitet (fx sensitivity for lav)
500  Serverfejl (aldrig med stack trace til klienten)
```

---

## Indholdsfortegnelse

1. [Auth](#1-auth)
2. [Organisation](#2-organisation)
3. [Brugere og invitationer](#3-brugere-og-invitationer)
4. [Selskaber](#4-selskaber)
5. [Ejerskab](#5-ejerskab)
6. [Governance-roller](#6-governance-roller)
7. [Ansatte](#7-ansatte)
8. [Personer](#8-personer)
9. [Kontrakter](#9-kontrakter)
10. [Sager](#10-sager)
11. [Frister](#11-frister)
12. [Tidsregistrering](#12-tidsregistrering)
13. [Opgaver](#13-opgaver)
14. [Dokumenter](#14-dokumenter)
15. [Økonomi](#15-økonomi)
16. [Aktivitetslog](#16-aktivitetslog)
17. [API Routes — Fil-upload](#17-api-routes--fil-upload)
18. [API Routes — Webhooks](#18-api-routes--webhooks)
19. [API Routes — Microsoft Graph](#19-api-routes--microsoft-graph)
20. [Stripe Billing](#20-stripe-billing)

---

## 1. Auth

**Fil:** `/src/actions/auth.ts`

---

### `registerOrganization`

Opretter ny tenant, første bruger (GROUP_OWNER) og starter Stripe trial.

```typescript
Input:
  organizationName:  string   // min 1, max 100
  cvr:               string   // 8 cifre
  email:             string   // valid email, unik
  password:          string   // min 8 tegn

Output: ActionResult<{ organizationId: string; userId: string }>

Guards:
  - Email ikke allerede i brug → error: "Denne email er allerede registreret"
  - CVR format ugyldig → error: "CVR skal være 8 cifre"

Side effects:
  - Opret Organization-record
  - Opret User-record med hashet password
  - Opret user_role_assignments: GROUP_OWNER, scope ALL
  - Opret Stripe Customer (via Stripe API)
  - Send velkomst-email med bekræftelseslink
  - Aktivitetslog: "Organisation oprettet"
```

---

### `acceptInvitation`

Bruges af inviteret bruger der klikker link i email.

```typescript
Input:
  token:     string   // invitation token
  name:      string   // fuldt navn, min 1
  password:  string   // min 8 tegn

Output: ActionResult<{ userId: string }>

Guards:
  - Token ikke fundet eller udløbet → error: "Invitation er udløbet eller ugyldig"
  - Token allerede brugt → error: "Denne invitation er allerede brugt"

Side effects:
  - Opret User-record
  - Opret user_role_assignments fra InvitationRecord
  - Marker invitation som brugt (used_at = now)
  - Auto-login via NextAuth (opret session)
```

---

### `updatePassword`

```typescript
Input:
  currentPassword:  string
  newPassword:      string   // min 8 tegn

Output: ActionResult<void>

Guards:
  - Session påkrævet
  - currentPassword matcher ikke → error: "Nuværende adgangskode er forkert"
```

---

## 2. Organisation

**Fil:** `/src/actions/organization.ts`

---

### `updateOrganization`

```typescript
Input:
  name?:                  string   // max 100
  contactEmail?:          string
  defaultAdvisoryDays?:   number[] // fx [90, 30, 7]
  fiscalYearStartMonth?:  number   // 1–12

Output: ActionResult<Organization>

Guards:
  - canAccessModule(userId, 'settings') — kræver GROUP_OWNER eller GROUP_ADMIN

Side effects:
  - Revaliderer: /app/settings
```

---

### `connectMicrosoft365`

Gemmer OAuth tokens fra Microsoft efter authorization code flow.

```typescript
Input:
  code:         string   // authorization code fra Microsoft OAuth callback
  redirectUri:  string

Output: ActionResult<{ connected: boolean; tenantName: string }>

Guards:
  - canAccessModule(userId, 'settings') — kræver group_owner eller group_admin

Side effects:
  - Udveksl code til access_token + refresh_token via Microsoft identity platform
  - Gem tokens krypteret på Organization (ms365_access_token, ms365_refresh_token)
  - Sæt Organization.ms365_connected = true
  - Gem ms365_tenant_name
```

---

### `disconnectMicrosoft365`

```typescript
Input: void

Output: ActionResult<void>

Guards:
  - GROUP_OWNER eller GROUP_ADMIN

Side effects:
  - Slet tokens fra Organization
  - Organization.ms365_connected = false
  - Aktivitetslog: "Microsoft 365-integration afbrudt"
```

---

## 3. Brugere og invitationer

**Fil:** `/src/actions/users.ts`

---

### `inviteUser`

```typescript
Input:
  email:       string
  roles:       Array<{
    role:        UserRole      // GROUP_OWNER | GROUP_ADMIN | GROUP_LEGAL | ...
    scope:       UserScope     // ALL | ASSIGNED | OWN
    companyIds?: string[]      // UUID array — påkrævet hvis scope = ASSIGNED/OWN
  }>

Output: ActionResult<{ invitationId: string }>

Guards:
  - canAccessModule(userId, 'user_management') — kræver GROUP_OWNER eller GROUP_ADMIN
  - Seat-limit tjek: tæl aktive + pending brugere mod Organization.seat_limit
    → Limit nået: error: "Du har nået dit seat-limit. Opgrader din plan for at tilføje flere brugere."
  - Email allerede aktiv bruger i tenant → error: "Denne person er allerede bruger"

Side effects:
  - Opret UserInvitation-record (udløber om 7 dage)
  - Send invitation-email
  - Aktivitetslog: "Bruger inviteret: [email] med rolle [rolle]"
```

---

### `updateUserRoles`

```typescript
Input:
  userId:  string   // UUID
  roles:   Array<{
    role:        UserRole
    scope:       UserScope
    companyIds?: string[]
  }>

Output: ActionResult<User>

Guards:
  - canAccessModule — kræver GROUP_OWNER eller GROUP_ADMIN
  - Kan ikke ændre sin egen GROUP_OWNER-rolle

Side effects:
  - Slet eksisterende user_role_assignments for brugeren
  - Opret nye user_role_assignments
  - Aktivitetslog: "Roller opdateret for [bruger]"
```

---

### `deactivateUser`

```typescript
Input:
  userId:  string   // UUID

Output: ActionResult<void>

Guards:
  - GROUP_OWNER eller GROUP_ADMIN
  - Kan ikke deaktivere sig selv
  - Kan ikke deaktivere den eneste GROUP_OWNER

Side effects:
  - User.active = false
  - Invalider alle aktive NextAuth-sessioner for brugeren
  - Aktivitetslog: "Bruger deaktiveret: [email]"
```

---

### `reactivateUser`

```typescript
Input:
  userId:  string

Output: ActionResult<void>

Guards:
  - GROUP_OWNER eller GROUP_ADMIN
  - Seat-limit tjek inden genaktivering

Side effects:
  - User.active = true
  - Aktivitetslog: "Bruger genaktiveret: [email]"
```

---

### `revokeInvitation`

```typescript
Input:
  invitationId:  string

Output: ActionResult<void>

Guards:
  - GROUP_OWNER eller GROUP_ADMIN

Side effects:
  - UserInvitation.revoked_at = now
```

---

## 4. Selskaber

**Fil:** `/src/actions/companies.ts`

---

### `createCompany`

```typescript
Input:
  name:                 string   // min 1, max 200
  cvr:                  string   // 8 cifre
  companyType:          CompanyType  // APS | AS | IS | HOLDING_APS | ANDET
  street:               string
  postalCode:           string   // dansk postnr, 4 cifre
  city:                 string
  foundedDate?:         Date
  fiscalYearStartMonth: number   // 1–12, default 1
  status:               CompanyStatus  // default: AKTIV
  notes?:               string
  tags?:                string[]

Output: ActionResult<Company>

Guards:
  - canAccessModule(userId, 'companies') — kræver GROUP_OWNER eller GROUP_ADMIN
  - CVR ikke allerede i brug i tenant
    → error: "CVR [XXXXXXXX] er allerede registreret (se [Selskabsnavn])"

Side effects:
  - Opret Company med organization_id
  - Aktivitetslog: "Selskab oprettet: [navn]"
  - Revaliderer: /app/dashboard, /app/companies
```

---

### `updateCompany`

```typescript
Input:
  companyId:  string
  // Alle felter fra createCompany — alle valgfrie (partial update)

Output: ActionResult<Company>

Guards:
  - canAccessCompany(userId, companyId)
  - canAccessModule(userId, 'companies') — kræver GROUP_OWNER, GROUP_ADMIN eller COMPANY_MANAGER

Side effects:
  - Aktivitetslog: "Stamdata opdateret: [ændrede felter]"
  - Revaliderer: /app/companies/[companyId]
```

---

### `updateCompanyStatus`

```typescript
Input:
  companyId:  string
  status:     CompanyStatus   // AKTIV | UNDER_STIFTELSE | UNDER_AFVIKLING | SOLGT

Output: ActionResult<Company>

Guards:
  - GROUP_OWNER eller GROUP_ADMIN
  - Overgang til SOLGT kræver bekræftelse (håndteres i UI — action modtager confirmed: true)

Side effects:
  - Ved SOLGT: Company.archived_at = now
  - Aktivitetslog: "Status ændret til [status]"
  - Revaliderer: /app/dashboard, /app/companies/[companyId]
```

---

### `getDashboardData`

Henter aggregerede data til portfolio-dashboard. Én query — ikke N+1.

```typescript
Input: void   // henter accessible companies fra session

Output: ActionResult<Array<{
  id:                    string
  name:                  string
  cvr:                   string
  status:                CompanyStatus
  ownershipPercentage:   number | null
  activeCasesCount:      number
  expiringContractsCount: number   // udløber inden 90 dage
  overdueTasksCount:     number
  tags:                  string[]
}>>

Guards:
  - Session påkrævet
  - getAccessibleCompanies(userId) filtrerer baseret på scope

Query-krav:
  - Aggregér counts i én JOIN-query (se CONVENTIONS.md §4 N+1 prevention)
  - Query-tid valideres < 500ms ved 50 selskaber
```

---

## 5. Ejerskab

**Fil:** `/src/actions/ownership.ts`

---

### `addOwner`

```typescript
Input:
  companyId:         string
  personId?:         string   // eksisterende person (enten personId ELLER newPerson)
  newPerson?:        PersonInput  // se afsnit 8
  ownershipPercent:  number   // 0.01 – 100.00
  ownerType:         EjerType  // PERSON | HOLDINGSELSKAB | ANDET_SELSKAB
  acquiredAt:        Date
  contractId?:       string   // reference til ejeraftale

Output: ActionResult<Ownership>

Guards:
  - canAccessCompany(userId, companyId)
  - canAccessSensitivity(userId, 'STRENGT_FORTROLIG') — ejerskab er STRENGT_FORTROLIG
  - Enten personId eller newPerson skal angives — ikke begge

Side effects:
  - Opret Ownership-record
  - Hvis newPerson: opret Person-record først
  - Advar (ikke blokér) hvis total ejerandel > 100 % efter tilføjelse
  - Aktivitetslog
  - Revaliderer: /app/companies/[companyId]/ownership
```

---

### `updateOwnership`

```typescript
Input:
  ownershipId:       string
  ownershipPercent?: number
  acquiredAt?:       Date
  contractId?:       string

Output: ActionResult<Ownership>

Guards:
  - canAccessSensitivity(userId, 'STRENGT_FORTROLIG')
  - Ownership.company.organization_id === session.organizationId
```

---

### `endOwnership`

Registrerer at ejerskab er ophørt (soft end — ikke delete).

```typescript
Input:
  ownershipId:  string
  endDate:      Date

Output: ActionResult<Ownership>

Guards:
  - canAccessSensitivity(userId, 'STRENGT_FORTROLIG')

Side effects:
  - Ownership.end_date = endDate
  - Aktivitetslog: "Ejerskab afregistreret: [person/selskab]"
```

---

## 6. Governance-roller

**Fil:** `/src/actions/governance.ts`

---

### `addCompanyRole`

```typescript
Input:
  companyId:   string
  personId?:   string
  newPerson?:  PersonInput
  role:        GovernanceRolle  // DIREKTØR | BESTYRELSESFORMAND | BESTYRELSESMEDLEM | TEGNINGSBERETTIGET | REVISOR
  startDate:   Date
  contractId?: string   // reference til direktørkontrakt e.l.

Output: ActionResult<CompanyRole>

Guards:
  - canAccessCompany(userId, companyId)
  - Sensitivity: FORTROLIG
  - Der kan kun være én aktiv DIREKTØR pr. selskab
    → error: "Selskabet har allerede en aktiv direktør. Afregistrér den nuværende først."
```

---

### `endCompanyRole`

```typescript
Input:
  roleId:   string
  endDate:  Date

Output: ActionResult<CompanyRole>

Guards:
  - canAccessCompany(userId, companyId via role)
  - Sensitivity: FORTROLIG

Side effects:
  - CompanyRole.end_date = endDate
  - Aktivitetslog
```

---

## 7. Ansatte

**Fil:** `/src/actions/employees.ts`

---

### `addEmployee`

```typescript
Input:
  companyId:        string
  personId?:        string
  newPerson?:       PersonInput
  jobTitle:         string   // fritekst
  employmentType:   AnsættelsesType  // FULDTID | DELTID | VIKAR | FREELANCE
  startDate:        Date
  contractId?:      string

Output: ActionResult<Employment>

Guards:
  - canAccessCompany(userId, companyId)
  - canAccessSensitivity(userId, 'STANDARD') — alle med selskabsadgang
```

---

### `endEmployment`

```typescript
Input:
  employmentId:  string
  endDate:       Date

Output: ActionResult<Employment>

Guards:
  - canAccessCompany(userId, companyId via employment)

Side effects:
  - Employment.end_date = endDate
  - Status → TERMINATED
  - Aktivitetslog: "Fratræden registreret: [person]"
```

---

## 8. Personer

**Fil:** `/src/actions/persons.ts`

---

### PersonInput (delt type)

Bruges i addOwner, addCompanyRole, addEmployee m.fl.

```typescript
type PersonInput = {
  name:         string   // min 1, max 200
  email?:       string
  phone?:       string
  address?:     string
  cprNote?:     boolean  // true = "CPR forefindes i fysisk mappe" — CPR gemmes ALDRIG
  cvr?:         string   // hvis personen repræsenterer selskab
  tags?:        PersonTag[]  // TANDLÆGE | DIREKTØR | BESTYRELSESMEDLEM | ANSAT | LEVERANDØR | RÅDGIVER | ANDET
  notes?:       string
}
```

---

### `createPerson`

```typescript
Input:  PersonInput

Output: ActionResult<Person>

Guards:
  - Session påkrævet
  - Advar (ikke blokér) ved duplikat email: "En person med denne email findes allerede: [navn]"

Side effects:
  - Opret Person med organization_id
  - Aktivitetslog: "Person oprettet: [navn]"
```

---

### `updatePerson`

```typescript
Input:
  personId:  string
  // Alle PersonInput-felter — valgfrie (partial)

Output: ActionResult<Person>

Guards:
  - Person.organization_id === session.organizationId
```

---

### `deletePerson`

Soft delete — kun muligt hvis ingen aktive tilknytninger.

```typescript
Input:
  personId:  string

Output: ActionResult<void>

Guards:
  - Person.organization_id === session.organizationId
  - GROUP_OWNER eller GROUP_ADMIN
  - Tjek aktive tilknytninger (aktive roles, employments, contract parties, case participants)
    → Aktive tilknytninger: error: "Personen er tilknyttet aktive records. Afregistrér tilknytninger først."

Side effects:
  - Person.deleted_at = now
```

---

### `searchPersons`

```typescript
Input:
  query:       string   // min 2 tegn
  companyId?:  string   // filtrer til ét selskab
  tags?:       PersonTag[]
  limit?:      number   // default 20

Output: ActionResult<Person[]>

Guards:
  - Session påkrævet
  - getAccessibleCompanies-filter hvis companyId angivet

Søgning:
  - PostgreSQL full-text search på name + email
  - Kun inden for tenant (organization_id)
```

---

### `importPersonsFromCsv`

```typescript
Input:
  rows: Array<{
    name:   string
    email?: string
    phone?: string
    tags?:  string   // kommasepareret
  }>

Output: ActionResult<{
  imported:  number
  skipped:   number
  errors:    Array<{ row: number; reason: string }>
}>

Guards:
  - GROUP_OWNER eller GROUP_ADMIN
  - Max 500 rækker pr. import

Logik:
  - Duplikat (email-match): skip med reason "Email [x] eksisterer allerede"
  - Ugyldigt navn (tomt): skip med reason "Navn er påkrævet"
  - Importer alle gyldige rækker selv hvis der er fejl i andre
```

---

## 9. Kontrakter

**Fil:** `/src/actions/contracts.ts`

---

### `createContract`

```typescript
Input:
  companyId:          string
  systemType:         ContractSystemType   // alle 33 typer fra CONTRACT-TYPES.md
  displayName:        string   // min 1, max 255
  sensitivity:        SensitivityLevel
  status:             ContractStatus   // default: UDKAST
  startDate:          Date
  expiryDate?:        Date     // null = løbende
  noticePeriodDays?:  number   // bruges til advis på løbende kontrakter
  autoRenewal?:       boolean
  advisoryDays?:      number[] // default: [90, 30, 7]
  notes?:             string
  parties:            Array<{
    entityType:    PartyType   // PERSON | COMPANY | EXTERNAL
    personId?:     string
    companyId?:    string      // selskab i systemet
    externalName?: string      // part udenfor systemet
    role:          string      // fritekst: "Lejer", "Udlejer", "Arbejdsgiver" etc.
  }>
  signers?:           Array<{ personId: string }>
  parentContractId?:  string   // reference til overliggende kontrakt
  triggeredById?:     string   // reference til kontrakt der udløste denne

Output: ActionResult<Contract>

Guards:
  - canAccessCompany(userId, companyId)
  - canAccessSensitivity(userId, sensitivity)
  - Sensitivity-minimum for systemType håndhævet:
    → error: "[systemType] kræver minimum sensitivitetsniveau [minimum]"
  - Lag 2-typer: kun tilgængelige hvis Organisation.chain_structure = true

Side effects:
  - Opret Contract-record
  - Opret ContractParty-records
  - Aktivér advis-logik (se createContractAdvisory)
  - Aktivitetslog
  - Revaliderer: /app/contracts, /app/companies/[companyId]/contracts
```

---

### `updateContract`

```typescript
Input:
  contractId:  string
  // Alle felter fra createContract — valgfrie

Output: ActionResult<Contract>

Guards:
  - Contract.organization_id === session.organizationId
  - canAccessSensitivity(userId, contract.sensitivity)
  - Ved ændring af sensitivity: ny sensitivity >= gammel sensitivity (kan ikke sænkes)

Side effects:
  - Aktivitetslog: "Kontrakt opdateret: [ændrede felter]"
  - Revaliderer
```

---

### `updateContractStatus`

```typescript
Input:
  contractId:    string
  status:        ContractStatus   // UDKAST | TIL_REVIEW | TIL_UNDERSKRIFT | AKTIV | UDLØBET | OPSAGT | FORNYET | ARKIVERET
  note?:         string    // fx opsigelsesgrund
  terminatedAt?: Date      // ved OPSAGT

Output: ActionResult<Contract>

Guards:
  - canAccessSensitivity(userId, contract.sensitivity)

Gyldige transitioner:
  UDKAST       → TIL_REVIEW, AKTIV
  TIL_REVIEW   → UDKAST, TIL_UNDERSKRIFT, AKTIV
  AKTIV        → UDLØBET, OPSAGT, FORNYET
  UDLØBET      → FORNYET
  OPSAGT       → (ingen)
  FORNYET      → (ingen)

Side effects:
  - Ved AKTIV: aktivér advis-cron-job
  - Ved OPSAGT/UDLØBET: deaktivér fremtidige advis-jobs
  - Aktivitetslog
```

---

### `deleteContract`

Soft delete.

```typescript
Input:
  contractId:  string

Output: ActionResult<void>

Guards:
  - GROUP_OWNER eller GROUP_ADMIN
  - canAccessSensitivity(userId, contract.sensitivity)
  - Kun UDKAST-kontrakter kan slettes
    → error: "Kun kladde-kontrakter kan slettes. Opsig aktive kontrakter i stedet."

Side effects:
  - Contract.deleted_at = now
```

---

### `getContractList`

```typescript
Input:
  companyId?:        string      // filtrer til ét selskab (eller alle accessible)
  status?:           ContractStatus[]
  systemType?:       ContractSystemType[]
  expiresWithinDays?: number     // fx 90
  page?:             number      // default 1
  pageSize?:         number      // default 25, max 100

Output: ActionResult<{
  contracts: ContractListItem[]
  total:     number
  page:      number
}>

Guards:
  - Filtrerer automatisk på getAccessibleCompanies(userId)
  - Filtrerer sensitivity: kun records bruger har adgang til
  - deleted_at: null altid
```

---

## 10. Sager

**Fil:** `/src/actions/cases.ts`

### Sagstype-hierarki (to-kolonne model)

```typescript
enum SagsType {
  TRANSAKTION   // Virksomhedskøb/-salg, omstrukturering
  TVIST         // Retssag, voldgift, forhandling med modpart
  COMPLIANCE    // GDPR, arbejdsmiljø, myndighedspåbud
  KONTRAKT      // Forhandling, opsigelse, misligholdelse
  GOVERNANCE    // Generalforsamling, bestyrelsesmøde, vedtægtsændring
  ANDET         // Ingen subtype — fritekst i description
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
// SagsSubtype er påkrævet medmindre SagsType = ANDET.
// UI: dropdown 1 vælger SagsType → dropdown 2 filtreres dynamisk til relevante subtypes.
```

---

### `createCase`

```typescript
Input:
  title:        string   // min 1, max 255
  caseType:     SagsType      // TRANSAKTION | TVIST | COMPLIANCE | KONTRAKT |
                              //  GOVERNANCE | ANDET
  caseSubtype:  SagsSubtype   // se enum nedenfor — påkrævet medmindre type = ANDET
  companyIds:   string[]  // én eller flere (sag kan dække flere selskaber)
  assignedTo:   string    // userId
  sensitivity:  SensitivityLevel   // default: INTERN
  description?: string
  notes?:       string
  personIds?:   string[]   // tilknyttede personer
  contractIds?: string[]   // tilknyttede kontrakter

Output: ActionResult<Case>

Guards:
  - Alle companyIds skal være inden for getAccessibleCompanies(userId)
  - canAccessModule(userId, 'cases')

Side effects:
  - Opret Case-record + CaseCompany-records + CasePerson-records + CaseContract-records
  - Generer sagsnummer: CAS-[YYYY]-[NNNN] (sekventielt pr. organisation pr. år)
  - Aktivitetslog: "Sag oprettet: [sagsnummer] [titel]"
```

---

### `updateCase`

```typescript
Input:
  caseId:       string
  title?:       string
  assignedTo?:  string
  description?: string
  notes?:       string

Output: ActionResult<Case>

Guards:
  - Case.organization_id === session.organizationId
  - canAccessModule(userId, 'cases')
```

---

### `updateCaseStatus`

```typescript
Input:
  caseId:  string
  status:  CaseStatus   // NY | AKTIV | AFVENTER_EKSTERN | AFVENTER_KLIENT | LUKKET | ARKIVERET

Output: ActionResult<Case>

Gyldige transitioner:
  NY                 →  AKTIV
  AKTIV              →  AFVENTER_EKSTERN, AFVENTER_KLIENT, LUKKET
  AFVENTER_EKSTERN   →  AKTIV, LUKKET
  AFVENTER_KLIENT    →  AKTIV, LUKKET
  LUKKET             →  AKTIV, ARKIVERET
  ARKIVERET          →  (ingen — readonly)

Side effects:
  - Ved ARKIVERET: Case.archived_at = now (readonly herefter)
  - Aktivitetslog
```

---

### `addCaseParticipant`

```typescript
Input:
  caseId:    string
  personId:  string
  role?:     string   // fritekst: "Modpart", "Rådgiver", "Vidne"

Output: ActionResult<CasePerson>

Guards:
  - Case.organization_id === session.organizationId
```

---

### `addCaseContract`

```typescript
Input:
  caseId:      string
  contractId:  string

Output: ActionResult<CaseContract>

Guards:
  - Begge records tilhører samme organisation
  - canAccessSensitivity på kontrakten
```

---

## 11. Frister

**Fil:** `/src/actions/deadlines.ts`

---

### `createDeadline`

```typescript
Input:
  caseId?:      string   // enten caseId eller taskId (deadline kan tilknyttes begge)
  title:        string
  dueDate:      Date
  assignedTo:   string   // userId
  priority:     Prioritet  // LAV | MELLEM | HØJ | KRITISK
  note?:        string
  adviseDaysBefore?: number   // default: 3

Output: ActionResult<Deadline>

Guards:
  - caseId eller taskId skal angives (ikke begge påkrævet)
  - Case/Task tilhører session.organizationId

Side effects:
  - Opret Deadline-record
  - Planlæg advis-email (dueDate - adviseDaysBefore dage, kl. 07:00)
```

---

### `updateDeadline`

```typescript
Input:
  deadlineId:  string
  title?:      string
  dueDate?:    Date
  assignedTo?: string
  priority?:   Prioritet
  note?:       string

Output: ActionResult<Deadline>

Side effects:
  - Genplanlæg advis-email ved dueDate-ændring
```

---

### `completeDeadline`

```typescript
Input:
  deadlineId:  string

Output: ActionResult<Deadline>

Side effects:
  - Deadline.completed_at = now
  - Annullér planlagte advis-emails for denne deadline
```

---

## 12. Tidsregistrering

**Fil:** `/src/actions/timeEntries.ts`

---

### `createTimeEntry`

```typescript
Input:
  caseId:       string
  date:         Date
  hours:        number    // 0.25 – 24, step 0.25
  description:  string    // min 1
  userId?:      string    // default: session.user.id (admin kan registrere for anden)
  hourlyRate?:  number    // default: User.defaultHourlyRate

Output: ActionResult<TimeEntry>

Guards:
  - Case.organization_id === session.organizationId
  - Hvis userId ≠ session.user.id: kræver GROUP_OWNER eller GROUP_ADMIN
```

---

### `deleteTimeEntry`

```typescript
Input:
  timeEntryId:  string

Output: ActionResult<void>

Guards:
  - TimeEntry.user_id === session.user.id ELLER GROUP_OWNER/GROUP_ADMIN
  - Kun inden for 30 dage efter oprettelse (herefter: kun GROUP_OWNER kan slette)
```

---

## 13. Opgaver

**Fil:** `/src/actions/tasks.ts`

---

### `createTask`

```typescript
Input:
  title:        string   // min 1, max 255
  description?: string
  assignedTo:   string   // userId
  dueDate:      Date
  priority:     Prioritet
  status:       TaskStatus   // default: NY
  caseId?:      string
  companyId?:   string

Output: ActionResult<Task>

Guards:
  - Session påkrævet
  - Hvis companyId: canAccessCompany(userId, companyId)

Side effects:
  - Opret Task-record
  - Planlæg daglig digest-opdatering for assignedTo
  - Hvis M365 tilsluttet: push til Outlook Calendar (via /api/integrations/microsoft)
  - Aktivitetslog
```

---

### `updateTask`

```typescript
Input:
  taskId:       string
  title?:       string
  description?: string
  assignedTo?:  string
  dueDate?:     Date
  priority?:    Prioritet
  status?:      TaskStatus

Output: ActionResult<Task>

Guards:
  - Task.organization_id === session.organizationId
  - Sensitivity: STANDARD (alle med adgang)

Side effects:
  - Ved dueDate-ændring: opdatér Outlook Calendar event
  - Aktivitetslog
```

---

### `updateTaskStatus`

Bruges til kanban drag-and-drop (optimistisk update).

```typescript
Input:
  taskId:  string
  status:  TaskStatus   // NY | AKTIV | AFVENTER | LUKKET

Output: ActionResult<Task>

Guards:
  - Task.organization_id === session.organizationId

Side effects:
  - Ved LUKKET: Task.completed_at = now
  - Aktivitetslog
```

---

### `deleteTask`

```typescript
Input:
  taskId:  string

Output: ActionResult<void>

Guards:
  - Task.organization_id === session.organizationId
  - GROUP_OWNER, GROUP_ADMIN eller task creator

Side effects:
  - Task.deleted_at = now
  - Slet Outlook Calendar event (hvis M365 tilsluttet)
```

---

## 14. Dokumenter

**Fil:** `/src/actions/documents.ts`
**Upload:** Via API route `/api/upload` (se afsnit 17)

---

### `createDocumentRecord`

Kaldes af klienten EFTER fil er uploadet til R2/S3 via `/api/upload`.

```typescript
Input:
  companyId:    string
  folderId?:    string
  filename:     string   // original filnavn
  storageKey:   string   // R2/S3 key returneret fra /api/upload
  mimeType:     string   // application/pdf | application/vnd.openxmlformats...
  sizeBytes:    number
  sensitivity:  SensitivityLevel   // default: INTERN
  note?:        string
  contractId?:  string   // tilknytning
  caseId?:      string
  personId?:    string

Output: ActionResult<Document>

Guards:
  - canAccessCompany(userId, companyId)
  - storageKey skal matche organisation (validér prefix på R2/S3 key)
```

---

### `getDocumentSignedUrl`

Genererer tidsbegrænset download/preview-URL.

```typescript
Input:
  documentId:  string

Output: ActionResult<{ url: string; expiresAt: Date }>

Guards:
  - canAccessCompany(userId, document.companyId)
  - canAccessSensitivity(userId, document.sensitivity)

Side effects:
  - Generer signed URL (udløber om 60 minutter)
  - Aktivitetslog: "Dokument tilgået: [filnavn]" (kun STRENGT_FORTROLIG og FORTROLIG)
```

---

### `deleteDocument`

Soft delete — fysisk sletning sker via batch-job efter 30 dage.

```typescript
Input:
  documentId:  string

Output: ActionResult<void>

Guards:
  - GROUP_OWNER, GROUP_ADMIN ELLER (uploading user og inden for 24 timer)
  - canAccessSensitivity(userId, document.sensitivity)

Side effects:
  - Document.deleted_at = now
  - Batch-job markerer R2/S3 objekt til sletning om 30 dage
  - Aktivitetslog
```

---

### `createFolder`

```typescript
Input:
  companyId:   string
  name:        string   // min 1, max 100
  parentId?:   string   // parent-mappe UUID

Output: ActionResult<DocumentFolder>

Guards:
  - canAccessCompany(userId, companyId)
  - Max mappestruktur-dybde: 3 niveauer
    → error: "Mappestrukturen er for dyb. Maks. 3 niveauer."
```

---

### `searchDocuments`

```typescript
Input:
  query:       string    // min 2 tegn
  companyId?:  string
  folderId?:   string
  mimeType?:   string
  page?:       number
  pageSize?:   number   // default 25

Output: ActionResult<{
  documents: DocumentListItem[]
  total:     number
}>

Guards:
  - Filtrerer på getAccessibleCompanies(userId)
  - Filtrerer sensitivity automatisk
  - deleted_at: null
```

---

## 15. Økonomi

**Fil:** `/src/actions/finance.ts`

---

### `upsertFinancialRecord`

```typescript
Input:
  companyId:   string
  fiscalYear:  number
  revenue?:    number
  profit?:     number
  equity?:     number
  source?:     string   // 'MANUAL' | 'CSV_IMPORT' — default: MANUAL

Output: ActionResult<FinancialRecord>

Guards:
  - canAccessModule(userId, 'finance')
  - canAccessCompany(userId, companyId)
```

---

### `createDividendRecord`

```typescript
Input:
  companyId:      string
  fiscalYear:     number
  amount:         number   // DKK, > 0
  decidedAt:      Date
  note?:          string
  recipientIds?:  string[] // person IDs

Output: ActionResult<DividendRecord>

Guards:
  - canAccessModule(userId, 'finance')
  - canAccessCompany(userId, companyId)
```

---

### `importFinancialFromCsv`

```typescript
Input:
  companyId:  string
  rows: Array<{
    fiscalYear:  number   // fx 2023
    revenue?:    number   // DKK
    profit?:     number   // DKK
    equity?:     number   // DKK
  }>

Output: ActionResult<{
  imported:  number
  skipped:   number
  errors:    Array<{ row: number; reason: string }>
}>

Guards:
  - canAccessModule(userId, 'finance')
  - canAccessCompany(userId, companyId)
  - Max 50 rækker pr. import

Logik:
  - Duplikat (samme companyId + fiscalYear): skip med reason "Regnskabsår [YYYY] eksisterer allerede"
  - Ugyldigt årstal (< 1900 eller > indeværende år + 1): skip
  - Negative beløb: accepteres (underskud)
```

---

## 16. Aktivitetslog

**Fil:** `/src/actions/activityLog.ts`

---

### `getActivityLog`

```typescript
Input:
  companyId?:   string    // filtrer til ét selskab
  entityType?:  AktivitetsEntitet  // SELSKAB | KONTRAKT | SAG | OPGAVE | PERSON | DOKUMENT
  entityId?:    string
  userId?:      string    // filtrer til én bruger
  from?:        Date
  to?:          Date
  page?:        number
  pageSize?:    number   // default 50

Output: ActionResult<{
  entries:  ActivityLogEntry[]
  total:    number
}>

Guards:
  - Session påkrævet
  - Filtrerer på accessible companies
  - STRENGT_FORTROLIG log-entries: kun for berettigede brugere
```

---

### `createActivityLogEntry` (intern hjælpefunktion)

Kaldes ikke direkte fra UI — kun fra andre actions.

```typescript
Input:
  organizationId:  string
  userId:          string
  entityType:      AktivitetsEntitet
  entityId:        string
  action:          AktivitetsHandling   // OPRETTET | OPDATERET | STATUS_ÆNDRET | SLETTET | TILGÅET | DOWNLOADET
  description:     string   // dansk, menneskelig tekst
  metadata?:       Record<string, unknown>   // fx { oldStatus: "UDKAST", newStatus: "AKTIV" }

Output: void   // fejler aldrig — logfejl må ikke bryde primær handling
```

---

## 17. API Routes — Fil-upload

**Fil:** `/src/app/api/upload/route.ts`
**Metode:** `POST`
**Auth:** Session-cookie (ikke API-key)

### `POST /api/upload`

Modtager fil og uploader til Cloudflare R2 / AWS S3.

```typescript
Request:
  Content-Type:  multipart/form-data
  Body:
    file:       File
    companyId:  string   // til nøglehierarki og adgangstjek

Response 200:
  {
    storageKey:  string   // fx "org_[id]/company_[id]/[uuid].[ext]"
    filename:    string
    mimeType:    string
    sizeBytes:   number
  }

Response 400:
  { error: "Filen er for stor. Maks. 50 MB." }
  { error: "Filtypen er ikke tilladt. Brug PDF eller DOCX." }

Response 403:
  { error: "Ingen adgang til dette selskab." }

Guards:
  - Session påkrævet
  - canAccessCompany(userId, companyId)
  - Max filstørrelse: 50 MB
  - Tilladte MIME-types: application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document
  - S3 key prefix: org_[organizationId]/company_[companyId]/ (tenant isolation på storage-niveau)

Efterfulgt af:
  Klienten kalder createDocumentRecord() med den returnerede storageKey.
```

---

## 18. API Routes — Webhooks

### `POST /api/webhooks/stripe`

**Fil:** `/src/app/api/webhooks/stripe/route.ts`

```typescript
Headers:
  Stripe-Signature:  string   // valideres med STRIPE_WEBHOOK_SECRET

Håndterede events:
  customer.subscription.created
    → Opdatér Organization.plan, Organization.seat_limit, Organization.trial_ends_at

  customer.subscription.updated
    → Opdatér Organization.plan + seat_limit ved planskift

  customer.subscription.deleted
    → Organization.subscription_status = 'CANCELLED'
    → Brugere kan stadig logge ind i 7 dage (grace period)

  invoice.payment_succeeded
    → Gem PaymentRecord (til faktura-historik)

  invoice.payment_failed
    → Organization.subscription_status = 'PAST_DUE'
    → Send advarsel-email til GROUP_OWNER

Response:
  200 OK altid (Stripe gensender ved 4xx/5xx)
  Fejl logges til monitoring — returnerer aldrig stack trace

Sikkerhed:
  - Valider Stripe-signatur INDEN body parses
  - Raw body påkrævet (ingen JSON.parse() middleware)
  - Idempotency: tjek event.id ikke allerede behandlet
```

---

### `POST /api/webhooks/microsoft`

**Fil:** `/src/app/api/webhooks/microsoft/route.ts`

Modtager notifikationer fra Microsoft Graph subscription (email til sag via BCC).

```typescript
Query params:
  validationToken:  string   // til webhook-validering (kun ved oprettelse)

Validering (GET-request):
  Response: 200, Content-Type: text/plain, Body: validationToken

Notifikation (POST-request):
  Body:
    {
      value: Array<{
        clientState:    string   // valideres mod gemt hemmelighed
        resourceData:   { id: string }
        changeType:     "created"
      }>
    }

Håndtering:
  1. Valider clientState mod Organization.ms365_webhook_secret
  2. Hent fuld email via Graph API (GET /messages/[id])
  3. Parser emne for sagsnummer (format: [CAS-YYYY-NNNN])
  4. Gem EmailThread-record tilknyttet sagen
  5. Aktivitetslog: "Email modtaget på sag [sagsnummer]"

Response:
  202 Accepted (async behandling — ikke 200)
```

---

## 19. API Routes — Microsoft Graph

**Fil:** `/src/app/api/integrations/microsoft/route.ts`

Bruges af Server Components og Server Actions til Graph API-kald.

### `GET /api/integrations/microsoft/contacts`

Henter kontakter fra brugerens Outlook adressebog.

```typescript
Query:
  search?:  string   // filtrer på navn/email
  top?:     number   // max 100, default 50

Response 200:
  {
    contacts: Array<{
      id:           string
      displayName:  string
      email?:       string
      phone?:       string
    }>
  }

Guards:
  - Session påkrævet
  - Organization.ms365_connected = true
  - Refresh access_token automatisk hvis udløbet (via refresh_token)
```

---

### `POST /api/integrations/microsoft/calendar`

Opretter eller opdaterer event i brugerens Outlook-kalender.

```typescript
Body:
  action:     "create" | "update" | "delete"
  eventId?:   string   // påkrævet ved update/delete (Graph event ID gemt på Task)
  title:      string
  dueDate:    Date
  taskId:     string   // bruges som externalId i event body
  taskUrl:    string   // direkte link til opgaven

Response 200:
  { graphEventId: string }

Guards:
  - Session påkrævet
  - Organization.ms365_connected = true
  - Bruger har koblet sin personlige M365-konto (User.ms365_linked = true)
```

---

## 20. Stripe Billing

**Fil:** `/src/actions/billing.ts`

---

### `createCheckoutSession`

Bruges ved planvalg under onboarding.

```typescript
Input:
  plan:    StripePlan   // STARTER | BUSINESS
  seats:   number

Output: ActionResult<{ checkoutUrl: string }>

Guards:
  - GROUP_OWNER
  - Organization.stripe_customer_id skal eksistere

Side effects:
  - Opret Stripe Checkout Session med trial_period_days: 14
  - returnUrl: /settings/billing?success=true
  - cancelUrl: /settings/billing
```

---

### `createBillingPortalSession`

Bruges til plan-opgradér, nedgradér og faktura-historik.

```typescript
Input: void

Output: ActionResult<{ portalUrl: string }>

Guards:
  - GROUP_OWNER
  - Organization.stripe_customer_id skal eksistere

Side effects:
  - Opret Stripe Billing Portal Session
  - returnUrl: /settings/billing
```

---

## Appendix A — Sensitivity-minimum pr. kontrakttype

Håndhæves i `createContract` og `updateContract`.
**Autoritativ kilde:** CONTRACT-TYPES.md v0.4. Denne tabel er identisk.

```typescript
// /src/lib/contractSensitivity.ts
export const SENSITIVITY_MINIMUM: Record<ContractSystemType, SensitivityLevel> = {
  // Lag 1 — Universelle
  EJERAFTALE:                   'STRENGT_FORTROLIG',
  DIREKTØRKONTRAKT:             'STRENGT_FORTROLIG',
  OVERDRAGELSESAFTALE:          'STRENGT_FORTROLIG',
  AKTIONÆRLÅN:                  'STRENGT_FORTROLIG',
  PANTSÆTNING:                  'STRENGT_FORTROLIG',
  VEDTÆGTER:                    'INTERN',
  ANSÆTTELSE_FUNKTIONÆR:        'FORTROLIG',
  ANSÆTTELSE_IKKE_FUNKTIONÆR:   'FORTROLIG',
  VIKARAFTALE:                  'STANDARD',
  UDDANNELSESAFTALE:            'STANDARD',
  FRATRÆDELSESAFTALE:           'FORTROLIG',
  KONKURRENCEKLAUSUL:           'FORTROLIG',
  PERSONALEHÅNDBOG:             'INTERN',
  LEJEKONTRAKT_ERHVERV:         'INTERN',
  LEASINGAFTALE:                'INTERN',
  LEVERANDØRKONTRAKT:           'INTERN',
  SAMARBEJDSAFTALE:             'FORTROLIG',
  NDA:                          'FORTROLIG',
  IT_SYSTEMAFTALE:              'INTERN',
  DBA:                          'INTERN',
  FORSIKRING:                   'INTERN',
  GF_REFERAT:                   'FORTROLIG',
  BESTYRELSESREFERAT:           'FORTROLIG',
  FORRETNINGSORDEN:             'FORTROLIG',
  DIREKTIONSINSTRUKS:           'FORTROLIG',
  VOA:                          'STRENGT_FORTROLIG',
  // Lag 2 — Strukturtyper (kun hvis Organisation.chain_structure = true)
  INTERN_SERVICEAFTALE:         'STRENGT_FORTROLIG',
  ROYALTY_LICENS:               'STRENGT_FORTROLIG',
  OPTIONSAFTALE:                'STRENGT_FORTROLIG',
  TILTRÆDELSESDOKUMENT:         'STRENGT_FORTROLIG',
  KASSEKREDIT:                  'FORTROLIG',
  CASH_POOL:                    'STRENGT_FORTROLIG',
  INTERCOMPANY_LÅN:             'STRENGT_FORTROLIG',
}
```

---

## Appendix B — Advis-logik

Advis håndteres af et cron-job (køres dagligt kl. 07:00 dansk tid).

```typescript
// Pseudokode for advis-cron

for each active contract where expiry_date IS NOT NULL:
  daysUntilExpiry = differenceInDays(expiry_date, today)
  for each advisoryDay in contract.advisory_days:  // fx [90, 30, 7]
    if daysUntilExpiry === advisoryDay:
      send advisory email to contract.responsible_users

for each active contract where expiry_date IS NULL and notice_period_days IS NOT NULL:
  // Løbende kontrakter: advis baseret på opsigelsesvarsel
  // Ingen automatisk advis — kun manuel påmindelse ved oprettelse

// Forfaldne opgaver
for each user:
  overdueTasks = tasks where assignedTo = user AND dueDate < today AND status != LUKKET
  if overdueTasks.length > 0:
    if today is weekday:  // ingen digest i weekenden
      send daily digest email

// Absolute deadlines
for each deadline where dueDate = today + adviseDaysBefore:
  send deadline reminder to assignedUser
```

---

## Appendix C — Global søgning

Implementeres som én samlet Server Action.

```typescript
export async function globalSearch(
  query: string  // min 2 tegn
): Promise<ActionResult<{
  companies:  Array<{ id: string; name: string; cvr: string }>
  persons:    Array<{ id: string; name: string; email?: string }>
  contracts:  Array<{ id: string; displayName: string; companyName: string }>
  cases:      Array<{ id: string; caseNumber: string; title: string }>
}>>
```

```sql
-- Én query pr. tabel med PostgreSQL full-text search
-- Filtreret på organization_id og getAccessibleCompanies
-- Sensitivity-filter: vis ikke STRENGT_FORTROLIG til uberettigede
-- Max 5 resultater pr. kategori i søgeresultater
-- Rangering: præcis match > prefix match > full-text match
```

---

---

## Changelog

```
v0.3 (QA-rettet):
  [K1] CaseStatus: API-SPEC bruger granulær model
       (NY | AKTIV | AFVENTER_EKSTERN | AFVENTER_KLIENT | LUKKET | ARKIVERET)
       som afviger fra DATABASE-SCHEMA.md v0.2 (ÅBEN | I_GANG | AFVENTER | LUKKET | ANNULLERET).
       → DATABASE-SCHEMA.md skal opdateres til at matche API-SPEC's model. Blokkerer: schema-opdatering.
  [K2] ContractStatus UDLØBET: korrekt i API-SPEC (med Ø) — DATABASE-SCHEMA.md bruger
       UDLOBET (uden Ø). DATABASE-SCHEMA.md enum ContractStatus skal rettes til UDLØBET.
       → Blokkerer: schema-opdatering.
  [K3] Forældet tabel-navn rettet (4 forekomster):
       user_roles → user_role_assignments
       (registerOrganization, acceptInvitation, updateUserRoles ×2)
  [K4] Engelske enum-værdier rettet:
       CompanyType OTHER → ANDET
       updateCompanyStatus: SOLD → SOLGT (guard + side effect ×2)
       createContract: default: DRAFT → UDKAST
  [K5] Forkert TypeScript-type rettet (3 forekomster):
       Priority → Prioritet (updateDeadline, createTask, updateTask)
  [K6] Forkert TypeScript-type rettet (3 forekomster):
       ScopeType → UserScope (inviteUser ×2, updateUserRoles)
       Samtidig: rollenavne i inviteUser kommentar: group_owner/group_admin → GROUP_OWNER/GROUP_ADMIN
  [K7] importFinancialFromCsv: Rykket fra §14 Dokumenter → §15 Økonomi
       (filen hører til finance.ts, guards peger på canAccessModule 'finance')
  [M1] Alle lowercase rollenavne konverteret til SCREAMING_SNAKE_CASE (~22 forekomster):
       group_owner → GROUP_OWNER, group_admin → GROUP_ADMIN,
       company_manager → COMPANY_MANAGER
       Berørte sektioner: §1, §2, §3, §4, §8, §12, §14, §13, §18, §20
  [M2] Appendix B pseudokode: CLOSED → LUKKET
  [M3] createActivityLogEntry metadata-eksempel: "DRAFT"/"ACTIVE" → "UDKAST"/"AKTIV"
  [M4] updateOrganization: revalidatePath flyttet fra Guards til Side effects
  [M5] AktivitetsEntitet og AktivitetsHandling anvendt i §16 men ikke defineret
       i DATABASE-SCHEMA.md. → DATABASE-SCHEMA.md skal tilføje disse enums. Blokkerer: schema-opdatering.

v0.2 (QA-rettet):
  + Appendix A fuldstændig erstattet med korrekt SENSITIVITY_MINIMUM
    fra CONTRACT-TYPES.md v0.4 — alle 33 danske enum-navne
  + Alle engelske enum-værdier rettet til dansk igennem hele dokumentet:
    CompanyStatus, GovernanceRolle, AnsættelsesType, PersonTag,
    ContractStatus (transitioner), CaseStatus (transitioner),
    Prioritet, TaskStatus, SensitivityLevel-kommentarer
  + EjerType: HOLDING → HOLDINGSELSKAB, OTHER_COMPANY → ANDET_SELSKAB
  + revalidatePath-stier rettet til /app/... prefix (alle forekomster)
  + SagsType + SagsSubtype two-column model tilføjet til sektion 10
    (6 hovedtyper, 20 subtyper, dynamisk UI-filtrering)
  + AktivitetsEntitet og AktivitetsHandling brugt i ActivityLog
    (erstatter LogEntityType og string action)
  + addEmployee guards: canAccessSensitivity tilføjet
  + getDocumentSignedUrl log-kommentar: STRICTLY_CONFIDENTIAL →
    STRENGT_FORTROLIG, CONFIDENTIAL → FORTROLIG
  + createCase: caseSubtype-felt tilføjet

v0.1:
  Første udkast
```

*API-SPEC.md v0.3*
