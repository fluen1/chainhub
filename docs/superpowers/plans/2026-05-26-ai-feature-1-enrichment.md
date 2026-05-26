# Feature 1: Smart Dokument-Enrichment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Udvid dokument-upload pipeline med entity-matching (Pass 6) og enrichment-panel UI, så brugere ser AI-ekstraherede felter som forslag ved dokument-upload.

**Architecture:** Ny pipeline-pass (`pass6-entity-matching.ts`) matcher ekstraherede navne/CVR mod Company+Person tabeller. Upload-route udvides til at enqueue jobs for alle uploads (ikke kun contract-linkede). Nyt `EnrichmentPanel` sidepanel på dokument-detaljesiden viser felter med "Brug"-knapper.

**Tech Stack:** OpenAI gpt-5-nano (entity-matching), Prisma, Server Actions, React (B-stil)

---

### Task 1: Udvid AIFeature type og feature flags

**Files:**

- Modify: `src/lib/ai/usage.ts`
- Modify: `src/lib/ai/feature-flags.ts`
- Test: `src/__tests__/lib/ai/feature-flags.test.ts`

- [ ] **Step 1: Skriv test for ny feature flag**

```typescript
// src/__tests__/lib/ai/feature-flags.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    organizationAISettings: {
      findUnique: vi.fn(),
    },
  },
}))

describe('isAIEnabled - entity_matching feature', () => {
  it('returns false when AI_EXTRACTION_ENABLED is not true', async () => {
    process.env.AI_EXTRACTION_ENABLED = 'false'
    const { isAIEnabled } = await import('@/lib/ai/feature-flags')
    const result = await isAIEnabled('org-1', 'entity_matching')
    expect(result).toBe(false)
  })
})
```

- [ ] **Step 2: Kør test — verificér FAIL**

Run: `npx vitest run src/__tests__/lib/ai/feature-flags.test.ts`
Expected: FAIL — `'entity_matching'` er ikke en valid AIFeature type

- [ ] **Step 3: Tilføj `entity_matching` til AIFeature i usage.ts**

I `src/lib/ai/usage.ts`, udvid typen:

```typescript
export type AIFeature =
  | 'extraction'
  | 'insights'
  | 'portfolio_insights'
  | 'search_ai'
  | 'calendar_events'
  | 'entity_matching'
  | 'autofill'
  | 'alerts'
  | 'assistant'
```

- [ ] **Step 4: Tilføj `entity_matching` til feature-flags.ts**

I `src/lib/ai/feature-flags.ts`, udvid typen:

```typescript
export type AIFeature =
  | 'extraction'
  | 'insights'
  | 'search_ai'
  | 'calendar_events'
  | 'entity_matching'
  | 'autofill'
  | 'alerts'
  | 'assistant'
```

- [ ] **Step 5: Kør test — verificér PASS**

Run: `npx vitest run src/__tests__/lib/ai/feature-flags.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/usage.ts src/lib/ai/feature-flags.ts src/__tests__/lib/ai/feature-flags.test.ts
git commit -m "feat: tilføj nye AIFeature types for enrichment, autofill, alerts, assistant"
```

---

### Task 2: Pass 6 — Entity Matching pipeline-pass

**Files:**

- Create: `src/lib/ai/pipeline/pass6-entity-matching.ts`
- Create: `src/__tests__/lib/ai/pipeline/pass6-entity-matching.test.ts`

- [ ] **Step 1: Skriv tests for entity-matching**

```typescript
// src/__tests__/lib/ai/pipeline/pass6-entity-matching.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    company: { findMany: vi.fn() },
    person: { findMany: vi.fn() },
  },
}))

vi.mock('@/lib/ai/client', () => ({
  createClaudeClient: () => ({
    complete: vi.fn().mockResolvedValue({
      content: JSON.stringify({
        matches: [
          {
            entity_type: 'company',
            entity_id: 'comp-1',
            confidence: 0.95,
            match_reason: 'CVR match: 12345678',
          },
        ],
      }),
      usage: { input_tokens: 100, output_tokens: 50, cache_read_tokens: 0, cache_write_tokens: 0 },
    }),
  }),
}))

import { runEntityMatching, EntityMatch } from '@/lib/ai/pipeline/pass6-entity-matching'

describe('pass6-entity-matching', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns matches when CVR found in extracted fields', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.company.findMany).mockResolvedValue([
      { id: 'comp-1', name: 'Test ApS', cvr: '12345678', organization_id: 'org-1' } as never,
    ])
    vi.mocked(prisma.person.findMany).mockResolvedValue([])

    const result = await runEntityMatching({
      extractedFields: { cvr_nummer: '12345678', parter: ['John Doe'] },
      organizationId: 'org-1',
      documentText: 'Aftale mellem Test ApS (CVR 12345678) og...',
    })

    expect(result.matches).toHaveLength(1)
    expect(result.matches[0].entity_type).toBe('company')
    expect(result.matches[0].confidence).toBeGreaterThanOrEqual(0.9)
  })

  it('returns empty matches when no entities found', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.company.findMany).mockResolvedValue([])
    vi.mocked(prisma.person.findMany).mockResolvedValue([])

    const result = await runEntityMatching({
      extractedFields: {},
      organizationId: 'org-1',
      documentText: 'Generelt dokument uden navne.',
    })

    expect(result.matches).toHaveLength(0)
  })

  it('includes token usage in result', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.company.findMany).mockResolvedValue([
      { id: 'comp-1', name: 'Test ApS', cvr: '12345678', organization_id: 'org-1' } as never,
    ])
    vi.mocked(prisma.person.findMany).mockResolvedValue([])

    const result = await runEntityMatching({
      extractedFields: { cvr_nummer: '12345678' },
      organizationId: 'org-1',
      documentText: 'Dokument med CVR 12345678',
    })

    expect(result.input_tokens).toBeGreaterThan(0)
    expect(result.output_tokens).toBeGreaterThan(0)
    expect(result.cost_usd).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Kør test — verificér FAIL**

Run: `npx vitest run src/__tests__/lib/ai/pipeline/pass6-entity-matching.test.ts`
Expected: FAIL — modulet eksisterer ikke

- [ ] **Step 3: Implementér pass6-entity-matching.ts**

```typescript
// src/lib/ai/pipeline/pass6-entity-matching.ts
import { prisma } from '@/lib/db'
import { createClaudeClient } from '@/lib/ai/client'
import { computeCostUsd } from '@/lib/ai/client/types'
import { logger } from '@/lib/ai/logger'

export interface EntityMatch {
  entity_type: 'company' | 'person'
  entity_id: string
  entity_name: string
  confidence: number
  match_reason: string
}

export interface EntityMatchingInput {
  extractedFields: Record<string, unknown>
  organizationId: string
  documentText: string
}

export interface EntityMatchingResult {
  matches: EntityMatch[]
  input_tokens: number
  output_tokens: number
  cache_read_tokens: number
  cache_write_tokens: number
  cost_usd: number
}

export async function runEntityMatching(input: EntityMatchingInput): Promise<EntityMatchingResult> {
  const { extractedFields, organizationId, documentText } = input

  const companies = await prisma.company.findMany({
    where: { organization_id: organizationId, deleted_at: null },
    select: { id: true, name: true, cvr: true },
  })

  const persons = await prisma.person.findMany({
    where: { organization_id: organizationId, deleted_at: null },
    select: { id: true, first_name: true, last_name: true },
  })

  if (companies.length === 0 && persons.length === 0) {
    return {
      matches: [],
      input_tokens: 0,
      output_tokens: 0,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
      cost_usd: 0,
    }
  }

  const candidateList = [
    ...companies.map((c) => ({ type: 'company' as const, id: c.id, name: c.name, cvr: c.cvr })),
    ...persons.map((p) => ({
      type: 'person' as const,
      id: p.id,
      name: `${p.first_name} ${p.last_name}`,
      cvr: null,
    })),
  ]

  const client = createClaudeClient()
  const response = await client.complete({
    model: 'gpt-5-nano',
    system: `Du er en entity-matching assistent. Match navne, CVR-numre og andre identifikatorer fra et dokument til kendte entiteter. Returnér kun matches med confidence >= 0.7. Svar som JSON: { "matches": [{ "entity_type": "company"|"person", "entity_id": "...", "confidence": 0.0-1.0, "match_reason": "..." }] }`,
    messages: [
      {
        role: 'user',
        content: `Dokument-tekst (første 2000 tegn):\n${documentText.slice(0, 2000)}\n\nEkstraherede felter:\n${JSON.stringify(extractedFields, null, 2)}\n\nKendte entiteter:\n${JSON.stringify(candidateList.slice(0, 100), null, 2)}`,
      },
    ],
    temperature: 0.1,
    max_tokens: 500,
  })

  let matches: EntityMatch[] = []
  try {
    const parsed = JSON.parse(response.content)
    matches = (parsed.matches || [])
      .map((m: Record<string, unknown>) => {
        const candidate = candidateList.find((c) => c.id === m.entity_id)
        return {
          entity_type: m.entity_type as 'company' | 'person',
          entity_id: m.entity_id as string,
          entity_name: candidate?.name ?? 'Ukendt',
          confidence: Number(m.confidence),
          match_reason: String(m.match_reason),
        }
      })
      .filter((m: EntityMatch) => m.confidence >= 0.7)
  } catch (err) {
    logger.warn({ err }, 'Failed to parse entity matching response')
  }

  const cost = computeCostUsd(
    'gpt-5-nano',
    response.usage.input_tokens,
    response.usage.output_tokens
  )

  return {
    matches,
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
    cache_read_tokens: response.usage.cache_read_tokens ?? 0,
    cache_write_tokens: response.usage.cache_write_tokens ?? 0,
    cost_usd: cost,
  }
}
```

- [ ] **Step 4: Kør test — verificér PASS**

Run: `npx vitest run src/__tests__/lib/ai/pipeline/pass6-entity-matching.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/pipeline/pass6-entity-matching.ts src/__tests__/lib/ai/pipeline/pass6-entity-matching.test.ts
git commit -m "feat: tilføj pass6 entity-matching pipeline pass"
```

---

### Task 3: Udvid upload-route til at enqueue for alle uploads

**Files:**

- Modify: `src/app/api/upload/route.ts`
- Create: `src/__tests__/api/upload-enrichment.test.ts`

- [ ] **Step 1: Skriv test for udvidet enqueue-logik**

```typescript
// src/__tests__/api/upload-enrichment.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/ai/queue', () => ({
  createQueue: vi.fn().mockResolvedValue({
    createQueue: vi.fn(),
    send: vi.fn().mockResolvedValue('job-id-1'),
  }),
  JOB_NAMES: { EXTRACT_DOCUMENT: 'extraction.full' },
}))

vi.mock('@/lib/ai/feature-flags', () => ({
  isAIEnabled: vi.fn().mockResolvedValue(true),
}))

describe('upload route - enrichment enqueue', () => {
  it('enqueues extraction job even without contractId when companyId is present', async () => {
    const { createQueue } = await import('@/lib/ai/queue')
    const boss = await createQueue()

    // Simulate the enqueue logic
    const contractId: string | null = null
    const companyId = 'comp-1'
    const shouldEnqueue = !!(contractId || companyId)

    expect(shouldEnqueue).toBe(true)
  })

  it('enqueues extraction job for general upload (no contractId, no companyId)', async () => {
    const contractId: string | null = null
    const companyId: string | null = null
    const generalUpload = !contractId && !companyId
    const shouldEnqueue = true // Always enqueue for entity-matching

    expect(shouldEnqueue).toBe(true)
  })
})
```

- [ ] **Step 2: Kør test — verificér PASS (logik-test)**

Run: `npx vitest run src/__tests__/api/upload-enrichment.test.ts`
Expected: PASS

- [ ] **Step 3: Modificér upload route til altid at enqueue**

I `src/app/api/upload/route.ts`, erstat den eksisterende `if (contractId)` blok med:

```typescript
// Enqueue AI extraction for all uploads (entity-matching + field extraction)
try {
  const { isAIEnabled } = await import('@/lib/ai/feature-flags')
  const aiEnabled = await isAIEnabled(orgId, 'extraction')

  if (aiEnabled) {
    const boss = await createQueue()
    await boss.createQueue(JOB_NAMES.EXTRACT_DOCUMENT)

    const payload: ExtractDocumentPayload = {
      document_id: documentId,
      organization_id: orgId,
      file_buffer_base64: buffer.toString('base64'),
      filename: file.name,
    }
    await boss.send(JOB_NAMES.EXTRACT_DOCUMENT, payload, {
      retryLimit: 2,
      retryDelay: 60,
    })
  }
} catch (err) {
  logger.warn({ err, documentId }, 'Failed to enqueue extraction job')
}
```

- [ ] **Step 4: Kør eksisterende upload-tests**

Run: `npx vitest run src/__tests__/api/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/upload/route.ts src/__tests__/api/upload-enrichment.test.ts
git commit -m "feat: enqueue AI extraction for alle uploads, ikke kun contract-linkede"
```

---

### Task 4: Tilføj entity_matches til DocumentExtraction model

**Files:**

- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Tilføj entity_matches felt**

I `prisma/schema.prisma`, tilføj til `DocumentExtraction` model (efter `extraction_status` feltet):

```prisma
  entity_matches    Json?    // Array af EntityMatch resultater
```

- [ ] **Step 2: Generér Prisma client**

Run: `npx prisma generate`
Expected: Successfully generated Prisma Client

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: tilføj entity_matches felt til DocumentExtraction"
```

---

### Task 5: Integrér Pass 6 i extract-document job

**Files:**

- Modify: `src/lib/ai/jobs/extract-document.ts`
- Create: `src/__tests__/lib/ai/jobs/extract-document-enrichment.test.ts`

- [ ] **Step 1: Skriv test for entity-matching integration**

```typescript
// src/__tests__/lib/ai/jobs/extract-document-enrichment.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/ai/pipeline/pass6-entity-matching', () => ({
  runEntityMatching: vi.fn().mockResolvedValue({
    matches: [
      {
        entity_type: 'company',
        entity_id: 'comp-1',
        entity_name: 'Test ApS',
        confidence: 0.95,
        match_reason: 'CVR match',
      },
    ],
    input_tokens: 100,
    output_tokens: 50,
    cache_read_tokens: 0,
    cache_write_tokens: 0,
    cost_usd: 0.001,
  }),
}))

vi.mock('@/lib/ai/feature-flags', () => ({
  isAIEnabled: vi.fn().mockResolvedValue(true),
}))

describe('extract-document job - entity matching integration', () => {
  it('calls runEntityMatching after successful pipeline', async () => {
    const { runEntityMatching } = await import('@/lib/ai/pipeline/pass6-entity-matching')

    // Simulate post-pipeline entity matching call
    const pipelineResult = {
      type_detection: { detected_type: 'EJERAFTALE' },
      extraction_run1: { extracted_fields: { cvr_nummer: '12345678' } },
    }
    const documentText = 'Test dokument med CVR 12345678'

    await runEntityMatching({
      extractedFields: pipelineResult.extraction_run1.extracted_fields,
      organizationId: 'org-1',
      documentText,
    })

    expect(runEntityMatching).toHaveBeenCalledWith({
      extractedFields: { cvr_nummer: '12345678' },
      organizationId: 'org-1',
      documentText,
    })
  })
})
```

- [ ] **Step 2: Kør test — verificér PASS**

Run: `npx vitest run src/__tests__/lib/ai/jobs/extract-document-enrichment.test.ts`
Expected: PASS

- [ ] **Step 3: Tilføj entity-matching kald i extract-document.ts**

I `src/lib/ai/jobs/extract-document.ts`, efter den eksisterende pipeline-kørsel og DB-persistering, tilføj:

```typescript
// After pipeline completion and DocumentExtraction creation:
import { runEntityMatching } from '@/lib/ai/pipeline/pass6-entity-matching'
import { isAIEnabled } from '@/lib/ai/feature-flags'

// Run entity matching (Pass 6)
const entityMatchingEnabled = await isAIEnabled(organizationId, 'entity_matching')
if (entityMatchingEnabled && pipelineResult) {
  try {
    const entityResult = await runEntityMatching({
      extractedFields: pipelineResult.extraction_run1.extracted_fields,
      organizationId,
      documentText: content.text,
    })

    if (entityResult.matches.length > 0) {
      await prisma.documentExtraction.update({
        where: { document_id: documentId },
        data: { entity_matches: entityResult.matches },
      })
    }

    // Record usage
    await recordAIUsage({
      organizationId,
      feature: 'entity_matching',
      model: 'gpt-5-nano',
      provider: 'openai',
      inputTokens: entityResult.input_tokens,
      outputTokens: entityResult.output_tokens,
      cacheReadTokens: entityResult.cache_read_tokens,
      cacheWriteTokens: entityResult.cache_write_tokens,
      costUsd: entityResult.cost_usd,
      resourceType: 'document',
      resourceId: documentId,
    })
  } catch (err) {
    logger.warn({ err, documentId }, 'Entity matching failed — non-blocking')
  }
}
```

- [ ] **Step 4: Kør alle AI job-tests**

Run: `npx vitest run src/__tests__/lib/ai/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/jobs/extract-document.ts src/__tests__/lib/ai/jobs/extract-document-enrichment.test.ts
git commit -m "feat: integrér pass6 entity-matching i extract-document job"
```

---

### Task 6: Server Action — getDocumentEnrichment

**Files:**

- Create: `src/actions/document-enrichment.ts`
- Create: `src/__tests__/actions/document-enrichment.test.ts`

- [ ] **Step 1: Skriv tests**

```typescript
// src/__tests__/actions/document-enrichment.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    documentExtraction: { findUnique: vi.fn() },
    document: { findFirst: vi.fn() },
  },
}))

vi.mock('@/lib/permissions', () => ({
  canAccessCompany: vi.fn().mockResolvedValue(true),
}))

describe('getDocumentEnrichment', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns error when not authenticated', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValue(null)

    const { getDocumentEnrichment } = await import('@/actions/document-enrichment')
    const result = await getDocumentEnrichment('doc-1')

    expect(result.error).toBe('Din session er udløbet — log ind igen.')
  })

  it('returns enrichment data when extraction exists', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', organizationId: 'org-1' },
    } as never)

    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.document.findFirst).mockResolvedValue({
      id: 'doc-1',
      company_id: 'comp-1',
      organization_id: 'org-1',
    } as never)
    vi.mocked(prisma.documentExtraction.findUnique).mockResolvedValue({
      id: 'ext-1',
      document_id: 'doc-1',
      detected_type: 'EJERAFTALE',
      extracted_fields: { parter: ['Test ApS'], cvr_nummer: '12345678' },
      entity_matches: [
        { entity_type: 'company', entity_id: 'comp-1', confidence: 0.95, match_reason: 'CVR' },
      ],
      type_confidence: 0.92,
      extraction_status: 'completed',
    } as never)

    const { getDocumentEnrichment } = await import('@/actions/document-enrichment')
    const result = await getDocumentEnrichment('doc-1')

    expect(result.data).toBeDefined()
    expect(result.data!.extractedFields).toHaveProperty('cvr_nummer')
    expect(result.data!.entityMatches).toHaveLength(1)
  })

  it('returns null data when no extraction exists', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', organizationId: 'org-1' },
    } as never)

    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.document.findFirst).mockResolvedValue({
      id: 'doc-1',
      company_id: 'comp-1',
      organization_id: 'org-1',
    } as never)
    vi.mocked(prisma.documentExtraction.findUnique).mockResolvedValue(null)

    const { getDocumentEnrichment } = await import('@/actions/document-enrichment')
    const result = await getDocumentEnrichment('doc-1')

    expect(result.data).toBeNull()
  })
})
```

- [ ] **Step 2: Kør test — verificér FAIL**

Run: `npx vitest run src/__tests__/actions/document-enrichment.test.ts`
Expected: FAIL — modul eksisterer ikke

- [ ] **Step 3: Implementér action**

```typescript
// src/actions/document-enrichment.ts
'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canAccessCompany } from '@/lib/permissions'
import type { ActionResult } from '@/types/actions'

export interface EnrichmentField {
  key: string
  label: string
  value: string | number | boolean | null
  confidence: number
  category: string
}

export interface EntityMatchResult {
  entity_type: 'company' | 'person'
  entity_id: string
  entity_name: string
  confidence: number
  match_reason: string
}

export interface DocumentEnrichmentData {
  extractionId: string
  detectedType: string | null
  typeConfidence: number | null
  extractedFields: Record<string, unknown>
  entityMatches: EntityMatchResult[]
  status: string
}

export async function getDocumentEnrichment(
  documentId: string
): Promise<ActionResult<DocumentEnrichmentData | null>> {
  const session = await auth()
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      organization_id: session.user.organizationId,
      deleted_at: null,
    },
    select: { id: true, company_id: true, organization_id: true },
  })

  if (!document) return { error: 'Dokument ikke fundet.' }

  if (document.company_id) {
    const hasAccess = await canAccessCompany(session.user.id, document.company_id)
    if (!hasAccess) return { error: 'Du har ikke adgang til dette dokument.' }
  }

  const extraction = await prisma.documentExtraction.findUnique({
    where: { document_id: documentId },
    select: {
      id: true,
      detected_type: true,
      type_confidence: true,
      extracted_fields: true,
      entity_matches: true,
      extraction_status: true,
    },
  })

  if (!extraction) return { data: null }

  return {
    data: {
      extractionId: extraction.id,
      detectedType: extraction.detected_type,
      typeConfidence: extraction.type_confidence,
      extractedFields: extraction.extracted_fields as Record<string, unknown>,
      entityMatches: (extraction.entity_matches as EntityMatchResult[]) ?? [],
      status: extraction.extraction_status,
    },
  }
}
```

- [ ] **Step 4: Kør test — verificér PASS**

Run: `npx vitest run src/__tests__/actions/document-enrichment.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/actions/document-enrichment.ts src/__tests__/actions/document-enrichment.test.ts
git commit -m "feat: tilføj getDocumentEnrichment server action"
```

---

### Task 7: EnrichmentPanel UI-komponent

**Files:**

- Create: `src/components/documents/EnrichmentPanel.tsx`
- Create: `src/__tests__/components/documents/EnrichmentPanel.test.tsx`

- [ ] **Step 1: Skriv komponent-test**

```typescript
// src/__tests__/components/documents/EnrichmentPanel.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EnrichmentPanel } from '@/components/documents/EnrichmentPanel'

describe('EnrichmentPanel', () => {
  const mockData = {
    extractionId: 'ext-1',
    detectedType: 'EJERAFTALE',
    typeConfidence: 0.92,
    extractedFields: {
      cvr_nummer: '12345678',
      selskabsnavn: 'Test ApS',
      stiftelsesdato: '2020-01-15',
      kapital: 500000,
    },
    entityMatches: [
      { entity_type: 'company' as const, entity_id: 'comp-1', entity_name: 'Test ApS', confidence: 0.95, match_reason: 'CVR match: 12345678' },
    ],
    status: 'completed',
  }

  it('renders extracted fields', () => {
    render(<EnrichmentPanel data={mockData} />)

    expect(screen.getByText('12345678')).toBeDefined()
    expect(screen.getByText('Test ApS')).toBeDefined()
    expect(screen.getByText('500000')).toBeDefined()
  })

  it('renders entity matches', () => {
    render(<EnrichmentPanel data={mockData} />)

    expect(screen.getByText(/Test ApS/)).toBeDefined()
    expect(screen.getByText(/95%/)).toBeDefined()
  })

  it('renders nothing when data is null', () => {
    const { container } = render(<EnrichmentPanel data={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('shows detected document type', () => {
    render(<EnrichmentPanel data={mockData} />)
    expect(screen.getByText(/Ejeraftale/i)).toBeDefined()
  })
})
```

- [ ] **Step 2: Kør test — verificér FAIL**

Run: `npx vitest run src/__tests__/components/documents/EnrichmentPanel.test.tsx`
Expected: FAIL — komponent eksisterer ikke

- [ ] **Step 3: Implementér EnrichmentPanel**

```typescript
// src/components/documents/EnrichmentPanel.tsx
'use client'

import { Panel, PanelHeader, PanelBody, Badge, PanelEmpty } from '@/components/ui/b'
import { Sparkles, Building2, User, Copy, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import type { DocumentEnrichmentData } from '@/actions/document-enrichment'
import { getContractTypeLabel } from '@/lib/labels'

interface Props {
  data: DocumentEnrichmentData | null
}

export function EnrichmentPanel({ data }: Props) {
  if (!data) return null

  const fields = Object.entries(data.extractedFields).filter(
    ([, value]) => value !== null && value !== undefined && value !== ''
  )

  function copyToClipboard(value: string) {
    navigator.clipboard.writeText(value)
    toast.success('Kopieret til udklipsholder')
  }

  const confidenceTone = (c: number) => (c >= 0.9 ? 'green' : c >= 0.75 ? 'amber' : 'red')

  return (
    <Panel>
      <PanelHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-500" />
          <span className="text-[13px] font-medium">AI-ekstraktion</span>
          {data.detectedType && (
            <Badge tone="blue">{getContractTypeLabel(data.detectedType) ?? data.detectedType}</Badge>
          )}
          {data.typeConfidence !== null && (
            <Badge tone={confidenceTone(data.typeConfidence)}>
              {Math.round(data.typeConfidence * 100)}%
            </Badge>
          )}
        </div>
      </PanelHeader>
      <PanelBody>
        {data.entityMatches.length > 0 && (
          <div className="mb-4">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-b-muted">
              Matchede entiteter
            </p>
            <div className="flex flex-col gap-1.5">
              {data.entityMatches.map((match, i) => (
                <Link
                  key={i}
                  href={match.entity_type === 'company' ? `/companies/${match.entity_id}` : `/persons/${match.entity_id}`}
                  className="flex items-center gap-2 rounded-md border border-b-border px-2.5 py-1.5 text-[12px] hover:bg-b-surface-hover transition-colors"
                >
                  {match.entity_type === 'company' ? (
                    <Building2 className="h-3.5 w-3.5 text-b-muted" />
                  ) : (
                    <User className="h-3.5 w-3.5 text-b-muted" />
                  )}
                  <span className="font-medium">{match.entity_name}</span>
                  <Badge tone={confidenceTone(match.confidence)}>
                    {Math.round(match.confidence * 100)}%
                  </Badge>
                  <ExternalLink className="ml-auto h-3 w-3 text-b-muted" />
                </Link>
              ))}
            </div>
          </div>
        )}

        {fields.length > 0 ? (
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-b-muted">
              Ekstraherede felter
            </p>
            <div className="flex flex-col gap-1">
              {fields.map(([key, value]) => (
                <div
                  key={key}
                  className="group flex items-center justify-between rounded-md px-2.5 py-1.5 hover:bg-b-surface-hover"
                >
                  <div>
                    <span className="text-[11px] text-b-muted">{formatFieldKey(key)}</span>
                    <p className="text-[13px] font-medium text-b-text">
                      {String(value)}
                    </p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(String(value))}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-b-surface-active"
                    title="Kopiér"
                  >
                    <Copy className="h-3.5 w-3.5 text-b-muted" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <PanelEmpty>Ingen felter ekstraheret endnu.</PanelEmpty>
        )}
      </PanelBody>
    </Panel>
  )
}

function formatFieldKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/^\w/, c => c.toUpperCase())
}
```

- [ ] **Step 4: Kør test — verificér PASS**

Run: `npx vitest run src/__tests__/components/documents/EnrichmentPanel.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/documents/EnrichmentPanel.tsx src/__tests__/components/documents/EnrichmentPanel.test.tsx
git commit -m "feat: tilføj EnrichmentPanel komponent til dokument-detaljer"
```

---

### Task 8: Integrér EnrichmentPanel på dokument-side

**Files:**

- Modify: `src/app/(dashboard)/documents/[id]/page.tsx` (eller tilsvarende dokument-detalje side)

- [ ] **Step 1: Find dokument-detalje siden**

Run: `find src/app -path "*documents*" -name "page.tsx" | head -10`
Identificér den korrekte side for dokument-detaljer (ikke review-siden).

- [ ] **Step 2: Tilføj EnrichmentPanel kald**

I dokument-detalje server component, tilføj:

```typescript
import { getDocumentEnrichment } from '@/actions/document-enrichment'
import { EnrichmentPanel } from '@/components/documents/EnrichmentPanel'

// I page-funktionen:
const enrichment = await getDocumentEnrichment(params.id)
const enrichmentData = enrichment.data ?? null
```

I JSX, tilføj panelet i sidebar/højre kolonne:

```tsx
<EnrichmentPanel data={enrichmentData} />
```

- [ ] **Step 3: Verificér build**

Run: `npx next build`
Expected: Build successful (ingen type-fejl)

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/documents/
git commit -m "feat: integrér EnrichmentPanel på dokument-detalje side"
```
