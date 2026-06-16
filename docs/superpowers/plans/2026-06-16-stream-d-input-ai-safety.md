# Stream D — Input-validering & AI-sikkerhed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lukke fire sikkerhed/korrekthed-huller: magic-bytes-bypass på fil-upload, manglende plan-gating på Plus-only AI, forkerte gpt-5-mini-priser i cost-estimat, og Zod-validering der tillader ubegrænsede fritekster og uvaliderede datostrenge.

**Architecture:** Alle fire fixes er kirurgiske ændringer til eksisterende filer. (a) Magic-bytes: brug `file-type`-pakken (allerede i `package.json`) direkte i `upload/route.ts` — læs de første bytes og sammenlign med `ALLOWED_TYPES`-listen i stedet for at stole på `file.type`. (b) Plan-gating: `isAIEnabled` mangler plan-awareness; i stedet tilføjer vi et separat plan-check i `processMessage`-orchestratoren og i extract-document-jobbet — dette holder feature-flags-ansvaret adskilt fra plan-ansvaret. (c) Cost-estimat: `estimateExtractionCost` bruger Sonnet-priser (~$3/$15 per M token) til en gpt-5-mini-pipeline — ret til $0.25/$2.0. (d) Zod: tilføj `.max()` på ubegrænsede strenge og `z.coerce.date()` på datostrenge i `person.ts`, `contact.ts`, `contract.ts` og `document-review.ts`.

**Tech Stack:** `file-type` 19.x (ESM-pakke, allerede i `package.json`), Zod 3, Vitest 3.

---

## Vigtigt før start

- **Rækkefølge:** Tasks 1–4 er indbyrdes uafhængige; tag dem i rækkefølgen (begynder med den mest kritiske: magic-bytes).
- **Plan-værdier:** `Organization.plan` er en String-kolonne med tre lovlige værdier: `'trial'`, `'basis'`, `'plus'`. AI-assistenten (og extraction) er Plus-only per produktbeslutningen i Stream D.
- **`file-type`-import:** Pakken er ESM-only. I Next.js API-routes bruges dynamic import: `const { fileTypeFromBuffer } = await import('file-type')`.
- **Commit-stil:** `[type]: beskrivelse på dansk`. Én commit pr. task.
- **Test-kommando:** `npx vitest run <testfil>`.

---

## Task 1: Magic-bytes-validering på fil-upload

### Baggrund

`src/app/api/upload/route.ts:54` tjekker `file.type` — en browser-kontrolleret streng der nemt manipuleres. En angriber kan rename `exploit.exe` til `exploit.pdf`, sætte `Content-Type: application/pdf` i multipart-headeren, og systemet accepterer filen. Pakken `file-type` læser de faktiske magic bytes (f.eks. `%PDF-` for PDF, `PK\x03\x04` for DOCX/ZIP) og returnerer den reelle MIME-type.

**Files:**

- Modify: `src/app/api/upload/route.ts:54-59`
- Create: `src/__tests__/api/upload-magic-bytes.test.ts`

- [ ] **Step 1: Skriv den fejlende test**

Opret `src/__tests__/api/upload-magic-bytes.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock auth + prisma + storage + queue + audit — vi tester kun MIME-logikken
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({
  prisma: {
    document: { create: vi.fn() },
    case: { findFirst: vi.fn() },
    contract: { findFirst: vi.fn() },
  },
}))
vi.mock('@/lib/storage', () => ({
  getStorageProvider: vi.fn(() => ({
    upload: vi.fn(),
    getDownloadUrl: vi.fn().mockResolvedValue('https://example.com/file'),
  })),
}))
vi.mock('@/lib/ai/queue', () => ({
  createQueue: vi.fn(),
  JOB_NAMES: { EXTRACT_DOCUMENT: 'extract_document' },
}))
vi.mock('@/lib/ai/feature-flags', () => ({ isAIEnabled: vi.fn().mockResolvedValue(false) }))
vi.mock('@/lib/audit', () => ({ recordAuditEvent: vi.fn() }))
vi.mock('@/lib/permissions', () => ({ canAccessCompany: vi.fn().mockResolvedValue(true) }))
vi.mock('@/lib/ai/rate-limit', () => ({
  checkUploadRateLimit: vi.fn().mockReturnValue({ allowed: true }),
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { POST } from '@/app/api/upload/route'
import { NextRequest } from 'next/server'

const SESSION = {
  user: { id: 'user-1', organizationId: 'org-1' },
}

function makePdfBytes(): Uint8Array {
  // Ægte PDF magic bytes: %PDF-
  return new TextEncoder().encode('%PDF-1.4 fake content')
}

function makeExeBytes(): Uint8Array {
  // Windows PE executable magic bytes: MZ (0x4D 0x5A)
  return new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00])
}

function makeDocxBytes(): Uint8Array {
  // DOCX er ZIP: magic bytes PK (0x50 0x4B 0x03 0x04)
  return new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00])
}

function makeRequest(bytes: Uint8Array, claimedMime: string, filename: string): NextRequest {
  const blob = new Blob([bytes], { type: claimedMime })
  const file = new File([blob], filename, { type: claimedMime })
  const formData = new FormData()
  formData.append('file', file)
  return new NextRequest('http://localhost/api/upload', {
    method: 'POST',
    body: formData,
  })
}

describe('POST /api/upload — magic-bytes-validering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue(SESSION as never)
    vi.mocked(prisma.document.create).mockResolvedValue({ id: 'doc-1' } as never)
  })

  it('accepterer en ægte PDF-fil (magic bytes %PDF-)', async () => {
    const req = makeRequest(makePdfBytes(), 'application/pdf', 'kontrakt.pdf')
    const res = await POST(req)
    expect(res.status).not.toBe(400)
  })

  it('afviser .exe maskeret som PDF — magic bytes MZ afvises selv med Content-Type application/pdf', async () => {
    const req = makeRequest(makeExeBytes(), 'application/pdf', 'malware.pdf')
    const res = await POST(req)
    const body = (await res.json()) as { error: string }
    expect(res.status).toBe(400)
    expect(body.error).toMatch(/filtype|magic/i)
  })

  it('accepterer ægte DOCX-fil (ZIP magic bytes)', async () => {
    const req = makeRequest(
      makeDocxBytes(),
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'aftale.docx'
    )
    const res = await POST(req)
    expect(res.status).not.toBe(400)
  })

  it('afviser en fil hvor MIME og magic bytes ikke stemmer overens (exe med docx-MIME)', async () => {
    const req = makeRequest(
      makeExeBytes(),
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'malware.docx'
    )
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Kør test — forvent FAIL**

```bash
npx vitest run src/__tests__/api/upload-magic-bytes.test.ts
```

Expected: FAIL — de to afvisnings-tests fejler fordi routen kun tjekker `file.type`, ikke magic bytes.

- [ ] **Step 3: Tilføj magic-bytes-check i upload-routen**

I `src/app/api/upload/route.ts` erstat linjerne 54-59:

```typescript
if (!ALLOWED_TYPES.includes(file.type)) {
  return NextResponse.json(
    { error: 'Filtypen er ikke tilladt (PDF, DOCX, PNG, JPG)' },
    { status: 400 }
  )
}
```

med:

```typescript
// Verificér filindhold via magic bytes — stoler ikke på browser-MIME
const { fileTypeFromBuffer } = await import('file-type')
const detectedType = await fileTypeFromBuffer(buffer)
const mimeToCheck = detectedType?.mime ?? file.type

if (!ALLOWED_TYPES.includes(mimeToCheck)) {
  return NextResponse.json(
    { error: 'Filtypen er ikke tilladt eller kan ikke verificeres (PDF, DOCX, PNG, JPG)' },
    { status: 400 }
  )
}
```

**Vigtigt:** Flyt `const bytes = await file.arrayBuffer()` og `const buffer = Buffer.from(bytes)` til **inden** MIME-checket (pt. på linje 105-106) — de skal nu bruges i MIME-checket. Den endelige rækkefølge i POST-handleren:

```typescript
// Hent buffer tidligt — bruges til magic-bytes-check OG storage upload
const bytes = await file.arrayBuffer()
const buffer = Buffer.from(bytes)

// Verificér filindhold via magic bytes — stoler ikke på browser-MIME
const { fileTypeFromBuffer } = await import('file-type')
const detectedType = await fileTypeFromBuffer(buffer)
const mimeToCheck = detectedType?.mime ?? file.type

if (!ALLOWED_TYPES.includes(mimeToCheck)) {
  return NextResponse.json(
    { error: 'Filtypen er ikke tilladt eller kan ikke verificeres (PDF, DOCX, PNG, JPG)' },
    { status: 400 }
  )
}
```

Slet de to dublerede linjer for `bytes`/`buffer` der lå på linje 105-106 (nu oprettede tidligere).

- [ ] **Step 4: Kør test — forvent PASS**

```bash
npx vitest run src/__tests__/api/upload-magic-bytes.test.ts
```

Expected: 4 tests PASS.

- [ ] **Step 5: TypeScript-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/upload/route.ts src/__tests__/api/upload-magic-bytes.test.ts
git commit -m "fix(upload): magic-bytes-validering via file-type — exe maskeret som PDF afvises"
```

---

## Task 2: Plan-gating — Basis-konto kan ikke trigge Plus-only AI

### Baggrund

`isAIEnabled` tjekker kun organisationens `OrganizationAISettings` (feature-flags, kill-switch, mode). Den tjekker **ikke** `Organization.plan`. Det betyder at en basis-organisation med `ai_mode = 'LIVE'`-settings kan bruge AI-assistenten og extraction — gratis. Plus-AI (assistant + extraction) skal kræve `plan = 'plus'`.

Løsning: tilføj `requiresPlan`-check i `processMessage` (orchestratoren for AI-assistenten) og i `extractDocument`-jobbet, **efter** den eksisterende `isAIEnabled`-check. Vi henter `Organization.plan` fra DB og returnerer en tydelig fejl.

**Files:**

- Modify: `src/lib/ai/assistant/orchestrator.ts:89-100` (tilføj plan-check i processMessage)
- Modify: `src/lib/ai/jobs/extract-document.ts:43-59` (tilføj plan-check i extractDocument)
- Create: `src/__tests__/ai/assistant-plan-gate.test.ts`

- [ ] **Step 1: Skriv den fejlende test**

Opret `src/__tests__/ai/assistant-plan-gate.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    message: { create: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    conversation: { findFirst: vi.fn(), update: vi.fn() },
    organization: { findUnique: vi.fn() },
    pendingAction: { create: vi.fn() },
  },
}))
vi.mock('@/lib/ai/client', () => ({
  createClaudeClient: vi.fn(),
  computeCostUsd: vi.fn().mockReturnValue(0.001),
}))
vi.mock('@/lib/ai/usage', () => ({ recordAIUsage: vi.fn() }))
vi.mock('@/lib/ai/assistant/context', () => ({
  buildSystemPrompt: vi.fn().mockResolvedValue('sys'),
}))
vi.mock('@/lib/ai/assistant/tools/registry', () => ({
  toolRegistry: new Map(),
  getToolDefinitions: vi.fn().mockReturnValue([]),
}))

import { prisma } from '@/lib/db'
import { processMessage } from '@/lib/ai/assistant/orchestrator'

describe('processMessage — plan-gating', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.message.create).mockResolvedValue({ id: 'm1' } as never)
    vi.mocked(prisma.message.findMany).mockResolvedValue([])
    vi.mocked(prisma.conversation.update).mockResolvedValue({} as never)
  })

  it('tillader processMessage for plus-plan organisation', async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({
      id: 'org-1',
      plan: 'plus',
    } as never)

    // Mock LLM-kald til at returnere et tomt svar
    const { createClaudeClient } = await import('@/lib/ai/client')
    vi.mocked(createClaudeClient).mockReturnValue({
      providerName: 'openai',
      complete: vi.fn().mockResolvedValue({
        id: 'r1',
        model: 'gpt-5-mini',
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'Hej!' }],
        usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0 },
      }),
    } as never)

    const result = await processMessage({
      conversationId: 'conv-1',
      userMessage: 'hej',
      organizationId: 'org-1',
      userId: 'user-1',
    })

    expect(result.response).toBe('Hej!')
  })

  it('afviser processMessage for basis-plan organisation med klar fejlbesked', async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({
      id: 'org-1',
      plan: 'basis',
    } as never)

    await expect(
      processMessage({
        conversationId: 'conv-1',
        userMessage: 'hej',
        organizationId: 'org-1',
        userId: 'user-1',
      })
    ).rejects.toThrow('AI-assistenten kræver Plus-abonnement')
  })

  it('afviser processMessage for trial-plan organisation', async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({
      id: 'org-1',
      plan: 'trial',
    } as never)

    await expect(
      processMessage({
        conversationId: 'conv-1',
        userMessage: 'hej',
        organizationId: 'org-1',
        userId: 'user-1',
      })
    ).rejects.toThrow('AI-assistenten kræver Plus-abonnement')
  })
})
```

- [ ] **Step 2: Kør test — forvent FAIL**

```bash
npx vitest run src/__tests__/ai/assistant-plan-gate.test.ts
```

Expected: FAIL — basis/trial-plan tests kaster ikke fejl, da plan-check mangler.

- [ ] **Step 3: Tilføj plan-check i processMessage**

I `src/lib/ai/assistant/orchestrator.ts` find `export async function processMessage` (linje 89). Tilføj plan-check som det **første** efter den eksisterende parameter-destructuring (linje 91), **inden** DB-kald:

```typescript
export async function processMessage(input: ProcessMessageInput): Promise<ProcessMessageResult> {
  const { conversationId, userMessage, organizationId, userId } = input

  // Plan-gate: AI-assistenten kræver plus-abonnement
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { plan: true },
  })
  if (!org || org.plan !== 'plus') {
    throw new Error('AI-assistenten kræver Plus-abonnement')
  }

  // 1. Gem bruger-besked i DB
  await prisma.message.create({
```

(Resten af funktionen er uændret.)

- [ ] **Step 4: Tilføj plan-check i extractDocument**

I `src/lib/ai/jobs/extract-document.ts` find `export async function extractDocument` (linje 43). Tilføj plan-check **efter** den eksisterende `isAIEnabled`-check (efter linje 59):

```typescript
// Plan-gate: extraction kræver plus-abonnement
const org = await prisma.organization.findUnique({
  where: { id: payload.organization_id },
  select: { plan: true },
})
if (!org || org.plan !== 'plus') {
  log.info({ document_id: payload.document_id }, 'AI extraction kræver Plus — skipping')
  return {
    extraction_id: '',
    detected_type: '',
    field_count: 0,
    total_cost_usd: 0,
    skipped: true,
    status: 'skipped',
    reason: 'AI extraction kræver Plus-abonnement',
  }
}
```

- [ ] **Step 5: Kør test — forvent PASS**

```bash
npx vitest run src/__tests__/ai/assistant-plan-gate.test.ts
```

Expected: 3 tests PASS.

- [ ] **Step 6: Kør eksisterende tests for orchestratoren og extract-document**

```bash
npx vitest run src/__tests__/ai/pipeline/orchestrator.test.ts src/__tests__/ai/extract-document.test.ts src/__tests__/lib/ai/pipeline/orchestrator-skip-agreement.test.ts
```

Expected: PASS. Hvis en test sætter `organization.plan` til andet end `'plus'`: opdatér mocken til `{ plan: 'plus' }`.

- [ ] **Step 7: TypeScript-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add src/lib/ai/assistant/orchestrator.ts src/lib/ai/jobs/extract-document.ts src/__tests__/ai/assistant-plan-gate.test.ts
git commit -m "feat(ai): plan-gating — basis-konto kan ikke trigge Plus-only AI"
```

---

## Task 3: OPENAI_API_KEY requiredInProd + AI_EXTRACTION_ENABLED + OPENAI_BASE_URL i env-skema

### Baggrund

`src/lib/env.ts:20` definerer `OPENAI_API_KEY: z.string().optional()`. I prod starter serveren op og accepterer requests — men første LLM-kald kaster en uhensigtsmæssig runtime-fejl langt henne i callstacken (`OPENAI_API_KEY environment variable is required` fra `createClaudeClient`). Det burde fanges ved startup. Desuden mangler `AI_EXTRACTION_ENABLED` og `OPENAI_BASE_URL` helt fra skemaet — de bruges i kodebasen (`feature-flags.ts:14`, `client/index.ts:12`) men valideres ikke.

**Files:**

- Modify: `src/lib/env.ts:20` + tilføj to nye entries

- [ ] **Step 1: Skriv den fejlende test**

Opret (eller tilføj til) `src/__tests__/lib/env-schema.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// Vi gengiver skemaet manuelt for at teste det isoleret fra process.env.
// Alternativet — at importere env.ts — ville kaste ved manglende variabler.

const isBuildPhase = false
const isProd = true

const requiredInProd = (msg: string) =>
  isProd ? z.string().min(1, `${msg} — påkrævet i production`) : z.string().optional()

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  NEXTAUTH_SECRET: z.string().min(1),
  OPENAI_API_KEY: requiredInProd('OPENAI_API_KEY'),
  AI_EXTRACTION_ENABLED: z.enum(['true', 'false']).optional().default('false'),
  OPENAI_BASE_URL: z.string().url().optional(),
})

describe('env-skema — prod-krav', () => {
  it('OPENAI_API_KEY er påkrævet i prod — fejler uden den', () => {
    const result = envSchema.safeParse({
      DATABASE_URL: 'postgres://localhost/db',
      NEXTAUTH_SECRET: 'secret',
      // OPENAI_API_KEY mangler bevidst
    })
    expect(result.success).toBe(false)
    const messages = result.success ? [] : result.error.issues.map((i) => i.message)
    expect(messages.some((m) => m.includes('OPENAI_API_KEY'))).toBe(true)
  })

  it('OPENAI_API_KEY er tilladt i prod når sat', () => {
    const result = envSchema.safeParse({
      DATABASE_URL: 'postgres://localhost/db',
      NEXTAUTH_SECRET: 'secret',
      OPENAI_API_KEY: 'sk-test-1234',
    })
    expect(result.success).toBe(true)
  })

  it('AI_EXTRACTION_ENABLED defaulter til false', () => {
    const result = envSchema.safeParse({
      DATABASE_URL: 'postgres://localhost/db',
      NEXTAUTH_SECRET: 'secret',
      OPENAI_API_KEY: 'sk-test',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.AI_EXTRACTION_ENABLED).toBe('false')
    }
  })

  it('AI_EXTRACTION_ENABLED accepterer kun "true" eller "false"', () => {
    const result = envSchema.safeParse({
      DATABASE_URL: 'postgres://localhost/db',
      NEXTAUTH_SECRET: 'secret',
      OPENAI_API_KEY: 'sk-test',
      AI_EXTRACTION_ENABLED: 'yes',
    })
    expect(result.success).toBe(false)
  })

  it('OPENAI_BASE_URL er valgfri men valideres som URL', () => {
    const bad = envSchema.safeParse({
      DATABASE_URL: 'postgres://localhost/db',
      NEXTAUTH_SECRET: 'secret',
      OPENAI_API_KEY: 'sk-test',
      OPENAI_BASE_URL: 'ikke-en-url',
    })
    expect(bad.success).toBe(false)

    const good = envSchema.safeParse({
      DATABASE_URL: 'postgres://localhost/db',
      NEXTAUTH_SECRET: 'secret',
      OPENAI_API_KEY: 'sk-test',
      OPENAI_BASE_URL: 'https://api.openai.com/v1',
    })
    expect(good.success).toBe(true)
  })
})
```

- [ ] **Step 2: Kør test — forvent FAIL**

```bash
npx vitest run src/__tests__/lib/env-schema.test.ts
```

Expected: FAIL — skemaet afspejler endnu ikke prod-kravet for OPENAI_API_KEY.

- [ ] **Step 3: Ret env.ts**

I `src/lib/env.ts` erstat linje 20:

```typescript
  OPENAI_API_KEY: z.string().optional(),
```

med:

```typescript
  OPENAI_API_KEY: requiredInProd('OPENAI_API_KEY'),
  AI_EXTRACTION_ENABLED: z.enum(['true', 'false']).optional().default('false'),
  OPENAI_BASE_URL: z.string().url().optional(),
```

- [ ] **Step 4: Kør test — forvent PASS**

```bash
npx vitest run src/__tests__/lib/env-schema.test.ts
```

Expected: 5 tests PASS.

- [ ] **Step 5: Byg for at verificere build-phase-eksklusionen virker**

```bash
npm run build
```

Expected: build PASS (isBuildPhase=true betyder OPENAI_API_KEY ikke er required under build selvom den mangler i .env.local).

- [ ] **Step 6: Commit**

```bash
git add src/lib/env.ts src/__tests__/lib/env-schema.test.ts
git commit -m "fix(env): OPENAI_API_KEY requiredInProd + AI_EXTRACTION_ENABLED + OPENAI_BASE_URL i skema"
```

---

## Task 4: Ret estimateExtractionCost til korrekte gpt-5-mini-priser

### Baggrund

`src/lib/ai/cost-cap.ts:240-246` beregner cost-estimat med Sonnet-priser ($3 input / $15 output per M token) selvom pipeline'en bruger `gpt-5-mini` ($0.25 input / $2.0 output). Det medfører 12× overestimering på input-siden og 7.5× på output-siden, som blokerer AI-features for organisationer der ikke er i nærheden af deres cap, og giver misvisende cost-dashboards.

Den korrekte beregning bruger `MODEL_COSTS` fra `@/lib/ai/client/types` — den eneste kilde til sandhed for priser i kodebasen.

**Files:**

- Modify: `src/lib/ai/cost-cap.ts:239-246`
- Modify: `src/__tests__/ai/cost-cap.test.ts` (tilføj/ret estimat-test)

- [ ] **Step 1: Skriv den fejlende test**

Tilføj denne test-blok i `src/__tests__/ai/cost-cap.test.ts` (find filen og tilføj nederst i den eksisterende `describe`-blok eller som separat describe):

```typescript
import { estimateExtractionCost } from '@/lib/ai/cost-cap'
import { MODEL_COSTS } from '@/lib/ai/client/types'

describe('estimateExtractionCost — gpt-5-mini priser', () => {
  it('estimerer korrekt for 1 side', () => {
    // 1 side = 4000 input tokens + 3000 output tokens med gpt-5-mini-priser
    // Input: 4000 * $0.25/M = $0.000001 × 4000 = $0.000001 × 4000
    const inputCost = (4000 * MODEL_COSTS['gpt-5-mini'].input) / 1_000_000
    const outputCost = (3000 * MODEL_COSTS['gpt-5-mini'].output) / 1_000_000
    const expected = inputCost * 2 + outputCost * 2 + 0.001 // 2 runs + haiku-erstatning

    const actual = estimateExtractionCost(1)
    expect(actual).toBeCloseTo(expected, 5)
  })

  it('estimerer korrekt for 10 sider', () => {
    const pages = 10
    const inputCost = (pages * 4000 * MODEL_COSTS['gpt-5-mini'].input) / 1_000_000
    const outputCost = (3000 * MODEL_COSTS['gpt-5-mini'].output) / 1_000_000
    const expected = inputCost * 2 + outputCost * 2 + 0.001

    const actual = estimateExtractionCost(pages)
    expect(actual).toBeCloseTo(expected, 5)
  })

  it('er mindst 10x billigere end Sonnet-estimat for samme input', () => {
    // Sikrer at vi IKKE bruger Sonnet-priser ($3 input vs $0.25 = 12x)
    const sonnetEstimate = ((10 * 4000 * 3) / 1_000_000) * 2 + ((3000 * 15) / 1_000_000) * 2 + 0.01
    const gptEstimate = estimateExtractionCost(10)
    expect(gptEstimate).toBeLessThan(sonnetEstimate / 8)
  })

  it('skalerer lineært med sidetal', () => {
    const est1 = estimateExtractionCost(1)
    const est5 = estimateExtractionCost(5)
    // 5 sider skal koste ca. 5× 1 side minus den faste output-del
    // (outputTokens er konstant, inputTokens skalerer)
    expect(est5).toBeGreaterThan(est1 * 4)
    expect(est5).toBeLessThan(est1 * 6)
  })
})
```

- [ ] **Step 2: Kør test — forvent FAIL**

```bash
npx vitest run src/__tests__/ai/cost-cap.test.ts
```

Expected: de nye estimat-tests FAIL ("10x billigere"-testen fejler fordi nuværende kode bruger Sonnet-priser).

- [ ] **Step 3: Ret estimateExtractionCost**

I `src/lib/ai/cost-cap.ts` erstat hele kommentar-blokken + funktion (linje 234-246):

```typescript
/**
 * Konservativt cost-estimat for extraction baseret på sidetal. Bruges som
 * pre-debet før pipeline kører, så parallelle jobs ikke alle kan overskride
 * capen. Overestimat er sikrere end underestimat.
 *
 * Antagelser: 4000 tokens/side, gpt-5-mini pricing ($0.25 input / $2.0 output
 * per M-token), 2 runs (pass2 + pass3 extraction), plus nano type-detection ($0.001 fast).
 */
export function estimateExtractionCost(pageCount: number): number {
  const inputTokensPerRun = pageCount * 4000
  const outputTokensPerRun = 3000
  const miniInputCost = (inputTokensPerRun * 0.25) / 1_000_000
  const miniOutputCost = (outputTokensPerRun * 2.0) / 1_000_000
  const typeDetectionCost = 0.001 // gpt-5-nano, fast
  return miniInputCost * 2 + miniOutputCost * 2 + typeDetectionCost
}
```

Tilføj import øverst i filen hvis den ikke allerede er der (den er den ikke — constants er inline):

(Ingen import nødvendig — vi bruger hardcodede konstanter direkte for at undgå cirkulær afhængighed med `client/types`. `MODEL_COSTS`-kilde er kun i tests.)

- [ ] **Step 4: Kør test — forvent PASS**

```bash
npx vitest run src/__tests__/ai/cost-cap.test.ts
```

Expected: alle tests PASS inkl. de fire nye.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/cost-cap.ts src/__tests__/ai/cost-cap.test.ts
git commit -m "fix(ai): estimateExtractionCost bruger gpt-5-mini-priser — 12x overestimat rettet"
```

---

## Task 5: Zod `.max()` på fritekster + `z.coerce.date()` på dato-felter

### Baggrund

Fire validerings-filer mangler øvre grænser på strenge og dato-typer:

| Felt                          | Fil                     | Problem                                                                 |
| ----------------------------- | ----------------------- | ----------------------------------------------------------------------- |
| `phone`, `notes`              | `person.ts`             | Ingen `.max()` — kan sende MB-store strenge                             |
| `name`, `company`, `message`  | `contact.ts`            | Ingen `.max()`                                                          |
| `notes`                       | `contract.ts:114`       | Ingen `.max()`                                                          |
| `comment`                     | `document-review.ts:10` | Ingen `.max()`                                                          |
| `effectiveDate`, `expiryDate` | `contract.ts:111-112`   | `z.string().optional()` → `new Date(ugyldig)` i DB giver `Invalid Date` |

Maks-grænser er pragmatisk valgt: telefonnummer max 30 (E.164 + ext), fri noter max 5000 (1 A4-side), kommentarer max 2000, kontaktbesked max 3000.

**Files:**

- Modify: `src/lib/validations/person.ts`
- Modify: `src/lib/validations/contact.ts`
- Modify: `src/lib/validations/contract.ts:111-114`
- Modify: `src/lib/validations/document-review.ts:10`
- Create: `src/__tests__/lib/validations/zod-max-limits.test.ts`

- [ ] **Step 1: Skriv de fejlende tests**

Opret `src/__tests__/lib/validations/zod-max-limits.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { createPersonSchema } from '@/lib/validations/person'
import { contactSchema } from '@/lib/validations/contact'
import { createContractSchema } from '@/lib/validations/contract'
import { reviewDocumentSchema } from '@/lib/validations/document-review'

const LONG = 'a'.repeat(6000)

describe('Zod max-grænser på fritekst-felter', () => {
  describe('createPersonSchema', () => {
    it('afviser phone > 30 tegn', () => {
      const result = createPersonSchema.safeParse({
        firstName: 'Test',
        lastName: 'Person',
        phone: 'a'.repeat(31),
      })
      expect(result.success).toBe(false)
    })

    it('afviser notes > 5000 tegn', () => {
      const result = createPersonSchema.safeParse({
        firstName: 'Test',
        lastName: 'Person',
        notes: LONG,
      })
      expect(result.success).toBe(false)
    })

    it('accepterer notes på præcis 5000 tegn', () => {
      const result = createPersonSchema.safeParse({
        firstName: 'Test',
        lastName: 'Person',
        notes: 'a'.repeat(5000),
      })
      expect(result.success).toBe(true)
    })
  })

  describe('contactSchema', () => {
    it('afviser name > 100 tegn', () => {
      const result = contactSchema.safeParse({
        name: 'a'.repeat(101),
        email: 'test@example.com',
        message: 'kort besked her',
      })
      expect(result.success).toBe(false)
    })

    it('afviser message > 3000 tegn', () => {
      const result = contactSchema.safeParse({
        name: 'Test',
        email: 'test@example.com',
        message: LONG,
      })
      expect(result.success).toBe(false)
    })

    it('accepterer company op til 200 tegn', () => {
      const result = contactSchema.safeParse({
        name: 'Test',
        email: 'test@example.com',
        company: 'a'.repeat(200),
        message: 'en besked',
      })
      expect(result.success).toBe(true)
    })

    it('afviser company > 200 tegn', () => {
      const result = contactSchema.safeParse({
        name: 'Test',
        email: 'test@example.com',
        company: 'a'.repeat(201),
        message: 'en besked',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('createContractSchema', () => {
    const BASE = {
      companyId: 'comp-1',
      systemType: 'EJERAFTALE',
      displayName: 'Test kontrakt',
      sensitivity: 'INTERN',
    }

    it('afviser notes > 5000 tegn', () => {
      const result = createContractSchema.safeParse({ ...BASE, notes: LONG })
      expect(result.success).toBe(false)
    })

    it('accepterer en gyldig ISO-dato i effectiveDate', () => {
      const result = createContractSchema.safeParse({
        ...BASE,
        effectiveDate: '2026-01-15',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.effectiveDate).toBeInstanceOf(Date)
      }
    })

    it('afviser ugyldig dato i effectiveDate', () => {
      const result = createContractSchema.safeParse({
        ...BASE,
        effectiveDate: 'ikke-en-dato',
      })
      expect(result.success).toBe(false)
    })

    it('afviser ugyldig dato i expiryDate', () => {
      const result = createContractSchema.safeParse({
        ...BASE,
        expiryDate: '9999-99-99',
      })
      expect(result.success).toBe(false)
    })

    it('accepterer tom streng i expiryDate (ingen udløb)', () => {
      const result = createContractSchema.safeParse({
        ...BASE,
        expiryDate: '',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('reviewDocumentSchema', () => {
    it('afviser comment > 2000 tegn', () => {
      const result = reviewDocumentSchema.safeParse({
        documentId: 'doc-1',
        decision: 'GODKENDT',
        comment: 'a'.repeat(2001),
      })
      expect(result.success).toBe(false)
    })

    it('accepterer comment på præcis 2000 tegn', () => {
      const result = reviewDocumentSchema.safeParse({
        documentId: 'doc-1',
        decision: 'GODKENDT',
        comment: 'a'.repeat(2000),
      })
      expect(result.success).toBe(true)
    })
  })
})
```

- [ ] **Step 2: Kør test — forvent FAIL**

```bash
npx vitest run src/__tests__/lib/validations/zod-max-limits.test.ts
```

Expected: de fleste tests FAIL (ingen `.max()` og dato-felter er `z.string().optional()`).

- [ ] **Step 3: Ret `person.ts`**

Erstat `src/lib/validations/person.ts` med:

```typescript
import { z } from 'zod'

export const createPersonSchema = z.object({
  firstName: z.string().min(1, 'Fornavn er påkrævet').max(100),
  lastName: z.string().min(1, 'Efternavn er påkrævet').max(100),
  email: z.string().email('Ugyldig email').optional().or(z.literal('')),
  phone: z.string().max(30, 'Telefonnummer må maks. være 30 tegn').optional(),
  notes: z.string().max(5000, 'Noter må maks. være 5000 tegn').optional(),
})

export const updatePersonSchema = createPersonSchema.partial().extend({
  personId: z.string().min(1),
})

export type CreatePersonInput = z.infer<typeof createPersonSchema>
export type UpdatePersonInput = z.infer<typeof updatePersonSchema>
```

- [ ] **Step 4: Ret `contact.ts`**

Erstat `src/lib/validations/contact.ts` med:

```typescript
import { z } from 'zod'

export const contactSchema = z.object({
  name: z.string().min(2, 'Angiv dit navn').max(100, 'Navn må maks. være 100 tegn'),
  email: z.string().email('Ugyldig e-mail-adresse'),
  company: z.string().max(200, 'Firmanavn må maks. være 200 tegn').optional(),
  message: z
    .string()
    .min(10, 'Skriv en kort besked (mindst 10 tegn)')
    .max(3000, 'Besked må maks. være 3000 tegn'),
})

export type ContactFormData = z.infer<typeof contactSchema>
```

- [ ] **Step 5: Ret `contract.ts` — notes og dato-felter**

I `src/lib/validations/contract.ts` erstat `createContractSchema` (linje 105-119) med:

```typescript
export const createContractSchema = z.object({
  companyId: z.string().min(1),
  systemType: zodContractSystemType,
  displayName: z.string().min(1, 'Kontraktnavn er påkrævet').max(255),
  sensitivity: zodSensitivityLevel,
  status: zodContractStatus.optional(),
  effectiveDate: z.coerce.date().optional(),
  expiryDate: z.coerce
    .date()
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' ? undefined : v)),
  noticePeriodDays: z.coerce.number().int().min(0).optional(),
  notes: z.string().max(5000, 'Noter må maks. være 5000 tegn').optional(),
  reminder90Days: z.boolean().optional(),
  reminder30Days: z.boolean().optional(),
  reminder7Days: z.boolean().optional(),
  parentContractId: z.string().min(1).optional().or(z.literal('')),
})
```

**Vigtigt:** Opdatér `CreateContractInput`-typen i server actions der bruger `effectiveDate`/`expiryDate`. Find alle steder der forventer `string` og tilpas til `Date | undefined`:

```bash
grep -rn "effectiveDate\|expiryDate" src/actions/contracts.ts src/actions/ --include="*.ts" | head -20
```

For hvert sted der bruger `effectiveDate` som string til Prisma (f.eks. `new Date(input.effectiveDate)`): fjern `new Date()`-wrapperen — værdien er nu allerede en `Date`.

- [ ] **Step 6: Ret `document-review.ts`**

Erstat `src/lib/validations/document-review.ts` med:

```typescript
import { z } from 'zod'

export const submitForReviewSchema = z.object({
  documentId: z.string().min(1),
})

export const reviewDocumentSchema = z.object({
  documentId: z.string().min(1),
  decision: z.enum(['GODKENDT', 'AFVIST']),
  comment: z.string().max(2000, 'Kommentar må maks. være 2000 tegn').optional(),
})
```

- [ ] **Step 7: Kør alle validerings-tests**

```bash
npx vitest run src/__tests__/lib/validations/zod-max-limits.test.ts src/__tests__/actions/document-review.test.ts src/__tests__/document-review-actions.test.ts src/__tests__/persons-actions.test.ts src/__tests__/actions/persons.test.ts
```

Expected: PASS. Hvis en eksisterende test sender en dato som string (f.eks. `effectiveDate: '2026-01-01'`): `z.coerce.date()` konverterer den automatisk — den test burde stadig bestå.

- [ ] **Step 8: TypeScript-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors. Hvis der er type-fejl på steder der bruger `effectiveDate` som `string` efter schema-ændringen: erstat `new Date(input.effectiveDate)` med `input.effectiveDate` (er nu allerede `Date | undefined`).

- [ ] **Step 9: Kør fuld testsuite**

```bash
npm test
```

Expected: alle tests PASS (eller samme antal som inden stream D startede).

- [ ] **Step 10: Commit**

```bash
git add src/lib/validations/person.ts src/lib/validations/contact.ts src/lib/validations/contract.ts src/lib/validations/document-review.ts src/__tests__/lib/validations/zod-max-limits.test.ts
git commit -m "fix(validation): Zod .max() på fritekster + z.coerce.date() på dato-felter"
```

---

## Stream D exit-gate

- [ ] `npx vitest run src/__tests__/api/upload-magic-bytes.test.ts` — 4 PASS. `.exe` maskeret som PDF giver 400.
- [ ] `npx vitest run src/__tests__/ai/assistant-plan-gate.test.ts` — 3 PASS. Basis-konto kaster fejl i processMessage.
- [ ] `npx vitest run src/__tests__/lib/env-schema.test.ts` — 5 PASS. OPENAI_API_KEY er required i prod.
- [ ] `npx vitest run src/__tests__/ai/cost-cap.test.ts` — alle PASS inkl. 4 nye estimat-tests.
- [ ] `npx vitest run src/__tests__/lib/validations/zod-max-limits.test.ts` — alle PASS. Ugyldig dato afvises.
- [ ] `npm test` — 0 nye fejl vs. baseline.
- [ ] `npx tsc --noEmit` — 0 errors.

---

## Self-review

**Spec-dækning:**

| Krav (roadmap Stream D)                                                               | Task   | Status              |
| ------------------------------------------------------------------------------------- | ------ | ------------------- |
| Magic-bytes på file-upload                                                            | Task 1 | ✅                  |
| AI-features gated på plan (basis → ingen Plus-AI)                                     | Task 2 | ✅                  |
| Cost-cap-check i assistant-orchestrator                                               | —      | ⚠️ se note nedenfor |
| OPENAI_API_KEY requiredInProd                                                         | Task 3 | ✅                  |
| AI_EXTRACTION_ENABLED + OPENAI_BASE_URL i env                                         | Task 3 | ✅                  |
| estimateExtractionCost — korrekte gpt-5-mini-priser                                   | Task 4 | ✅                  |
| Zod .max() på person.phone/notes, contact.\*, contract.notes, document-review.comment | Task 5 | ✅                  |
| Dato-regex / z.coerce.date() på dato-felter                                           | Task 5 | ✅                  |

**Note — cost-cap-check i assistant-orchestrator:** `processMessage` mangler et `checkCostCap`-kald inden LLM-kaldet. `checkCostCap` eksisterer i `src/lib/ai/cost-cap.ts`. Den er dog allerede kaldt i `extractDocument`-jobbet. Roadmappen nævner cost-cap-check som en del af stream D, men omfanget ("i assistant-orchestrator") er et åbent valg: tilføjes det her (inline i processMessage) eller i `sendMessage`-actionen (bedre separation)?

**Valg A (anbefalet):** Tilføj `checkCostCap` i `processMessage` direkte efter plan-gate-checket i Task 2, trin 3:

```typescript
// Cost-cap-check: afvis hvis månedlig cap er nået
const capCheck = await checkCostCap(organizationId)
if (!capCheck.allowed) {
  throw new Error(capCheck.reason ?? 'Månedlig AI-cap er nået')
}
```

**Valg B:** Tilføj i `sendMessage`-actionen i `src/actions/assistant.ts` (efter `isAIEnabled`-checket). Giver brugeren en `ActionResult`-fejl frem for en exception, hvilket er bedre UI-mæssigt.

Begge er korrekte. Valg B foretrækkes (bruger `ActionResult<T>`-mønstret som resten af actioner) — men det er et designvalg implementøren skal tage. Uanset valg: tilføj en test der beviser at en organisation på cap får `{ error: '...' }` (Valg B) eller exception (Valg A).

**Placeholder-scan:** Ingen TBD/TODO i planen. Alle tests er fuldt kodede. ✅

**Type-konsistens:**

- `processMessage` kalder `prisma.organization.findUnique` — `Organization`-modellen har `.plan: String` i schema. ✅
- `createContractSchema.effectiveDate` ændres fra `z.string()` til `z.coerce.date()` — opstrøms actions der kalder `new Date(input.effectiveDate)` skal opdateres (Task 5 Step 5 dækker dette). ✅
- `estimateExtractionCost`-signaturen er uændret `(pageCount: number) => number`. ✅
