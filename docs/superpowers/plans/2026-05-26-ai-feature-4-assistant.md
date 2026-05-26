# Feature 4: Portfolio-AI-Assistent (Chat-panel) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Byg et slide-out chat-panel med fuld agent-capabilities: søg data, generer rapporter, og udfør handlinger (med bekræftelse) på vegne af brugeren.

**Architecture:** Nyt `src/lib/ai/assistant/` modul med orchestrator (tool-use loop), tools-registrering, og context-builder. Nye Prisma-modeller for Conversation/Message/PendingAction. Chat UI som slide-out panel (400px) i sidebar. Model: gpt-5-mini for chat, gpt-5-nano for tool-routing.

**Tech Stack:** OpenAI Responses API (tool-use/function calling), Prisma, PgBoss (async), Server Actions, React (B-stil)

---

### Task 1: Conversation Prisma-modeller

**Files:**

- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Tilføj enums og modeller**

I `prisma/schema.prisma`, tilføj:

```prisma
enum MessageRole {
  USER
  ASSISTANT
  SYSTEM

  @@map("message_role")
}

enum PendingActionStatus {
  PENDING
  CONFIRMED
  REJECTED
  EXPIRED

  @@map("pending_action_status")
}

model Conversation {
  id              String    @id @default(uuid())
  organization_id String
  user_id         String
  title           String?
  created_at      DateTime  @default(now())
  updated_at      DateTime  @updatedAt

  organization    Organization @relation(fields: [organization_id], references: [id])
  messages        Message[]
  pending_actions PendingAction[]

  @@index([organization_id, user_id])
  @@index([user_id, updated_at])
}

model Message {
  id              String      @id @default(uuid())
  conversation_id String
  role            MessageRole
  content         String
  tool_calls      Json?
  tool_results    Json?
  tokens_used     Int?
  cost_usd        Decimal?    @db.Decimal(10, 6)
  created_at      DateTime    @default(now())

  conversation    Conversation @relation(fields: [conversation_id], references: [id], onDelete: Cascade)

  @@index([conversation_id, created_at])
}

model PendingAction {
  id              String              @id @default(uuid())
  conversation_id String
  action_type     String
  action_label    String
  payload         Json
  status          PendingActionStatus @default(PENDING)
  created_at      DateTime            @default(now())
  resolved_at     DateTime?

  conversation    Conversation @relation(fields: [conversation_id], references: [id], onDelete: Cascade)

  @@index([conversation_id, status])
}
```

Tilføj relationer i Organization model:

```prisma
conversations Conversation[]
```

- [ ] **Step 2: Generér Prisma client**

Run: `npx prisma generate`
Expected: Successfully generated Prisma Client

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: tilføj Conversation, Message, PendingAction Prisma-modeller"
```

---

### Task 2: Assistant tools — read-only queries

**Files:**

- Create: `src/lib/ai/assistant/tools/search-contracts.ts`
- Create: `src/lib/ai/assistant/tools/search-companies.ts`
- Create: `src/lib/ai/assistant/tools/search-persons.ts`
- Create: `src/lib/ai/assistant/tools/get-alerts.ts`
- Create: `src/lib/ai/assistant/tools/generate-report.ts`
- Create: `src/lib/ai/assistant/tools/types.ts`
- Create: `src/__tests__/lib/ai/assistant/tools/search-contracts.test.ts`

- [ ] **Step 1: Definér tool-type interface**

```typescript
// src/lib/ai/assistant/tools/types.ts
export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown> // JSON Schema
  requiresConfirmation: boolean
  execute: (params: Record<string, unknown>, context: ToolContext) => Promise<ToolResult>
}

export interface ToolContext {
  organizationId: string
  userId: string
}

export interface ToolResult {
  success: boolean
  data: unknown
  displayText: string
}
```

- [ ] **Step 2: Skriv test for search-contracts tool**

```typescript
// src/__tests__/lib/ai/assistant/tools/search-contracts.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    contract: { findMany: vi.fn() },
  },
}))

describe('search-contracts tool', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns contracts matching query', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.contract.findMany).mockResolvedValue([
      {
        id: 'c1',
        name: 'Lejekontrakt',
        contract_type: 'LEJEKONTRAKT',
        status: 'AKTIV',
        end_date: new Date('2026-08-01'),
        company: { name: 'Test ApS' },
      },
    ] as never)

    const { searchContractsTool } = await import('@/lib/ai/assistant/tools/search-contracts')
    const result = await searchContractsTool.execute(
      { query: 'lejekontrakt', status: 'AKTIV' },
      { organizationId: 'org-1', userId: 'user-1' }
    )

    expect(result.success).toBe(true)
    expect(result.displayText).toContain('Lejekontrakt')
  })

  it('filters by organization_id', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.contract.findMany).mockResolvedValue([])

    const { searchContractsTool } = await import('@/lib/ai/assistant/tools/search-contracts')
    await searchContractsTool.execute(
      { query: 'test' },
      { organizationId: 'org-1', userId: 'user-1' }
    )

    expect(prisma.contract.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organization_id: 'org-1',
          deleted_at: null,
        }),
      })
    )
  })
})
```

- [ ] **Step 3: Kør test — verificér FAIL**

Run: `npx vitest run src/__tests__/lib/ai/assistant/tools/search-contracts.test.ts`
Expected: FAIL

- [ ] **Step 4: Implementér search-contracts tool**

```typescript
// src/lib/ai/assistant/tools/search-contracts.ts
import { prisma } from '@/lib/db'
import type { ToolDefinition, ToolContext, ToolResult } from './types'

export const searchContractsTool: ToolDefinition = {
  name: 'search_contracts',
  description:
    'Søg i kontrakter efter navn, type, status, eller selskab. Returnerer op til 10 resultater med nøgleoplysninger.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Fritekst-søgning i kontraktnavn' },
      status: {
        type: 'string',
        enum: ['AKTIV', 'UDLOBET', 'OPSAGT', 'UDKAST'],
        description: 'Filtrér på status',
      },
      contract_type: { type: 'string', description: 'Kontrakttype (fx LEJEKONTRAKT, EJERAFTALE)' },
      expiring_within_days: {
        type: 'number',
        description: 'Find kontrakter der udløber inden N dage',
      },
    },
  },
  requiresConfirmation: false,

  async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const where: Record<string, unknown> = {
      organization_id: context.organizationId,
      deleted_at: null,
    }

    if (params.query) {
      where.name = { contains: String(params.query), mode: 'insensitive' }
    }
    if (params.status) {
      where.status = String(params.status)
    }
    if (params.contract_type) {
      where.contract_type = String(params.contract_type)
    }
    if (params.expiring_within_days) {
      const days = Number(params.expiring_within_days)
      where.end_date = {
        gte: new Date(),
        lte: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
      }
    }

    const contracts = await prisma.contract.findMany({
      where,
      include: { company: { select: { name: true } } },
      take: 10,
      orderBy: { end_date: 'asc' },
    })

    if (contracts.length === 0) {
      return { success: true, data: [], displayText: 'Ingen kontrakter fundet.' }
    }

    const lines = contracts.map((c) => {
      const endStr = c.end_date ? c.end_date.toISOString().split('T')[0] : 'Ingen slutdato'
      return `• ${c.name} (${c.contract_type}) — ${c.status} — Udløber: ${endStr} — Selskab: ${c.company?.name ?? 'Ikke tilknyttet'}`
    })

    return {
      success: true,
      data: contracts.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.contract_type,
        status: c.status,
        endDate: c.end_date,
        company: c.company?.name,
      })),
      displayText: `Fandt ${contracts.length} kontrakt(er):\n${lines.join('\n')}`,
    }
  },
}
```

- [ ] **Step 5: Implementér øvrige read-only tools (search-companies, search-persons, get-alerts, generate-report)**

```typescript
// src/lib/ai/assistant/tools/search-companies.ts
import { prisma } from '@/lib/db'
import type { ToolDefinition, ToolContext, ToolResult } from './types'

export const searchCompaniesTool: ToolDefinition = {
  name: 'search_companies',
  description: 'Søg i selskaber efter navn, CVR, eller status. Returnerer op til 10 resultater.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Fritekst-søgning i selskabsnavn eller CVR' },
      status: { type: 'string', description: 'Filtrér på status (aktiv, inaktiv)' },
    },
  },
  requiresConfirmation: false,

  async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const where: Record<string, unknown> = {
      organization_id: context.organizationId,
      deleted_at: null,
    }

    if (params.query) {
      where.OR = [
        { name: { contains: String(params.query), mode: 'insensitive' } },
        { cvr: { contains: String(params.query) } },
      ]
    }
    if (params.status) {
      where.status = String(params.status)
    }

    const companies = await prisma.company.findMany({
      where,
      select: { id: true, name: true, cvr: true, status: true, city: true },
      take: 10,
      orderBy: { name: 'asc' },
    })

    if (companies.length === 0) {
      return { success: true, data: [], displayText: 'Ingen selskaber fundet.' }
    }

    const lines = companies.map(
      (c) => `• ${c.name} (CVR: ${c.cvr ?? 'mangler'}) — ${c.status} — ${c.city ?? ''}`
    )

    return {
      success: true,
      data: companies,
      displayText: `Fandt ${companies.length} selskab(er):\n${lines.join('\n')}`,
    }
  },
}
```

```typescript
// src/lib/ai/assistant/tools/search-persons.ts
import { prisma } from '@/lib/db'
import type { ToolDefinition, ToolContext, ToolResult } from './types'

export const searchPersonsTool: ToolDefinition = {
  name: 'search_persons',
  description: 'Søg i personer efter navn, email, eller rolle.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Fritekst-søgning i personnavn eller email' },
    },
  },
  requiresConfirmation: false,

  async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const query = String(params.query ?? '')
    const persons = await prisma.person.findMany({
      where: {
        organization_id: context.organizationId,
        deleted_at: null,
        OR: [
          { first_name: { contains: query, mode: 'insensitive' } },
          { last_name: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: { id: true, first_name: true, last_name: true, email: true, phone: true },
      take: 10,
    })

    if (persons.length === 0) {
      return { success: true, data: [], displayText: 'Ingen personer fundet.' }
    }

    const lines = persons.map(
      (p) => `• ${p.first_name} ${p.last_name} — ${p.email ?? 'ingen email'} — ${p.phone ?? ''}`
    )

    return {
      success: true,
      data: persons,
      displayText: `Fandt ${persons.length} person(er):\n${lines.join('\n')}`,
    }
  },
}
```

```typescript
// src/lib/ai/assistant/tools/get-alerts.ts
import { prisma } from '@/lib/db'
import type { ToolDefinition, ToolContext, ToolResult } from './types'

export const getAlertsTool: ToolDefinition = {
  name: 'get_alerts',
  description:
    'Hent aktive advarsler og alerts for organisationen. Viser deadline-overskridelser, manglende dokumenter, risici.',
  parameters: {
    type: 'object',
    properties: {
      severity: {
        type: 'string',
        enum: ['CRITICAL', 'WARNING', 'INFO'],
        description: 'Filtrér på alvorlighed',
      },
      category: {
        type: 'string',
        enum: ['DEADLINE', 'MISSING', 'RISK', 'COMPLIANCE'],
        description: 'Filtrér på kategori',
      },
    },
  },
  requiresConfirmation: false,

  async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const where: Record<string, unknown> = {
      organization_id: context.organizationId,
      dismissed_at: null,
    }
    if (params.severity) where.severity = String(params.severity)
    if (params.category) where.category = String(params.category)

    const alerts = await prisma.alert.findMany({
      where,
      orderBy: [{ severity: 'asc' }, { created_at: 'desc' }],
      take: 20,
    })

    if (alerts.length === 0) {
      return { success: true, data: [], displayText: 'Ingen aktive advarsler.' }
    }

    const lines = alerts.map((a) => `• [${a.severity}] ${a.message} (${a.entity_name})`)

    return {
      success: true,
      data: alerts,
      displayText: `${alerts.length} aktive advarsler:\n${lines.join('\n')}`,
    }
  },
}
```

```typescript
// src/lib/ai/assistant/tools/generate-report.ts
import { prisma } from '@/lib/db'
import type { ToolDefinition, ToolContext, ToolResult } from './types'

export const generateReportTool: ToolDefinition = {
  name: 'generate_report',
  description:
    'Generer et overblik/rapport for et selskab eller hele porteføljen. Inkluderer nøgletal, kontrakter, alerts.',
  parameters: {
    type: 'object',
    properties: {
      company_id: {
        type: 'string',
        description: 'Selskabs-ID for selskabsrapport (udelad for portefølje-overblik)',
      },
      report_type: {
        type: 'string',
        enum: ['summary', 'due_diligence', 'risk'],
        description: 'Rapporttype',
      },
    },
  },
  requiresConfirmation: false,

  async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const orgId = context.organizationId

    if (params.company_id) {
      const company = await prisma.company.findFirst({
        where: { id: String(params.company_id), organization_id: orgId, deleted_at: null },
        include: {
          contracts: {
            where: { deleted_at: null },
            select: { id: true, name: true, contract_type: true, status: true, end_date: true },
          },
          _count: { select: { documents: true, company_persons: true } },
        },
      })

      if (!company) return { success: false, data: null, displayText: 'Selskab ikke fundet.' }

      const activeContracts = company.contracts.filter((c) => c.status === 'AKTIV').length
      const report = [
        `**${company.name}** (CVR: ${company.cvr ?? 'mangler'})`,
        `Status: ${company.status}`,
        `Kontrakter: ${company.contracts.length} total, ${activeContracts} aktive`,
        `Dokumenter: ${company._count.documents}`,
        `Tilknyttede personer: ${company._count.company_persons}`,
        '',
        '**Kontrakter:**',
        ...company.contracts.map(
          (c) =>
            `• ${c.name} — ${c.contract_type} — ${c.status} — Udløber: ${c.end_date?.toISOString().split('T')[0] ?? 'N/A'}`
        ),
      ]

      return { success: true, data: company, displayText: report.join('\n') }
    }

    // Portfolio overview
    const [companyCount, contractCount, activeContracts, alertCount] = await Promise.all([
      prisma.company.count({ where: { organization_id: orgId, deleted_at: null } }),
      prisma.contract.count({ where: { organization_id: orgId, deleted_at: null } }),
      prisma.contract.count({
        where: { organization_id: orgId, deleted_at: null, status: 'AKTIV' },
      }),
      prisma.alert.count({ where: { organization_id: orgId, dismissed_at: null } }),
    ])

    const report = [
      '**Portefølje-overblik**',
      `Selskaber: ${companyCount}`,
      `Kontrakter: ${contractCount} total, ${activeContracts} aktive`,
      `Aktive advarsler: ${alertCount}`,
    ]

    return {
      success: true,
      data: { companyCount, contractCount, activeContracts, alertCount },
      displayText: report.join('\n'),
    }
  },
}
```

- [ ] **Step 6: Kør tests — verificér PASS**

Run: `npx vitest run src/__tests__/lib/ai/assistant/`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/ai/assistant/tools/
git commit -m "feat: tilføj read-only assistant tools (search, alerts, report)"
```

---

### Task 3: Assistant tools — write actions (med bekræftelse)

**Files:**

- Create: `src/lib/ai/assistant/tools/create-task.ts`
- Create: `src/lib/ai/assistant/tools/create-case.ts`
- Create: `src/lib/ai/assistant/tools/create-reminder.ts`
- Create: `src/lib/ai/assistant/tools/registry.ts`

- [ ] **Step 1: Implementér create-task tool**

```typescript
// src/lib/ai/assistant/tools/create-task.ts
import type { ToolDefinition, ToolContext, ToolResult } from './types'

export const createTaskTool: ToolDefinition = {
  name: 'create_task',
  description: 'Opret en ny opgave tilknyttet et selskab eller en sag. Kræver brugerbekræftelse.',
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Opgavens titel' },
      description: { type: 'string', description: 'Beskrivelse af opgaven' },
      company_id: { type: 'string', description: 'Selskab opgaven tilhører' },
      due_date: { type: 'string', description: 'Forfaldsdato (YYYY-MM-DD)' },
      priority: {
        type: 'string',
        enum: ['LAV', 'NORMAL', 'HØJ', 'KRITISK'],
        description: 'Prioritet',
      },
    },
    required: ['title'],
  },
  requiresConfirmation: true,

  async execute(params: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    // This is called AFTER user confirms — actual execution happens via the action
    return {
      success: true,
      data: params,
      displayText: `Opretter opgave: "${params.title}"${params.due_date ? ` (forfald: ${params.due_date})` : ''}`,
    }
  },
}
```

- [ ] **Step 2: Implementér create-case og create-reminder (samme mønster)**

```typescript
// src/lib/ai/assistant/tools/create-case.ts
import type { ToolDefinition, ToolContext, ToolResult } from './types'

export const createCaseTool: ToolDefinition = {
  name: 'create_case',
  description: 'Opret en ny sag/tvist. Kræver brugerbekræftelse.',
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Sagens titel' },
      description: { type: 'string', description: 'Beskrivelse' },
      company_ids: {
        type: 'array',
        items: { type: 'string' },
        description: 'Tilknyttede selskaber',
      },
      case_type: { type: 'string', description: 'Sagstype' },
    },
    required: ['title'],
  },
  requiresConfirmation: true,

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    return {
      success: true,
      data: params,
      displayText: `Opretter sag: "${params.title}"`,
    }
  },
}
```

```typescript
// src/lib/ai/assistant/tools/create-reminder.ts
import type { ToolDefinition, ToolContext, ToolResult } from './types'

export const createReminderTool: ToolDefinition = {
  name: 'create_reminder',
  description: 'Opret en påmindelse/deadline. Kræver brugerbekræftelse.',
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Påmindelsens titel' },
      date: { type: 'string', description: 'Dato (YYYY-MM-DD)' },
      entity_type: { type: 'string', description: 'Tilknyttet type (company, contract)' },
      entity_id: { type: 'string', description: 'Tilknyttet ID' },
    },
    required: ['title', 'date'],
  },
  requiresConfirmation: true,

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    return {
      success: true,
      data: params,
      displayText: `Opretter påmindelse: "${params.title}" d. ${params.date}`,
    }
  },
}
```

- [ ] **Step 3: Opret tool registry**

```typescript
// src/lib/ai/assistant/tools/registry.ts
import { searchContractsTool } from './search-contracts'
import { searchCompaniesTool } from './search-companies'
import { searchPersonsTool } from './search-persons'
import { getAlertsTool } from './get-alerts'
import { generateReportTool } from './generate-report'
import { createTaskTool } from './create-task'
import { createCaseTool } from './create-case'
import { createReminderTool } from './create-reminder'
import type { ToolDefinition } from './types'

export const toolRegistry: Map<string, ToolDefinition> = new Map([
  ['search_contracts', searchContractsTool],
  ['search_companies', searchCompaniesTool],
  ['search_persons', searchPersonsTool],
  ['get_alerts', getAlertsTool],
  ['generate_report', generateReportTool],
  ['create_task', createTaskTool],
  ['create_case', createCaseTool],
  ['create_reminder', createReminderTool],
])

export function getToolDefinitions(): Array<{
  name: string
  description: string
  parameters: Record<string, unknown>
}> {
  return Array.from(toolRegistry.values()).map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }))
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai/assistant/tools/
git commit -m "feat: tilføj write-tools (create_task, create_case, create_reminder) og tool registry"
```

---

### Task 4: Assistant orchestrator

**Files:**

- Create: `src/lib/ai/assistant/orchestrator.ts`
- Create: `src/lib/ai/assistant/context.ts`
- Create: `src/__tests__/lib/ai/assistant/orchestrator.test.ts`

- [ ] **Step 1: Skriv tests**

```typescript
// src/__tests__/lib/ai/assistant/orchestrator.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/ai/client', () => ({
  createClaudeClient: () => ({
    complete: vi.fn().mockResolvedValue({
      content: 'Her er dine kontrakter der udløber snart.',
      tool_calls: [{ name: 'search_contracts', arguments: { expiring_within_days: 30 } }],
      usage: { input_tokens: 200, output_tokens: 100, cache_read_tokens: 0, cache_write_tokens: 0 },
    }),
  }),
}))

vi.mock('@/lib/ai/assistant/tools/registry', () => ({
  toolRegistry: new Map([
    [
      'search_contracts',
      {
        name: 'search_contracts',
        requiresConfirmation: false,
        execute: vi
          .fn()
          .mockResolvedValue({ success: true, data: [], displayText: 'Ingen kontrakter fundet.' }),
      },
    ],
  ]),
  getToolDefinitions: () => [
    { name: 'search_contracts', description: 'Søg kontrakter', parameters: {} },
  ],
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    message: { create: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    conversation: { update: vi.fn() },
    pendingAction: { create: vi.fn() },
  },
}))

describe('assistant orchestrator', () => {
  beforeEach(() => vi.clearAllMocks())

  it('processes user message and returns response', async () => {
    const { processMessage } = await import('@/lib/ai/assistant/orchestrator')

    const result = await processMessage({
      conversationId: 'conv-1',
      userMessage: 'Hvilke kontrakter udløber snart?',
      organizationId: 'org-1',
      userId: 'user-1',
    })

    expect(result.response).toBeDefined()
    expect(result.toolResults).toBeDefined()
  })
})
```

- [ ] **Step 2: Kør test — verificér FAIL**

Run: `npx vitest run src/__tests__/lib/ai/assistant/orchestrator.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementér context builder**

```typescript
// src/lib/ai/assistant/context.ts
import { prisma } from '@/lib/db'

export async function buildSystemPrompt(organizationId: string, userId: string): Promise<string> {
  const [companyCount, contractCount, alertCount] = await Promise.all([
    prisma.company.count({ where: { organization_id: organizationId, deleted_at: null } }),
    prisma.contract.count({ where: { organization_id: organizationId, deleted_at: null } }),
    prisma.alert.count({ where: { organization_id: organizationId, dismissed_at: null } }),
  ])

  return `Du er ChainHub AI-assistent for en kædegruppe. Du hjælper hovedkontoret med at styre deres portefølje af lokationsselskaber.

Kontekst:
- Organisationen har ${companyCount} selskaber og ${contractCount} kontrakter
- Der er ${alertCount} aktive advarsler

Regler:
- Svar ALTID på dansk
- Brug du-form
- Vær konkret og handlingsanvisende
- Ved write-handlinger (create_task, create_case, create_reminder): beskriv hvad du vil gøre og vent på bekræftelse
- Formatér data som lister eller tabeller når det giver mening
- Referer til entiteter med navn, ikke ID
- Hvis du ikke kan finde data, sig det ærligt

Tilgængelige handlinger:
- Søg i kontrakter, selskaber, og personer
- Hent advarsler og overblik
- Opret opgaver, sager, og påmindelser (kræver bekræftelse)`
}
```

- [ ] **Step 4: Implementér orchestrator**

```typescript
// src/lib/ai/assistant/orchestrator.ts
import { createClaudeClient } from '@/lib/ai/client'
import { computeCostUsd } from '@/lib/ai/client/types'
import { prisma } from '@/lib/db'
import { recordAIUsage } from '@/lib/ai/usage'
import { toolRegistry, getToolDefinitions } from './tools/registry'
import { buildSystemPrompt } from './context'
import type { ToolResult } from './tools/types'

export interface ProcessMessageInput {
  conversationId: string
  userMessage: string
  organizationId: string
  userId: string
}

export interface ProcessMessageResult {
  response: string
  toolResults: Array<{ toolName: string; result: ToolResult }>
  pendingActions: Array<{
    id: string
    actionType: string
    actionLabel: string
    payload: Record<string, unknown>
  }>
  tokensUsed: number
  costUsd: number
}

export async function processMessage(input: ProcessMessageInput): Promise<ProcessMessageResult> {
  const { conversationId, userMessage, organizationId, userId } = input

  // Save user message
  await prisma.message.create({
    data: {
      conversation_id: conversationId,
      role: 'USER',
      content: userMessage,
    },
  })

  // Build context
  const systemPrompt = await buildSystemPrompt(organizationId, userId)
  const history = await prisma.message.findMany({
    where: { conversation_id: conversationId },
    orderBy: { created_at: 'asc' },
    take: 20,
    select: { role: true, content: true },
  })

  const messages = history.map((m) => ({
    role: m.role.toLowerCase() as 'user' | 'assistant' | 'system',
    content: m.content,
  }))

  // Call LLM with tools
  const client = createClaudeClient()
  const response = await client.complete({
    model: 'gpt-5-mini',
    system: systemPrompt,
    messages,
    tools: getToolDefinitions(),
    temperature: 0.3,
    max_tokens: 2000,
  })

  // Process tool calls
  const toolResults: Array<{ toolName: string; result: ToolResult }> = []
  const pendingActions: Array<{
    id: string
    actionType: string
    actionLabel: string
    payload: Record<string, unknown>
  }> = []

  if (response.tool_calls && response.tool_calls.length > 0) {
    for (const call of response.tool_calls) {
      const tool = toolRegistry.get(call.name)
      if (!tool) continue

      if (tool.requiresConfirmation) {
        // Create pending action for user confirmation
        const pending = await prisma.pendingAction.create({
          data: {
            conversation_id: conversationId,
            action_type: call.name,
            action_label: `${call.name}: ${JSON.stringify(call.arguments).slice(0, 100)}`,
            payload: call.arguments as Record<string, unknown>,
          },
        })
        pendingActions.push({
          id: pending.id,
          actionType: call.name,
          actionLabel: pending.action_label,
          payload: call.arguments as Record<string, unknown>,
        })
      } else {
        // Execute read-only tool
        const result = await tool.execute(call.arguments as Record<string, unknown>, {
          organizationId,
          userId,
        })
        toolResults.push({ toolName: call.name, result })
      }
    }
  }

  const cost = computeCostUsd(
    'gpt-5-mini',
    response.usage.input_tokens,
    response.usage.output_tokens
  )

  // Save assistant message
  await prisma.message.create({
    data: {
      conversation_id: conversationId,
      role: 'ASSISTANT',
      content: response.content,
      tool_calls: response.tool_calls ?? undefined,
      tool_results: toolResults.length > 0 ? toolResults : undefined,
      tokens_used: response.usage.input_tokens + response.usage.output_tokens,
      cost_usd: cost,
    },
  })

  // Record usage
  await recordAIUsage({
    organizationId,
    feature: 'assistant',
    model: 'gpt-5-mini',
    provider: 'openai',
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    costUsd: cost,
  })

  // Update conversation timestamp
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updated_at: new Date() },
  })

  return {
    response: response.content,
    toolResults,
    pendingActions,
    tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
    costUsd: cost,
  }
}
```

- [ ] **Step 5: Kør test — verificér PASS**

Run: `npx vitest run src/__tests__/lib/ai/assistant/orchestrator.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/assistant/orchestrator.ts src/lib/ai/assistant/context.ts src/__tests__/lib/ai/assistant/orchestrator.test.ts
git commit -m "feat: tilføj assistant orchestrator med tool-use loop"
```

---

### Task 5: Assistant server actions

**Files:**

- Create: `src/actions/assistant.ts`
- Create: `src/__tests__/actions/assistant.test.ts`

- [ ] **Step 1: Skriv tests**

```typescript
// src/__tests__/actions/assistant.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({
  prisma: {
    conversation: { create: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
    pendingAction: { findFirst: vi.fn(), update: vi.fn() },
  },
}))
vi.mock('@/lib/ai/assistant/orchestrator', () => ({
  processMessage: vi.fn().mockResolvedValue({
    response: 'Her er svaret.',
    toolResults: [],
    pendingActions: [],
    tokensUsed: 300,
    costUsd: 0.003,
  }),
}))
vi.mock('@/lib/ai/feature-flags', () => ({ isAIEnabled: vi.fn().mockResolvedValue(true) }))

describe('assistant actions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sendMessage returns error when not authenticated', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValue(null)

    const { sendMessage } = await import('@/actions/assistant')
    const result = await sendMessage({ conversationId: 'conv-1', message: 'Hej' })
    expect(result.error).toBe('Din session er udløbet — log ind igen.')
  })

  it('sendMessage returns assistant response', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1', organizationId: 'org-1' } } as never)

    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.conversation.findFirst).mockResolvedValue({
      id: 'conv-1',
      organization_id: 'org-1',
    } as never)

    const { sendMessage } = await import('@/actions/assistant')
    const result = await sendMessage({
      conversationId: 'conv-1',
      message: 'Hvilke kontrakter udløber?',
    })

    expect(result.data?.response).toBe('Her er svaret.')
  })

  it('createConversation creates new conversation', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1', organizationId: 'org-1' } } as never)

    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.conversation.create).mockResolvedValue({
      id: 'conv-new',
      organization_id: 'org-1',
      user_id: 'user-1',
    } as never)

    const { createConversation } = await import('@/actions/assistant')
    const result = await createConversation()

    expect(result.data?.id).toBe('conv-new')
  })
})
```

- [ ] **Step 2: Kør test — verificér FAIL**

Run: `npx vitest run src/__tests__/actions/assistant.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementér actions**

```typescript
// src/actions/assistant.ts
'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isAIEnabled } from '@/lib/ai/feature-flags'
import { processMessage } from '@/lib/ai/assistant/orchestrator'
import type { ActionResult } from '@/types/actions'

export interface SendMessageInput {
  conversationId: string
  message: string
}

export interface SendMessageResult {
  response: string
  toolResults: Array<{ toolName: string; displayText: string }>
  pendingActions: Array<{
    id: string
    actionType: string
    actionLabel: string
    payload: Record<string, unknown>
  }>
}

export async function sendMessage(
  input: SendMessageInput
): Promise<ActionResult<SendMessageResult>> {
  const session = await auth()
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  const enabled = await isAIEnabled(session.user.organizationId, 'assistant')
  if (!enabled) return { error: 'AI-assistent er ikke aktiveret for din organisation.' }

  const conversation = await prisma.conversation.findFirst({
    where: { id: input.conversationId, organization_id: session.user.organizationId },
  })
  if (!conversation) return { error: 'Samtale ikke fundet.' }

  const result = await processMessage({
    conversationId: input.conversationId,
    userMessage: input.message,
    organizationId: session.user.organizationId,
    userId: session.user.id,
  })

  return {
    data: {
      response: result.response,
      toolResults: result.toolResults.map((tr) => ({
        toolName: tr.toolName,
        displayText: tr.result.displayText,
      })),
      pendingActions: result.pendingActions,
    },
  }
}

export async function createConversation(): Promise<ActionResult<{ id: string }>> {
  const session = await auth()
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  const conversation = await prisma.conversation.create({
    data: {
      organization_id: session.user.organizationId,
      user_id: session.user.id,
    },
  })

  return { data: { id: conversation.id } }
}

export async function confirmAction(actionId: string): Promise<ActionResult<{ success: boolean }>> {
  const session = await auth()
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  const action = await prisma.pendingAction.findFirst({
    where: { id: actionId, status: 'PENDING' },
    include: { conversation: { select: { organization_id: true } } },
  })

  if (!action) return { error: 'Handling ikke fundet eller allerede udført.' }
  if (action.conversation.organization_id !== session.user.organizationId) {
    return { error: 'Ingen adgang.' }
  }

  // Execute the confirmed action via existing server actions
  const { toolRegistry } = await import('@/lib/ai/assistant/tools/registry')
  const tool = toolRegistry.get(action.action_type)
  if (!tool) return { error: 'Ukendt handlingstype.' }

  await tool.execute(action.payload as Record<string, unknown>, {
    organizationId: session.user.organizationId,
    userId: session.user.id,
  })

  await prisma.pendingAction.update({
    where: { id: actionId },
    data: { status: 'CONFIRMED', resolved_at: new Date() },
  })

  return { data: { success: true } }
}

export async function rejectAction(actionId: string): Promise<ActionResult<{ success: boolean }>> {
  const session = await auth()
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  await prisma.pendingAction.update({
    where: { id: actionId },
    data: { status: 'REJECTED', resolved_at: new Date() },
  })

  return { data: { success: true } }
}

export async function getConversationHistory(
  conversationId: string
): Promise<ActionResult<Array<{ role: string; content: string; createdAt: Date }>>> {
  const session = await auth()
  if (!session) return { error: 'Din session er udløbet — log ind igen.' }

  const messages = await prisma.message.findMany({
    where: {
      conversation_id: conversationId,
      conversation: { organization_id: session.user.organizationId },
    },
    orderBy: { created_at: 'asc' },
    select: { role: true, content: true, created_at: true },
  })

  return {
    data: messages.map((m) => ({ role: m.role, content: m.content, createdAt: m.created_at })),
  }
}
```

- [ ] **Step 4: Kør test — verificér PASS**

Run: `npx vitest run src/__tests__/actions/assistant.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/actions/assistant.ts src/__tests__/actions/assistant.test.ts
git commit -m "feat: tilføj assistant server actions (sendMessage, createConversation, confirm/reject)"
```

---

### Task 6: ChatPanel UI-komponent

**Files:**

- Create: `src/components/assistant/ChatPanel.tsx`
- Create: `src/components/assistant/ActionConfirmCard.tsx`
- Create: `src/__tests__/components/assistant/ChatPanel.test.tsx`

- [ ] **Step 1: Skriv test**

```typescript
// src/__tests__/components/assistant/ChatPanel.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ChatPanel } from '@/components/assistant/ChatPanel'

vi.mock('@/actions/assistant', () => ({
  sendMessage: vi.fn().mockResolvedValue({
    data: { response: 'Svar fra AI', toolResults: [], pendingActions: [] },
  }),
  createConversation: vi.fn().mockResolvedValue({ data: { id: 'conv-1' } }),
}))

describe('ChatPanel', () => {
  it('renders when open', () => {
    render(<ChatPanel open={true} onClose={vi.fn()} />)
    expect(screen.getByPlaceholderText(/Skriv en besked/)).toBeDefined()
  })

  it('does not render when closed', () => {
    const { container } = render(<ChatPanel open={false} onClose={vi.fn()} />)
    expect(container.querySelector('[data-chat-panel]')).toBeNull()
  })

  it('shows welcome message initially', () => {
    render(<ChatPanel open={true} onClose={vi.fn()} />)
    expect(screen.getByText(/Hej!/)).toBeDefined()
  })
})
```

- [ ] **Step 2: Kør test — verificér FAIL**

Run: `npx vitest run src/__tests__/components/assistant/ChatPanel.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implementér ChatPanel**

```typescript
// src/components/assistant/ChatPanel.tsx
'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Send, Sparkles } from 'lucide-react'
import { sendMessage, createConversation, type SendMessageResult } from '@/actions/assistant'
import { ActionConfirmCard } from './ActionConfirmCard'
import { toast } from 'sonner'

interface Message {
  role: 'user' | 'assistant'
  content: string
  pendingActions?: SendMessageResult['pendingActions']
}

interface Props {
  open: boolean
  onClose: () => void
}

export function ChatPanel({ open, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open && !conversationId) {
      createConversation().then(result => {
        if (result.data) setConversationId(result.data.id)
      })
    }
  }, [open, conversationId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const handleSend = useCallback(async () => {
    if (!input.trim() || !conversationId || loading) return

    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setLoading(true)

    try {
      const result = await sendMessage({ conversationId, message: userMsg })
      if (result.error) {
        toast.error(result.error)
        return
      }
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: result.data!.response,
        pendingActions: result.data!.pendingActions,
      }])
    } catch {
      toast.error('Noget gik galt — prøv igen')
    } finally {
      setLoading(false)
    }
  }, [input, conversationId, loading])

  if (!open) return null

  return (
    <div
      data-chat-panel
      className="fixed right-0 top-0 z-50 flex h-screen w-[400px] flex-col border-l border-b-border bg-white shadow-xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-b-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-500" />
          <span className="text-[13px] font-medium">AI-assistent</span>
        </div>
        <button onClick={onClose} className="rounded p-1 hover:bg-b-surface-hover">
          <X className="h-4 w-4 text-b-muted" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="text-center text-[13px] text-b-muted py-8">
            <Sparkles className="mx-auto mb-2 h-8 w-8 text-purple-300" />
            <p className="font-medium text-b-text">Hej!</p>
            <p className="mt-1">Jeg kan hjælpe med at finde data, lave rapporter, og oprette opgaver.</p>
            <p className="mt-2 text-[11px]">Prøv fx: &quot;Hvilke kontrakter udløber snart?&quot;</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`mb-3 ${msg.role === 'user' ? 'text-right' : ''}`}>
            <div className={`inline-block max-w-[85%] rounded-lg px-3 py-2 text-[13px] ${
              msg.role === 'user'
                ? 'bg-blue-500 text-white'
                : 'bg-b-surface text-b-text'
            }`}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
            {msg.pendingActions && msg.pendingActions.length > 0 && (
              <div className="mt-2">
                {msg.pendingActions.map(action => (
                  <ActionConfirmCard
                    key={action.id}
                    actionId={action.id}
                    actionType={action.actionType}
                    actionLabel={action.actionLabel}
                    payload={action.payload}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="mb-3">
            <div className="inline-block rounded-lg bg-b-surface px-3 py-2 text-[13px] text-b-muted">
              Tænker...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-b-border px-4 py-3">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder="Skriv en besked..."
            disabled={loading}
            className="flex-1 rounded-md border border-b-border bg-white px-3 py-2 text-[13px] placeholder:text-b-muted focus:border-blue-400 focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="rounded-md bg-blue-500 p-2 text-white hover:bg-blue-600 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Implementér ActionConfirmCard**

```typescript
// src/components/assistant/ActionConfirmCard.tsx
'use client'

import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { confirmAction, rejectAction } from '@/actions/assistant'
import { toast } from 'sonner'

interface Props {
  actionId: string
  actionType: string
  actionLabel: string
  payload: Record<string, unknown>
}

export function ActionConfirmCard({ actionId, actionType, actionLabel, payload }: Props) {
  const [status, setStatus] = useState<'pending' | 'confirmed' | 'rejected'>('pending')
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    setLoading(true)
    const result = await confirmAction(actionId)
    if (result.error) {
      toast.error(result.error)
    } else {
      setStatus('confirmed')
      toast.success('Handling udført')
    }
    setLoading(false)
  }

  async function handleReject() {
    setLoading(true)
    await rejectAction(actionId)
    setStatus('rejected')
    setLoading(false)
  }

  if (status !== 'pending') {
    return (
      <div className={`rounded-md border px-3 py-2 text-[12px] ${
        status === 'confirmed' ? 'border-green-200 bg-green-50 text-green-700' : 'border-gray-200 bg-gray-50 text-gray-500'
      }`}>
        {status === 'confirmed' ? '✓ Udført' : '✗ Afvist'}
      </div>
    )
  }

  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
      <p className="text-[11px] font-medium text-amber-800">Bekræft handling</p>
      <p className="mt-0.5 text-[12px] text-amber-700">{actionLabel}</p>
      {payload.title && (
        <p className="mt-1 text-[12px] font-medium text-amber-900">{String(payload.title)}</p>
      )}
      <div className="mt-2 flex gap-2">
        <button
          onClick={handleConfirm}
          disabled={loading}
          className="flex items-center gap-1 rounded bg-green-500 px-2 py-1 text-[11px] font-medium text-white hover:bg-green-600 disabled:opacity-50"
        >
          <Check className="h-3 w-3" /> Bekræft
        </button>
        <button
          onClick={handleReject}
          disabled={loading}
          className="flex items-center gap-1 rounded bg-gray-200 px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-300 disabled:opacity-50"
        >
          <X className="h-3 w-3" /> Afvis
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Kør test — verificér PASS**

Run: `npx vitest run src/__tests__/components/assistant/ChatPanel.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/assistant/ChatPanel.tsx src/components/assistant/ActionConfirmCard.tsx src/__tests__/components/assistant/ChatPanel.test.tsx
git commit -m "feat: tilføj ChatPanel og ActionConfirmCard UI-komponenter"
```

---

### Task 7: Integrér ChatPanel i layout

**Files:**

- Modify: `src/components/layout/b-shell.tsx`
- Create: `src/components/layout/ChatToggle.tsx`

- [ ] **Step 1: Opret ChatToggle knap**

```typescript
// src/components/layout/ChatToggle.tsx
'use client'

import { MessageSquare } from 'lucide-react'

interface Props {
  onClick: () => void
}

export function ChatToggle({ onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center rounded-md p-1.5 hover:bg-b-surface-hover transition-colors"
      title="Åbn AI-assistent"
    >
      <MessageSquare className="h-4 w-4 text-b-muted" />
    </button>
  )
}
```

- [ ] **Step 2: Tilføj ChatPanel + toggle i BShell**

I `src/components/layout/b-shell.tsx`, tilføj state og render:

```typescript
import { useState } from 'react'
import { ChatPanel } from '@/components/assistant/ChatPanel'
import { ChatToggle } from './ChatToggle'

// I komponent-body:
const [chatOpen, setChatOpen] = useState(false)

// I JSX (i sidebar header eller footer):
<ChatToggle onClick={() => setChatOpen(true)} />

// Ved siden af main content:
<ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
```

- [ ] **Step 3: Verificér build**

Run: `npx next build`
Expected: Build successful

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/ChatToggle.tsx src/components/layout/b-shell.tsx
git commit -m "feat: integrér ChatPanel toggle i BShell sidebar"
```
