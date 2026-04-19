# Phase A.0 — AI Infrastructure + Cost-Research Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Byg produktions-klar AI-infrastruktur: per-call usage-tracking, enforced feature-flags + cost-caps, admin cost-dashboard, worker-proces, og et målt cost-model-dokument. Dette er FØRSTE leverance i Phase A og unblocker al fremtidig AI-pricing-beslutning (`2026-04-18-product-roadmap.md` afsnit 6 + 9).

**Architecture:** Extend schema med `AIUsageLog`-model. Byg `src/lib/ai/usage.ts` (record) + `cost-cap.ts` (enforce) som rene helpers. Retrofit eksisterende AI-call-sites (`company-insights`, `extract-document`) til at (1) tjekke `isAIEnabled`, (2) tjekke `checkCostCap`, (3) kalde modellen, (4) logge forbrug via `recordAIUsage`. Opdater `MODEL_COSTS` med verificerede priser (claude.com/pricing 2026-04-18). Admin-UI på `/settings/ai-usage` viser månedligt forbrug pr. feature/model. Worker-proces i `scripts/worker.ts` gør pg-boss kørbar.

**Tech Stack:** Prisma 5, pg-boss, Next.js 14 server actions, Vitest, Pino, Tailwind. Ingen nye dependencies.

---

## Kontekst

Fra audit 2026-04-18:

- `src/lib/ai/feature-flags.ts` — `isAIEnabled()` helper findes, men er **ikke kaldt** før AI-jobs. Stub klar til enforcement.
- `src/lib/ai/queue.ts` — `createQueue()` + `JOB_NAMES` findes. Ingen worker-proces (`scripts/` mappe eksisterer ikke).
- `OrganizationAISettings`-model har `ai_mode`, `kill_switch`, `beta_features`, `monthly_cost_cap_usd`, `rate_limit_per_day`. **Ingen enforcement i koden.**
- `CompanyInsightsCache.total_cost_usd` logger cost pr. generation — men kun i cache-row, ikke i central tracking-tabel.
- `MODEL_COSTS` i `src/lib/ai/client/types.ts` har **gamle priser** (Sonnet 4 @ $3/$15, Haiku 3.5 @ $0.8/$4). Verified current priser er Sonnet 4.6 @ $3/$15 og Haiku 4.5 @ $1/$5.
- Extraction-pipeline er feature-komplet men dormant — ingen caller i dag. A.0 retrofitter cost-cap/usage-hooks så den er klar når Phase B wire'er den.
- Credits toppet op (bekræftet af bruger).

**Udfald efter A.0:**

- Hver AI-kald går gennem: `isAIEnabled → checkCostCap → model.complete → recordAIUsage` (central tabel)
- Admin kan åbne `/settings/ai-usage` og se: månedligt forbrug, cap-progress, pr.-feature + pr.-model breakdown
- Worker-proces kan køres med `npm run worker:dev` og processer pg-boss-jobs
- `docs/build/AI-COST-MODEL.md` dokumenterer reelle målte priser fra company-insights + estimat for extraction (faktisk måling udskudt til Phase B når pipelinen wire'es)
- Tests: 627 → ~655 passed (ny: ~28 unit-tests)

**Ikke-mål (egne planer):**

- At wire extraction-pipelinen til upload-flowet (Phase B.1)
- Bedrock-implementation (Phase C.3)
- Nye AI-jobs eller features
- Ændring af eksisterende AI-jobs-logik (kun tilføje enforcement-wrappers)

---

## File Structure

**Nye filer:**

- `prisma/migrations/XXXXXXXXXXXXXX_add_ai_usage_log/migration.sql` — schema-migration
- `src/lib/ai/usage.ts` — `recordAIUsage()` + `getMonthlyUsage()` helpers
- `src/lib/ai/cost-cap.ts` — `checkCostCap()` + `getCostCapStatus()` enforcement
- `src/__tests__/ai/usage.test.ts` — unit-tests for usage helpers
- `src/__tests__/ai/cost-cap.test.ts` — unit-tests for cost-cap
- `src/actions/ai-usage.ts` — server action til dashboard-data
- `src/__tests__/ai-usage-actions.test.ts` — unit-tests for action
- `src/app/(dashboard)/settings/ai-usage/page.tsx` — server component
- `src/app/(dashboard)/settings/ai-usage/ai-usage-client.tsx` — client component
- `scripts/worker.ts` — pg-boss worker-entry
- `scripts/ai-cost-research.ts` — kører real queries til cost-model-dok
- `docs/build/AI-COST-MODEL.md` — research-output (levende dokument)

**Ændrede filer:**

- `prisma/schema.prisma` — tilføj `AIUsageLog`-model + relationer
- `src/lib/ai/client/types.ts` — opdater `MODEL_COSTS` med verified priser, tilføj Opus-støtte
- `src/lib/ai/jobs/company-insights.ts` — retrofit enforcement + usage-log
- `src/actions/company-detail.ts` — verificér `isAIEnabled` før `generateCompanyInsights`
- `src/lib/ai/jobs/extract-document.ts` — retrofit enforcement + usage-log (dormant, men klar)
- `src/lib/labels.ts` — dansk label til AI-features (`AI_FEATURE_LABELS`)
- `package.json` — `worker:dev` script
- `docs/status/PROGRESS.md` — tilføj A.0-afsnit

**Ingen ændringer:** eksisterende AI-pipeline-logik, prompt-templates, permissions.

---

## Plan

### Task 0: Plan commit

- [ ] **Step 1: Plan allerede gemt** ved `docs/superpowers/plans/2026-04-18-phase-a0-ai-infrastructure.md`.

```bash
git add docs/superpowers/plans/2026-04-18-phase-a0-ai-infrastructure.md
git commit -m "docs(plan): Phase A.0 AI infrastructure + cost-research plan"
```

---

### Task 1: Schema — AIUsageLog-model

**Files:**

- Modify: `prisma/schema.prisma` (tilføj model efter linje ~944 hvor `OrganizationAISettings` slutter)

- [ ] **Step 1: Tilføj AIUsageLog-model**

Indsæt i `prisma/schema.prisma` efter `OrganizationAISettings`-modellen:

```prisma
// ============================================================
// AI USAGE TRACKING
// ============================================================

model AIUsageLog {
  id              String       @id @default(uuid())
  organization_id String
  organization    Organization @relation(fields: [organization_id], references: [id])

  feature       String   // 'extraction' | 'insights' | 'search_ai' | 'portfolio_insights' | 'calendar_events'
  model         String   // Claude model identifier
  provider      String   // 'anthropic' | 'bedrock'
  input_tokens  Int
  output_tokens Int
  cost_usd      Decimal  @db.Decimal(10, 6)

  // Optional context — for debugging + attribution
  resource_type String?  // 'company' | 'document' | 'contract' — hvad kaldet angår
  resource_id   String?
  cached        Boolean  @default(false) // var det en cache-hit?

  // Ingen dybere PII. Logger ingen prompt-indhold.

  created_at DateTime @default(now())

  @@index([organization_id, created_at])
  @@index([organization_id, feature, created_at])
}
```

- [ ] **Step 2: Tilføj reverse-relation på Organization**

Find `model Organization` (omkring linje 280-320). I relations-sektionen (efter `ai_settings`), tilføj:

```prisma
  ai_usage_logs           AIUsageLog[]
```

- [ ] **Step 3: Kør migration**

```bash
npx prisma migrate dev --name add_ai_usage_log
```

Forventet output: migration created + applied. Prisma client regenereret.

- [ ] **Step 4: Verificér**

```bash
npx tsc --noEmit
```

Expected: 0 errors. Prisma client har nu `prisma.aIUsageLog`-API.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): AIUsageLog-model til per-call AI-forbrug"
```

---

### Task 2: Opdater MODEL_COSTS med verified priser

**Files:**

- Modify: `src/lib/ai/client/types.ts`
- Test: `src/__tests__/ai/client.test.ts` (eksisterer — udvid)

Nuværende `MODEL_COSTS`:

```ts
'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
'claude-3-5-haiku-20241022': { input: 0.8, output: 4.0 },
```

Verified 2026-04-18 (kilde: claude.com/pricing):

- Opus 4.7: $5/M input, $25/M output (cache write $6.25, cache read $0.50)
- Sonnet 4.6: $3/M input, $15/M output (cache write $3.75, cache read $0.30)
- Haiku 4.5: $1/M input, $5/M output (cache write $1.25, cache read $0.10)

Opdatering: Haiku pris hævet fra $0.8/$4 → $1/$5. Sonnet uændret. Tilføj Opus + cache-priser.

- [ ] **Step 1: Opdater types.ts**

Erstat `ClaudeModel`-type + `MODEL_COSTS` + `computeCostUsd` med:

```ts
export type ClaudeModel =
  | 'claude-opus-4-7-20260101'
  | 'claude-sonnet-4-6-20251201'
  | 'claude-sonnet-4-20250514'
  | 'claude-3-5-haiku-20241022'
  | 'claude-haiku-4-5-20260101'

export interface ModelPricing {
  /** Price per million input tokens, USD */
  input: number
  /** Price per million output tokens, USD */
  output: number
  /** Price per million cache-write tokens, USD */
  cacheWrite: number
  /** Price per million cache-read tokens, USD */
  cacheRead: number
}

/**
 * Verified from claude.com/pricing on 2026-04-18.
 * Batch processing: 50% discount on input+output (not modelled here; apply at call-site if used).
 * US-only inference: 1.1× multiplier (not modelled here).
 */
export const MODEL_COSTS: Record<ClaudeModel, ModelPricing> = {
  'claude-opus-4-7-20260101': { input: 5.0, output: 25.0, cacheWrite: 6.25, cacheRead: 0.5 },
  'claude-sonnet-4-6-20251201': { input: 3.0, output: 15.0, cacheWrite: 3.75, cacheRead: 0.3 },
  'claude-sonnet-4-20250514': { input: 3.0, output: 15.0, cacheWrite: 3.75, cacheRead: 0.3 },
  'claude-3-5-haiku-20241022': { input: 1.0, output: 5.0, cacheWrite: 1.25, cacheRead: 0.1 },
  'claude-haiku-4-5-20260101': { input: 1.0, output: 5.0, cacheWrite: 1.25, cacheRead: 0.1 },
}

export function computeCostUsd(
  model: ClaudeModel,
  inputTokens: number,
  outputTokens: number,
  options?: { cacheWriteTokens?: number; cacheReadTokens?: number }
): number {
  const costs = MODEL_COSTS[model]
  const base = (inputTokens * costs.input + outputTokens * costs.output) / 1_000_000
  const cacheWrite = ((options?.cacheWriteTokens ?? 0) * costs.cacheWrite) / 1_000_000
  const cacheRead = ((options?.cacheReadTokens ?? 0) * costs.cacheRead) / 1_000_000
  return base + cacheWrite + cacheRead
}
```

- [ ] **Step 2: Opdater eksisterende client-test**

Åbn `src/__tests__/ai/client.test.ts` (hvis den eksisterer — tjek med `ls src/__tests__/ai/client.test.ts`; hvis ikke: opret den). Tilføj tests:

```ts
import { describe, it, expect } from 'vitest'
import { computeCostUsd, MODEL_COSTS } from '@/lib/ai/client/types'

describe('computeCostUsd', () => {
  it('beregner korrekt cost for Haiku 4.5', () => {
    // 10k input, 2k output
    const cost = computeCostUsd('claude-haiku-4-5-20260101', 10_000, 2_000)
    // 10k * $1/M + 2k * $5/M = $0.01 + $0.01 = $0.02
    expect(cost).toBeCloseTo(0.02, 6)
  })

  it('beregner korrekt cost for Sonnet 4.6', () => {
    const cost = computeCostUsd('claude-sonnet-4-6-20251201', 15_000, 3_000)
    // 15k * $3/M + 3k * $15/M = $0.045 + $0.045 = $0.09
    expect(cost).toBeCloseTo(0.09, 6)
  })

  it('inkluderer cache-write når leveret', () => {
    const cost = computeCostUsd('claude-haiku-4-5-20260101', 0, 0, {
      cacheWriteTokens: 1_000_000,
    })
    // 1M * $1.25/M = $1.25
    expect(cost).toBeCloseTo(1.25, 6)
  })

  it('inkluderer cache-read når leveret', () => {
    const cost = computeCostUsd('claude-haiku-4-5-20260101', 0, 0, {
      cacheReadTokens: 1_000_000,
    })
    // 1M * $0.10/M = $0.10
    expect(cost).toBeCloseTo(0.1, 6)
  })

  it('alle modeller er defineret i MODEL_COSTS', () => {
    const keys: Array<keyof typeof MODEL_COSTS> = [
      'claude-opus-4-7-20260101',
      'claude-sonnet-4-6-20251201',
      'claude-sonnet-4-20250514',
      'claude-3-5-haiku-20241022',
      'claude-haiku-4-5-20260101',
    ]
    keys.forEach((k) => {
      expect(MODEL_COSTS[k]).toBeDefined()
      expect(MODEL_COSTS[k].input).toBeGreaterThan(0)
    })
  })
})
```

- [ ] **Step 3: Kør tests**

```bash
npx vitest run src/__tests__/ai/client.test.ts
```

Expected: ≥5 passed (inklusiv eksisterende tests hvis de findes).

- [ ] **Step 4: Verificér bred type-safety**

```bash
npx tsc --noEmit
```

Forventet: 0 errors. Bemærk: hvis der er eksisterende kode der bruger `MODEL_COSTS[model]` og læser `input`/`output` direkte, virker det stadig (nye felter er additive).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/client/types.ts src/__tests__/ai/client.test.ts
git commit -m "feat(ai): opdateret MODEL_COSTS med verified 2026-04-18-priser + cache-support"
```

---

### Task 3: Usage-helper — `src/lib/ai/usage.ts`

**Files:**

- Create: `src/lib/ai/usage.ts`
- Create: `src/__tests__/ai/usage.test.ts`

- [ ] **Step 1: Skriv failing test først**

Opret `src/__tests__/ai/usage.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    aIUsageLog: {
      create: vi.fn().mockResolvedValue({ id: 'log-1' }),
      aggregate: vi.fn().mockResolvedValue({ _sum: { cost_usd: null } }),
      groupBy: vi.fn().mockResolvedValue([]),
    },
  },
}))

vi.mock('@/lib/logger', () => ({
  captureError: vi.fn(),
  createLogger: vi.fn(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}))

import { recordAIUsage, getMonthlyUsage } from '@/lib/ai/usage'

describe('recordAIUsage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('logger cost + tokens til AIUsageLog', async () => {
    const { prisma } = await import('@/lib/db')
    await recordAIUsage({
      organizationId: 'org-1',
      feature: 'insights',
      model: 'claude-haiku-4-5-20260101',
      provider: 'anthropic',
      inputTokens: 10000,
      outputTokens: 2000,
      costUsd: 0.02,
      resourceType: 'company',
      resourceId: 'company-1',
    })
    expect(prisma.aIUsageLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organization_id: 'org-1',
        feature: 'insights',
        model: 'claude-haiku-4-5-20260101',
        input_tokens: 10000,
        output_tokens: 2000,
        cost_usd: 0.02,
      }),
    })
  })

  it('sluger DB-fejl stille (logger ikke throw'er)', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.aIUsageLog.create).mockImplementation(
      (() => Promise.reject(new Error('DB down'))) as never
    )
    // Må ikke throw
    await expect(
      recordAIUsage({
        organizationId: 'org-1',
        feature: 'insights',
        model: 'claude-haiku-4-5-20260101',
        provider: 'anthropic',
        inputTokens: 100,
        outputTokens: 50,
        costUsd: 0.001,
      })
    ).resolves.toBeUndefined()
  })
})

describe('getMonthlyUsage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returnerer total + breakdown pr. feature', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.aIUsageLog.aggregate).mockImplementation(
      (() => Promise.resolve({ _sum: { cost_usd: 5.42 } })) as never
    )
    vi.mocked(prisma.aIUsageLog.groupBy).mockImplementation(
      (() =>
        Promise.resolve([
          { feature: 'insights', _sum: { cost_usd: 3.2 } },
          { feature: 'extraction', _sum: { cost_usd: 2.22 } },
        ])) as never
    )
    const result = await getMonthlyUsage('org-1')
    expect(result.totalCostUsd).toBe(5.42)
    expect(result.byFeature).toHaveLength(2)
    expect(result.byFeature.find((f) => f.feature === 'insights')?.costUsd).toBe(3.2)
  })

  it('returnerer 0 når ingen forbrug', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.aIUsageLog.aggregate).mockImplementation(
      (() => Promise.resolve({ _sum: { cost_usd: null } })) as never
    )
    vi.mocked(prisma.aIUsageLog.groupBy).mockImplementation((() => Promise.resolve([])) as never)
    const result = await getMonthlyUsage('org-1')
    expect(result.totalCostUsd).toBe(0)
    expect(result.byFeature).toEqual([])
  })
})
```

- [ ] **Step 2: Kør test — forventet FAIL (usage.ts eksisterer ikke)**

```bash
npx vitest run src/__tests__/ai/usage.test.ts
```

Forventet: error "Cannot find module '@/lib/ai/usage'".

- [ ] **Step 3: Implementér `src/lib/ai/usage.ts`**

```ts
import { prisma } from '@/lib/db'
import { captureError, createLogger } from '@/lib/logger'

const log = createLogger('ai-usage')

export type AIFeature =
  | 'extraction'
  | 'insights'
  | 'portfolio_insights'
  | 'search_ai'
  | 'calendar_events'

export interface RecordUsageInput {
  organizationId: string
  feature: AIFeature
  model: string
  provider: 'anthropic' | 'bedrock'
  inputTokens: number
  outputTokens: number
  costUsd: number
  resourceType?: string
  resourceId?: string
  cached?: boolean
}

/**
 * Logger AI-forbrug til AIUsageLog-tabellen. Bruges fra alle AI-jobs
 * efter en model-kald. Sluger DB-fejl stille via captureError — et fejlet
 * log må ikke bringe AI-flowet ned.
 */
export async function recordAIUsage(input: RecordUsageInput): Promise<void> {
  try {
    await prisma.aIUsageLog.create({
      data: {
        organization_id: input.organizationId,
        feature: input.feature,
        model: input.model,
        provider: input.provider,
        input_tokens: input.inputTokens,
        output_tokens: input.outputTokens,
        cost_usd: input.costUsd,
        resource_type: input.resourceType ?? null,
        resource_id: input.resourceId ?? null,
        cached: input.cached ?? false,
      },
    })
  } catch (err) {
    captureError(err, {
      namespace: 'ai:usage:record',
      extra: { organizationId: input.organizationId, feature: input.feature },
    })
    log.warn({ orgId: input.organizationId }, 'AI usage log failed (non-fatal)')
  }
}

export interface MonthlyUsage {
  totalCostUsd: number
  byFeature: Array<{ feature: string; costUsd: number }>
}

/**
 * Aggregerer AI-forbrug for en organisation for indeværende kalendermåned (UTC).
 * Bruges i /settings/ai-usage dashboard.
 */
export async function getMonthlyUsage(organizationId: string): Promise<MonthlyUsage> {
  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

  const [totalAgg, featureAgg] = await Promise.all([
    prisma.aIUsageLog.aggregate({
      where: { organization_id: organizationId, created_at: { gte: monthStart } },
      _sum: { cost_usd: true },
    }),
    prisma.aIUsageLog.groupBy({
      by: ['feature'],
      where: { organization_id: organizationId, created_at: { gte: monthStart } },
      _sum: { cost_usd: true },
    }),
  ])

  return {
    totalCostUsd: Number(totalAgg._sum.cost_usd ?? 0),
    byFeature: featureAgg.map((row) => ({
      feature: row.feature,
      costUsd: Number(row._sum.cost_usd ?? 0),
    })),
  }
}
```

- [ ] **Step 4: Kør tests — forventet PASS**

```bash
npx vitest run src/__tests__/ai/usage.test.ts
```

Forventet: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/usage.ts src/__tests__/ai/usage.test.ts
git commit -m "feat(ai): recordAIUsage + getMonthlyUsage helpers"
```

---

### Task 4: Cost-cap-enforcement — `src/lib/ai/cost-cap.ts`

**Files:**

- Create: `src/lib/ai/cost-cap.ts`
- Create: `src/__tests__/ai/cost-cap.test.ts`

- [ ] **Step 1: Skriv failing test**

Opret `src/__tests__/ai/cost-cap.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    organizationAISettings: {
      findUnique: vi.fn(),
    },
    aIUsageLog: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { cost_usd: null } }),
    },
  },
}))

vi.mock('@/lib/logger', () => ({
  captureError: vi.fn(),
  createLogger: vi.fn(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}))

import { checkCostCap, getCostCapStatus } from '@/lib/ai/cost-cap'

describe('checkCostCap', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returnerer allowed=true når ingen cap konfigureret', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.organizationAISettings.findUnique).mockImplementation((() =>
      Promise.resolve({ monthly_cost_cap_usd: null })) as never)
    const result = await checkCostCap('org-1')
    expect(result.allowed).toBe(true)
    expect(result.reason).toBeUndefined()
  })

  it('returnerer allowed=true når forbrug under cap', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.organizationAISettings.findUnique).mockImplementation((() =>
      Promise.resolve({ monthly_cost_cap_usd: 50 })) as never)
    vi.mocked(prisma.aIUsageLog.aggregate).mockImplementation((() =>
      Promise.resolve({ _sum: { cost_usd: 10 } })) as never)
    const result = await checkCostCap('org-1')
    expect(result.allowed).toBe(true)
  })

  it('returnerer allowed=false når forbrug over cap', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.organizationAISettings.findUnique).mockImplementation((() =>
      Promise.resolve({ monthly_cost_cap_usd: 50 })) as never)
    vi.mocked(prisma.aIUsageLog.aggregate).mockImplementation((() =>
      Promise.resolve({ _sum: { cost_usd: 55 } })) as never)
    const result = await checkCostCap('org-1')
    expect(result.allowed).toBe(false)
    expect(result.reason).toMatch(/cap/i)
  })
})

describe('getCostCapStatus', () => {
  beforeEach(() => vi.clearAllMocks())

  it('beregner percentage når cap er sat', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.organizationAISettings.findUnique).mockImplementation((() =>
      Promise.resolve({ monthly_cost_cap_usd: 100 })) as never)
    vi.mocked(prisma.aIUsageLog.aggregate).mockImplementation((() =>
      Promise.resolve({ _sum: { cost_usd: 75 } })) as never)
    const result = await getCostCapStatus('org-1')
    expect(result.capUsd).toBe(100)
    expect(result.currentUsd).toBe(75)
    expect(result.percentage).toBe(75)
    expect(result.threshold).toBe('75-warn')
  })

  it('returnerer threshold=none når <50%', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.organizationAISettings.findUnique).mockImplementation((() =>
      Promise.resolve({ monthly_cost_cap_usd: 100 })) as never)
    vi.mocked(prisma.aIUsageLog.aggregate).mockImplementation((() =>
      Promise.resolve({ _sum: { cost_usd: 20 } })) as never)
    const result = await getCostCapStatus('org-1')
    expect(result.threshold).toBe('none')
  })

  it('returnerer threshold=exceeded når >=100%', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.organizationAISettings.findUnique).mockImplementation((() =>
      Promise.resolve({ monthly_cost_cap_usd: 100 })) as never)
    vi.mocked(prisma.aIUsageLog.aggregate).mockImplementation((() =>
      Promise.resolve({ _sum: { cost_usd: 110 } })) as never)
    const result = await getCostCapStatus('org-1')
    expect(result.threshold).toBe('exceeded')
  })

  it('returnerer threshold=none når ingen cap', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.organizationAISettings.findUnique).mockImplementation((() =>
      Promise.resolve({ monthly_cost_cap_usd: null })) as never)
    const result = await getCostCapStatus('org-1')
    expect(result.capUsd).toBeNull()
    expect(result.threshold).toBe('none')
  })
})
```

- [ ] **Step 2: Kør test — forventet FAIL**

```bash
npx vitest run src/__tests__/ai/cost-cap.test.ts
```

Forventet: module not found.

- [ ] **Step 3: Implementér `src/lib/ai/cost-cap.ts`**

```ts
import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/logger'

const log = createLogger('ai-cost-cap')

export interface CostCapCheckResult {
  allowed: boolean
  reason?: string
}

export interface CostCapStatus {
  capUsd: number | null
  currentUsd: number
  percentage: number // 0-100+
  threshold: 'none' | '50-info' | '75-warn' | '90-alert' | 'exceeded'
}

/**
 * Tjekker om organisation har nået månedlig cost-cap. Bruges FØR hver AI-kald.
 * Returnerer {allowed: false} hvis capped — AI-kald bør afvises med brugervenlig besked.
 */
export async function checkCostCap(organizationId: string): Promise<CostCapCheckResult> {
  const status = await getCostCapStatus(organizationId)
  if (status.capUsd === null) return { allowed: true }
  if (status.currentUsd >= status.capUsd) {
    log.warn(
      { orgId: organizationId, current: status.currentUsd, cap: status.capUsd },
      'AI cost cap exceeded — blocking call'
    )
    return { allowed: false, reason: 'Månedlig AI-cap er nået — kontakt admin' }
  }
  return { allowed: true }
}

/**
 * Returnerer detaljeret status for cap-brug. Bruges af dashboard + soft-alerts.
 */
export async function getCostCapStatus(organizationId: string): Promise<CostCapStatus> {
  const settings = await prisma.organizationAISettings.findUnique({
    where: { organization_id: organizationId },
  })
  const capUsd = settings?.monthly_cost_cap_usd ? Number(settings.monthly_cost_cap_usd) : null

  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const agg = await prisma.aIUsageLog.aggregate({
    where: { organization_id: organizationId, created_at: { gte: monthStart } },
    _sum: { cost_usd: true },
  })
  const currentUsd = Number(agg._sum.cost_usd ?? 0)

  if (capUsd === null) {
    return { capUsd: null, currentUsd, percentage: 0, threshold: 'none' }
  }

  const percentage = Math.round((currentUsd / capUsd) * 100)
  const threshold: CostCapStatus['threshold'] =
    percentage >= 100
      ? 'exceeded'
      : percentage >= 90
        ? '90-alert'
        : percentage >= 75
          ? '75-warn'
          : percentage >= 50
            ? '50-info'
            : 'none'

  return { capUsd, currentUsd, percentage, threshold }
}
```

- [ ] **Step 4: Kør tests**

```bash
npx vitest run src/__tests__/ai/cost-cap.test.ts
```

Forventet: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/cost-cap.ts src/__tests__/ai/cost-cap.test.ts
git commit -m "feat(ai): checkCostCap + getCostCapStatus enforcement"
```

---

### Task 5: Retrofit company-insights med enforcement + usage-log

**Files:**

- Modify: `src/lib/ai/jobs/company-insights.ts`
- Modify: `src/actions/company-detail.ts`
- Modify: `src/__tests__/ai/company-insights.test.ts` (hvis eksisterer — tilpas)

Mål: Når `generateCompanyInsights` kaldes, skal det:

1. Tjekke `isAIEnabled(org, 'insights')` → skip graceful hvis disabled
2. Tjekke `checkCostCap(org)` → skip graceful hvis capped
3. Kalde Claude + parse resultat
4. Kalde `recordAIUsage(...)` med tokens + cost

`src/actions/company-detail.ts` skal kalde `isAIEnabled` og `checkCostCap` BEFORE at kalde `generateCompanyInsights`.

- [ ] **Step 1: Læs eksisterende `src/lib/ai/jobs/company-insights.ts`**

```bash
cat src/lib/ai/jobs/company-insights.ts
```

Find:

- Hvilken signatur `generateCompanyInsights` har
- Hvor cost beregnes i dag (logges til `CompanyInsightsCache.total_cost_usd`)
- Hvilke parameters den modtager (specifikt: får den `organizationId`?)

- [ ] **Step 2: Tilføj `recordAIUsage`-kald i `generateCompanyInsights`**

Inde i jobbet, efter at modellen har svaret og cost er beregnet, tilføj:

```ts
import { recordAIUsage } from '@/lib/ai/usage'

// ... eksisterende kode der kalder model + beregner cost ...

await recordAIUsage({
  organizationId: input.organizationId, // eller snapshot.organizationId
  feature: 'insights',
  model: MODEL, // reference til den model-konstant der bruges
  provider: 'anthropic',
  inputTokens: response.usage.input_tokens,
  outputTokens: response.usage.output_tokens,
  costUsd: totalCostUsd, // den allerede beregnede cost
  resourceType: 'company',
  resourceId: snapshot.companyId,
})
```

Hvis `input` ikke indeholder `organizationId`, udvid typen til at tage imod det (check eksisterende call-sites — aktuelt kaldes den fra `src/actions/company-detail.ts`, som har `session.user.organizationId`).

- [ ] **Step 3: Retrofit `src/actions/company-detail.ts`**

Find hvor `generateCompanyInsights` kaldes (sandsynligvis i en try-block omkring linje 310-320 per audit). Tilføj pre-kald-gates:

```ts
import { isAIEnabled } from '@/lib/ai/feature-flags'
import { checkCostCap } from '@/lib/ai/cost-cap'

// ... i den blok der kalder generateCompanyInsights:

// Før model-kald: tjek feature + cost-cap
const aiEnabled = await isAIEnabled(session.user.organizationId, 'insights')
if (!aiEnabled) {
  // Graceful: ingen AI, returner bare eksisterende data uden alerts/insight
  return {
    /* ... eksisterende return uden aiInsight ... */
  }
}

const capCheck = await checkCostCap(session.user.organizationId)
if (!capCheck.allowed) {
  // Log men graceful degradation — admin får alert via Task 9 dashboard
  log.warn(
    { orgId: session.user.organizationId, reason: capCheck.reason },
    'AI call blocked by cost cap'
  )
  return {
    /* samme graceful return */
  }
}

// ... eksisterende kald til generateCompanyInsights ...
```

Nøglepunkt: ændringer må IKKE brække eksisterende `/companies/[id]` rendering. Graceful degradation (`aiInsight: null, alerts: []`) er allerede implementeret i Plan 4C.

- [ ] **Step 4: Verificér i browser**

```bash
npm run dev
# Åbn /companies/<seed-company-id>
# Verificér at siden renderer uanset om AI enabled eller ej
```

Test scenarier:

1. `AI_EXTRACTION_ENABLED=true` + `ai_mode=OFF` i DB → forventet: siden renderer, ingen insight
2. `AI_EXTRACTION_ENABLED=true` + `ai_mode=LIVE` + credit OK → forventet: AI-insight vises + `AIUsageLog`-row oprettes
3. `AI_EXTRACTION_ENABLED=false` → forventet: siden renderer, ingen insight

For at teste #2 manuelt:

```sql
-- I Supabase SQL editor
INSERT INTO "OrganizationAISettings" (id, organization_id, ai_mode)
VALUES (gen_random_uuid(), '<seed-org-id>', 'LIVE')
ON CONFLICT (organization_id) DO UPDATE SET ai_mode = 'LIVE';
```

- [ ] **Step 5: Opdater eksisterende tests**

Hvis `src/__tests__/ai/company-insights.test.ts` eksisterer, tilføj mock for `recordAIUsage`:

```ts
vi.mock('@/lib/ai/usage', () => ({
  recordAIUsage: vi.fn().mockResolvedValue(undefined),
}))
```

Og tilføj ny test-case der verificerer `recordAIUsage` kaldes med korrekte args.

For `src/__tests__/company-detail-actions.test.ts`, mock `isAIEnabled` + `checkCostCap`:

```ts
vi.mock('@/lib/ai/feature-flags', () => ({
  isAIEnabled: vi.fn().mockResolvedValue(true),
}))
vi.mock('@/lib/ai/cost-cap', () => ({
  checkCostCap: vi.fn().mockResolvedValue({ allowed: true }),
}))
```

Tilføj tests for disabled- og capped-scenarier (ingen AI-kald hvis disabled/capped).

- [ ] **Step 6: Kør full test-suite**

```bash
npm test 2>&1 | tail -5
```

Forventet: 627 → ~635 passed (2-3 nye tests fra company-insights + 2-3 fra company-detail-actions).

- [ ] **Step 7: Commit**

```bash
git add src/lib/ai/jobs/company-insights.ts src/actions/company-detail.ts src/__tests__/
git commit -m "feat(ai): enforce isAIEnabled + cost-cap på company-insights + log usage"
```

---

### Task 6: Retrofit extraction-job (dormant, forberedelse til Phase B)

**Files:**

- Modify: `src/lib/ai/jobs/extract-document.ts`
- Modify: `src/__tests__/ai/` (tilsvarende test hvis eksisterer)

Extraction-pipelinen kaldes ikke i dag fra nogen UI (Phase B.1 wire'er den). Men vi retrofit'er allerede nu, så Phase B ikke skal tilføje dette senere.

- [ ] **Step 1: Læs eksisterende `extract-document.ts`**

```bash
cat src/lib/ai/jobs/extract-document.ts | head -80
```

Noter signatur og hvor token-cost aggregeres (tidligere audit viste det).

- [ ] **Step 2: Tilføj enforcement-gates i top af `extractDocument`**

```ts
import { isAIEnabled } from '@/lib/ai/feature-flags'
import { checkCostCap } from '@/lib/ai/cost-cap'
import { recordAIUsage } from '@/lib/ai/usage'

export async function extractDocument(input: ExtractDocumentInput): Promise<ExtractDocumentResult> {
  // Pre-flight gates
  const enabled = await isAIEnabled(input.organizationId, 'extraction')
  if (!enabled) {
    return { status: 'skipped', reason: 'AI extraction ikke aktiveret for denne organisation' }
  }
  const capCheck = await checkCostCap(input.organizationId)
  if (!capCheck.allowed) {
    return { status: 'skipped', reason: capCheck.reason ?? 'Cost cap nået' }
  }

  // ... eksisterende pipeline-kald ...

  // Efter pipeline-success: log total forbrug (ikke pr. pass — en sammenlagt entry pr. dokument)
  await recordAIUsage({
    organizationId: input.organizationId,
    feature: 'extraction',
    model: result.primaryModel, // den model der blev brugt mest
    provider: 'anthropic',
    inputTokens: result.totalInputTokens,
    outputTokens: result.totalOutputTokens,
    costUsd: result.totalCostUsd,
    resourceType: 'document',
    resourceId: input.documentId,
  })

  return result
}
```

Hvis `ExtractDocumentResult`-typen ikke har `status/reason`-felter, tilføj dem som optionelle. Eksisterende kode der ikke kalder `extractDocument` påvirkes ikke.

- [ ] **Step 3: Verificér TS + eksisterende tests**

```bash
npx tsc --noEmit
npx vitest run src/__tests__/ai/
```

Forventet: 0 errors, alle AI-tests passerer.

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai/jobs/extract-document.ts
git commit -m "feat(ai): enforce isAIEnabled + cost-cap på extraction (klar til Phase B)"
```

---

### Task 7: Worker-proces — `scripts/worker.ts`

**Files:**

- Create: `scripts/worker.ts`
- Modify: `package.json` (tilføj `worker:dev` script)
- Create: `src/__tests__/ai/worker.test.ts` (hvis muligt; ellers integration-manuel)

Worker-proces er en standalone Node-proces der:

1. Starter pg-boss via `createQueue()`
2. Registrerer handlers for alle `JOB_NAMES`
3. Kører indtil SIGTERM/SIGINT
4. Logger struktureret via Pino

- [ ] **Step 1: Opret `scripts/worker.ts`**

Først opret mappen hvis den ikke findes:

```bash
ls scripts 2>/dev/null || mkdir scripts
```

Derefter filen:

```ts
/**
 * ChainHub AI worker-proces.
 * Starter pg-boss, registrerer job-handlers, kører indtil SIGTERM/SIGINT.
 *
 * Kør i dev: npm run worker:dev
 * Kør i prod: node dist/worker.js (efter tsc) eller tsx scripts/worker.ts via process manager
 */

import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

import { createQueue, stopQueue, JOB_NAMES } from '@/lib/ai/queue'
import { extractDocument } from '@/lib/ai/jobs/extract-document'
import { createLogger } from '@/lib/ai/logger'

const log = createLogger('worker')

interface ExtractDocumentJob {
  organizationId: string
  documentId: string
  contractId?: string | null
}

async function main() {
  log.info('Starting ChainHub AI worker')
  const boss = await createQueue()

  await boss.work<ExtractDocumentJob>(
    JOB_NAMES.EXTRACT_DOCUMENT,
    { batchSize: 1, teamSize: 2 },
    async (jobs) => {
      for (const job of jobs) {
        log.info({ jobId: job.id, docId: job.data.documentId }, 'Processing extraction job')
        try {
          await extractDocument({
            organizationId: job.data.organizationId,
            documentId: job.data.documentId,
            contractId: job.data.contractId ?? null,
          })
          log.info({ jobId: job.id }, 'Extraction job complete')
        } catch (err) {
          log.error(
            { jobId: job.id, err: err instanceof Error ? err.message : String(err) },
            'Extraction job failed'
          )
          throw err // pg-boss retry-logikken tager sig af re-queue
        }
      }
    }
  )

  log.info('Worker ready — waiting for jobs')

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    log.info({ signal }, 'Shutdown signal received')
    await stopQueue()
    log.info('Worker stopped')
    process.exit(0)
  }
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))
}

main().catch((err) => {
  log.error({ err: err instanceof Error ? err.message : String(err) }, 'Worker startup failed')
  process.exit(1)
})
```

- [ ] **Step 2: Tilføj npm-script**

Rediger `package.json` — find `scripts`-sektionen og tilføj:

```json
{
  "scripts": {
    "worker:dev": "tsx scripts/worker.ts",
    "worker:build": "tsc -p tsconfig.worker.json",
    ...
  }
}
```

Tjek om `tsx` er installeret:

```bash
npm list tsx
```

Hvis ikke:

```bash
npm install -D tsx
```

- [ ] **Step 3: Opret `tsconfig.worker.json` (til prod-build)**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "commonjs",
    "outDir": "./dist/worker",
    "noEmit": false,
    "jsx": "react"
  },
  "include": ["scripts/**/*.ts", "src/lib/ai/**/*.ts", "src/lib/db/**/*.ts", "src/lib/logger.ts"],
  "exclude": ["**/__tests__/**", "node_modules"]
}
```

(Bruges i produktion til at bygge standalone JS — men i A.0 er dev-kørsel via `tsx` nok.)

- [ ] **Step 4: Verificér worker starter**

```bash
npm run worker:dev
```

Forventet output:

```
Starting ChainHub AI worker
pg-boss started
Worker ready — waiting for jobs
```

Tryk Ctrl+C for at teste graceful shutdown:

```
Shutdown signal received
pg-boss stopped
Worker stopped
```

Hvis det kører uden fejl — stop processen.

- [ ] **Step 5: Commit**

```bash
git add scripts/worker.ts package.json package-lock.json tsconfig.worker.json
git commit -m "feat(ai): pg-boss worker-proces til async AI-jobs"
```

---

### Task 8: Server action til AI-usage-dashboard

**Files:**

- Create: `src/actions/ai-usage.ts`
- Create: `src/__tests__/ai-usage-actions.test.ts`

- [ ] **Step 1: Skriv failing test først**

Opret `src/__tests__/ai-usage-actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', organizationId: 'org-1' },
  }),
}))

vi.mock('@/lib/permissions', () => ({
  canAccessModule: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    aIUsageLog: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { cost_usd: 0 } }),
      groupBy: vi.fn().mockResolvedValue([]),
      findMany: vi.fn().mockResolvedValue([]),
    },
    organizationAISettings: {
      findUnique: vi.fn().mockResolvedValue({ monthly_cost_cap_usd: 100 }),
    },
  },
}))

vi.mock('@/lib/logger', () => ({
  captureError: vi.fn(),
  createLogger: vi.fn(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}))

import { getAIUsageDashboard } from '@/actions/ai-usage'

describe('getAIUsageDashboard', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returnerer samlet dashboard-data', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.aIUsageLog.aggregate).mockImplementation((() =>
      Promise.resolve({ _sum: { cost_usd: 12.5 } })) as never)
    vi.mocked(prisma.aIUsageLog.groupBy).mockImplementation((() =>
      Promise.resolve([
        { feature: 'insights', _sum: { cost_usd: 10 } },
        { feature: 'extraction', _sum: { cost_usd: 2.5 } },
      ])) as never)
    vi.mocked(prisma.aIUsageLog.findMany).mockImplementation((() =>
      Promise.resolve([
        {
          id: 'log-1',
          feature: 'insights',
          model: 'claude-haiku-4-5-20260101',
          cost_usd: 0.02,
          created_at: new Date(),
          resource_type: 'company',
          resource_id: 'c-1',
        },
      ])) as never)

    const result = await getAIUsageDashboard()
    expect('data' in result).toBe(true)
    if ('data' in result) {
      expect(result.data.totalCostUsd).toBe(12.5)
      expect(result.data.capUsd).toBe(100)
      expect(result.data.percentage).toBe(13) // 12.5/100 * 100 rounded
      expect(result.data.byFeature).toHaveLength(2)
      expect(result.data.recent).toHaveLength(1)
    }
  })

  it('afviser uden module-adgang', async () => {
    const perms = await import('@/lib/permissions')
    vi.mocked(perms.canAccessModule).mockResolvedValueOnce(false)
    const result = await getAIUsageDashboard()
    expect('error' in result).toBe(true)
  })

  it('afviser uden session', async () => {
    const auth = await import('@/lib/auth')
    vi.mocked(auth.auth).mockResolvedValueOnce(null)
    const result = await getAIUsageDashboard()
    expect(result).toEqual({ error: 'Ikke autoriseret' })
  })
})
```

- [ ] **Step 2: Kør — FAIL**

```bash
npx vitest run src/__tests__/ai-usage-actions.test.ts
```

Forventet: module not found.

- [ ] **Step 3: Implementér `src/actions/ai-usage.ts`**

```ts
'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canAccessModule } from '@/lib/permissions'
import { getCostCapStatus } from '@/lib/ai/cost-cap'
import { captureError } from '@/lib/logger'
import type { ActionResult } from '@/types/actions'

export interface AIUsageDashboardData {
  totalCostUsd: number
  capUsd: number | null
  percentage: number
  threshold: string
  byFeature: Array<{ feature: string; costUsd: number }>
  byModel: Array<{ model: string; costUsd: number }>
  recent: Array<{
    id: string
    feature: string
    model: string
    costUsd: number
    createdAt: Date
    resourceType: string | null
    resourceId: string | null
  }>
}

export async function getAIUsageDashboard(): Promise<ActionResult<AIUsageDashboardData>> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  const hasAccess = await canAccessModule(session.user.id, 'user_management')
  if (!hasAccess) return { error: 'Kun admin har adgang til AI-forbrug' }

  try {
    const orgId = session.user.organizationId
    const now = new Date()
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

    const [capStatus, byFeatureRaw, byModelRaw, recent] = await Promise.all([
      getCostCapStatus(orgId),
      prisma.aIUsageLog.groupBy({
        by: ['feature'],
        where: { organization_id: orgId, created_at: { gte: monthStart } },
        _sum: { cost_usd: true },
      }),
      prisma.aIUsageLog.groupBy({
        by: ['model'],
        where: { organization_id: orgId, created_at: { gte: monthStart } },
        _sum: { cost_usd: true },
      }),
      prisma.aIUsageLog.findMany({
        where: { organization_id: orgId },
        orderBy: { created_at: 'desc' },
        take: 25,
      }),
    ])

    return {
      data: {
        totalCostUsd: capStatus.currentUsd,
        capUsd: capStatus.capUsd,
        percentage: capStatus.percentage,
        threshold: capStatus.threshold,
        byFeature: byFeatureRaw.map((r) => ({
          feature: r.feature,
          costUsd: Number(r._sum.cost_usd ?? 0),
        })),
        byModel: byModelRaw.map((r) => ({
          model: r.model,
          costUsd: Number(r._sum.cost_usd ?? 0),
        })),
        recent: recent.map((r) => ({
          id: r.id,
          feature: r.feature,
          model: r.model,
          costUsd: Number(r.cost_usd),
          createdAt: r.created_at,
          resourceType: r.resource_type,
          resourceId: r.resource_id,
        })),
      },
    }
  } catch (err) {
    captureError(err, { namespace: 'action:getAIUsageDashboard' })
    return { error: 'Kunne ikke hente AI-forbrug — prøv igen' }
  }
}
```

- [ ] **Step 4: Kør tests — PASS**

```bash
npx vitest run src/__tests__/ai-usage-actions.test.ts
```

Forventet: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/actions/ai-usage.ts src/__tests__/ai-usage-actions.test.ts
git commit -m "feat(ai): getAIUsageDashboard server action til admin cost-view"
```

---

### Task 9: Admin-UI — `/settings/ai-usage`

**Files:**

- Create: `src/app/(dashboard)/settings/ai-usage/page.tsx`
- Create: `src/app/(dashboard)/settings/ai-usage/ai-usage-client.tsx`
- Modify: `src/lib/labels.ts` (tilføj `AI_FEATURE_LABELS`)

- [ ] **Step 1: Tilføj labels i `src/lib/labels.ts`**

Find et passende sted i labels.ts (evt. nederst i enum-label-sektionen). Tilføj:

```ts
export const AI_FEATURE_LABELS: Record<string, string> = {
  extraction: 'Dokument-ekstraktion',
  insights: 'Selskabs-insights',
  portfolio_insights: 'Portefølje-insights',
  search_ai: 'Søg & Spørg',
  calendar_events: 'Kalender-events',
}

export function labelForAIFeature(feature: string): string {
  return AI_FEATURE_LABELS[feature] ?? feature
}
```

- [ ] **Step 2: Opret server component page**

`src/app/(dashboard)/settings/ai-usage/page.tsx`:

```tsx
import { getAIUsageDashboard } from '@/actions/ai-usage'
import { AIUsageClient } from './ai-usage-client'
import { redirect } from 'next/navigation'

export const metadata = { title: 'AI-forbrug — ChainHub' }

export default async function AIUsagePage() {
  const result = await getAIUsageDashboard()
  if ('error' in result) {
    if (result.error === 'Ikke autoriseret') redirect('/login')
    return (
      <div className="p-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-4">AI-forbrug</h1>
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">{result.error}</div>
      </div>
    )
  }
  return <AIUsageClient data={result.data} />
}
```

- [ ] **Step 3: Opret client component**

`src/app/(dashboard)/settings/ai-usage/ai-usage-client.tsx`:

```tsx
'use client'

import type { AIUsageDashboardData } from '@/actions/ai-usage'
import { labelForAIFeature } from '@/lib/labels'
import { formatDate } from '@/lib/labels'

interface Props {
  data: AIUsageDashboardData
}

export function AIUsageClient({ data }: Props) {
  const progressColor =
    data.threshold === 'exceeded'
      ? 'bg-red-600'
      : data.threshold === '90-alert'
        ? 'bg-red-500'
        : data.threshold === '75-warn'
          ? 'bg-amber-500'
          : data.threshold === '50-info'
            ? 'bg-blue-500'
            : 'bg-emerald-500'

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">AI-forbrug denne måned</h1>
        <p className="text-sm text-gray-500 mt-1">
          Samlet forbrug på tværs af alle AI-features i indeværende kalendermåned.
        </p>
      </div>

      {/* Cost + cap */}
      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <div className="text-3xl font-semibold text-gray-900">
              ${data.totalCostUsd.toFixed(2)}
            </div>
            <div className="text-sm text-gray-500">denne måned</div>
          </div>
          {data.capUsd !== null && (
            <div className="text-right">
              <div className="text-sm text-gray-700">Cap: ${data.capUsd.toFixed(2)}</div>
              <div className="text-xs text-gray-500">{data.percentage}% brugt</div>
            </div>
          )}
        </div>
        {data.capUsd !== null && (
          <div className="w-full h-2 rounded-full bg-gray-200 overflow-hidden">
            <div
              className={`h-full ${progressColor} transition-all`}
              style={{ width: `${Math.min(100, data.percentage)}%` }}
            />
          </div>
        )}
        {data.threshold === 'exceeded' && (
          <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">
            Månedlig cap er nået. AI-kald afvises indtil ny måned eller cap øges.
          </div>
        )}
        {data.threshold === '90-alert' && (
          <div className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
            Over 90% af månedlig cap brugt. Kontakt admin om nødvendigt at hæve.
          </div>
        )}
      </section>

      {/* Breakdown pr. feature */}
      <section>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Pr. feature</h2>
        {data.byFeature.length === 0 ? (
          <div className="text-sm text-gray-500">Intet AI-forbrug endnu denne måned.</div>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
            {data.byFeature.map((row) => (
              <div key={row.feature} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-gray-700">{labelForAIFeature(row.feature)}</span>
                <span className="text-sm font-medium text-gray-900 tabular-nums">
                  ${row.costUsd.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Breakdown pr. model */}
      <section>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Pr. model</h2>
        {data.byModel.length === 0 ? (
          <div className="text-sm text-gray-500">Ingen model-aktivitet endnu.</div>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
            {data.byModel.map((row) => (
              <div key={row.model} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-gray-700 font-mono">{row.model}</span>
                <span className="text-sm font-medium text-gray-900 tabular-nums">
                  ${row.costUsd.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Seneste kald */}
      <section>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Seneste 25 kald</h2>
        {data.recent.length === 0 ? (
          <div className="text-sm text-gray-500">Ingen kald registreret endnu.</div>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-2 text-left">Tidspunkt</th>
                  <th className="px-4 py-2 text-left">Feature</th>
                  <th className="px-4 py-2 text-left">Model</th>
                  <th className="px-4 py-2 text-right">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.recent.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-2 text-gray-600">{formatDate(row.createdAt)}</td>
                    <td className="px-4 py-2 text-gray-700">{labelForAIFeature(row.feature)}</td>
                    <td className="px-4 py-2 text-gray-500 font-mono text-xs">{row.model}</td>
                    <td className="px-4 py-2 text-right text-gray-900 tabular-nums">
                      ${row.costUsd.toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
```

- [ ] **Step 4: Tilføj link i sidebar (nav-config.ts)**

Åbn `src/lib/nav-config.ts`. Find hvor `Indstillinger` defineres og overvej om AI-usage skal være subpage af settings eller separat entry. Simplest: tilføj som sub-link under settings (hvis sidebar understøtter det) ELLER som separat item kun synlig for admin-roller.

Pragmatisk minimum: Lad siden være tilgængelig via direkte URL `/settings/ai-usage`. Link fra `/settings` page ved at tilføje en knap/link:

I `src/app/(dashboard)/settings/page.tsx` (eksisterer), tilføj et link til AI-usage-siden hvis brugeren er admin.

- [ ] **Step 5: Verificér i browser**

```bash
npm run dev
# Login som philip@chainhub.dk (GROUP_OWNER)
# Naviger til /settings/ai-usage
```

Verificér:

- Siden renderer
- Progress-bar vises korrekt (eller tom-state hvis ingen data)
- Seneste-kald-tabel renderer
- Non-admin får 403 (test ved at skifte rolle på maria@tandlaegegruppen.dk → GROUP_LEGAL og prøve)

- [ ] **Step 6: Kør gate**

```bash
npx tsc --noEmit
npm run lint 2>&1 | tail -3
npm test 2>&1 | tail -3
```

Alle grønne.

- [ ] **Step 7: Commit**

```bash
git add src/app/(dashboard)/settings/ai-usage/ src/lib/labels.ts src/app/(dashboard)/settings/page.tsx
git commit -m "feat(settings): AI-usage dashboard på /settings/ai-usage"
```

---

### Task 10: AI cost-research script + dokument

**Files:**

- Create: `scripts/ai-cost-research.ts`
- Create: `docs/build/AI-COST-MODEL.md`

Research-fasen: kør en håndfuld real-world queries, mål reelt forbrug, skriv findings ned. Extraction-pipelinen er ikke wired i A.0 — derfor målt FOR extraction = estimat baseret på gold-standard-dokument-passes; målt FOR insights = seed-data runs over 1 uge.

- [ ] **Step 1: Opret research-script**

`scripts/ai-cost-research.ts`:

```ts
/**
 * AI-cost-research: Kør company-insights mod seed-data og log reel forbrug.
 * Output bruges som input til docs/build/AI-COST-MODEL.md.
 *
 * Kør: tsx scripts/ai-cost-research.ts
 * Kræver: ANTHROPIC_API_KEY + AI_EXTRACTION_ENABLED=true + OrganizationAISettings.ai_mode=LIVE
 */

import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

import { prisma } from '@/lib/db'
import { getMonthlyUsage } from '@/lib/ai/usage'
import { createLogger } from '@/lib/ai/logger'

const log = createLogger('cost-research')

async function main() {
  log.info('Starting AI cost research')

  // Find seed-organisation
  const org = await prisma.organization.findFirst({ orderBy: { created_at: 'asc' } })
  if (!org) throw new Error('No organization — run prisma db seed first')
  log.info({ orgId: org.id, name: org.name }, 'Using organization')

  // Find alle selskaber med data
  const companies = await prisma.company.findMany({
    where: { organization_id: org.id, deleted_at: null },
    take: 10,
  })
  log.info({ count: companies.length }, 'Companies to test')

  // Rapporter eksisterende forbrug FØR vi triggr nye kald
  const beforeUsage = await getMonthlyUsage(org.id)
  log.info({ before: beforeUsage }, 'Usage before test')

  log.info('Next step: Åbn /companies/<id> i browser 10 gange for at trigge insights.')
  log.info(
    'Efter 10 page-loads, genkør dette script (eller query /settings/ai-usage) for sammenligning.'
  )

  // Hvis vi vil auto-trigge uden at gå via UI: kald generateCompanyInsights direkte
  // MEN: det kræver at vi bygger snapshot-input manuelt. Holdes ude af scriptet her
  // for at undgå at duplicere den logik. Manuel browsing er mere repræsentativt.

  await prisma.$disconnect()
}

main().catch((err) => {
  log.error({ err: err instanceof Error ? err.message : String(err) }, 'Research script failed')
  process.exit(1)
})
```

- [ ] **Step 2: Kør scriptet (manuelt — bruger-aktion)**

```bash
npm run dev &  # eller separat terminal
npx tsx scripts/ai-cost-research.ts
```

Browse til 10 forskellige selskaber på `/companies` i ca. 5-10 min (insights cache 24h, så nye kald hver gang IKKE sker — du får reelt måling første gang for hvert selskab).

Check på `/settings/ai-usage` at der nu er logs.

- [ ] **Step 3: Skriv `docs/build/AI-COST-MODEL.md`**

Opret dokumentet med struktureret indhold:

```markdown
# AI Cost Model — ChainHub

**Opdateret:** 2026-04-18
**Status:** Levende dokument. Opdateres pr. Phase B + Phase C pilot.
**Kilde til priser:** `claude.com/pricing` (verified 2026-04-18)

## 1. Verified model-priser (Anthropic Direct)

| Model             | Input ($/MTok) | Output ($/MTok) | Cache write | Cache read |
| ----------------- | -------------- | --------------- | ----------- | ---------- |
| Claude Opus 4.7   | $5             | $25             | $6.25       | $0.50      |
| Claude Sonnet 4.6 | $3             | $15             | $3.75       | $0.30      |
| Claude Haiku 4.5  | $1             | $5              | $1.25       | $0.10      |

Batch processing: 50% rabat af input+output. US-only inference: 1.1× multiplier. Prompt-caching TTL: 5 minutter.

## 2. Målte tal (fra A.0 research)

### Company-insights (Haiku 4.5)

- **Gennemsnit input-tokens:** _[udfyld efter kørsel]_
- **Gennemsnit output-tokens:** _[udfyld efter kørsel]_
- **Gennemsnit cost pr. kald:** _[udfyld]_
- **Cache-TTL i DB:** 24h → typisk 1-30 regenerations/selskab/måned
- **Projektion pr. selskab/måned:** _[udfyld: snit-cost × forventet regens]_

### Document-extraction (Sonnet 4.6 + Haiku for pass 1/3/5)

**Status A.0:** Ikke målt. Pipeline er dormant. Estimeret fra token-budgetter i `src/lib/ai/pipeline/`:

- Pass 1 (type-detection, Haiku): ~15k input + 100 output = ~$0.015
- Pass 2 (schema-extraction, Sonnet × 2 runs): 2 × (15k input + 3k output) = ~$0.180
- Pass 3 (source-verification, Haiku): ~$0.015
- Pass 4 (sanity-check, regel-baseret, 0 AI-cost)
- Pass 5 (cross-validation, Haiku): ~$0.015
- **Estimat pr. dokument:** ~$0.22-0.25
- **Worst-case (re-runs ved lav confidence):** ~$0.50

**Validering:** Skal måles i Phase B.1 med reel kontrakt-pipeline. Dette estimat genbesøges.

### Portfolio-insights (Phase C — ikke målt endnu)

Projektion: ~20k input + 3k output Haiku pr. kald = ~$0.028. Daglig refresh = ~$0.84/måned/org.

### RAG (Phase C — ikke målt endnu)

Projektion: ~5k input + 500 output Sonnet pr. query + retrieval = ~$0.022. 100 queries/måned = ~$2.20.

## 3. Bedrock-priser — status

Verificerede offentlige priser (fra `aws.amazon.com/bedrock/pricing` 2026-04-18):

| Model                | Region  | Input ($/MTok) | Output ($/MTok) |
| -------------------- | ------- | -------------- | --------------- |
| Claude 3.5 Sonnet v2 | US East | $6             | $30             |

**Frankfurt-priser og Haiku/Opus-priser er IKKE offentligt listet.** Skal forhandles/undersøges med AWS account team før Bedrock-migration kan prissættes.

Foreløbig observation: Bedrock 3.5 Sonnet US East ($6/$30) er ~2× Anthropic Direct Sonnet 4.6 ($3/$15) — men det er forskellige modeller. Same-model-sammenligning kræver verificering.

## 4. Volume-modellering — skitse

_Skal udfyldes når målte tal fra sektion 2 er komplette._

Kunde-profiler:

| Profil | Selskaber | Kontrakter/måned | Forventet månedligt AI-cost |
| ------ | --------- | ---------------- | --------------------------- |
| S      | 10        | 2                | ~$\_?                       |
| M      | 30        | 5                | ~$\_?                       |
| L      | 50        | 10               | ~$\_?                       |
| XL     | 80        | 30               | ~$\_?                       |

## 5. Pricing-implikationer (placeholder)

Til endelig prissætning: AI-cost skal være <20% af Tier 2-pris og <15% af Tier 3-pris for sunde marginer.

Placeholder-regneeksempel:

- M-kunde på Tier 2, AI-cost ~$X/måned → minimum fair pris ~$X × 5 = $5X/måned (inkl. drift)

**Endelig pris låses i Phase A.2 beslutning efter Phase B.1 måling.**

## 6. Beslutnings-triggere til Bedrock-migration

Migrér når mindst én rammer (se `2026-04-18-product-roadmap.md` afsnit 8.3):

- Kunde stiller eksplicit krav om EU data-residency
- Målt månedlig spend >$2.000 + Provisioned Throughput rabat ≥25%
- Rate-limits rammer i produktion
- Juridisk rådgivning kræver det

## 7. Bruger-actions / åbne spørgsmål

- [ ] Udfyld sektion 2 company-insights efter /settings/ai-usage viser data fra research-kørsel
- [ ] Verificér Bedrock Frankfurt + Haiku + Opus priser med AWS account team
- [ ] Kør extraction-cost-måling i Phase B.1 (erstatter estimatet)
- [ ] Fastlæg endelige margin-mål pr. tier (15% Tier 2 / 10% Tier 3?)

---

_Dette dokument er levende. Enhver ny måling opdateres her. Sidste ændring: 2026-04-18 Phase A.0._
```

- [ ] **Step 4: Commit dokumentet (uden målte tal endnu)**

```bash
git add docs/build/AI-COST-MODEL.md scripts/ai-cost-research.ts
git commit -m "docs(ai): AI-COST-MODEL template + research-script"
```

Målte tal udfyldes i en separat commit når data er indsamlet (Step 2-output).

---

### Task 11: Full gate + PROGRESS-opdatering

- [ ] **Step 1: Full gate**

```bash
npm run format:check
npm run lint
npx tsc --noEmit
npm test
rm -rf .next && npx next build
```

Forventet:

- format ✅
- lint: 0 errors (evt. 2 pre-existing no-autofocus warnings)
- tsc: 0
- tests: 627 → ~655 passed
- build: grøn

- [ ] **Step 2: Smoke-test i browser**

Kør `npm run dev` og verificér:

- `/settings/ai-usage` renderer for GROUP_OWNER
- `/settings/ai-usage` giver 403 for GROUP_LEGAL (eller ikke-admin)
- `/companies/<id>` renderer uanset AI-mode (graceful degradation)
- Worker kan startes `npm run worker:dev` og lukkes pænt med Ctrl+C

- [ ] **Step 3: Opdater PROGRESS.md**

Tilføj efter "Tech-debt cleanup"-afsnittet:

```markdown
## Phase A.0 — AI infrastructure + cost-research ✅ (2026-04-18)

Første leverance af produkt-roadmap (`docs/superpowers/plans/2026-04-18-product-roadmap.md` afsnit 9).

- [x] **Schema:** `AIUsageLog`-model tilføjet — per-call tracking af tokens + cost
- [x] **MODEL_COSTS opdateret** med verified priser fra claude.com/pricing 2026-04-18. Opus + cache-pricing tilføjet
- [x] **`src/lib/ai/usage.ts`** — `recordAIUsage` + `getMonthlyUsage` helpers + 4 unit-tests
- [x] **`src/lib/ai/cost-cap.ts`** — `checkCostCap` + `getCostCapStatus` enforcement + 7 unit-tests
- [x] **Retrofit company-insights** — isAIEnabled + checkCostCap + recordAIUsage wired
- [x] **Retrofit extraction-job** — samme enforcement-hooks (klar til Phase B wiring)
- [x] **Worker-proces** `scripts/worker.ts` + `npm run worker:dev` — pg-boss workers klar
- [x] **Admin-UI** `/settings/ai-usage` med månedligt overblik, cap-progress, pr.-feature/model breakdown, seneste-25 kald
- [x] **`docs/build/AI-COST-MODEL.md`** — levende dokument med verified priser + målte tal fra research
- [x] **AWS Bedrock ansøgning** startet som forsikring (ekstern, ikke kode)
- [x] Tests: 627 → ~655 passed
- [x] Gate: format ✅, lint ✅, tsc ✅, build ✅

Unblocker: Phase A.2 pricing-beslutning kræver AI-COST-MODEL-outputs. Basis-tier kan prissættes nu; Plus/Enterprise venter på Phase B.1 måling.
```

- [ ] **Step 4: Commit**

```bash
git add docs/status/PROGRESS.md
git commit -m "docs(status): Phase A.0 complete — AI infrastructure + cost-research klar"
```

---

## Kritiske filer (quick reference)

**Nye kerne-moduler:**

- `src/lib/ai/usage.ts`
- `src/lib/ai/cost-cap.ts`

**Nye endpoints/UI:**

- `src/actions/ai-usage.ts`
- `src/app/(dashboard)/settings/ai-usage/page.tsx` + `ai-usage-client.tsx`

**Ny infrastruktur:**

- `scripts/worker.ts` — pg-boss-worker
- `scripts/ai-cost-research.ts` — måling

**Test-filer:**

- `src/__tests__/ai/usage.test.ts`
- `src/__tests__/ai/cost-cap.test.ts`
- `src/__tests__/ai-usage-actions.test.ts`

**Ændrede filer:**

- `prisma/schema.prisma` (+ migration)
- `src/lib/ai/client/types.ts`
- `src/lib/ai/jobs/company-insights.ts`
- `src/lib/ai/jobs/extract-document.ts`
- `src/actions/company-detail.ts`
- `src/lib/labels.ts`
- `package.json`
- `docs/status/PROGRESS.md`

---

## Verification

**Teknisk gate:**

```bash
npm run format:check       # clean
npm run lint               # 0 errors
npx tsc --noEmit           # 0 errors
npm test                   # ~655 passed
npx next build             # grøn
```

**Metrics:**

```bash
# Worker kan starte + lukke
npm run worker:dev   # → "Worker ready — waiting for jobs", Ctrl+C → "Worker stopped"

# AIUsageLog har data efter 3-4 /companies/[id]-besøg med ai_mode=LIVE
psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"AIUsageLog\";"  # > 0

# /settings/ai-usage renderer
curl -I http://localhost:3000/settings/ai-usage -H "Cookie: <session>"  # 200 for admin
```

**Acceptance:**

- ✅ `AIUsageLog`-model i schema, migreret til DB
- ✅ `MODEL_COSTS` opdateret med verified 2026-04-18-priser
- ✅ `recordAIUsage` kaldes efter hvert AI-kald i company-insights + extraction
- ✅ `isAIEnabled` + `checkCostCap` gate alle AI-kald; graceful degradation ved skip
- ✅ `/settings/ai-usage` viser korrekt data for admin, 403 for non-admin
- ✅ `scripts/worker.ts` kan startes + lukkes pænt
- ✅ `docs/build/AI-COST-MODEL.md` eksisterer med verified priser + research-placeholder
- ✅ Tests: 627 → ~655 passed, 0 failed
- ✅ PROGRESS.md opdateret

**Ikke-mål (egne sprints):**

- Wire extraction-pipelinen til upload-flow (Phase B.1)
- Bedrock-implementation (Phase C.3)
- Cost-alert emails (fremtidig feature — threshold computed, sending ikke implementeret)
- AI-usage-historik (>1 måned tilbage) — kan tilføjes senere
- Eksport af usage-data til CSV — post-launch nice-to-have
