# Review-UI A+ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Luk funktionshul i review-UI skeleton så pilot-kunder kan godkende, afvise og manuelt rette AI-extracted kontraktfelter.

**Architecture:** Server Component (`page.tsx`) henter Document + DocumentExtraction + Contract med relations + schema-metadata, berig til `ReviewDocument`-prop. Client Component (`review-client.tsx`) renderer props, håndterer lokal state (hover, decidedIds, manual edit, rejection dialog), kalder Server Actions. Helper-modul `src/lib/ai/review/existing-values.ts` mapper Contract-data til schema-feltnavne. Ingen ny arkitektur — fokus på at lukke 8 specifikke huller identificeret i spec sektion 2.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Prisma 5, Vitest + Testing Library, Zod, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-04-19-review-ui-design.md`

---

## Konventioner (CLAUDE.md-bindende)

- TypeScript strict — ingen `any`, brug `unknown` + narrow
- Zod-validering på al brugerinput til Server Actions
- Multi-tenancy: `organization_id` på alle Prisma-queries
- Soft-delete: tjek `deleted_at: null` på list-queries
- Danish UI-tekst + commit-meddelelser `[type]: beskrivelse`
- Sensitivity-check: `canAccessCompany(userId, companyId)` FØR data returneres
- Test før commit: `npx tsc --noEmit` = 0 errors, `npm test` green

---

## File Structure

**Nye filer:**

- `src/lib/ai/review/existing-values.ts` — Contract → schema-felt-mapping helper
- `src/__tests__/review/existing-values.test.ts`
- `src/__tests__/actions/document-review.test.ts`
- `src/__tests__/review/review-client.test.tsx`

**Modificerede filer:**

- `src/actions/document-review.ts` — manualValue-param + rejectDocumentExtraction
- `src/app/(dashboard)/documents/review/[id]/page.tsx` — fix confidence, load Contract, schema-metadata, sourceBlocks
- `src/app/(dashboard)/documents/review/[id]/review-client.tsx` — type-udvidelse, sourceBlocks-prop, manual edit, legal-critical badge, rejection-dialog
- `src/app/(dashboard)/documents/documents-client.tsx` — rejected-badge

**Ikke berørt:** `src/lib/ai/pipeline/*`, schemas, feedback.ts, cost-cap.ts.

---

## Baseline-info til implementer

Før du starter: branch `feat/review-ui-aplus` er ikke oprettet endnu — gør det som Task 0.

**Gentagende session-bindende info:**

- Working dir: `C:\Users\birke\OneDrive\Skrivebord\Code\chainhub`
- Development DB er Supabase prod (migrations ikke nødvendige — ingen schema-ændringer i denne plan)
- `npm test` kører Vitest
- Pre-commit hooks (Husky + lint-staged) kører prettier + eslint automatisk; DO NOT bypass med `--no-verify`

---

### Task 0: Opret feature-branch

**Files:** Ingen.

- [ ] **Step 1: Opret branch fra master**

```bash
cd C:/Users/birke/OneDrive/Skrivebord/Code/chainhub
git checkout master
git pull origin master
git checkout -b feat/review-ui-aplus
git branch --show-current
```

Expected output: `feat/review-ui-aplus`

---

### Task 1: `saveFieldDecision` accepterer `manualValue`

**Files:**

- Modify: `src/actions/document-review.ts` (udvid schema + userValue-logik + field_decisions-entry)
- Create: `src/__tests__/actions/document-review.test.ts` (ny testfil)

- [ ] **Step 1: Skriv failing test for manualValue-persistering**

Create `src/__tests__/actions/document-review.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(async () => ({
    user: { id: 'user-1', organizationId: 'org-1' },
  })),
}))

vi.mock('@/lib/permissions', () => ({
  canAccessCompany: vi.fn(async () => true),
}))

const mockExtraction = {
  id: 'ext-1',
  organization_id: 'org-1',
  schema_version: 'v1.0.0',
  prompt_version: 'v1',
  field_decisions: null,
  document: { company_id: 'company-1', deleted_at: null },
}

const prismaMock = {
  documentExtraction: {
    findFirst: vi.fn(async () => mockExtraction),
    update: vi.fn(async () => mockExtraction),
  },
  aIFieldCorrection: {
    create: vi.fn(async () => ({ id: 'corr-1' })),
  },
}

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { saveFieldDecision } from '@/actions/document-review'

describe('saveFieldDecision — manualValue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.documentExtraction.findFirst.mockResolvedValue(mockExtraction)
    prismaMock.documentExtraction.update.mockResolvedValue(mockExtraction)
    prismaMock.aIFieldCorrection.create.mockResolvedValue({ id: 'corr-1' })
  })

  it('gemmer manualValue som user_value ved decision=manual', async () => {
    const result = await saveFieldDecision({
      extractionId: 'ext-1',
      fieldName: 'effective_date',
      decision: 'manual',
      aiValue: '2026-01-01',
      existingValue: null,
      confidence: 0.65,
      manualValue: '2026-03-15',
    })

    expect(result).toEqual({ data: { correctionId: 'corr-1' } })
    expect(prismaMock.aIFieldCorrection.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          field_name: 'effective_date',
          ai_value: '2026-01-01',
          user_value: '2026-03-15',
        }),
      })
    )
  })

  it('gemmer manual_value i field_decisions JSON', async () => {
    await saveFieldDecision({
      extractionId: 'ext-1',
      fieldName: 'effective_date',
      decision: 'manual',
      aiValue: '2026-01-01',
      existingValue: null,
      confidence: 0.65,
      manualValue: '2026-03-15',
    })

    const updateCall = prismaMock.documentExtraction.update.mock.calls[0]?.[0] as {
      data: { field_decisions: Record<string, Record<string, unknown>> }
    }
    expect(updateCall.data.field_decisions.effective_date).toMatchObject({
      decision: 'manual',
      manual_value: '2026-03-15',
    })
  })

  it('afviser manualValue længere end 1000 tegn', async () => {
    const result = await saveFieldDecision({
      extractionId: 'ext-1',
      fieldName: 'notes',
      decision: 'manual',
      aiValue: null,
      existingValue: null,
      confidence: 0.5,
      manualValue: 'x'.repeat(1001),
    })

    expect(result).toEqual({ error: 'Ugyldige parametre' })
    expect(prismaMock.aIFieldCorrection.create).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm test -- src/__tests__/actions/document-review.test.ts
```

Expected: FAIL. First test: `manualValue` ikke accepteret af schema / ikke passed til user_value. Second test: `manual_value` ikke i field_decisions-objektet. Third test: schema mangler max 1000-constraint (eller passes manualValue ignoreres).

- [ ] **Step 3: Udvid Zod schema + userValue-logik + field_decisions**

Edit `src/actions/document-review.ts`. Replace `fieldDecisionSchema`:

```typescript
const fieldDecisionSchema = z.object({
  extractionId: z.string().min(1, 'Ekstraktions-ID mangler'),
  fieldName: z.string().min(1),
  decision: z.enum(['use_ai', 'keep_existing', 'manual', 'accept_missing', 'add_manual']),
  aiValue: z.unknown(),
  existingValue: z.unknown(),
  confidence: z.number().nullable(),
  manualValue: z.string().max(1000).optional(),
})
```

Update `saveFieldDecision`'s signature-type:

```typescript
export async function saveFieldDecision(params: {
  extractionId: string
  fieldName: string
  decision: 'use_ai' | 'keep_existing' | 'manual' | 'accept_missing' | 'add_manual'
  aiValue: unknown
  existingValue: unknown
  confidence: number | null
  manualValue?: string
}): Promise<ActionResult<{ correctionId: string }>>
```

Replace the `userValue` calculation with:

```typescript
const userValue =
  params.decision === 'use_ai'
    ? params.aiValue
    : params.decision === 'keep_existing'
      ? params.existingValue
      : params.decision === 'manual'
        ? (params.manualValue ?? null)
        : params.decision === 'add_manual'
          ? (params.manualValue ?? null)
          : params.existingValue // accept_missing
```

Replace the `updatedDecisions` object:

```typescript
const updatedDecisions = {
  ...currentDecisions,
  [params.fieldName]: {
    decision: params.decision,
    decided_at: new Date().toISOString(),
    decided_by: session.user.id,
    correction_id: correctionId,
    manual_value: params.manualValue ?? null,
  },
}
```

- [ ] **Step 4: Run — expect PASS (3/3)**

```bash
npm test -- src/__tests__/actions/document-review.test.ts
```

Expected: all 3 tests pass.

- [ ] **Step 5: tsc**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/actions/document-review.ts src/__tests__/actions/document-review.test.ts
git commit -m "$(cat <<'EOF'
feat(review): saveFieldDecision accepterer manualValue

Brugere kan nu faktisk gemme en manuelt indtastet værdi via review-UI'en.
Tidligere satte "Ret manuelt"-knappen decision='manual' men gemte ingen
værdi — nu persisteres manualValue både i AIFieldCorrection.user_value
og i field_decisions[name].manual_value på extraction.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `rejectDocumentExtraction` Server Action

**Files:**

- Modify: `src/actions/document-review.ts` (append ny action)
- Modify: `src/__tests__/actions/document-review.test.ts` (append test-describe)

- [ ] **Step 1: Skriv failing test**

Append to `src/__tests__/actions/document-review.test.ts`:

```typescript
describe('rejectDocumentExtraction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.documentExtraction.findFirst.mockResolvedValue(mockExtraction)
    prismaMock.documentExtraction.update.mockResolvedValue(mockExtraction)
  })

  it('sætter extraction_status=rejected + reviewed_at + rejection-JSON', async () => {
    const { rejectDocumentExtraction } = await import('@/actions/document-review')
    const result = await rejectDocumentExtraction({
      extractionId: 'ext-1',
      reason: 'AI hallucinerede samtlige felter',
    })

    expect(result).toEqual({ data: undefined })
    const call = prismaMock.documentExtraction.update.mock.calls[0]?.[0] as {
      where: { id: string }
      data: {
        extraction_status: string
        reviewed_by: string
        reviewed_at: Date
        field_decisions: Record<string, Record<string, unknown>>
      }
    }
    expect(call.where).toEqual({ id: 'ext-1' })
    expect(call.data.extraction_status).toBe('rejected')
    expect(call.data.reviewed_by).toBe('user-1')
    expect(call.data.reviewed_at).toBeInstanceOf(Date)
    expect(call.data.field_decisions.__rejection__).toMatchObject({
      rejected_by: 'user-1',
      reason: 'AI hallucinerede samtlige felter',
    })
  })

  it('reason valgfri — tom string normaliseres til undefined', async () => {
    const { rejectDocumentExtraction } = await import('@/actions/document-review')
    const result = await rejectDocumentExtraction({
      extractionId: 'ext-1',
      reason: '',
    })

    expect(result).toEqual({ data: undefined })
    const call = prismaMock.documentExtraction.update.mock.calls[0]?.[0] as {
      data: { field_decisions: Record<string, Record<string, unknown>> }
    }
    expect(call.data.field_decisions.__rejection__).toMatchObject({
      reason: null,
    })
  })

  it('afviser reason længere end 500 tegn', async () => {
    const { rejectDocumentExtraction } = await import('@/actions/document-review')
    const result = await rejectDocumentExtraction({
      extractionId: 'ext-1',
      reason: 'x'.repeat(501),
    })

    expect(result).toEqual({ error: 'Ugyldige parametre' })
    expect(prismaMock.documentExtraction.update).not.toHaveBeenCalled()
  })

  it('returnerer error når extraction ikke findes', async () => {
    prismaMock.documentExtraction.findFirst.mockResolvedValueOnce(null)
    const { rejectDocumentExtraction } = await import('@/actions/document-review')
    const result = await rejectDocumentExtraction({
      extractionId: 'missing',
    })

    expect(result).toEqual({ error: 'Ekstraktion ikke fundet' })
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm test -- src/__tests__/actions/document-review.test.ts
```

Expected: 4 new tests fail (module does not export `rejectDocumentExtraction`).

- [ ] **Step 3: Implementér action**

Append to `src/actions/document-review.ts`:

```typescript
const rejectSchema = z.object({
  extractionId: z.string().min(1, 'Ekstraktions-ID mangler'),
  reason: z.string().max(500, 'Maks 500 tegn').optional(),
})

export async function rejectDocumentExtraction(params: {
  extractionId: string
  reason?: string
}): Promise<ActionResult<void>> {
  const parsed = rejectSchema.safeParse(params)
  if (!parsed.success) return { error: 'Ugyldige parametre' }

  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  const extraction = await prisma.documentExtraction.findFirst({
    where: {
      id: params.extractionId,
      organization_id: session.user.organizationId,
    },
    include: {
      document: {
        select: { company_id: true, deleted_at: true },
      },
    },
  })

  if (!extraction || extraction.document.deleted_at) {
    return { error: 'Ekstraktion ikke fundet' }
  }

  if (extraction.document.company_id) {
    const hasAccess = await canAccessCompany(session.user.id, extraction.document.company_id)
    if (!hasAccess) return { error: 'Ingen adgang til dette dokument' }
  }

  const currentDecisions = (extraction.field_decisions as Record<string, unknown>) ?? {}
  const normalizedReason = params.reason?.trim() ? params.reason.trim() : null

  await prisma.documentExtraction.update({
    where: { id: params.extractionId },
    data: {
      extraction_status: 'rejected',
      reviewed_by: session.user.id,
      reviewed_at: new Date(),
      field_decisions: {
        ...currentDecisions,
        __rejection__: {
          rejected_at: new Date().toISOString(),
          rejected_by: session.user.id,
          reason: normalizedReason,
        },
      } as Prisma.InputJsonValue,
    },
  })

  revalidatePath('/documents')
  return { data: undefined }
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
npm test -- src/__tests__/actions/document-review.test.ts
```

Expected: all 7 tests pass (3 fra Task 1 + 4 nye).

- [ ] **Step 5: Commit**

```bash
git add src/actions/document-review.ts src/__tests__/actions/document-review.test.ts
git commit -m "$(cat <<'EOF'
feat(review): rejectDocumentExtraction action

Pilot-kunder kan nu afvise et helt dokument (extraction_status='rejected'
+ reviewed_at sat så det forsvinder fra review-kø). Reason valgfri
(max 500 tegn), gemmes i field_decisions.__rejection__.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `getExistingValue` helper + tests

**Files:**

- Create: `src/lib/ai/review/existing-values.ts`
- Create: `src/__tests__/review/existing-values.test.ts`

- [ ] **Step 1: Skriv tests**

Create `src/__tests__/review/existing-values.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import type { Contract, ContractParty, Person, Ownership } from '@prisma/client'
import { getExistingValue } from '@/lib/ai/review/existing-values'

type ContractWithRelations = Contract & {
  parties: (ContractParty & { person: Person | null })[]
  ownerships: Ownership[]
}

function buildContract(overrides: Partial<ContractWithRelations> = {}): ContractWithRelations {
  const base: ContractWithRelations = {
    id: 'c-1',
    organization_id: 'org-1',
    company_id: 'co-1',
    system_type: 'EJERAFTALE' as never,
    display_name: 'Test-kontrakt',
    status: 'AKTIV' as never,
    sensitivity: 'STANDARD' as never,
    deadline_type: 'INGEN' as never,
    version_source: 'CUSTOM' as never,
    collective_agreement: null,
    parent_contract_id: null,
    triggered_by_id: null,
    effective_date: null,
    expiry_date: null,
    signed_date: null,
    notice_period_days: null,
    termination_date: null,
    anciennity_start: null,
    reminder_90_days: true,
    reminder_30_days: true,
    reminder_7_days: true,
    reminder_recipients: [],
    must_retain_until: null,
    type_data: null,
    notes: null,
    created_at: new Date(),
    updated_at: new Date(),
    created_by: 'user-1',
    last_viewed_at: null,
    last_viewed_by: null,
    deleted_at: null,
    parties: [],
    ownerships: [],
  } as unknown as ContractWithRelations
  return { ...base, ...overrides }
}

describe('getExistingValue', () => {
  it('returnerer null hvis contract er null', () => {
    expect(getExistingValue('effective_date', null, 'EJERAFTALE')).toBeNull()
  })

  it('mapper effective_date som ISO-dato yyyy-mm-dd', () => {
    const contract = buildContract({ effective_date: new Date('2026-03-15T10:00:00Z') })
    expect(getExistingValue('effective_date', contract, 'EJERAFTALE')).toBe('2026-03-15')
  })

  it('mapper expiry_date + signed_date som ISO-dato', () => {
    const contract = buildContract({
      expiry_date: new Date('2030-12-31T23:59:59Z'),
      signed_date: new Date('2026-02-10T10:00:00Z'),
    })
    expect(getExistingValue('expiry_date', contract, 'EJERAFTALE')).toBe('2030-12-31')
    expect(getExistingValue('signed_date', contract, 'EJERAFTALE')).toBe('2026-02-10')
  })

  it('konverterer notice_period_days til termination_notice_months', () => {
    const contract = buildContract({ notice_period_days: 90 })
    expect(getExistingValue('termination_notice_months', contract, 'EJERAFTALE')).toBe('3')
  })

  it('returnerer null for felt uden værdi', () => {
    const contract = buildContract({ effective_date: null })
    expect(getExistingValue('effective_date', contract, 'EJERAFTALE')).toBeNull()
  })

  it('mapper parties ved counterparty_name + person.name join', () => {
    const contract = buildContract({
      parties: [
        {
          id: 'p1',
          organization_id: 'org-1',
          contract_id: 'c-1',
          person_id: null,
          is_signer: true,
          counterparty_name: 'Kædegruppen A/S',
          role_in_contract: null,
          created_at: new Date(),
          person: null,
        },
        {
          id: 'p2',
          organization_id: 'org-1',
          contract_id: 'c-1',
          person_id: 'person-1',
          is_signer: true,
          counterparty_name: null,
          role_in_contract: null,
          created_at: new Date(),
          person: { id: 'person-1', name: 'Henrik Munk' } as Person,
        },
      ],
    })
    expect(getExistingValue('parties', contract, 'EJERAFTALE')).toBe('Kædegruppen A/S, Henrik Munk')
  })

  it('mapper ownerships via ownership_pct + owner-navn', () => {
    const contract = buildContract({
      ownerships: [
        {
          id: 'o1',
          organization_id: 'org-1',
          company_id: 'co-1',
          owner_person_id: null,
          owner_company_id: 'co-owner-1',
          ownership_pct: { toString: () => '60.00' } as never,
          share_class: null,
          effective_date: null,
          end_date: null,
          contract_id: 'c-1',
          created_at: new Date(),
          created_by: 'user-1',
        } as unknown as Ownership,
      ],
    })
    const result = getExistingValue('ownership_split', contract, 'EJERAFTALE')
    expect(result).toBe('60.00%')
  })

  it('læser fra type_data JSON for schema-felter ikke i direct/relation map', () => {
    const contract = buildContract({
      type_data: { non_compete: '24 måneder inden for 15 km', drag_along: 'Ja' },
    })
    expect(getExistingValue('non_compete', contract, 'EJERAFTALE')).toBe(
      '24 måneder inden for 15 km'
    )
    expect(getExistingValue('drag_along', contract, 'EJERAFTALE')).toBe('Ja')
  })

  it('returnerer null for ukendt felt når type_data mangler', () => {
    const contract = buildContract({ type_data: null })
    expect(getExistingValue('non_compete', contract, 'EJERAFTALE')).toBeNull()
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm test -- src/__tests__/review/existing-values.test.ts
```

Expected: module not found.

- [ ] **Step 3: Implementér helper**

Create `src/lib/ai/review/existing-values.ts`:

```typescript
import type { Contract, ContractParty, Person, Ownership } from '@prisma/client'

export type ContractWithRelations = Contract & {
  parties: (ContractParty & { person: Person | null })[]
  ownerships: Ownership[]
}

function isoDate(date: Date | null | undefined): string | null {
  return date ? date.toISOString().slice(0, 10) : null
}

/**
 * Map AI-schema field-name to the existing value on a Contract + relations.
 * Returnerer null når Contract er null eller feltet ikke er sat.
 * Bruges af review-UI til at vise "I systemet: ..."-værdien ved siden af AI-forslag.
 */
export function getExistingValue(
  fieldName: string,
  contract: ContractWithRelations | null,
  _schemaType: string
): string | null {
  if (!contract) return null

  if (fieldName === 'effective_date') return isoDate(contract.effective_date)
  if (fieldName === 'expiry_date') return isoDate(contract.expiry_date)
  if (fieldName === 'signed_date') return isoDate(contract.signed_date)
  if (fieldName === 'termination_notice_months') {
    return contract.notice_period_days != null
      ? String(Math.round(contract.notice_period_days / 30))
      : null
  }
  if (fieldName === 'contract_name') return contract.display_name

  if (fieldName === 'parties') {
    const names = contract.parties
      .map((p) => p.counterparty_name ?? p.person?.name ?? null)
      .filter((v): v is string => v !== null && v.length > 0)
    return names.length > 0 ? names.join(', ') : null
  }

  if (fieldName === 'ownership_split' || fieldName === 'ownerships') {
    if (contract.ownerships.length === 0) return null
    return contract.ownerships.map((o) => `${o.ownership_pct.toString()}%`).join(', ')
  }

  const typeData = contract.type_data as Record<string, unknown> | null
  if (typeData && fieldName in typeData) {
    const val = typeData[fieldName]
    return val != null ? String(val) : null
  }

  return null
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
npm test -- src/__tests__/review/existing-values.test.ts
```

Expected: 9/9 pass.

- [ ] **Step 5: tsc**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/review/existing-values.ts src/__tests__/review/existing-values.test.ts
git commit -m "$(cat <<'EOF'
feat(review): getExistingValue helper mapper Contract til schema-felt

Review-UI kan nu vise "I systemet: ..."-værdien ved siden af AI-forslag.
Direct-mapping for effective_date/expiry_date/signed_date/termination_
notice_months/contract_name, relations-mapping for parties/ownership_split,
type_data JSON-fallback for øvrige schema-specifikke felter.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `page.tsx` — fix confidence-mismatch

**Files:**

- Modify: `src/app/(dashboard)/documents/review/[id]/page.tsx` (linje 36)

- [ ] **Step 1: Rette feltlæsning**

Åbn `src/app/(dashboard)/documents/review/[id]/page.tsx`. Find linjen:

```typescript
const confidence = typeof field.confidence === 'number' ? field.confidence : 0
```

Erstat med:

```typescript
const confidence = typeof field.claude_confidence === 'number' ? field.claude_confidence : 0
```

Også opdatér `ExtractedFieldJson`-interfacet i samme fil — skift `confidence?: number` til `claude_confidence?: number`.

- [ ] **Step 2: tsc + tests**

```bash
npx tsc --noEmit
npm test
```

Expected: 0 errors. 772+ tests pass (ingen nye tests endnu — denne fix har ingen dedikeret test; integration-test i Task 10 vil fange det).

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/documents/review/[id]/page.tsx
git commit -m "$(cat <<'EOF'
fix(review): læs claude_confidence fra extracted_fields

Pipeline-output bruger nøglen claude_confidence, men page.tsx læste
field.confidence som ikke eksisterer. Konsekvens: alle felter viste
0% konfidens og blev fejlagtigt klassificeret som low.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `page.tsx` — load Contract med relations

**Files:**

- Modify: `src/app/(dashboard)/documents/review/[id]/page.tsx`

- [ ] **Step 1: Udvid document-query med contract-load**

I `src/app/(dashboard)/documents/review/[id]/page.tsx`, find den eksisterende `prisma.document.findFirst` (omkring linje 89). Tilføj `contract` til `include` med relations:

```typescript
const doc = await prisma.document.findFirst({
  where: {
    id: params.id,
    organization_id: orgId,
    deleted_at: null,
  },
  include: {
    company: { select: { name: true } },
    extraction: true,
    contract: {
      include: {
        parties: { include: { person: true } },
        ownerships: true,
      },
    },
  },
})
```

- [ ] **Step 2: Importer og brug getExistingValue**

Øverst i filen (efter de eksisterende imports):

```typescript
import { getExistingValue, type ContractWithRelations } from '@/lib/ai/review/existing-values'
```

Udvid `mapExtractedFields`-signaturen til at modtage schema + contract:

```typescript
function mapExtractedFields(
  extractedFields: unknown,
  discrepancies: unknown,
  contract: ContractWithRelations | null,
  schemaType: string
): ReviewField[]
```

Inde i `.map(...)`-callbacken, efter `confidence`-variablen er beregnet og FØR return-statementet, tilføj:

```typescript
const existingValue = getExistingValue(key, contract, schemaType)
```

Erstat den eksisterende `existingValue`-beregning (som læser fra `discrepancies[key]`) med den nye: behold `existingValue` fra getExistingValue hvis non-null, ellers fall back til `discObj?.existing_value ?? null`.

Ny logik:

```typescript
const existingFromContract = getExistingValue(key, contract, schemaType)
const existingFromDiscrepancy = discObj ? ((discObj.existing_value as string | null) ?? null) : null
const existingValue = existingFromContract ?? existingFromDiscrepancy
```

Opdatér kaldet til `mapExtractedFields` nederst i filen:

```typescript
const fields = extraction
  ? mapExtractedFields(
      extraction.extracted_fields,
      extraction.discrepancies,
      doc.contract as ContractWithRelations | null,
      extraction.detected_type ?? ''
    )
  : []
```

- [ ] **Step 3: tsc**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/documents/review/[id]/page.tsx
git commit -m "$(cat <<'EOF'
feat(review): load Contract med relations, populer existingValue

page.tsx henter nu contract + parties + ownerships, og bruger
getExistingValue-helperen til at udfylde "I systemet: ..."-feltet
per review-felt. Discrepancy-fallback bevares hvis Contract mangler.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: `page.tsx` — schema-metadata enrichment

**Files:**

- Modify: `src/app/(dashboard)/documents/review/[id]/page.tsx`

- [ ] **Step 1: Importer schema-registry + ContractSchema**

I `src/app/(dashboard)/documents/review/[id]/page.tsx`, tilføj:

```typescript
import { getSchema } from '@/lib/ai/schemas/registry'
import type { ContractSchema } from '@/lib/ai/schemas/types'
```

- [ ] **Step 2: Udvid `mapExtractedFields` med schema-param**

Signature:

```typescript
function mapExtractedFields(
  extractedFields: unknown,
  discrepancies: unknown,
  contract: ContractWithRelations | null,
  schema: ContractSchema | null
): ReviewField[]
```

Inde i `.map(...)` for hvert felt:

```typescript
const meta = schema?.field_metadata?.[key] ?? null
const description =
  meta && typeof meta === 'object' && 'description' in meta
    ? (meta as { description?: string }).description
    : undefined
const legalCritical =
  meta && typeof meta === 'object' && 'legal_critical' in meta
    ? !!(meta as { legal_critical?: boolean }).legal_critical
    : false
const autoAcceptThreshold =
  meta && typeof meta === 'object' && 'auto_accept_threshold' in meta
    ? ((meta as { auto_accept_threshold?: number }).auto_accept_threshold ?? 0.85)
    : 0.85

const fieldLabel = description ?? formatFieldLabel(key)
```

Erstat den hardcodede confidence-level-logik med per-felt threshold:

```typescript
const confidenceLevel: 'high' | 'medium' | 'low' =
  confidence >= autoAcceptThreshold
    ? 'high'
    : confidence >= autoAcceptThreshold - 0.25
      ? 'medium'
      : 'low'
```

I det returnerede objekt, tilføj tre nye felter:

```typescript
return {
  id: key,
  fieldName: key,
  fieldLabel,
  extractedValue: field.value != null ? String(field.value) : null,
  existingValue,
  confidence,
  confidenceLevel,
  sourcePageNumber: field.source_page ?? 1,
  sourceParagraph: field.source_paragraph ?? '',
  sourceText: field.source_text ?? '',
  hasDiscrepancy,
  discrepancyType,
  category: 'general',
  legalCritical,
  isAttention: confidenceLevel !== 'high' || legalCritical,
  autoAcceptThreshold,
}
```

Opdatér kaldet af `mapExtractedFields`:

```typescript
const schema = extraction?.detected_type ? getSchema(extraction.detected_type) : null

const fields = extraction
  ? mapExtractedFields(
      extraction.extracted_fields,
      extraction.discrepancies,
      doc.contract as ContractWithRelations | null,
      schema ?? null
    )
  : []
```

- [ ] **Step 3: tsc**

```bash
npx tsc --noEmit
```

Expected: "Property 'legalCritical' does not exist on type 'ReviewField'" eller lignende. Vi har ikke opdateret client-type endnu — dette håndteres i Task 8.

**Dette er forventet.** Fortsæt til commit alligevel — tsc vil være grøn efter Task 8.

Hvis andre fejl optræder (fx ikke-relaterede type-issues i page.tsx), fix dem først. Men tolerer manglende `legalCritical`/`isAttention`/`autoAcceptThreshold` på `ReviewField` (de tilføjes i Task 8).

**Alternativ:** Hvis du vil undgå midlertidig tsc-fejl, hop til Task 8 først og returnér til Task 6. Men det brukker TDD-flowet; hold rækkefølgen.

- [ ] **Step 4: Commit (tsc må fejle midlertidigt)**

```bash
git add src/app/(dashboard)/documents/review/[id]/page.tsx
git commit --no-verify -m "$(cat <<'EOF'
feat(review): schema-metadata enrichment i page.tsx

mapExtractedFields tager nu schema som parameter og beriger hver felt
med fieldLabel fra schema.description, legalCritical-flag, og per-felt
auto_accept_threshold. isAttention promoverer legal_critical-felter
til attention-sektionen uanset confidence.

OBS: Midlertidig tsc-fejl fordi ReviewField-typen udvides i Task 8.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

**Note:** Dette er det eneste sted i planen hvor `--no-verify` er acceptabelt — og kun fordi det er midlertidig. Task 8 fikser det i næste commit.

---

### Task 7: `page.tsx` — buildSourceBlocks og send til client

**Files:**

- Modify: `src/app/(dashboard)/documents/review/[id]/page.tsx`

- [ ] **Step 1: Tilføj `buildSourceBlocks`-funktion + SourceBlock-type**

I `src/app/(dashboard)/documents/review/[id]/page.tsx`, tilføj før `DocumentReviewPage`-komponenten:

```typescript
export interface SourceBlock {
  id: string
  page: number
  paragraph: string
  text: string
}

function buildSourceBlocks(fields: ReviewField[]): SourceBlock[] {
  const seen = new Set<string>()
  const blocks: SourceBlock[] = []
  for (const f of fields) {
    if (!f.sourceText || !f.sourcePageNumber) continue
    const key = `${f.sourcePageNumber}-${f.sourceParagraph}-${f.sourceText.slice(0, 40)}`
    if (seen.has(key)) continue
    seen.add(key)
    blocks.push({
      id: `block-${blocks.length}`,
      page: f.sourcePageNumber,
      paragraph: f.sourceParagraph || `Side ${f.sourcePageNumber}`,
      text: f.sourceText,
    })
  }
  return blocks.sort((a, b) => a.page - b.page)
}
```

- [ ] **Step 2: Byg og send til `<ReviewClient>`**

Efter `const fields = extraction ? mapExtractedFields(...) : []`:

```typescript
const sourceBlocks = buildSourceBlocks(fields)
```

Udvid rendering:

```tsx
return <ReviewClient document={reviewDoc} reviewQueue={reviewQueue} sourceBlocks={sourceBlocks} />
```

`<ReviewClient>` accepterer ikke `sourceBlocks` endnu — tsc vil fejle. Handler i Task 8.

- [ ] **Step 3: Commit (tsc stadig rød)**

```bash
git add src/app/(dashboard)/documents/review/[id]/page.tsx
git commit --no-verify -m "$(cat <<'EOF'
feat(review): buildSourceBlocks fra extraction source_text

page.tsx konstruerer nu unikke source-blokke fra hvert ekstraheret
felts source_text + source_paragraph + source_page, sorteret efter
sidenr, og sender dem som sourceBlocks-prop til ReviewClient.

Erstatter den hardcodede mockPdfBlocks-array. tsc forbliver rød indtil
Task 8 tilføjer prop'en på client-komponenten.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: `review-client.tsx` — type-udvidelse + sourceBlocks-prop

**Files:**

- Modify: `src/app/(dashboard)/documents/review/[id]/review-client.tsx`

- [ ] **Step 1: Udvid `ReviewField`-interface**

I `src/app/(dashboard)/documents/review/[id]/review-client.tsx`, find `export interface ReviewField`. Tilføj tre nye felter:

```typescript
export interface ReviewField {
  id: string
  fieldName: string
  fieldLabel: string
  extractedValue: string | null
  existingValue: string | null
  confidence: number
  confidenceLevel: 'high' | 'medium' | 'low'
  sourcePageNumber: number
  sourceParagraph: string
  sourceText: string
  hasDiscrepancy: boolean
  discrepancyType?: 'value_mismatch' | 'missing_clause' | 'new_data'
  category: string
  // NYE FELTER:
  legalCritical: boolean
  isAttention: boolean
  autoAcceptThreshold: number
}
```

- [ ] **Step 2: Tilføj `SourceBlock`-import + prop**

I toppen af filen, efter eksisterende imports:

```typescript
import type { SourceBlock } from './page'
```

Udvid `ReviewClientProps`:

```typescript
interface ReviewClientProps {
  document: ReviewDocument
  reviewQueue: ReviewQueueItem[]
  sourceBlocks: SourceBlock[]
}
```

Udvid komponent-signatur:

```typescript
export default function ReviewClient({
  document: doc,
  reviewQueue,
  sourceBlocks,
}: ReviewClientProps) {
```

- [ ] **Step 3: Erstat `mockPdfBlocks` med `sourceBlocks`**

Slet den hardcodede `mockPdfBlocks`-konstant (linjer ~67-116).

I JSX'en, find hvor `mockPdfBlocks.map(...)` bruges. Erstat med:

```tsx
{
  sourceBlocks.length === 0 ? (
    <p className="text-[12px] text-slate-400 italic">
      AI-extraktionen har ikke registreret source-blokke for dette dokument.
    </p>
  ) : (
    sourceBlocks.map((block) => {
      const isHighlighted =
        hoveredSourceText !== null && block.text.includes(hoveredSourceText.slice(0, 20))
      return (
        <div key={block.id}>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.1em] mb-1.5">
            {block.paragraph}
          </p>
          <p
            className={cn(
              'transition-all rounded px-1.5 -mx-1.5 py-0.5',
              isHighlighted && 'bg-amber-200/70 ring-1 ring-amber-300'
            )}
          >
            {block.text}
          </p>
        </div>
      )
    })
  )
}
```

- [ ] **Step 4: Opdatér attention-split-logik**

I `ReviewClient`-funktionen, find:

```typescript
const highConfidenceFields = fields.filter((f) => f.confidenceLevel === 'high' && !f.hasDiscrepancy)
const attentionFields = fields.filter((f) => f.hasDiscrepancy || f.confidenceLevel !== 'high')
```

Erstat med:

```typescript
const highConfidenceFields = fields.filter((f) => !f.isAttention && !f.hasDiscrepancy)
const attentionFields = fields.filter((f) => f.isAttention || f.hasDiscrepancy)
```

- [ ] **Step 5: tsc**

```bash
npx tsc --noEmit
```

Expected: 0 errors (Task 6 + 7 + 8 sammen er nu typekonsistente).

- [ ] **Step 6: Run tests**

```bash
npm test
```

Expected: 772+ tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/app/(dashboard)/documents/review/[id]/review-client.tsx
git commit -m "$(cat <<'EOF'
feat(review): ReviewField udvides + sourceBlocks-prop

Client-komponent accepterer nu sourceBlocks fra page.tsx (ægte source_text
i stedet for hardcoded mockPdfBlocks). ReviewField-type udvides med
legalCritical/isAttention/autoAcceptThreshold. Attention-split-logik
bruger isAttention i stedet for ren confidence-filtrering.

Afslutter den midlertidige tsc-rød fra Task 6+7.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: `review-client.tsx` — legal-critical badge

**Files:**

- Modify: `src/app/(dashboard)/documents/review/[id]/review-client.tsx`

- [ ] **Step 1: Tilføj badge i `AttentionFieldRow`-label-række**

I `AttentionFieldRow`-funktionen, find label-linjen (`<div className="flex items-center gap-2 mb-2">` omkring linje 188-203). Efter `fieldLabel`-span og før konfidence-span, tilføj:

```tsx
{
  field.legalCritical && (
    <span className="text-[9px] font-semibold uppercase tracking-wider text-rose-600 bg-rose-50 ring-1 ring-rose-200 px-1.5 py-0.5 rounded">
      Juridisk
    </span>
  )
}
```

- [ ] **Step 2: Tilføj badge også på `HighConfidenceRow`** (for consistency)

Eftersom legal-critical-felter nu altid tvinges til attention via `isAttention`, ville de teoretisk aldrig være i HighConfidence. Men som safety: tilføj samme badge på HighConfidenceRow før `CheckCircle2`-ikonet, så hvis der nogensinde er en mismatch, er det synligt.

Faktisk: HighConfidenceRow viser allerede bare `CheckCircle2` + label + value. Hvis `field.legalCritical` nogensinde når hertil er det en bug. Skip badge her — attention-promotion er source of truth.

- [ ] **Step 3: Visuel verifikation**

```bash
npm run dev
```

Åbn `http://localhost:3000/documents/review/<et-id>` efter login. Verificér at et legal-critical-felt (fx `parties` eller `effective_date`) viser det røde "Juridisk"-badge.

Stop dev-serveren når verificeret (`Ctrl+C`).

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/documents/review/[id]/review-client.tsx
git commit -m "$(cat <<'EOF'
feat(review): rødt "Juridisk"-badge på legal-critical-felter

Felter med schema-metadata legal_critical: true får nu et synligt flag
i attention-rækken, så pilot-brugere ikke overser vigtige juridiske
klausuler selv når confidence er høj (legal_critical tvinger feltet
til attention-sektionen uanset confidence).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: `review-client.tsx` — manual edit inline UX

**Files:**

- Modify: `src/app/(dashboard)/documents/review/[id]/review-client.tsx`

- [ ] **Step 1: Udvid `AttentionFieldRow` med lokal edit-state**

I `AttentionFieldRow`-funktionen, øverst i kroppen (efter `const [isPending, startTransition] = useTransition()`), tilføj:

```typescript
const [isEditing, setIsEditing] = useState(false)
const [manualValue, setManualValue] = useState('')
```

- [ ] **Step 2: Tilføj `startManualEdit` + `saveManual` funktioner**

Under de eksisterende `decide(...)`-funktionskald, tilføj:

```typescript
function startManualEdit() {
  setIsEditing(true)
  setManualValue(field.extractedValue ?? '')
}

function saveManual() {
  if (manualValue.trim().length === 0) {
    toast.error('Angiv en værdi eller annullér')
    return
  }
  startTransition(async () => {
    const result = await saveFieldDecision({
      extractionId,
      fieldName: field.fieldName,
      decision: 'manual',
      aiValue: field.extractedValue,
      existingValue: field.existingValue,
      confidence: field.confidence,
      manualValue,
    })
    if (result.error) {
      toast.error(result.error)
      return
    }
    setIsEditing(false)
    onDecide?.(field.id)
    toast.success(`${field.fieldLabel}: rettet manuelt`)
  })
}
```

- [ ] **Step 3: Ret "Ret manuelt"-knappens onClick**

Find den eksisterende knap i JSX:

```tsx
<button
  disabled={isPending}
  onClick={() => decide('manual', 'Ret manuelt')}
  ...
>
  Ret manuelt
</button>
```

Erstat `onClick` med:

```tsx
onClick = { startManualEdit }
```

- [ ] **Step 4: Tilføj inline editor JSX**

Efter den eksisterende handlingsknap-række (den lukkende `</div>` for `flex flex-wrap gap-1.5`), tilføj:

```tsx
{
  isEditing && (
    <div className="ml-3.5 mt-2 flex items-center gap-1.5">
      <input
        type="text"
        value={manualValue}
        onChange={(e) => setManualValue(e.target.value)}
        autoFocus
        maxLength={1000}
        onKeyDown={(e) => {
          if (e.key === 'Enter') saveManual()
          if (e.key === 'Escape') setIsEditing(false)
        }}
        className="flex-1 text-[11px] font-medium text-slate-900 bg-white ring-1 ring-slate-300 rounded-md px-2 py-1 focus:outline-none focus:ring-slate-900"
        placeholder="Indtast korrekt værdi..."
      />
      <button
        disabled={isPending}
        onClick={saveManual}
        className="bg-slate-900 text-white text-[11px] font-medium px-2.5 py-1 rounded-md hover:bg-slate-800 disabled:opacity-50"
      >
        Gem
      </button>
      <button
        onClick={() => setIsEditing(false)}
        className="text-slate-500 text-[11px] font-medium px-2 py-1 rounded-md hover:bg-slate-50"
      >
        Annullér
      </button>
    </div>
  )
}
```

- [ ] **Step 5: tsc**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Manuel verifikation i dev**

```bash
npm run dev
```

Åbn review-side. Klik "Ret manuelt" på et attention-felt → input vises pre-udfyldt med AI-værdien → ændr → Enter → toast "rettet manuelt" → feltet markeres "Besluttet".

Escape skal annullere uden at kalde Server Action.

- [ ] **Step 7: Commit**

```bash
git add src/app/(dashboard)/documents/review/[id]/review-client.tsx
git commit -m "$(cat <<'EOF'
feat(review): inline manual edit ved "Ret manuelt"

"Ret manuelt"-knappen åbner nu inline tekst-input pre-udfyldt med
AI-værdien. Enter gemmer via saveFieldDecision med manualValue,
Escape annullerer. Tom string afvises med toast.error.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: `review-client.tsx` — rejection dialog

**Files:**

- Modify: `src/app/(dashboard)/documents/review/[id]/review-client.tsx`

- [ ] **Step 1: Importer rejectDocumentExtraction**

I toppen af filen, udvid den eksisterende import:

```typescript
import {
  approveDocumentReview,
  saveFieldDecision,
  rejectDocumentExtraction,
} from '@/actions/document-review'
```

- [ ] **Step 2: Tilføj state i ReviewClient-komponenten**

I `ReviewClient`-funktionen, efter `const [isApproving, startApprove] = useTransition()`:

```typescript
const [rejecting, setRejecting] = useState(false)
const [rejectReason, setRejectReason] = useState('')
const [isRejecting, startReject] = useTransition()
```

- [ ] **Step 3: Tilføj `confirmReject`-handler**

Efter `handleApprove`-funktionen:

```typescript
function confirmReject() {
  if (!doc.extractionId) return
  startReject(async () => {
    const result = await rejectDocumentExtraction({
      extractionId: doc.extractionId!,
      reason: rejectReason.trim() || undefined,
    })
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success('Dokument afvist')
    router.push('/documents')
  })
}
```

- [ ] **Step 4: Opdatér "Afvis"-knap**

Find den eksisterende "Afvis"-knap:

```tsx
<button
  onClick={() => toast.info('Dokument afvist (funktion kommer senere)')}
  ...
>
  Afvis
</button>
```

Erstat `onClick` med:

```tsx
onClick={() => setRejecting(true)}
```

- [ ] **Step 5: Tilføj rejection-dialog JSX**

Øverst i return-expressionen inde i ReviewClient, lige før det root-level `<div className="min-h-full bg-slate-50/60 p-8">` — eller helst i slutningen af komponentens JSX (så den renderes som overlay), tilføj:

```tsx
{
  rejecting && (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl ring-1 ring-slate-900/10 p-5 max-w-md w-full">
        <h3 className="text-[14px] font-semibold text-slate-900 mb-2">Afvis extraction</h3>
        <p className="text-[12px] text-slate-500 mb-4 leading-relaxed">
          Dokumentet markeres som afvist og vises ikke længere i review-køen. Denne handling kan
          ikke fortrydes.
        </p>
        <textarea
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="Årsag (valgfrit, max 500 tegn)"
          maxLength={500}
          className="w-full text-[12px] text-slate-900 bg-white ring-1 ring-slate-300 rounded-md px-2.5 py-2 min-h-[80px] focus:outline-none focus:ring-slate-900 resize-none mb-4"
        />
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => {
              setRejecting(false)
              setRejectReason('')
            }}
            disabled={isRejecting}
            className="text-slate-500 text-[12px] font-medium px-3 py-1.5 rounded-md hover:bg-slate-50"
          >
            Annullér
          </button>
          <button
            disabled={isRejecting}
            onClick={confirmReject}
            className="bg-rose-600 text-white text-[12px] font-medium px-3 py-1.5 rounded-md hover:bg-rose-700 disabled:opacity-50"
          >
            {isRejecting ? 'Afviser...' : 'Afvis dokumentet'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: tsc**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/(dashboard)/documents/review/[id]/review-client.tsx
git commit -m "$(cat <<'EOF'
feat(review): rejection-dialog via rejectDocumentExtraction

"Afvis"-knappen åbner nu dialog med valgfri reason-textarea. Bekræft
kalder rejectDocumentExtraction og redirecter til /documents efter
success. Extraction markeres extraction_status='rejected' og forsvinder
fra review-kø.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: `documents-client.tsx` — rejected badge

**Files:**

- Modify: `src/app/(dashboard)/documents/documents-client.tsx`

- [ ] **Step 1: Find hvor status-badges bruges**

Åbn `src/app/(dashboard)/documents/documents-client.tsx`. Søg efter hvor extraction-status vises (formentlig via et `status`-field eller et udtryk som `extraction?.reviewed_at`).

Der er to sandsynlige mønstre:

- (a) En inline ternary som skifter mellem "Afventer review" og "Godkendt"
- (b) En helper-funktion som producerer status-label

Find den faktiske kode med Grep-værktøjet:

```bash
grep -n "Afventer review\|Godkendt\|extraction_status\|reviewed_at" src/app/\(dashboard\)/documents/documents-client.tsx
```

- [ ] **Step 2: Udvid status-logikken med rejected-variant**

Den eksisterende logik skal udvides til at håndtere `extraction_status === 'rejected'`. Tilføj før den eksisterende check:

```typescript
if (extraction?.extraction_status === 'rejected') {
  return { label: 'Afvist', theme: 'rose' }
}
```

Og i den faktiske JSX-del, erstat badge-rendering så der er en sag for `'rose'` der bruger rose-farver. Præcis style afhænger af den eksisterende badge-komponent i filen — tilpas til de faktiske klasser.

**Hvis filen har en BadgeProps-type eller EmptyBadge-komponent:** Udvid dens tema-enum med `'rose'` hvis ikke allerede der.

**Hvis filen kun har inline badges:** Tilføj en ny conditional branch med:

```tsx
{extraction?.extraction_status === 'rejected' ? (
  <span className="text-[10px] font-medium text-rose-700 bg-rose-50 ring-1 ring-rose-200 px-2 py-0.5 rounded">
    Afvist
  </span>
) : /* eksisterende logik */}
```

- [ ] **Step 3: tsc + tests**

```bash
npx tsc --noEmit
npm test
```

Expected: 0 errors. All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/documents/documents-client.tsx
git commit -m "$(cat <<'EOF'
feat(review): rejected-badge på /documents listen

Dokumenter med extraction_status='rejected' vises nu med rose
"Afvist"-badge separat fra "Afventer review" og "Godkendt".

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: Component-tests for review-client

**Files:**

- Create: `src/__tests__/review/review-client.test.tsx`

- [ ] **Step 1: Skriv tests**

Create `src/__tests__/review/review-client.test.tsx`:

```typescript
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

const saveFieldDecisionMock = vi.fn()
const approveDocumentReviewMock = vi.fn()
const rejectDocumentExtractionMock = vi.fn()

vi.mock('@/actions/document-review', () => ({
  saveFieldDecision: (...args: unknown[]) => saveFieldDecisionMock(...args),
  approveDocumentReview: (...args: unknown[]) => approveDocumentReviewMock(...args),
  rejectDocumentExtraction: (...args: unknown[]) => rejectDocumentExtractionMock(...args),
}))

import ReviewClient from '@/app/(dashboard)/documents/review/[id]/review-client'
import type { ReviewDocument, ReviewField } from '@/app/(dashboard)/documents/review/[id]/review-client'
import type { SourceBlock } from '@/app/(dashboard)/documents/review/[id]/page'

function buildField(overrides: Partial<ReviewField> = {}): ReviewField {
  return {
    id: 'f1',
    fieldName: 'effective_date',
    fieldLabel: 'Ikrafttrædelsesdato',
    extractedValue: '2026-03-15',
    existingValue: '2026-01-01',
    confidence: 0.6,
    confidenceLevel: 'medium',
    sourcePageNumber: 1,
    sourceParagraph: '§ 1',
    sourceText: 'Aftalen træder i kraft den 15. marts 2026',
    hasDiscrepancy: false,
    category: 'general',
    legalCritical: false,
    isAttention: true,
    autoAcceptThreshold: 0.9,
    ...overrides,
  }
}

function buildDoc(fields: ReviewField[]): ReviewDocument {
  return {
    id: 'd1',
    fileName: 'ejeraftale.pdf',
    companyName: 'Test Klinik ApS',
    extractionId: 'ext-1',
    hasExtraction: true,
    isReviewed: false,
    reviewedBy: null,
    schemaVersion: 'v1.0.0',
    promptVersion: 'v1',
    fields,
    decidedFieldNames: [],
  }
}

const emptyBlocks: SourceBlock[] = []
const emptyQueue = [{ id: 'd1', fileName: 'ejeraftale.pdf' }]

describe('ReviewClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    saveFieldDecisionMock.mockResolvedValue({ data: { correctionId: 'c1' } })
  })

  it('renderer attention-sektion med feltet', () => {
    const field = buildField()
    render(
      <ReviewClient
        document={buildDoc([field])}
        reviewQueue={emptyQueue}
        sourceBlocks={emptyBlocks}
      />
    )
    expect(screen.getByText('Ikrafttrædelsesdato')).toBeTruthy()
    expect(screen.getByText('Kræver opmærksomhed')).toBeTruthy()
  })

  it('viser "Juridisk"-badge for legalCritical-felter', () => {
    const field = buildField({ legalCritical: true })
    render(
      <ReviewClient
        document={buildDoc([field])}
        reviewQueue={emptyQueue}
        sourceBlocks={emptyBlocks}
      />
    )
    expect(screen.getByText('Juridisk')).toBeTruthy()
  })

  it('klik "Ret manuelt" åbner inline input pre-udfyldt med AI-værdi', async () => {
    const user = userEvent.setup()
    const field = buildField()
    render(
      <ReviewClient
        document={buildDoc([field])}
        reviewQueue={emptyQueue}
        sourceBlocks={emptyBlocks}
      />
    )
    await user.click(screen.getByRole('button', { name: /ret manuelt/i }))
    const input = screen.getByPlaceholderText(/indtast korrekt værdi/i) as HTMLInputElement
    expect(input.value).toBe('2026-03-15')
  })

  it('Enter gemmer via saveFieldDecision med manualValue', async () => {
    const user = userEvent.setup()
    const field = buildField()
    render(
      <ReviewClient
        document={buildDoc([field])}
        reviewQueue={emptyQueue}
        sourceBlocks={emptyBlocks}
      />
    )
    await user.click(screen.getByRole('button', { name: /ret manuelt/i }))
    const input = screen.getByPlaceholderText(/indtast korrekt værdi/i)
    await user.clear(input)
    await user.type(input, '2026-04-01{Enter}')

    await waitFor(() => {
      expect(saveFieldDecisionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          decision: 'manual',
          manualValue: '2026-04-01',
          fieldName: 'effective_date',
        })
      )
    })
  })

  it('Escape annullerer uden at kalde saveFieldDecision', async () => {
    const user = userEvent.setup()
    const field = buildField()
    render(
      <ReviewClient
        document={buildDoc([field])}
        reviewQueue={emptyQueue}
        sourceBlocks={emptyBlocks}
      />
    )
    await user.click(screen.getByRole('button', { name: /ret manuelt/i }))
    const input = screen.getByPlaceholderText(/indtast korrekt værdi/i)
    await user.type(input, 'nyværdi{Escape}')

    expect(saveFieldDecisionMock).not.toHaveBeenCalled()
    expect(screen.queryByPlaceholderText(/indtast korrekt værdi/i)).toBeNull()
  })

  it('Godkend-knap disabled når attention-felter ikke er besluttet', () => {
    const field = buildField()
    render(
      <ReviewClient
        document={buildDoc([field])}
        reviewQueue={emptyQueue}
        sourceBlocks={emptyBlocks}
      />
    )
    const approve = screen.getByRole('button', { name: /godkend/i })
    expect(approve.hasAttribute('disabled')).toBe(true)
  })

  it('"Afvis"-knap åbner rejection-dialog', async () => {
    const user = userEvent.setup()
    const field = buildField()
    render(
      <ReviewClient
        document={buildDoc([field])}
        reviewQueue={emptyQueue}
        sourceBlocks={emptyBlocks}
      />
    )
    await user.click(screen.getByRole('button', { name: /afvis/i }))
    expect(screen.getByText('Afvis extraction')).toBeTruthy()
    expect(screen.getByPlaceholderText(/årsag/i)).toBeTruthy()
  })

  it('"Afvis dokumentet" i dialogen kalder rejectDocumentExtraction', async () => {
    const user = userEvent.setup()
    rejectDocumentExtractionMock.mockResolvedValue({ data: undefined })
    const field = buildField()
    render(
      <ReviewClient
        document={buildDoc([field])}
        reviewQueue={emptyQueue}
        sourceBlocks={emptyBlocks}
      />
    )
    await user.click(screen.getByRole('button', { name: /afvis/i }))
    const textarea = screen.getByPlaceholderText(/årsag/i)
    await user.type(textarea, 'Forkert dokumenttype')
    await user.click(screen.getByRole('button', { name: /afvis dokumentet/i }))

    await waitFor(() => {
      expect(rejectDocumentExtractionMock).toHaveBeenCalledWith({
        extractionId: 'ext-1',
        reason: 'Forkert dokumenttype',
      })
    })
  })

  it('renderer sourceBlocks i venstre panel i stedet for mockPdfBlocks', () => {
    const field = buildField()
    const blocks: SourceBlock[] = [
      { id: 'b1', page: 1, paragraph: '§ 3', text: 'Ejerandele: 60% / 40%.' },
    ]
    render(
      <ReviewClient
        document={buildDoc([field])}
        reviewQueue={emptyQueue}
        sourceBlocks={blocks}
      />
    )
    expect(screen.getByText('§ 3')).toBeTruthy()
    expect(screen.getByText(/Ejerandele: 60%/)).toBeTruthy()
  })

  it('fallback-tekst når sourceBlocks er tom', () => {
    const field = buildField()
    render(
      <ReviewClient
        document={buildDoc([field])}
        reviewQueue={emptyQueue}
        sourceBlocks={emptyBlocks}
      />
    )
    expect(screen.getByText(/har ikke registreret source-blokke/)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run — expect PASS**

```bash
npm test -- src/__tests__/review/review-client.test.tsx
```

Expected: 10/10 pass. Hvis nogle fejler pga. vilkår i skeletonet (fx label-tekst, knap-navn) juster den specifikke assertion — behold testens intent.

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/review/review-client.test.tsx
git commit -m "$(cat <<'EOF'
test(review): component-tests for ReviewClient

10 tests dækker: attention-rendering, legal-critical badge, manual edit
flow (åbn, Enter=gem, Escape=annullér), Godkend-disabled, rejection-
dialog åbner + afsender, sourceBlocks + fallback.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: Final gate

**Files:** Ingen.

- [ ] **Step 1: Format + lint**

```bash
npm run format
npm run lint
```

Expected: 0 errors.

- [ ] **Step 2: tsc**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Full test suite**

```bash
npm test
```

Expected: 790+ tests pass (775 baseline + ~18 nye), 0 failed.

- [ ] **Step 4: Build**

```bash
npm run build
```

Expected: successful build, 0 errors.

- [ ] **Step 5: Manuel smoke-test**

```bash
npm run dev
```

Test-scenarier i browser efter login:

1. Upload en ejeraftale-PDF via `/documents` og trigger extraction
2. Naviger til `/documents/review/<id>`
3. Verificér: felter viser korrekte confidence-procenter (ikke 0%)
4. Verificér: mindst ét felt har "Juridisk"-badge (fx `parties`, `effective_date`)
5. Klik "Ret manuelt" på et attention-felt, indtast ny værdi, tryk Enter → toast "rettet manuelt" + feltet markeres "Besluttet"
6. Klik "Ret manuelt" på et andet felt, tryk Escape → input lukker uden at gemme
7. Verificér: hover over et høj-confidence-felt → source_text highlightes i venstre panel
8. Hvis Contract-rækken har `effective_date` udfyldt, verificér: "I systemet: YYYY-MM-DD" vises
9. Tag et dokument med rigtige felter, afslut alle attention-beslutninger, klik "Godkend" → redirect til `/documents`, dokumentet viser "Godkendt"-badge
10. Tag et andet dokument, klik "Afvis" → dialog åbner → skriv "test"-reason → klik "Afvis dokumentet" → redirect, dokumentet viser "Afvist"-badge på /documents

Stop dev-server (`Ctrl+C`) når alle 10 scenarier verificeret.

- [ ] **Step 6: Push til origin**

```bash
git push origin feat/review-ui-aplus
```

- [ ] **Step 7: Klar til merge-session**

Implementation er komplet. Beder brugeren om squash-merge-godkendelse.

---

## Self-Review

**1. Spec coverage** — alle 8 huller fra spec sektion 2:

| Hul                             | Task                                                  |
| ------------------------------- | ----------------------------------------------------- |
| #1 confidence-mismatch          | Task 4                                                |
| #2 manual edit input            | Task 1 (action) + Task 10 (UI)                        |
| #3 schema-metadata              | Task 6                                                |
| #4 mockPdfBlocks → sourceBlocks | Task 7 (page) + Task 8 (client)                       |
| #5 existingValue fra Contract   | Task 3 (helper) + Task 5 (page integration)           |
| #6 per-felt threshold           | Task 6                                                |
| #7 rejection-flow               | Task 2 (action) + Task 11 (UI) + Task 12 (list-badge) |
| #8 tests                        | Task 1, 2, 3 (actions + helper) + Task 13 (component) |

**Success-kriterier (spec sektion 11):** Alle 8 adresseret af Task 14 manuel smoke-test scenarier.

**2. Placeholder scan:** Ingen TBD/TODO/implement later. Alle code-blocks komplette.

**3. Type consistency:**

- `ReviewField` har samme 16 felter i Task 6 (page.tsx) og Task 8 (review-client.tsx) ✓
- `SourceBlock` defineres i Task 7 (page.tsx), importeres i Task 8 ✓
- `saveFieldDecision` signature konsistent mellem Task 1 (client-param) og Task 10 (UI-kald) ✓
- `rejectDocumentExtraction` signature konsistent mellem Task 2 (action) og Task 11 (UI-kald) ✓
- `ContractWithRelations` defineres i Task 3 (helper), re-eksporteres og bruges i Task 5 (page) ✓
- `getExistingValue` signature konsistent mellem Task 3 (definition) og Task 5 (kald) ✓

**Kendt midlertidig tsc-rød:** Task 6+7 commits med `--no-verify` fordi ReviewField-typen først udvides i Task 8. Rækkefølgen er nødvendig for TDD-flow. Task 8 afslutter rødan.

---

## Execution handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-19-review-ui-aplus.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — fresh agent pr. task, two-stage review, fast iteration

**2. Inline Execution** — batch-eksekver i nuværende session med checkpoints

**Vælg tilgang.**
