# CONVENTIONS.md
# ChainHub — Kodekonventioner
**Version:** v0.4 — Supabase datasource
**Gælder for:** Alle build-agenter (BA-01 til BA-11)
**Regel:** Ingen agent skriver kode der bryder med dette dokument.
**Opdateres af:** Orchestrator (BA-01) — aldrig af specialist-agenter unilateralt.

---

## 1. Projektstruktur

```
/
├── src/
│   ├── app/                        Next.js App Router
│   │   ├── (auth)/                 Login, registrering
│   │   ├── (dashboard)/            Beskyttet — kræver session
│   │   │   ├── layout.tsx          Dashboard shell (sidebar + header)
│   │   │   ├── page.tsx            Portfolio-dashboard (forside)
│   │   │   ├── companies/          Selskaber
│   │   │   ├── contracts/          Kontrakter
│   │   │   ├── cases/              Sager
│   │   │   ├── tasks/              Opgaver
│   │   │   ├── persons/            Persondatabase
│   │   │   ├── documents/          Dokumenthåndtering
│   │   │   └── settings/           Indstillinger
│   │   └── api/                    API routes
│   │       └── [...]/route.ts
│   ├── components/
│   │   ├── ui/                     shadcn/ui + custom basiskomponenter
│   │   ├── layout/                 Sidebar, header, navigation
│   │   └── [modul]/                Modul-specifikke komponenter
│   ├── lib/
│   │   ├── auth/                   NextAuth config + helpers
│   │   ├── db/                     Prisma client
│   │   ├── permissions/            Adgangstjek-helpers
│   │   ├── validations/            Zod schemas
│   │   └── utils/                  Generelle hjælpefunktioner
│   ├── actions/                    Server Actions (én fil pr. modul)
│   │   ├── companies.ts
│   │   ├── contracts.ts
│   │   └── ...
│   ├── hooks/                      Custom React hooks
│   └── types/                      TypeScript type-definitioner
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── docs/                           Spec-dokumenter (MD-filer)
│   ├── spec/
│   ├── build/
│   └── status/
└── e2e/                            Playwright E2E tests
```

---

## 2. Navngivning

### Filer og mapper
```
Komponenter:        PascalCase          CompanyCard.tsx
Server Actions:     camelCase           companies.ts
API routes:         kebab-case mappe    /api/company-cards/route.ts
Hooks:              camelCase, use-     useCompanyData.ts
Typer:              PascalCase          CompanyWithContracts.ts
Migrations:         Prisma auto         20240101_add_contracts
```

### Variabler og funktioner
```typescript
// Variabler og funktioner: camelCase
const companyId = params.id
async function getCompanyContracts(companyId: string) {}

// Konstanter: SCREAMING_SNAKE_CASE
const MAX_FILE_SIZE_MB = 10
const SENSITIVITY_LEVELS = ['STANDARD', 'INTERN', ...] as const

// React komponenter: PascalCase
export function ContractStatusBadge({ status }: Props) {}

// TypeScript types og interfaces: PascalCase
type ContractWithParties = Prisma.ContractGetPayload<{...}>
interface ContractFormValues { title: string; ... }
```

### Database (Prisma)
```
Tabeller:           snake_case plural       contracts, company_persons
Kolonner:           snake_case              organization_id, created_at
Enums:              SCREAMING_SNAKE_CASE    STRENGT_FORTROLIG
Systemroller:       SCREAMING_SNAKE_CASE    GROUP_OWNER, GROUP_ADMIN, COMPANY_MANAGER
Relations:          camelCase plural        company.contracts
```

---

## 3. TypeScript

```typescript
// ALTID: Eksplicit return type på server functions og actions
async function getContracts(orgId: string): Promise<Contract[]> {}

// ALTID: Zod validation på al brugerinput
const schema = z.object({
  title: z.string().min(1).max(255),
  systemType: z.nativeEnum(ContractSystemType),
})

// ALDRIG: any — brug unknown og narrowing
// Forkert:
function process(data: any) {}
// Korrekt:
function process(data: unknown) {
  if (!isContract(data)) throw new Error('Invalid data')
}

// ALTID: Brug Prisma's genererede typer
type CompanyWithContracts = Prisma.CompanyGetPayload<{
  include: { contracts: true }
}>

// ALDRIG: Non-null assertion (!.) uden guard
// Forkert:
const name = company!.name
// Korrekt:
if (!company) throw new Error('Company not found')
const name = company.name
```

---

## 4. Database og Prisma

### Supabase datasource — ikke-forhandlingsbart
```prisma
// prisma/schema.prisma SKAL bruge denne datasource-konfiguration:
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")    // Supabase Transaction Pooler (port 6543)
  directUrl = env("DIRECT_URL")      // Supabase Direct Connection (port 5432)
}

// VIGTIGT:
// - DATABASE_URL bruger Supabase pooler (PgBouncer, Transaction mode)
// - DIRECT_URL bruges af prisma migrate dev og prisma db push
// - Uden directUrl FEJLER migrationer stille med pooler-relaterede fejl
// - prisma generate bruger ingen af dem — kun schema-parsing
```

### Multi-tenancy — ikke-forhandlingsbart
```typescript
// ALTID: organization_id på ALLE queries — ingen undtagelse
const contracts = await prisma.contract.findMany({
  where: {
    organization_id: session.user.organizationId,  // ALTID
    deleted_at: null,                               // ALTID ved soft delete
  }
})

// ALDRIG: findUnique uden organization_id tjek
// Forkert:
const contract = await prisma.contract.findUnique({
  where: { id: contractId }
})
// Korrekt:
const contract = await prisma.contract.findUnique({
  where: {
    id: contractId,
    organization_id: session.user.organizationId,  // tenant isolation
  }
})
```

### Soft delete
```typescript
// Alle kritiske tabeller har deleted_at
// ALDRIG: hard delete på contracts, cases, companies, persons, documents
// Brug altid:
await prisma.contract.update({
  where: { id, organization_id: orgId },
  data: { deleted_at: new Date() }
})

// ALTID: deleted_at: null i alle queries
where: { organization_id: orgId, deleted_at: null }
```

### Sensitivity-tjek
```typescript
// ALTID: tjek sensitivity FØR data returneres
const contract = await prisma.contract.findUnique({ where: { id, organization_id: orgId } })
if (!contract) notFound()
if (!await canAccessSensitivity(userId, contract.sensitivity)) forbidden()
return contract
```

### N+1 prevention
```typescript
// ALDRIG: loop med individuelle queries
// Forkert:
const companies = await prisma.company.findMany({ where: { organization_id: orgId } })
for (const company of companies) {
  company.contractCount = await prisma.contract.count({ where: { company_id: company.id } })
}

// Korrekt: aggregér i én query
const companies = await prisma.company.findMany({
  where: { organization_id: orgId, deleted_at: null },
  include: {
    _count: { select: { contracts: true, cases: true } }
  }
})
```

---

## 5. Server Actions

```typescript
// Struktur for alle server actions
'use server'

import { auth } from '@/lib/auth'
import { canAccessCompany, canAccessSensitivity } from '@/lib/permissions'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const createContractSchema = z.object({
  companyId: z.string().uuid(),
  systemType: z.nativeEnum(ContractSystemType),
  displayName: z.string().min(1).max(255),
  sensitivity: z.nativeEnum(SensitivityLevel),
})

export async function createContract(
  input: z.infer<typeof createContractSchema>
): Promise<ActionResult<Contract>> {
  // 1. Session
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  // 2. Validér input
  const parsed = createContractSchema.safeParse(input)
  if (!parsed.success) return { error: 'Ugyldigt input' }

  // 3. Adgangstjek
  const hasAccess = await canAccessCompany(session.user.id, parsed.data.companyId)
  if (!hasAccess) return { error: 'Ingen adgang' }

  // 4. Sensitivity-minimum tjek
  const minSensitivity = getMinSensitivity(parsed.data.systemType)
  if (!meetsMinimumSensitivity(parsed.data.sensitivity, minSensitivity)) {
    return { error: `Sensitivitet skal minimum være ${minSensitivity}` }
  }

  // 5. Udfør
  try {
    const contract = await prisma.contract.create({
      data: {
        ...parsed.data,
        organization_id: session.user.organizationId,
        created_by: session.user.id,
      }
    })
    revalidatePath(`/companies/${parsed.data.companyId}`)
    return { data: contract }
  } catch (error) {
    return { error: 'Noget gik galt — prøv igen' }
  }
}

// Fælles return type for alle actions
type ActionResult<T> = { data: T; error?: never } | { error: string; data?: never }
```

---

## 6. API Routes

```typescript
// Kun til: fil-upload, webhooks, eksterne integrationer
// Alt andet: Server Actions

// Struktur
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Altid: organization_id på queries
  const contract = await prisma.contract.findUnique({
    where: { id: params.id, organization_id: session.user.organizationId }
  })
  if (!contract) return Response.json({ error: 'Not found' }, { status: 404 })

  return Response.json(contract)
}
```

---

## 7. Komponenter

```typescript
// ALTID: Eksplicit Props type
interface ContractCardProps {
  contract: ContractWithParties
  onEdit?: (id: string) => void
}

export function ContractCard({ contract, onEdit }: ContractCardProps) {
  // Ingen business logic i komponenter
  // Ingen direkte Prisma-kald
  // Ingen fetch() kald — brug Server Components eller Server Actions
}

// Loading state — ALTID implementeret
export function ContractCardSkeleton() {
  return <div className="animate-pulse bg-gray-100 rounded-lg h-24" />
}

// Tom state — ALTID implementeret
export function ContractListEmpty() {
  return (
    <div className="text-center py-12 text-gray-500">
      <p>Ingen kontrakter endnu</p>
      <p className="text-sm">Opret den første kontrakt for dette selskab</p>
    </div>
  )
}
```

### Styling
```typescript
// KUN Tailwind utility classes — aldrig inline styles
// Forkert:
<div style={{ color: 'red', marginTop: '8px' }}>

// Korrekt:
<div className="text-red-600 mt-2">

// Varianter med cn() helper (clsx + tailwind-merge)
import { cn } from '@/lib/utils'
<div className={cn('base-classes', isActive && 'active-classes')}>
```

---

## 8. Fejlhåndtering

```typescript
// Brugervenlige fejlbeskeder på dansk
// Tekniske detaljer kun i console/logs — aldrig til bruger

// Server Actions returnerer ActionResult (se afsnit 5)
// Komponenter viser toast ved fejl:
import { toast } from 'sonner'
const result = await createContract(data)
if (result.error) {
  toast.error(result.error)
  return
}

// API routes: standard HTTP statuskoder
// 400 Ugyldigt input
// 401 Ikke autentificeret
// 403 Ikke autoriseret (har session men mangler adgang)
// 404 Ikke fundet
// 500 Serverfejl

// Aldrig: eksponér stack traces eller database-fejl til klienten
```

---

## 9. Sprog og tekst

```
ALTID dansk i UI — ingen engelske labels, knapper eller fejlbeskeder
ALTID du-form — "Opret selskab", "Dine kontrakter", "Du har ingen sager"
ALDRIG juridisk jargon i UI-tekster
ALDRIG tomme fejlbeskeder — altid handlingsanvisende

Eksempler:
  "Noget gik galt"              → for generisk
  "Kontrakten kunne ikke gemmes — prøv igen eller kontakt support"  → korrekt
  "Error 500"                   → aldrig
  "Du har ikke adgang til denne kontrakt"  → korrekt
```

---

## 10. Permissions — ikke-forhandlingsbart

```typescript
// Disse helpers SKAL kaldes — ingen genveje

// Tilgængeligt fra @/lib/permissions
canAccessCompany(userId, companyId): Promise<boolean>
canAccessSensitivity(userId, level): Promise<boolean>
canAccessModule(userId, module): Promise<boolean>
getAccessibleCompanies(userId): Promise<Company[]>

// REGEL: Enhver server action og API route der returnerer data
// SKAL kalde mindst canAccessCompany() eller canAccessSensitivity()
// FØR data returneres — uden undtagelse.

// REGEL: Sensitivity-minimum pr. system_type håndhæves i:
// 1. Server action (ved oprettelse og redigering)
// 2. Database constraint (CHECK constraint i migration)
// Aldrig kun i UI.
```

---

## 11. Test

```typescript
// Placering
src/__tests__/          Unit + integration tests (Vitest)
e2e/                    E2E tests (Playwright)

// Navngivning
companies.test.ts       Unit tests for companies modul
contracts.test.ts       Unit tests for contracts modul
auth.test.ts            Auth + permissions tests

// Ikke-forhandlingsbare tests — skal altid være grønne
// Se BA-10 (Test-agent) i AGENT-ROSTER.md for komplet liste

// Minimum pr. server action:
// - Happy path
// - Uautoriseret adgang (ingen session)
// - Forkert tenant (anden organisations data)
// - Ugyldig input (Zod validation)
```

---

## 12. Environment og konfiguration

```bash
# Alle env vars SKAL dokumenteres i .env.example
# Startup-script validerer at alle påkrævede vars er sat
# Se BA-08 (DevOps-agent) og /docs/ops/RUNBOOK.md

# Database (Supabase) — begge SKAL være sat
DATABASE_URL                    Supabase Transaction Pooler (port 6543, ?pgbouncer=true)
DIRECT_URL                      Supabase Direct Connection (port 5432) — til migrationer

# Auth
NEXTAUTH_SECRET
NEXTAUTH_URL
MICROSOFT_CLIENT_ID
MICROSOFT_CLIENT_SECRET

# Stripe
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET           www-prefix i webhook URL — ikke-forhandlingsbart

# App
NEXT_PUBLIC_APP_URL             NEXT_PUBLIC_ prefix til klient-eksponerede vars
```

---

## 13. Git og commits

```
Commit format: [type]: beskrivelse på dansk

feat: tilføj kontrakt-oprettelse
fix: ret tenant isolation på kontrakt-endpoint
chore: opdater Prisma schema med sensitivity-kolonne
docs: opdater CONVENTIONS.md med test-sektion
refactor: udtræk permissions-helpers til eget modul

Branch navngivning:
feat/contract-module
fix/tenant-isolation
chore/prisma-migration
```

---

## 14. Dependency-regel — ikke-forhandlingsbart

```
Enhver agent der introducerer en ny import SKAL tilføje pakken til package.json
i samme commit. Det er ikke tilladt at generere kode med imports til pakker
der ikke er installeret.

Regel gælder for:
- npm-pakker (import fra node_modules)
- shadcn/ui-komponenter (src/components/ui/)
- Alle @radix-ui/*, lucide-react, zod, date-fns og lignende

Ved sprint-afslutning kører BA-08-devops altid:
  1. npm install --legacy-peer-deps
  2. npx prisma generate
  3. npx tsc --noEmit    (ingen TypeScript-fejl)
  4. npx next build      (ingen build-fejl)

Sprint markeres IKKE som færdigt hvis build fejler.
```

---

## 15. Applikationsstart — succeskriterium

```
Et sprint er kun produktionsklart når:
  □ npx next dev starter uden fejl
  □ /companies loader uden runtime-fejl
  □ /contracts loader uden runtime-fejl
  □ /cases loader uden runtime-fejl
  □ /dashboard loader uden runtime-fejl
  □ npx next build gennemføres uden fejl

Agenter SKAL verificere dette inden commit.
Middleware skal deaktiveres midlertidigt hvis nødvendigt for verifikation.
```

---

## Hurtigtjekliste til alle agenter

Inden kode markeres som færdig — tjek:

```
□ organization_id på alle Prisma queries
□ deleted_at: null på alle list-queries
□ canAccessCompany() kaldt inden data returneres
□ canAccessSensitivity() kaldt på sensitive ressourcer
□ Zod validation på al brugerinput
□ Loading state implementeret
□ Tom state implementeret
□ Fejlbeskeder på dansk, handlingsanvisende
□ Ingen inline styles — kun Tailwind
□ Ingen console.log i produktion-kode
□ .env.example opdateret ved nye env vars
□ Alle nye imports har matchende pakke i package.json
□ npx next build gennemføres uden fejl
```

---

## Changelog

```
v0.4 (Supabase datasource):
  + Sektion 4: Ny undersektion "Supabase datasource — ikke-forhandlingsbart"
    prisma/schema.prisma SKAL bruge url + directUrl med env("DATABASE_URL")
    og env("DIRECT_URL") for at understøtte Supabase PgBouncer pooling.
  + Sektion 12: DIRECT_URL tilføjet som påkrævet env var.
    DATABASE_URL og DIRECT_URL dokumenteret med Supabase-kontekst.

v0.3 (MABS-læringer):
  + Sektion 14: Dependency-regel — alle imports kræver pakke i package.json
  + Sektion 14: Build-gate — npm install, prisma generate, tsc, next build
    skal gennemføres uden fejl inden sprint markeres færdigt
  + Sektion 15: Applikationsstart-succeskriterium — navngivne routes
    skal loade uden fejl
  + Hurtigtjekliste: To nye punkter tilføjet (imports + build)

v0.2 (QA-rettet):
  + Linje 91: STRICTLY_CONFIDENTIAL → STRENGT_FORTROLIG (dansk enum-eksempel)
  + Linje 77: INTERNAL → INTERN i SENSITIVITY_LEVELS-eksempel
  + Sektion 2: Systemroller tilføjet som navngivningskategori
    (SCREAMING_SNAKE_CASE: GROUP_OWNER, GROUP_ADMIN, COMPANY_MANAGER etc.)
  + Versionslinje tilføjet i header

v0.1:
  Første udkast
```

*CONVENTIONS.md v0.4 — Supabase datasource tilføjet.*
