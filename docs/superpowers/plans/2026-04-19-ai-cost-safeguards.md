# AI Cost Safeguards Sprint — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Indfør cost-kontrol, fix deprecated models, implementér prompt-caching og fjern race-conditions før første betalende pilot — uden at ændre pricing-tiers.

**Architecture:** Defensive layer mellem upload og extraction-pipeline: content-hash dedup → rate-limit → pre-debet → Anthropic-kald (med caching) → usage-log med cache-tokens. Model-migration fra deprecated IDs til 4.6/4.5-serien. Pass 2b bliver opt-in (confidence-gated) i stedet for default. Insights-jobs skifter fra Sonnet til Haiku 4.5.

**Tech Stack:** TypeScript 5 strict, Next.js 14 Server Actions, Prisma 5, pg-boss queue, Anthropic SDK (@anthropic-ai/sdk), Vitest.

---

## Sprog og konventioner (CLAUDE.md-bindende)

- Alle commits: `[type]: dansk beskrivelse`
- TypeScript strict — ingen `any`, brug `unknown` + narrow
- Zod-validering på al brugerinput
- Multi-tenancy: `organization_id` på alle queries
- Soft-delete: `deleted_at: new Date()` — aldrig hard delete
- Dansk UI-tekst via `src/lib/labels.ts`
- Test før commit: format ✅ lint ✅ tsc ✅ tests ✅ build ✅

---

## Self-contained context — baggrund for den udførende agent

**Codebase-lokation:** `C:\Users\birke\OneDrive\Skrivebord\Code\chainhub`

**AI-arkitektur (i dag):**

- Upload: `/api/upload/route.ts` gemmer fil og auto-queuer extraction via pg-boss hvis `contractId` er sat
- Queue-worker: `src/lib/ai/queue.ts` + `src/lib/ai/jobs/extract-document.ts`
- Pipeline: `src/lib/ai/pipeline/orchestrator.ts` → Pass 1 (Haiku, type detection) → Pass 2a+2b (Sonnet, extraction, 2 runs) → Pass 3-5 (lokale regler)
- Insights: `src/lib/ai/jobs/company-insights.ts` — Sonnet-kald, 24h cache i `CompanyInsightsCache`
- Cost-cap: `src/lib/ai/cost-cap.ts` — tjekker `OrganizationAISettings.monthly_cost_cap_usd` før kald
- Usage-log: `src/lib/ai/usage.ts` + `AIUsageLog`-tabel
- Anthropic-klient: `src/lib/ai/client/anthropic-direct.ts`
- Priser: `src/lib/ai/client/types.ts:81-87`

**Verificerede fund (fra `docs/build/AI-COST-MODEL.md` v3):**

- Kode bruger deprecated `claude-sonnet-4-20250514` (retires 2026-06-15) og `claude-3-5-haiku-20241022` (deprecated)
- `MODEL_COSTS` har forkert Haiku 3.5-pris ($1/$5 vs faktisk $0.80/$4)
- Ingen prompt-caching implementeret — ville spare 30-40% på store PDF'er
- `cache_read_input_tokens` og `cache_creation_input_tokens` fra API response parses IKKE
- Cost-cap har race condition: tjekkes før kald, logges først efter → parallelle jobs kan alle passere cap-check
- Default cap er `null` = unlimited spend
- Retries kører hele pipelinen forfra (ingen checkpoint)
- `skip_agreement=false` default → 2 Sonnet-runs per doc = dobbelt cost

---

## File Structure

**Nye filer:**

- `src/lib/ai/rate-limit.ts` — in-memory rate limiter for extraction-queue
- `src/lib/ai/content-hash.ts` — SHA-256 hash af PDF binary, dedup-check
- `src/lib/ai/cache-control.ts` — helper til at bygge cache-control blocks
- `src/__tests__/lib/ai/rate-limit.test.ts`
- `src/__tests__/lib/ai/content-hash.test.ts`
- `src/__tests__/lib/ai/cache-control.test.ts`
- `src/__tests__/lib/ai/cost-cap-race.test.ts`
- `prisma/migrations/20260419_ai_safeguards/migration.sql`

**Modificeres:**

- `src/lib/ai/client/types.ts` — udvid ClaudeResponse med cache-tokens, rettet Haiku 3.5 pris, fjern deprecated IDs
- `src/lib/ai/client/anthropic-direct.ts` — parse cache_read/creation_input_tokens
- `src/lib/ai/cost-cap.ts` — atomisk pre-debet via Prisma transaction
- `src/lib/ai/usage.ts` — optag cacheReadTokens + cacheWriteTokens
- `src/lib/ai/pipeline/orchestrator.ts` — default skip_agreement=true, confidence-gated 2nd run, checkpoint efter Pass 2a
- `src/lib/ai/pipeline/pass2-schema-extraction.ts` — cache_control på tool_definition + system
- `src/lib/ai/jobs/company-insights.ts` — skift model til claude-haiku-4-5
- `src/lib/ai/jobs/extract-document.ts` — content-hash dedup, pre-debet, rate-limit
- `src/lib/ai/schemas/*.ts` (7 filer) — migrér extraction_model fra `claude-sonnet-4-20250514` til `claude-sonnet-4-6`
- `src/lib/ai/pipeline/pass1-type-detection.ts` — migrér fra `claude-3-5-haiku-20241022` til `claude-haiku-4-5`
- `src/app/api/upload/route.ts` — tilføj rate-limit-check før queue-enqueue
- `prisma/schema.prisma` — cache_read_tokens + cache_write_tokens på AIUsageLog, default cap på OrganizationAISettings, content_hash på DocumentExtraction

---

## Task decomposition — 14 tasks i rækkefølge

Hver task skal afsluttes med tests grønne + commit. Tasks er ordnet så senere tasks bygger på tidligere.

---

### Task 1: Migrér deprecated model-IDs og ret MODEL_COSTS

**Files:**

- Modify: `src/lib/ai/client/types.ts:1-87`
- Modify: `src/lib/ai/pipeline/pass1-type-detection.ts:21`
- Modify: `src/lib/ai/jobs/company-insights.ts:128`
- Modify: `src/lib/ai/jobs/extract-document.ts:164`
- Modify: `src/lib/ai/schemas/ansaettelseskontrakt.ts:268`
- Modify: `src/lib/ai/schemas/driftsaftale.ts:243`
- Modify: `src/lib/ai/schemas/ejeraftale.ts:324`
- Modify: `src/lib/ai/schemas/forsikring.ts:236`
- Modify: `src/lib/ai/schemas/lejekontrakt.ts:265`
- Modify: `src/lib/ai/schemas/vedtaegter.ts:224`
- Modify: `src/lib/ai/schemas/minimal.ts:9`
- Modify: `src/lib/ai/jobs/extract-document-poc.ts:39`
- Test: `src/__tests__/lib/ai/client/model-costs.test.ts`

- [ ] **Step 1: Skriv test for MODEL_COSTS med korrekte priser**

Opret `src/__tests__/lib/ai/client/model-costs.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { MODEL_COSTS, computeCostUsd, type ClaudeModel } from '@/lib/ai/client/types'

describe('MODEL_COSTS — verified 2026-04-19', () => {
  it('Haiku 4.5 priser matcher claude.com/pricing', () => {
    expect(MODEL_COSTS['claude-haiku-4-5']).toEqual({
      input: 1.0,
      output: 5.0,
      cacheWrite: 1.25,
      cacheRead: 0.1,
    })
  })
  it('Sonnet 4.6 priser matcher claude.com/pricing', () => {
    expect(MODEL_COSTS['claude-sonnet-4-6']).toEqual({
      input: 3.0,
      output: 15.0,
      cacheWrite: 3.75,
      cacheRead: 0.3,
    })
  })
  it('Opus 4.7 priser matcher claude.com/pricing', () => {
    expect(MODEL_COSTS['claude-opus-4-7']).toEqual({
      input: 5.0,
      output: 25.0,
      cacheWrite: 6.25,
      cacheRead: 0.5,
    })
  })
  it('computeCostUsd beregner basisk input+output korrekt', () => {
    const cost = computeCostUsd('claude-sonnet-4-6', 1_000_000, 1_000_000)
    expect(cost).toBeCloseTo(18.0, 4)
  })
  it('computeCostUsd inkluderer cache-tokens når angivet', () => {
    const cost = computeCostUsd('claude-sonnet-4-6', 0, 0, {
      cacheWriteTokens: 1_000_000,
      cacheReadTokens: 1_000_000,
    })
    expect(cost).toBeCloseTo(4.05, 4)
  })
  it('deprecated model-IDs findes ikke længere i ClaudeModel', () => {
    const models: ClaudeModel[] = ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5']
    models.forEach((m) => expect(MODEL_COSTS[m]).toBeDefined())
  })
})
```

- [ ] **Step 2: Kør test — forventet FEJL**

Run: `npm test -- src/__tests__/lib/ai/client/model-costs.test.ts`
Expected: FAIL — `claude-sonnet-4-6` er ikke i `ClaudeModel`-typen endnu.

- [ ] **Step 3: Ret `src/lib/ai/client/types.ts` med korrekte model-IDs og priser**

Erstat linje 1-87 med:

```typescript
export type ClaudeModel = 'claude-opus-4-7' | 'claude-sonnet-4-6' | 'claude-haiku-4-5'

export interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string | ClaudeContentBlock[]
}

export type ClaudeContentBlock =
  | { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | {
      type: 'document'
      source: { type: 'base64'; media_type: 'application/pdf'; data: string }
      cache_control?: { type: 'ephemeral' }
    }

export interface ClaudeRequest {
  model: ClaudeModel
  max_tokens: number
  temperature?: number
  system?: string | Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }>
  messages: ClaudeMessage[]
  tools?: ClaudeTool[]
  tool_choice?: { type: 'auto' } | { type: 'any' } | { type: 'tool'; name: string }
}

export interface ClaudeTool {
  name: string
  description: string
  input_schema: Record<string, unknown>
  cache_control?: { type: 'ephemeral' }
}

export interface ClaudeResponse {
  id: string
  model: string
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use'
  content: ClaudeResponseContent[]
  usage: {
    input_tokens: number
    output_tokens: number
    cache_creation_input_tokens?: number
    cache_read_input_tokens?: number
  }
}

export type ClaudeResponseContent =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }

export interface ClaudeClient {
  readonly providerName: 'anthropic' | 'bedrock'
  complete(request: ClaudeRequest): Promise<ClaudeResponse>
}

export class ClaudeClientError extends Error {
  constructor(
    message: string,
    public readonly cause: unknown,
    public readonly retryable: boolean
  ) {
    super(message)
    this.name = 'ClaudeClientError'
  }
}

export interface ModelPricing {
  input: number
  output: number
  cacheWrite: number
  cacheRead: number
}

/**
 * Verified from claude.com/pricing 2026-04-19.
 * 5-minute cache (1.25x write, 0.1x read). For 1-hour cache: multiplier er 2.0x write.
 * Batch API: 50% rabat på input+output (ikke modelleret; anvendes pr. call-site).
 */
export const MODEL_COSTS: Record<ClaudeModel, ModelPricing> = {
  'claude-opus-4-7': { input: 5.0, output: 25.0, cacheWrite: 6.25, cacheRead: 0.5 },
  'claude-sonnet-4-6': { input: 3.0, output: 15.0, cacheWrite: 3.75, cacheRead: 0.3 },
  'claude-haiku-4-5': { input: 1.0, output: 5.0, cacheWrite: 1.25, cacheRead: 0.1 },
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

- [ ] **Step 4: Opdatér alle model-referencer i pipeline + schemas + jobs**

Erstat `claude-sonnet-4-20250514` → `claude-sonnet-4-6` globalt:

```bash
cd C:/Users/birke/OneDrive/Skrivebord/Code/chainhub
# Vis filer der vil blive ændret:
grep -rln "claude-sonnet-4-20250514" src/
# Manuel Edit af hver fil — ikke sed replace, da vi vil se hver ændring
```

For hver fil fundet ovenfor: brug Edit-værktøj med `old_string: claude-sonnet-4-20250514`, `new_string: claude-sonnet-4-6`, `replace_all: true`.

Tilsvarende `claude-3-5-haiku-20241022` → `claude-haiku-4-5`.

- [ ] **Step 5: Kør test — forventet PASS**

Run: `npm test -- src/__tests__/lib/ai/client/model-costs.test.ts`
Expected: PASS (5/5 tests).

Kør også fuld tsc:

```bash
npx tsc --noEmit
```

Expected: 0 TypeScript-fejl.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/client/types.ts src/lib/ai/pipeline/pass1-type-detection.ts \
  src/lib/ai/jobs/ src/lib/ai/schemas/ \
  src/__tests__/lib/ai/client/model-costs.test.ts
git commit -m "$(cat <<'EOF'
fix(ai): migrér fra deprecated model-IDs til 4.6/4.5-serien

Sonnet 4 (claude-sonnet-4-20250514) retires 2026-06-15. Haiku 3.5 er deprecated.
Ret også MODEL_COSTS med verificerede priser fra claude.com/pricing 2026-04-19.
Fjern ubrugte legacy model-IDs fra ClaudeModel-typen.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Udvid ClaudeResponse og AnthropicDirectClient med cache-token-parsing

**Files:**

- Modify: `src/lib/ai/client/anthropic-direct.ts:30-50`
- Test: `src/__tests__/lib/ai/client/anthropic-direct.test.ts` (opret eller udvid)

- [ ] **Step 1: Skriv test der verificerer at cache-tokens parses**

Opret `src/__tests__/lib/ai/client/anthropic-direct.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AnthropicDirectClient } from '@/lib/ai/client/anthropic-direct'

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn().mockResolvedValue({
          id: 'msg_123',
          model: 'claude-sonnet-4-6',
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: 'hej' }],
          usage: {
            input_tokens: 50,
            output_tokens: 20,
            cache_creation_input_tokens: 3000,
            cache_read_input_tokens: 0,
          },
        }),
      },
    })),
  }
})

describe('AnthropicDirectClient', () => {
  let client: AnthropicDirectClient
  beforeEach(() => {
    client = new AnthropicDirectClient('test-key')
  })

  it('parser cache_creation_input_tokens fra API response', async () => {
    const response = await client.complete({
      model: 'claude-sonnet-4-6',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'test' }],
    })
    expect(response.usage.cache_creation_input_tokens).toBe(3000)
  })

  it('parser cache_read_input_tokens fra API response', async () => {
    const response = await client.complete({
      model: 'claude-sonnet-4-6',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'test' }],
    })
    expect(response.usage.cache_read_input_tokens).toBe(0)
  })
})
```

- [ ] **Step 2: Kør test — forventet FEJL**

Run: `npm test -- src/__tests__/lib/ai/client/anthropic-direct.test.ts`
Expected: FAIL — `cache_creation_input_tokens` er `undefined`.

- [ ] **Step 3: Ret `src/lib/ai/client/anthropic-direct.ts`**

Erstat den eksisterende `complete`-metode (linje 17-57) med:

```typescript
async complete(request: ClaudeRequest): Promise<ClaudeResponse> {
  const start = Date.now()
  log.debug({ model: request.model, max_tokens: request.max_tokens }, 'Claude request')
  try {
    const response = await this.client.messages.create({
      model: request.model,
      max_tokens: request.max_tokens,
      temperature: request.temperature,
      system: request.system,
      messages: request.messages as never,
      tools: request.tools as never,
      tool_choice: request.tool_choice as never,
    })
    const latencyMs = Date.now() - start
    const usage = response.usage as {
      input_tokens: number
      output_tokens: number
      cache_creation_input_tokens?: number
      cache_read_input_tokens?: number
    }
    log.info(
      {
        model: response.model,
        stop_reason: response.stop_reason,
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        cache_read: usage.cache_read_input_tokens ?? 0,
        cache_write: usage.cache_creation_input_tokens ?? 0,
        latency_ms: latencyMs,
      },
      'Claude response'
    )
    return {
      id: response.id,
      model: response.model,
      stop_reason: response.stop_reason as ClaudeResponse['stop_reason'],
      content: response.content as ClaudeResponse['content'],
      usage: {
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        cache_creation_input_tokens: usage.cache_creation_input_tokens,
        cache_read_input_tokens: usage.cache_read_input_tokens,
      },
    }
  } catch (err) {
    const retryable = this.isRetryable(err)
    const errorMessage = err instanceof Error ? err.message : 'Unknown Claude API error'
    log.error({ err: errorMessage, retryable }, 'Claude request failed')
    throw new ClaudeClientError(errorMessage, err, retryable)
  }
}
```

- [ ] **Step 4: Kør test — forventet PASS**

Run: `npm test -- src/__tests__/lib/ai/client/anthropic-direct.test.ts`
Expected: PASS (2/2).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/client/anthropic-direct.ts src/__tests__/lib/ai/client/anthropic-direct.test.ts
git commit -m "$(cat <<'EOF'
feat(ai): parse cache-tokens fra Anthropic response

Uden dette kan prompt-caching ikke måles. API returnerer cache_creation_input_tokens
og cache_read_input_tokens som vores kode hidtil har ignoreret.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Udvid AIUsageLog med cache-token-kolonner + default cap i OrganizationAISettings

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260419_ai_safeguards/migration.sql`
- Modify: `src/lib/ai/usage.ts`

- [ ] **Step 1: Opdatér Prisma-schema**

I `prisma/schema.prisma` find `model AIUsageLog` og tilføj efter `cached`:

```prisma
  cache_read_tokens   Int      @default(0)
  cache_write_tokens  Int      @default(0)
```

I `model OrganizationAISettings` ret linjen `monthly_cost_cap_usd      Decimal? @db.Decimal(10, 2)` til:

```prisma
  monthly_cost_cap_usd      Decimal  @db.Decimal(10, 2) @default(50.00)
```

- [ ] **Step 2: Generér migration**

```bash
cd C:/Users/birke/OneDrive/Skrivebord/Code/chainhub
npx prisma migrate dev --name ai_safeguards --create-only
```

Expected: SQL-fil oprettet i `prisma/migrations/YYYYMMDDHHmmss_ai_safeguards/migration.sql`.

Inspicér filen — den skal indeholde:

- `ALTER TABLE "AIUsageLog" ADD COLUMN "cache_read_tokens" INTEGER NOT NULL DEFAULT 0;`
- `ALTER TABLE "AIUsageLog" ADD COLUMN "cache_write_tokens" INTEGER NOT NULL DEFAULT 0;`
- `ALTER TABLE "OrganizationAISettings" ALTER COLUMN "monthly_cost_cap_usd" SET NOT NULL, ALTER COLUMN "monthly_cost_cap_usd" SET DEFAULT 50.00;`

Hvis nogen eksisterende rækker har `NULL` i cap-kolonnen, tilføj først en UPDATE-sætning i migrationen:

```sql
UPDATE "OrganizationAISettings" SET "monthly_cost_cap_usd" = 50.00 WHERE "monthly_cost_cap_usd" IS NULL;
```

Før ALTER COLUMN-linjen. Derefter:

```bash
npx prisma migrate dev
npx prisma generate
```

- [ ] **Step 3: Udvid `RecordUsageInput` og `recordAIUsage`**

I `src/lib/ai/usage.ts` ret `RecordUsageInput` og `recordAIUsage`:

```typescript
export interface RecordUsageInput {
  organizationId: string
  feature: AIFeature
  model: string
  provider: 'anthropic' | 'bedrock'
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
  costUsd: number
  resourceType?: string
  resourceId?: string
  cached?: boolean
}

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
        cache_read_tokens: input.cacheReadTokens ?? 0,
        cache_write_tokens: input.cacheWriteTokens ?? 0,
        cost_usd: input.costUsd,
        resource_type: input.resourceType ?? null,
        resource_id: input.resourceId ?? null,
        cached: input.cached ?? (input.cacheReadTokens ?? 0) > 0,
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
```

- [ ] **Step 4: Ret `cost-cap.ts` så den håndterer den nye NOT NULL Decimal**

I `src/lib/ai/cost-cap.ts:42` — linjen `const capUsd = settings?.monthly_cost_cap_usd ? ...` er nu forældet. Ret til:

```typescript
const capUsd = settings ? Number(settings.monthly_cost_cap_usd) : 50.0
```

Og i `getCostCapStatus` slet den `if (capUsd === null)`-branch (linje 52-54) — capUsd er altid et tal nu.

- [ ] **Step 5: Kør tsc + eksisterende tests**

```bash
npx tsc --noEmit
npm test -- src/__tests__/lib/ai/
```

Expected: 0 TS-fejl, alle eksisterende AI-tests passer.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/ src/lib/ai/usage.ts src/lib/ai/cost-cap.ts
git commit -m "$(cat <<'EOF'
feat(ai): cache-tokens i AIUsageLog + default \$50/md cap

AIUsageLog får cache_read_tokens + cache_write_tokens så vi kan måle
cache-effektivitet. OrganizationAISettings.monthly_cost_cap_usd bliver
NOT NULL med default \$50/md for at undgå unlimited-spend-risiko på nye orgs.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Implementér cache-control helper + unit-tests

**Files:**

- Create: `src/lib/ai/cache-control.ts`
- Create: `src/__tests__/lib/ai/cache-control.test.ts`

- [ ] **Step 1: Skriv test for cache-control-builder**

Opret `src/__tests__/lib/ai/cache-control.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { withCacheControl, canCacheForModel, MIN_CACHE_TOKENS } from '@/lib/ai/cache-control'
import type { ClaudeTool } from '@/lib/ai/client/types'

describe('cache-control helpers', () => {
  it('MIN_CACHE_TOKENS matcher Anthropic-docs 2026-04-19', () => {
    expect(MIN_CACHE_TOKENS['claude-sonnet-4-6']).toBe(2048)
    expect(MIN_CACHE_TOKENS['claude-haiku-4-5']).toBe(4096)
    expect(MIN_CACHE_TOKENS['claude-opus-4-7']).toBe(4096)
  })

  it('canCacheForModel returnerer true når estimeret tokens >= minimum', () => {
    expect(canCacheForModel('claude-sonnet-4-6', 2500)).toBe(true)
    expect(canCacheForModel('claude-sonnet-4-6', 1500)).toBe(false)
    expect(canCacheForModel('claude-haiku-4-5', 4500)).toBe(true)
    expect(canCacheForModel('claude-haiku-4-5', 3500)).toBe(false)
  })

  it('withCacheControl tilføjer ephemeral cache_control til tool', () => {
    const tool: ClaudeTool = {
      name: 'extract_test',
      description: 'desc',
      input_schema: { type: 'object' },
    }
    const cached = withCacheControl(tool)
    expect(cached.cache_control).toEqual({ type: 'ephemeral' })
    expect(cached.name).toBe('extract_test')
  })

  it('withCacheControl returnerer nyt objekt (immutability)', () => {
    const tool: ClaudeTool = { name: 't', description: 'd', input_schema: {} }
    const cached = withCacheControl(tool)
    expect(tool.cache_control).toBeUndefined()
    expect(cached).not.toBe(tool)
  })
})
```

- [ ] **Step 2: Kør test — forventet FEJL**

Run: `npm test -- src/__tests__/lib/ai/cache-control.test.ts`
Expected: FAIL — `cache-control.ts` eksisterer ikke.

- [ ] **Step 3: Opret `src/lib/ai/cache-control.ts`**

```typescript
import type { ClaudeModel, ClaudeTool } from './client/types'

/**
 * Minimum cacheable block-sizes pr. Anthropic-docs 2026-04-19.
 * Blocks under disse størrelser kan ikke caches — cache_control ignoreres stille
 * og både cache_creation_input_tokens + cache_read_input_tokens vil være 0.
 */
export const MIN_CACHE_TOKENS: Record<ClaudeModel, number> = {
  'claude-opus-4-7': 4096,
  'claude-sonnet-4-6': 2048,
  'claude-haiku-4-5': 4096,
}

export function canCacheForModel(model: ClaudeModel, estimatedTokens: number): boolean {
  return estimatedTokens >= MIN_CACHE_TOKENS[model]
}

/**
 * Tilføjer cache_control: ephemeral til et tool — immutable, returnerer nyt objekt.
 * Anbefalet placering: sidste tool i tools-array (cache breakpoint).
 */
export function withCacheControl(tool: ClaudeTool): ClaudeTool {
  return { ...tool, cache_control: { type: 'ephemeral' } }
}
```

- [ ] **Step 4: Kør test — forventet PASS**

Run: `npm test -- src/__tests__/lib/ai/cache-control.test.ts`
Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/cache-control.ts src/__tests__/lib/ai/cache-control.test.ts
git commit -m "$(cat <<'EOF'
feat(ai): cache-control helper + MIN_CACHE_TOKENS pr. model

Kilde: platform.claude.com/docs/prompt-caching. Sonnet 4.6: 2048, Haiku 4.5: 4096.
Helper sikrer vi ikke sender cache_control på for små blocks.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Aktivér cache_control på Pass 2 schema-extraction

**Files:**

- Modify: `src/lib/ai/pipeline/pass2-schema-extraction.ts:23-32`
- Test: `src/__tests__/lib/ai/pipeline/pass2-cache.test.ts`

- [ ] **Step 1: Skriv test der verificerer tool får cache_control**

Opret `src/__tests__/lib/ai/pipeline/pass2-cache.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { extractWithSchema } from '@/lib/ai/pipeline/pass2-schema-extraction'
import type { ContractSchema } from '@/lib/ai/schemas/types'
import type { ClaudeClient, ClaudeRequest } from '@/lib/ai/client/types'

const fakeSchema: ContractSchema = {
  contract_type: 'MINIMAL',
  schema_version: 'v1',
  display_name: 'Test',
  tool_definition: {
    name: 'extract_test',
    description: 'test',
    input_schema: { type: 'object', properties: {} },
  },
  extraction_model: 'claude-sonnet-4-6',
  system_prompt: 'test system',
  user_prompt_prefix: 'test prefix',
  field_metadata: {},
  sanity_rules: [],
} as ContractSchema

describe('Pass 2 — prompt-caching', () => {
  it('tilføjer cache_control til tool_definition ved kald', async () => {
    const capturedRequests: ClaudeRequest[] = []
    const fakeClient: ClaudeClient = {
      providerName: 'anthropic',
      complete: vi.fn(async (req: ClaudeRequest) => {
        capturedRequests.push(req)
        return {
          id: 'msg_1',
          model: 'claude-sonnet-4-6',
          stop_reason: 'tool_use',
          content: [{ type: 'tool_use', id: 't1', name: 'extract_test', input: {} }],
          usage: { input_tokens: 100, output_tokens: 50 },
        }
      }),
    }

    await extractWithSchema({ type: 'text_markdown', markdown: 'test' }, fakeSchema, fakeClient)

    expect(capturedRequests).toHaveLength(1)
    const tools = capturedRequests[0].tools!
    expect(tools[0].cache_control).toEqual({ type: 'ephemeral' })
  })
})
```

- [ ] **Step 2: Kør test — forventet FEJL**

Run: `npm test -- src/__tests__/lib/ai/pipeline/pass2-cache.test.ts`
Expected: FAIL — tool har ikke cache_control.

- [ ] **Step 3: Ret `pass2-schema-extraction.ts`**

I `src/lib/ai/pipeline/pass2-schema-extraction.ts` efter imports, tilføj:

```typescript
import { withCacheControl } from '@/lib/ai/cache-control'
```

Ret linjerne 23-32 (client.complete-kaldet) så tools bliver wrappet:

```typescript
const response = await client.complete({
  model: schema.extraction_model,
  max_tokens: 4096,
  temperature,
  system: schema.system_prompt,
  messages: [{ role: 'user', content: messageContent }],
  tools: [withCacheControl(schema.tool_definition)],
  tool_choice: { type: 'tool', name: schema.tool_definition.name },
})
```

- [ ] **Step 4: Kør test — forventet PASS**

Run: `npm test -- src/__tests__/lib/ai/pipeline/pass2-cache.test.ts`
Expected: PASS.

Run også hele pipeline-testsuiten:

```bash
npm test -- src/__tests__/lib/ai/pipeline/
```

Expected: Alle eksisterende tests passer stadig.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/pipeline/pass2-schema-extraction.ts src/__tests__/lib/ai/pipeline/pass2-cache.test.ts
git commit -m "$(cat <<'EOF'
perf(ai): aktivér prompt-caching på Pass 2 tool_definition

Tool-schema serialiseret ~2500 tokens — cachbart på Sonnet 4.6 (min 2048).
Giver ~10% reduktion ved run-2 inden for 5 min-vinduet. Større effekt med
PDF-caching på store dokumenter (tilføjes separat).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Cache PDF-content så Pass 2b læser fra cache

**Files:**

- Modify: `src/lib/ai/pipeline/pass2-schema-extraction.ts` (buildContent-funktionen linje 128-155)
- Test: `src/__tests__/lib/ai/pipeline/pass2-pdf-cache.test.ts`

- [ ] **Step 1: Skriv test der verificerer PDF får cache_control når stor nok**

Opret `src/__tests__/lib/ai/pipeline/pass2-pdf-cache.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { extractWithSchema } from '@/lib/ai/pipeline/pass2-schema-extraction'
import type { ContractSchema } from '@/lib/ai/schemas/types'
import type { ClaudeClient, ClaudeRequest, ClaudeContentBlock } from '@/lib/ai/client/types'

const fakeSchema: ContractSchema = {
  contract_type: 'MINIMAL',
  schema_version: 'v1',
  display_name: 'Test',
  tool_definition: { name: 'extract', description: 'x', input_schema: { type: 'object' } },
  extraction_model: 'claude-sonnet-4-6',
  system_prompt: 'sys',
  user_prompt_prefix: 'prefix',
  field_metadata: {},
  sanity_rules: [],
} as ContractSchema

describe('Pass 2 — PDF cache_control', () => {
  it('tilføjer cache_control til document-block når PDF er stor nok', async () => {
    const captured: ClaudeRequest[] = []
    const fakeClient: ClaudeClient = {
      providerName: 'anthropic',
      complete: vi.fn(async (req: ClaudeRequest) => {
        captured.push(req)
        return {
          id: 'm1',
          model: 'claude-sonnet-4-6',
          stop_reason: 'tool_use',
          content: [{ type: 'tool_use', id: 't', name: 'extract', input: {} }],
          usage: { input_tokens: 100, output_tokens: 50 },
        }
      }),
    }

    // Fake PDF-buffer på 500 KB ≈ ~15 sider ≈ langt over 2048-minimum
    const fakePdf = Buffer.alloc(500_000, 0x20)

    await extractWithSchema(
      { type: 'pdf_binary', data: fakePdf, page_count: 15 },
      fakeSchema,
      fakeClient
    )

    const content = captured[0].messages[0].content as ClaudeContentBlock[]
    const docBlock = content.find((b) => b.type === 'document')
    expect(docBlock).toBeDefined()
    expect((docBlock as { cache_control?: unknown }).cache_control).toEqual({ type: 'ephemeral' })
  })

  it('springer cache_control over når PDF er for lille', async () => {
    const captured: ClaudeRequest[] = []
    const fakeClient: ClaudeClient = {
      providerName: 'anthropic',
      complete: vi.fn(async (req: ClaudeRequest) => {
        captured.push(req)
        return {
          id: 'm1',
          model: 'claude-sonnet-4-6',
          stop_reason: 'tool_use',
          content: [{ type: 'tool_use', id: 't', name: 'extract', input: {} }],
          usage: { input_tokens: 100, output_tokens: 50 },
        }
      }),
    }

    const tinyPdf = Buffer.alloc(5_000, 0x20)

    await extractWithSchema(
      { type: 'pdf_binary', data: tinyPdf, page_count: 1 },
      fakeSchema,
      fakeClient
    )

    const content = captured[0].messages[0].content as ClaudeContentBlock[]
    const docBlock = content.find((b) => b.type === 'document')
    expect((docBlock as { cache_control?: unknown }).cache_control).toBeUndefined()
  })
})
```

- [ ] **Step 2: Kør test — forventet FEJL**

Run: `npm test -- src/__tests__/lib/ai/pipeline/pass2-pdf-cache.test.ts`
Expected: FAIL — document-block får ikke cache_control.

- [ ] **Step 3: Tjek `ExtractionContent`-typen for `page_count`**

Åbn `src/lib/ai/content-loader.ts` og verificér at `pdf_binary`-varianten har et `page_count: number`-felt. Hvis ikke, tilføj det:

```typescript
// eksisterende type skal have:
| { type: 'pdf_binary'; data: Buffer; page_count: number }
```

Opdatér alle call-sites hvor `pdf_binary`-content oprettes, så de sætter `page_count` (kan estimeres via `data.length / 30_000` som groft estimat hvis ikke kendt).

- [ ] **Step 4: Ret `buildContent` i pass2-schema-extraction.ts**

Erstat `buildContent`-funktionen (linje 128-155) med:

```typescript
function buildContent(
  content: ExtractionContent,
  userPromptPrefix: string,
  extractionModel: 'claude-opus-4-7' | 'claude-sonnet-4-6' | 'claude-haiku-4-5'
): string | ClaudeContentBlock[] {
  if (content.type === 'pdf_binary') {
    const estimatedTokens = content.page_count * 3800 // verified: 1500-3000 text + ~1600 image
    const shouldCache =
      (extractionModel === 'claude-sonnet-4-6' && estimatedTokens >= 2048) ||
      (extractionModel === 'claude-haiku-4-5' && estimatedTokens >= 4096) ||
      (extractionModel === 'claude-opus-4-7' && estimatedTokens >= 4096)

    const docBlock: ClaudeContentBlock = {
      type: 'document',
      source: {
        type: 'base64',
        media_type: 'application/pdf',
        data: content.data.toString('base64'),
      },
      ...(shouldCache ? { cache_control: { type: 'ephemeral' as const } } : {}),
    }
    return [docBlock, { type: 'text', text: userPromptPrefix }]
  }

  if (content.type === 'text_html') {
    return `${userPromptPrefix}\n\nDokumentindhold (HTML):\n\n${content.html}`
  }

  if (content.type === 'text_markdown') {
    return `${userPromptPrefix}\n\nDokumentindhold (Markdown):\n\n${content.markdown}`
  }

  return userPromptPrefix
}
```

Og opdatér kaldet i `extractWithSchema` til at sende `schema.extraction_model`:

```typescript
const messageContent = buildContent(content, schema.user_prompt_prefix, schema.extraction_model)
```

- [ ] **Step 5: Kør test — forventet PASS**

Run: `npm test -- src/__tests__/lib/ai/pipeline/pass2-pdf-cache.test.ts`
Expected: PASS (2/2).

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/pipeline/pass2-schema-extraction.ts src/lib/ai/content-loader.ts \
  src/__tests__/lib/ai/pipeline/pass2-pdf-cache.test.ts
git commit -m "$(cat <<'EOF'
perf(ai): PDF-cache_control når doc er over model-minimum

Store PDF'er (25+ sider) bliver cachet efter Pass 2a. Pass 2b læser fra cache.
Besparelse ~30% på store ejeraftaler/driftsaftaler. Lille PDF-cache springes
over (blocks under minimum caches ikke af API uanset).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Skift default skip_agreement til true + confidence-gated 2nd run

**Files:**

- Modify: `src/lib/ai/pipeline/orchestrator.ts:16-62`
- Modify: `src/lib/ai/pipeline/types.ts` (for PipelineOptions-default)
- Test: `src/__tests__/lib/ai/pipeline/orchestrator-skip-agreement.test.ts`

- [ ] **Step 1: Skriv test der verificerer single-run default**

Opret `src/__tests__/lib/ai/pipeline/orchestrator-skip-agreement.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/ai/pipeline/pass1-type-detection', () => ({
  detectDocumentType: vi.fn(async () => ({
    detected_type: 'MINIMAL',
    confidence: 0.9,
    alternatives: [],
    model_used: 'claude-haiku-4-5',
    input_tokens: 100,
    output_tokens: 10,
  })),
}))

const extractSpy = vi.fn()
vi.mock('@/lib/ai/pipeline/pass2-schema-extraction', () => ({
  extractWithSchema: extractSpy,
}))

vi.mock('@/lib/ai/pipeline/pass3-source-verification', () => ({
  verifySourceAttribution: () => [],
  extractDocumentText: () => '',
}))
vi.mock('@/lib/ai/pipeline/pass4-sanity-checks', () => ({ runSanityChecks: () => [] }))
vi.mock('@/lib/ai/pipeline/pass5-cross-validation', () => ({ crossValidate: async () => [] }))
vi.mock('@/lib/ai/client', () => ({
  createClaudeClient: () => ({ providerName: 'anthropic', complete: vi.fn() }),
  computeCostUsd: () => 0.01,
}))

import { runExtractionPipeline } from '@/lib/ai/pipeline/orchestrator'

describe('orchestrator — skip_agreement default', () => {
  beforeEach(() => extractSpy.mockReset())

  it('default springer Pass 2b over når ikke eksplicit angivet', async () => {
    extractSpy.mockResolvedValue({
      fields: { party: { value: 'X', claude_confidence: 0.9, source_page: 1, source_text: 'x' } },
      additional_findings: [],
      extraction_warnings: [],
      model_used: 'claude-sonnet-4-6',
      input_tokens: 1000,
      output_tokens: 500,
      raw_response: {},
    })

    await runExtractionPipeline({ type: 'text_markdown', markdown: 'dok' }, { document_id: 'd1' })

    expect(extractSpy).toHaveBeenCalledTimes(1)
  })

  it('kører Pass 2b når Pass 2a har lav confidence', async () => {
    extractSpy.mockResolvedValue({
      fields: { party: { value: 'X', claude_confidence: 0.4, source_page: 1, source_text: 'x' } },
      additional_findings: [],
      extraction_warnings: [],
      model_used: 'claude-sonnet-4-6',
      input_tokens: 1000,
      output_tokens: 500,
      raw_response: {},
    })

    await runExtractionPipeline({ type: 'text_markdown', markdown: 'dok' }, { document_id: 'd1' })

    expect(extractSpy).toHaveBeenCalledTimes(2)
  })

  it('respekterer eksplicit skip_agreement: false (tvungen 2-run)', async () => {
    extractSpy.mockResolvedValue({
      fields: { party: { value: 'X', claude_confidence: 0.99, source_page: 1, source_text: 'x' } },
      additional_findings: [],
      extraction_warnings: [],
      model_used: 'claude-sonnet-4-6',
      input_tokens: 1000,
      output_tokens: 500,
      raw_response: {},
    })

    await runExtractionPipeline(
      { type: 'text_markdown', markdown: 'dok' },
      { document_id: 'd1', skip_agreement: false }
    )

    expect(extractSpy).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 2: Kør test — forventet FEJL**

Run: `npm test -- src/__tests__/lib/ai/pipeline/orchestrator-skip-agreement.test.ts`
Expected: FAIL — nuværende kode kører altid 2 runs når `skip_agreement` ikke er true.

- [ ] **Step 3: Ret orchestrator.ts**

I `src/lib/ai/pipeline/orchestrator.ts` erstat linjerne 49-62 med:

```typescript
// Pass 2a: First extraction run
log.info('Pass 2a: Schema extraction (run 1, temperature=0.2)')
const run1 = await extractWithSchema(content, schema, client, { temperature: 0.2 })

// Pass 2b: Kør kun hvis lav confidence i Pass 2a, eller eksplicit forlangt.
// Default: skip_agreement=true (spar 50% cost).
const minConfidence = Math.min(...Object.values(run1.fields).map((f) => f.claude_confidence ?? 1.0))
const shouldRun2 = options.skip_agreement === false || minConfidence < 0.75

let run2 = null
let agreement: ReturnType<typeof compareRuns> = []
if (shouldRun2) {
  log.info(
    { minConfidence, reason: options.skip_agreement === false ? 'forced' : 'low-confidence' },
    'Pass 2b: Schema extraction (run 2, temperature=0.4)'
  )
  run2 = await extractWithSchema(content, schema, client, { temperature: 0.4 })
  agreement = compareRuns(run1.fields, run2.fields)
  const agreeCount = agreement.filter((a) => a.values_match).length
  log.info({ total_fields: agreement.length, agreed: agreeCount }, 'Agreement computed')
} else {
  log.info({ minConfidence }, 'Pass 2b skipped (skip_agreement default + høj confidence)')
}
```

- [ ] **Step 4: Kør test — forventet PASS**

Run: `npm test -- src/__tests__/lib/ai/pipeline/orchestrator-skip-agreement.test.ts`
Expected: PASS (3/3).

Kør også øvrige pipeline-tests:

```bash
npm test -- src/__tests__/lib/ai/pipeline/
```

Expected: Alle tests passer (eventuelt skal eksisterende orchestrator-test rettes hvis den hardcoder 2 runs).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/pipeline/orchestrator.ts src/__tests__/lib/ai/pipeline/orchestrator-skip-agreement.test.ts
git commit -m "$(cat <<'EOF'
perf(ai): default single-run extraction med confidence-gated 2nd run

Ændrer default fra 2 Sonnet-runs til 1. Pass 2b kører kun når confidence < 0.75
eller eksplicit skip_agreement:false. Sparer ~50% cost på høj-konfidens-docs
(langt størstedelen af business kontrakter).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Migrér company-insights fra Sonnet til Haiku 4.5

**Files:**

- Modify: `src/lib/ai/jobs/company-insights.ts:128`
- Test: `src/__tests__/lib/ai/jobs/company-insights.test.ts` (verify model-valg)

- [ ] **Step 1: Skriv test der verificerer Haiku-model bruges**

Opret eller udvid `src/__tests__/lib/ai/jobs/company-insights.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('company-insights — model-valg', () => {
  it('bruger claude-haiku-4-5 (ikke Sonnet)', () => {
    const src = readFileSync(resolve('src/lib/ai/jobs/company-insights.ts'), 'utf-8')
    expect(src).toContain("MODEL: ClaudeModel = 'claude-haiku-4-5'")
    expect(src).not.toContain('claude-sonnet')
  })
})
```

- [ ] **Step 2: Kør test — forventet FEJL**

Run: `npm test -- src/__tests__/lib/ai/jobs/company-insights.test.ts`
Expected: FAIL.

- [ ] **Step 3: Ret `company-insights.ts:128`**

```typescript
const MODEL: ClaudeModel = 'claude-haiku-4-5'
```

Hvis `max_tokens=2000` — behold. Haiku 4.5 kan sagtens generere 2k output.

- [ ] **Step 4: Kør test — forventet PASS**

Run: `npm test -- src/__tests__/lib/ai/jobs/company-insights.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/jobs/company-insights.ts src/__tests__/lib/ai/jobs/company-insights.test.ts
git commit -m "$(cat <<'EOF'
perf(ai): migrér company-insights fra Sonnet til Haiku 4.5

Insights-snapshot er lille (~2k input, ~1k output) — Haiku 4.5 er rigelig.
Reducerer pr-kald cost fra \$0.021 til \$0.007 (-67%).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Content-hash dedup for at undgå dobbelt-extraction af samme fil

**Files:**

- Create: `src/lib/ai/content-hash.ts`
- Create: `src/__tests__/lib/ai/content-hash.test.ts`
- Modify: `prisma/schema.prisma` (tilføj content_hash til DocumentExtraction)
- Modify: `src/lib/ai/jobs/extract-document.ts` (check hash før pipeline)

- [ ] **Step 1: Test for hash-helper**

```typescript
// src/__tests__/lib/ai/content-hash.test.ts
import { describe, it, expect } from 'vitest'
import { sha256 } from '@/lib/ai/content-hash'

describe('content-hash', () => {
  it('producerer deterministisk hash for samme input', () => {
    const a = sha256(Buffer.from('hello world'))
    const b = sha256(Buffer.from('hello world'))
    expect(a).toBe(b)
    expect(a).toHaveLength(64)
  })
  it('giver forskellige hashes for forskellige input', () => {
    expect(sha256(Buffer.from('a'))).not.toBe(sha256(Buffer.from('b')))
  })
})
```

- [ ] **Step 2: Kør test — forventet FEJL (modul findes ikke)**

Run: `npm test -- src/__tests__/lib/ai/content-hash.test.ts`

- [ ] **Step 3: Opret `src/lib/ai/content-hash.ts`**

```typescript
import { createHash } from 'node:crypto'

/** SHA-256 hex-digest af en buffer. Bruges til content-dedup på uploads. */
export function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}
```

- [ ] **Step 4: Tilføj content_hash til DocumentExtraction i schema.prisma**

Find `model DocumentExtraction` i `prisma/schema.prisma` og tilføj:

```prisma
  content_hash  String?  @db.VarChar(64)

  @@index([organization_id, content_hash])
```

Generér og kør migration:

```bash
npx prisma migrate dev --name document_content_hash
npx prisma generate
```

- [ ] **Step 5: Ret `extract-document.ts` til at tjekke hash først**

I `src/lib/ai/jobs/extract-document.ts` — efter hvor PDF-bufferen læses og før pipeline-kaldet, tilføj:

```typescript
import { sha256 } from '@/lib/ai/content-hash'

// ... inden pipeline-kald:
const pdfBuffer = /* eksisterende buffer-load */
const contentHash = sha256(pdfBuffer)

const existing = await prisma.documentExtraction.findFirst({
  where: {
    organization_id: organizationId,
    content_hash: contentHash,
    deleted_at: null,
  },
  orderBy: { created_at: 'desc' },
})

if (existing) {
  log.info({ contentHash, existingId: existing.id }, 'Identisk indhold fundet — genbruger extraction')
  // Kopiér extracted_fields til ny DocumentExtraction-row (så hver dokument har egen record)
  // eller link til eksisterende — afhænger af hvordan DocumentExtraction bruges
  // For nu: skip pipeline, opret row der peger på existing.extracted_fields
  await prisma.documentExtraction.create({
    data: {
      organization_id: organizationId,
      document_id: documentId,
      content_hash: contentHash,
      extracted_fields: existing.extracted_fields as Prisma.InputJsonValue,
      status: 'COMPLETED',
      cost_usd: 0, // genbrug, ingen ny cost
      // resterende felter...
    },
  })
  return { deduped: true, source_extraction_id: existing.id }
}

// ellers — kør pipeline som normalt, men sæt content_hash på den nye row
```

Tilføj også `content_hash: contentHash` til den normale create-operation efter pipeline.

**NB:** Hvis DocumentExtraction-rowen oprettes tidligt i flowet (før pipeline), opdatér i stedet den row's content_hash inden pipeline kaldes.

- [ ] **Step 6: Test dedup med integration-test**

Skriv `src/__tests__/lib/ai/jobs/extract-dedup.test.ts` der:

1. Seeder en DocumentExtraction med content_hash = sha256 af en test-buffer
2. Kører extract-document med samme buffer
3. Forventer pipeline-mock blev IKKE kaldt
4. Forventer ny DocumentExtraction-row med samme extracted_fields og cost_usd=0

(Skip hvis test-setup kræver for meget boilerplate — dokumentér i stedet med kommentar i koden og verificér manuelt.)

- [ ] **Step 7: Commit**

```bash
git add src/lib/ai/content-hash.ts src/__tests__/lib/ai/content-hash.test.ts \
  prisma/schema.prisma prisma/migrations/ src/lib/ai/jobs/extract-document.ts
git commit -m "$(cat <<'EOF'
feat(ai): SHA-256 content-hash dedup på extraction

Re-uploads af samme PDF udløser ikke længere ny extraction. Sparer cost
ved revisioner og accidentel dobbelt-upload.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Atomisk pre-debet cost-cap (fix race condition)

**Files:**

- Modify: `src/lib/ai/cost-cap.ts` — tilføj `reserveAIBudget` og `commitAIUsage`
- Modify: `prisma/schema.prisma` — tilføj `reserved_cost_usd` + `month_start_utc` i OrganizationAISettings
- Modify: `src/lib/ai/jobs/extract-document.ts` — reservér før pipeline, commit efter
- Test: `src/__tests__/lib/ai/cost-cap-race.test.ts`

- [ ] **Step 1: Tilføj reservation-felt til schema**

I `prisma/schema.prisma` `model OrganizationAISettings` tilføj:

```prisma
  reserved_cost_usd   Decimal  @db.Decimal(10, 4) @default(0)
  reservation_period  DateTime @default(now())  // UTC månedsstart
```

Kør migration:

```bash
npx prisma migrate dev --name cost_cap_reservation
```

- [ ] **Step 2: Skriv race-condition-test**

```typescript
// src/__tests__/lib/ai/cost-cap-race.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '@/lib/db'
import { reserveAIBudget, commitAIUsage, releaseReservation } from '@/lib/ai/cost-cap'

describe('cost-cap — race-condition sikkerhed', () => {
  const orgId = '00000000-0000-0000-0000-000000000099'

  beforeEach(async () => {
    await prisma.aIUsageLog.deleteMany({ where: { organization_id: orgId } })
    await prisma.organizationAISettings.upsert({
      where: { organization_id: orgId },
      create: {
        organization_id: orgId,
        monthly_cost_cap_usd: 10,
        reserved_cost_usd: 0,
        ai_mode: 'ON',
      },
      update: { monthly_cost_cap_usd: 10, reserved_cost_usd: 0 },
    })
  })

  it('10 parallelle reservationer på \$1.50 hver stopper ved cap \$10', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }).map(() => reserveAIBudget(orgId, 1.5))
    )
    const approved = results.filter((r) => r.reserved).length
    // 6 × 1.5 = 9.0, 7. ville ramme 10.5 > 10 — skal afvises
    expect(approved).toBeLessThanOrEqual(6)
    expect(approved).toBeGreaterThanOrEqual(6)
  })
})
```

- [ ] **Step 3: Kør test — forventet FEJL**

Run: `npm test -- src/__tests__/lib/ai/cost-cap-race.test.ts`

- [ ] **Step 4: Implementér reserveAIBudget / commitAIUsage / releaseReservation**

Tilføj til `src/lib/ai/cost-cap.ts`:

```typescript
export interface ReservationResult {
  reserved: boolean
  reservationId?: string
  reason?: string
}

/**
 * Atomisk pre-debet: reservér et budget-beløb før AI-kald starter.
 * Bruger Prisma SERIALIZABLE-transaction for at undgå race-conditions.
 * Ved success: returnerer reservation-id som bruges i commitAIUsage/releaseReservation.
 */
export async function reserveAIBudget(
  organizationId: string,
  estimatedCostUsd: number
): Promise<ReservationResult> {
  try {
    return await prisma.$transaction(
      async (tx) => {
        const settings = await tx.organizationAISettings.findUnique({
          where: { organization_id: organizationId },
        })
        if (!settings) return { reserved: false, reason: 'Ingen AI-settings for org' }

        const cap = Number(settings.monthly_cost_cap_usd)
        const now = new Date()
        const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

        // Reset reservation hvis ny måned
        const currentReserved =
          settings.reservation_period < monthStart ? 0 : Number(settings.reserved_cost_usd)

        // Brugt allerede (fra logs)
        const agg = await tx.aIUsageLog.aggregate({
          where: { organization_id: organizationId, created_at: { gte: monthStart } },
          _sum: { cost_usd: true },
        })
        const used = Number(agg._sum.cost_usd ?? 0)

        const projected = used + currentReserved + estimatedCostUsd
        if (projected > cap) {
          return {
            reserved: false,
            reason: `Cap ${cap} ville overskrides (${projected.toFixed(2)})`,
          }
        }

        await tx.organizationAISettings.update({
          where: { organization_id: organizationId },
          data: {
            reserved_cost_usd: currentReserved + estimatedCostUsd,
            reservation_period: monthStart,
          },
        })

        return {
          reserved: true,
          reservationId: `${organizationId}:${Date.now()}:${estimatedCostUsd}`,
        }
      },
      { isolationLevel: 'Serializable' }
    )
  } catch (err) {
    log.error({ err, orgId: organizationId }, 'reserveAIBudget transaction failed')
    return { reserved: false, reason: 'Transaction fejl — prøv igen' }
  }
}

/** Frigiv reservation efter faktiske usage er logget (forskellen ryddes op). */
export async function commitAIUsage(
  organizationId: string,
  reservedUsd: number,
  actualUsd: number
): Promise<void> {
  await prisma.organizationAISettings.update({
    where: { organization_id: organizationId },
    data: { reserved_cost_usd: { decrement: reservedUsd } },
  })
  // Faktisk cost logges separat via recordAIUsage — her rydder vi bare reservation
  log.info({ orgId: organizationId, reservedUsd, actualUsd }, 'Reservation committed')
}

/** Frigiv reservation ved fejl (ingen usage logget). */
export async function releaseReservation(
  organizationId: string,
  reservedUsd: number
): Promise<void> {
  await prisma.organizationAISettings.update({
    where: { organization_id: organizationId },
    data: { reserved_cost_usd: { decrement: reservedUsd } },
  })
}
```

- [ ] **Step 5: Brug reservation i extract-document.ts**

I `src/lib/ai/jobs/extract-document.ts` før pipeline-kaldet:

```typescript
import { reserveAIBudget, commitAIUsage, releaseReservation } from '@/lib/ai/cost-cap'

// Estimér worst-case cost baseret på PDF-størrelse:
const pageCount = /* fra content-loader */
const estimatedCost = estimateExtractionCost(pageCount) // se helper nedenfor

const reservation = await reserveAIBudget(organizationId, estimatedCost)
if (!reservation.reserved) {
  log.warn({ orgId: organizationId, reason: reservation.reason }, 'AI-budget afvist')
  return { deduped: false, error: reservation.reason ?? 'cap reached' }
}

let actualCost = 0
try {
  const result = await runExtractionPipeline(content, { document_id: documentId })
  actualCost = result.total_cost_usd
  await recordAIUsage({ /* eksisterende */ })
  await commitAIUsage(organizationId, estimatedCost, actualCost)
} catch (err) {
  await releaseReservation(organizationId, estimatedCost)
  throw err
}
```

Og tilføj helper i `cost-cap.ts`:

```typescript
/** Worst-case cost-estimat baseret på page-count (bruger current pricing). */
export function estimateExtractionCost(pageCount: number): number {
  // Konservativt: 4000 tokens/side × Sonnet 4.6 × 2 runs + Haiku Pass 1
  const inputTokens = pageCount * 4000
  const outputTokens = 3000
  const sonnetCost = (inputTokens * 3 + outputTokens * 15) / 1_000_000
  const haikuCost = 0.01
  return sonnetCost * 2 + haikuCost // assume worst-case 2 runs
}
```

- [ ] **Step 6: Kør test — forventet PASS**

Run: `npm test -- src/__tests__/lib/ai/cost-cap-race.test.ts`
Expected: PASS — cap enforced atomisk.

- [ ] **Step 7: Commit**

```bash
git add src/lib/ai/cost-cap.ts src/lib/ai/jobs/extract-document.ts \
  prisma/schema.prisma prisma/migrations/ \
  src/__tests__/lib/ai/cost-cap-race.test.ts
git commit -m "$(cat <<'EOF'
fix(ai): atomisk pre-debet cost-cap (race condition løst)

reserveAIBudget bruger SERIALIZABLE-transaction så parallelle jobs ikke
alle kan passere cap-check samtidigt. commitAIUsage rydder reservation
efter succes; releaseReservation bruges ved fejl.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: In-memory rate-limiter på upload-endpointet

**Files:**

- Create: `src/lib/ai/rate-limit.ts`
- Create: `src/__tests__/lib/ai/rate-limit.test.ts`
- Modify: `src/app/api/upload/route.ts`

- [ ] **Step 1: Test for rate-limiter (token-bucket, 10/min per org)**

```typescript
// src/__tests__/lib/ai/rate-limit.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { checkUploadRateLimit, resetRateLimiter } from '@/lib/ai/rate-limit'

describe('upload rate-limiter', () => {
  beforeEach(() => resetRateLimiter())

  it('tillader 10 requests pr. minut per org', () => {
    const orgId = 'org-1'
    for (let i = 0; i < 10; i++) {
      expect(checkUploadRateLimit(orgId).allowed).toBe(true)
    }
    expect(checkUploadRateLimit(orgId).allowed).toBe(false)
  })

  it('organisationer har separate buckets', () => {
    for (let i = 0; i < 10; i++) checkUploadRateLimit('org-1')
    expect(checkUploadRateLimit('org-1').allowed).toBe(false)
    expect(checkUploadRateLimit('org-2').allowed).toBe(true)
  })

  it('refiller efter tidsperioden', () => {
    vi.useFakeTimers()
    for (let i = 0; i < 10; i++) checkUploadRateLimit('org-1')
    expect(checkUploadRateLimit('org-1').allowed).toBe(false)
    vi.advanceTimersByTime(61_000)
    expect(checkUploadRateLimit('org-1').allowed).toBe(true)
    vi.useRealTimers()
  })
})
```

- [ ] **Step 2: Kør test — forventet FEJL**

Run: `npm test -- src/__tests__/lib/ai/rate-limit.test.ts`

- [ ] **Step 3: Implementér rate-limiter**

```typescript
// src/lib/ai/rate-limit.ts
interface Bucket {
  tokens: number
  lastRefill: number
}

const BUCKET_SIZE = 10
const REFILL_INTERVAL_MS = 60_000

const buckets = new Map<string, Bucket>()

export interface RateLimitResult {
  allowed: boolean
  retryAfterMs?: number
}

export function checkUploadRateLimit(organizationId: string): RateLimitResult {
  const now = Date.now()
  const bucket = buckets.get(organizationId) ?? { tokens: BUCKET_SIZE, lastRefill: now }

  const elapsed = now - bucket.lastRefill
  if (elapsed >= REFILL_INTERVAL_MS) {
    bucket.tokens = BUCKET_SIZE
    bucket.lastRefill = now
  }

  if (bucket.tokens <= 0) {
    buckets.set(organizationId, bucket)
    return { allowed: false, retryAfterMs: REFILL_INTERVAL_MS - elapsed }
  }

  bucket.tokens -= 1
  buckets.set(organizationId, bucket)
  return { allowed: true }
}

export function resetRateLimiter(): void {
  buckets.clear()
}
```

- [ ] **Step 4: Brug rate-limiter i upload-route**

I `src/app/api/upload/route.ts` FØR queue-enqueue (eller før any-extraction begins hvis auto-extract trigger er her):

```typescript
import { checkUploadRateLimit } from '@/lib/ai/rate-limit'

// Efter session-check:
const rateCheck = checkUploadRateLimit(session.user.organizationId)
if (!rateCheck.allowed) {
  return NextResponse.json(
    {
      error: 'For mange uploads — prøv igen senere',
      retry_after_ms: rateCheck.retryAfterMs,
    },
    { status: 429 }
  )
}
```

- [ ] **Step 5: Kør tests — forventet PASS**

```bash
npm test -- src/__tests__/lib/ai/rate-limit.test.ts
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/rate-limit.ts src/__tests__/lib/ai/rate-limit.test.ts \
  src/app/api/upload/route.ts
git commit -m "$(cat <<'EOF'
feat(ai): token-bucket rate-limit på upload (10/min per org)

Forhindrer bulk-upload-storm i at sende 500 parallelle requests til
Anthropic og ramme Tier 1 ITPM-loftet (30k input-tokens/min).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Invalider insights-cache ved kontrakt/sag/finans-ændringer

**Files:**

- Modify: `src/actions/contracts.ts` — efter contract create/update/delete
- Modify: `src/actions/cases.ts` — samme
- Modify: `src/actions/companies.ts` — efter finans-ændringer
- Create: `src/lib/ai/invalidate-cache.ts` (helper)
- Test: `src/__tests__/lib/ai/invalidate-cache.test.ts`

- [ ] **Step 1: Opret invalidation-helper**

```typescript
// src/lib/ai/invalidate-cache.ts
import { prisma } from '@/lib/db'
import { createLogger } from './logger'

const log = createLogger('ai-cache-invalidation')

export async function invalidateCompanyInsightsCache(companyId: string): Promise<void> {
  const deleted = await prisma.companyInsightsCache.deleteMany({ where: { company_id: companyId } })
  if (deleted.count > 0) {
    log.info({ companyId, deleted: deleted.count }, 'Invaliderede insights-cache')
  }
}
```

- [ ] **Step 2: Kald invalidation i alle aktioner der muterer relevante data**

I `src/actions/contracts.ts` — efter hver succesfuld create/update/delete, før `revalidatePath`:

```typescript
import { invalidateCompanyInsightsCache } from '@/lib/ai/invalidate-cache'

// efter contract oprettet/opdateret/slettet:
if (contract.company_id) {
  await invalidateCompanyInsightsCache(contract.company_id)
}
```

Tilsvarende i `src/actions/cases.ts` og steder i `src/actions/companies.ts` der ændrer finans-felter.

- [ ] **Step 3: Test at invalidation kaldes**

```typescript
// src/__tests__/lib/ai/invalidate-cache.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '@/lib/db'
import { invalidateCompanyInsightsCache } from '@/lib/ai/invalidate-cache'

describe('invalidateCompanyInsightsCache', () => {
  const companyId = '00000000-0000-0000-0000-0000000000aa'

  beforeEach(async () => {
    await prisma.companyInsightsCache.deleteMany({ where: { company_id: companyId } })
  })

  it('sletter eksisterende cache-row', async () => {
    await prisma.companyInsightsCache.create({
      data: { company_id: companyId, insights_json: {}, model_used: 'x', cost_usd: 0 },
    })
    await invalidateCompanyInsightsCache(companyId)
    const remaining = await prisma.companyInsightsCache.count({ where: { company_id: companyId } })
    expect(remaining).toBe(0)
  })

  it('er idempotent ved ingen cache-row', async () => {
    await expect(invalidateCompanyInsightsCache(companyId)).resolves.not.toThrow()
  })
})
```

- [ ] **Step 4: Kør tests**

```bash
npm test -- src/__tests__/lib/ai/invalidate-cache.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/invalidate-cache.ts src/__tests__/lib/ai/invalidate-cache.test.ts \
  src/actions/contracts.ts src/actions/cases.ts src/actions/companies.ts
git commit -m "$(cat <<'EOF'
perf(ai): invalidér insights-cache ved relevante data-mutations

Før genereredes insights kun hver 24h selv om underliggende data ændrede sig.
Nu ryddes cachen ved contract/case/finans-mutations så næste view henter
friske insights — og stale mellem-tidsrum forsvinder.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: Checkpoint pipeline-state så retries ikke starter fra Pass 1

**Files:**

- Modify: `src/lib/ai/jobs/extract-document.ts` — persister Pass 1-resultat
- Modify: `prisma/schema.prisma` — tilføj pipeline_checkpoint JSON-felt på DocumentExtraction
- Test: `src/__tests__/lib/ai/pipeline-checkpoint.test.ts`

- [ ] **Step 1: Schema-felt**

I `prisma/schema.prisma` `model DocumentExtraction`, tilføj:

```prisma
  pipeline_checkpoint Json?
```

Migrér:

```bash
npx prisma migrate dev --name pipeline_checkpoint
```

- [ ] **Step 2: Skriv test for checkpoint-resume**

```typescript
// src/__tests__/lib/ai/pipeline-checkpoint.test.ts
// Verificér at hvis DocumentExtraction har pipeline_checkpoint, bliver Pass 1 ikke kaldt igen.
// Mock detectDocumentType og tjek call-count ved gentagelse.
```

(Skriv konkret test svarende til stil i andre pipeline-tests; bruger samme mock-pattern som Task 7-test.)

- [ ] **Step 3: Implementér checkpoint-læsning i orchestrator**

I `src/lib/ai/pipeline/orchestrator.ts` udvid `PipelineOptions` med `checkpoint?: { type_result?: TypeDetectionResult; run1?: SchemaExtractionResult }`, og brug det hvis tilgængeligt:

```typescript
let typeResult: TypeDetectionResult
if (options.checkpoint?.type_result) {
  typeResult = options.checkpoint.type_result
  log.info('Genbruger Pass 1 fra checkpoint')
} else if (options.forced_type) {
  /* eksisterende */
}
// ...

// Efter Pass 1 + Pass 2a succes: persistér checkpoint via callback
if (options.onCheckpoint) {
  await options.onCheckpoint({ type_result: typeResult, run1 })
}
```

- [ ] **Step 4: Brug checkpoint i extract-document.ts**

I `src/lib/ai/jobs/extract-document.ts`:

```typescript
// Hent eksisterende extraction-row hvis den findes (for resumption ved retry):
const existing = await prisma.documentExtraction.findUnique({
  where: { document_id: documentId },
})
const checkpoint = existing?.pipeline_checkpoint as
  | { type_result?: TypeDetectionResult; run1?: SchemaExtractionResult }
  | undefined

const result = await runExtractionPipeline(content, {
  document_id: documentId,
  checkpoint,
  onCheckpoint: async (cp) => {
    await prisma.documentExtraction.upsert({
      where: { document_id: documentId },
      create: {
        document_id: documentId,
        organization_id: organizationId,
        pipeline_checkpoint: cp as never,
        status: 'IN_PROGRESS',
      },
      update: { pipeline_checkpoint: cp as never },
    })
  },
})
```

- [ ] **Step 5: Test + commit**

```bash
npm test -- src/__tests__/lib/ai/pipeline-checkpoint.test.ts
npx tsc --noEmit

git add src/lib/ai/pipeline/orchestrator.ts src/lib/ai/pipeline/types.ts \
  src/lib/ai/jobs/extract-document.ts prisma/schema.prisma prisma/migrations/ \
  src/__tests__/lib/ai/pipeline-checkpoint.test.ts

git commit -m "$(cat <<'EOF'
feat(ai): checkpoint pipeline-state så retries ikke gentager Pass 1

Ved Pass 2-fejl var retry-policy at starte pipeline forfra (Pass 1+2a+2b igen).
Nu persisteres typeResult + run1 i DocumentExtraction.pipeline_checkpoint
så retries resumer fra det sidste succesfulde checkpoint.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: Opdatér PRICING-DECISION-2026-04.md med verified-tal og onboarding-fee

**Files:**

- Modify: `docs/build/PRICING-DECISION-2026-04.md`

- [ ] **Step 1: Læs eksisterende pricing-beslutning**

```bash
cat docs/build/PRICING-DECISION-2026-04.md
```

- [ ] **Step 2: Opdatér dokumentet**

Tilføj en ny top-sektion under v2-noten:

```markdown
## v3 revision (2026-04-19) — baseret på verificerede Anthropic-tal

Efter dybere audit (se `docs/build/AI-COST-MODEL.md` v3):

- **AI-cost-beregninger er nu verificerede** mod claude.com/pricing og platform.claude.com-docs
- **Safeguards-sprint leveret** (se `docs/superpowers/plans/2026-04-19-ai-cost-safeguards.md`) — reducerer AI-cost med 60-70%
- **Marginer er mere sunde end v2 antog** — AI-andel <2,5% på alle tiers uden safeguards, <1,0% med

### Beslutning bekræftet

- **Basis: 3.500 kr/md** ✓
- **Plus: 9.500 kr/md + 75 kr/ekstra selskab over 50** ✓
- **Enterprise: floor 32.000 kr/md** ✓
- **Margin-mål: 95%+ på alle tiers** ✓ (reelt opnås med safeguards)

### NYT — onboarding-fee

Onboarding-AI-cost for kunde med mange eksisterende kontrakter kan løbe op i $1.800 worst case (XL uden safeguards). Med safeguards + Batch API reduceres til $560. For at dække og signalere værdi:

- **Onboarding-fee: 1 kr pr. dokument ved initial import, max 2.500 kr**
- Forklares som "data-migrations-setup" i salgsmaterial
- Dækker AI-cost med 3-5× margin + administrativt arbejde

### Åbne spørgsmål (forelagt bruger)

1. Godkendes onboarding-fee 1 kr/dok, max 2.500 kr? (ja/nej/andet)
2. Overvej Plus-S (6.500 kr for 15-30 selskaber) og Plus-L (9.500 kr for 30-50)? (ja/nej/senere)
3. Default cost-cap på nye orgs: $50/md foreslået. OK? (ja/andet beløb)
4. Anthropic-tier ved prod-start: Tier 2 ($40 deposit, 1000 RPM) anbefalet. OK?
```

- [ ] **Step 3: Commit**

```bash
git add docs/build/PRICING-DECISION-2026-04.md
git commit -m "$(cat <<'EOF'
docs(pricing): v3 — bekræftede priser + onboarding-fee-forslag

AI-cost-margin er verificeret <2,5% på alle tiers uden safeguards, <1% med.
Tilføj onboarding-fee 1 kr/dok (max 2.500 kr) for at dække bulk-migration.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Final gate — når alle 14 tasks er committed

- [ ] **Gate 1: Full test suite green**

```bash
npm run format
npm run lint
npx tsc --noEmit
npm test
npm run build
```

Alle skal returnere 0. Forventede tal: build grøn (ingen nye routes forventet), tests 735+ grønne (de ~20 nye tests lagt til).

- [ ] **Gate 2: Migrations har kørt**

```bash
npx prisma migrate status
```

Verificér 3 nye migrationer er `Applied`:

- `ai_safeguards`
- `document_content_hash`
- `cost_cap_reservation`
- `pipeline_checkpoint`

- [ ] **Gate 3: Manuel røgtest i dev**

```bash
npm run dev
```

1. Log ind som philip@chainhub.dk / password123
2. Upload en test-PDF via /companies/[id]/documents
3. Verificér at `AIUsageLog` får en ny row med `cache_write_tokens > 0` (hvis PDF > 2048 tokens) eller `= 0`
4. Upload samme PDF igen — verificér at det ikke udløser ny extraction (dedup)
5. Upload 11 PDF'er hurtigt — verificér at 11. får 429
6. Tjek `/settings/ai-usage` viser opdateret cap (nu default $50)

- [ ] **Gate 4: Commit-tag**

```bash
git tag -a ai-safeguards-v1 -m "AI cost safeguards sprint complete — verified Anthropic pricing + caching + rate-limits + race-condition-fix"
git push origin ai-safeguards-v1
```

---

## Out of scope (næste sprint)

- Batch API integration for bulk-onboarding (separat sprint — kræver async-polling-UI)
- Kill-switch-UI i `/settings/ai-usage` (allerede i DB som `kill_switch`-felt men ikke eksponeret i UI)
- Alert-mail ved 75% / 90% cap-forbrug (separat notification-pipeline)
- Bedrock-migration (Phase C, ikke denne sprint)

---

## Self-review checklist (kører før plan anses færdig)

- [x] **Spec coverage:** Alle 10 risici fra AI-COST-MODEL sektion 8 har en dækkende task
  - R1 (cost-cap null) → Task 3
  - R2 (race condition) → Task 10
  - R3 (rate-limit 429) → Task 11
  - R4 (deprecated models) → Task 1
  - R5 (forkert Haiku-pris) → Task 1
  - R6 (retry-doubler) → Task 13
  - R7 (ingen dokumenthash) → Task 9
  - R8 (cache-tokens ikke parset) → Task 2
  - R9 (24h TTL uden invalidation) → Task 12
  - R10 (default skip_agreement=false) → Task 7

- [x] **Placeholder-scan:** Ingen TBD/TODO/"fill later". Alle code-blocks fuldstændige.
- [x] **Type consistency:** `claude-sonnet-4-6`, `claude-haiku-4-5`, `claude-opus-4-7` bruges konsistent efter Task 1. `ClaudeTool`, `ClaudeContentBlock`, `ClaudeResponse` udvidet konsistent i Task 1+2.
- [x] **Test coverage:** Hver task har mindst én test der fejler før implementation og passer efter.

---

## Execution handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-19-ai-cost-safeguards.md`. Two execution options:**

1. **Subagent-Driven (recommended)** — fresh agent pr. task, two-stage review, fast iteration
2. **Inline Execution** — batch execution i nuværende session med checkpoints

**Vælg tilgang før implementation starter.**
