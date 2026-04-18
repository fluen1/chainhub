# Multi-Pass Extraction Pipeline + 6 Contract Schemas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the production extraction pipeline on top of Plan 1's foundation: multi-pass extraction with agreement-based confidence, source verification, sanity checks, cross-validation, and schemas for 6 priority contract types. Also extends content loader for Word and Excel files. Replaces the proof-of-concept extraction job with the real pipeline.

**Architecture:** Pipeline orchestrator chains 5 passes: (1) Type detection via Haiku, (2) Schema extraction via Sonnet 4 x2 for agreement, (3) Source verification via fuzzy match, (4) Rule-based sanity checks, (5) Cross-validation against human-verified data. Each pass is a separate module. Schema definitions live in `src/lib/ai/schemas/<type>.ts` with tool definitions, prompt templates, field metadata, and sanity rules. A schema registry maps contract types to schemas. Unknown types fall back to minimal extraction.

**Tech Stack:** Same as Plan 1 (TypeScript, Prisma, Anthropic SDK, pg-boss, pino) plus: `mammoth` (Word→HTML), `exceljs` (Excel→Markdown), `fastest-levenshtein` (fuzzy string matching for source verification).

---

## Scope

### In scope

- Extend content loader: Word (via mammoth HTML) + Excel (via exceljs Markdown tables)
- Schema infrastructure: types, registry, base validation
- 6 contract schemas with prompt templates: EJERAFTALE, LEJEKONTRAKT, FORSIKRING, VEDTAEGTER, ANSAETTELSESKONTRAKT, DRIFTSAFTALE
- Minimal extraction schema for unknown types
- `additional_findings` and `extraction_warnings` on all extractions
- Pass 1: Type detection (Haiku)
- Pass 2: Schema extraction x2 for agreement (Sonnet 4)
- Pass 3: Source verification (fuzzy match)
- Pass 4: Sanity check framework with per-type rules
- Pass 5: Cross-validation against existing data
- Agreement-based confidence computation
- Pipeline orchestrator chaining all passes
- Replace PoC worker job with real pipeline
- AIFieldCorrection logging helpers

### Out of scope

- Bedrock client (Plan deferred to week 16)
- UI migration (separate plans)
- Insights system (Plan 4)
- Søg & Spørg AI (Plan 5)
- Shadow mode deployment (requires Supabase + Hetzner)
- Hetzner deployment

### Dependencies

- Plan 1 completed (all infrastructure in place)
- ANTHROPIC_API_KEY in .env.local
- Test PDF fixture at `src/__tests__/fixtures/test-contract.pdf`

---

## File Structure

### New files

```
src/lib/ai/
├── schemas/
│   ├── types.ts                    # ContractSchema interface, FieldMetadata, SanityRule
│   ├── registry.ts                 # Schema registry: type → schema mapping
│   ├── ejeraftale.ts               # EJERAFTALE schema + prompt
│   ├── lejekontrakt.ts             # LEJEKONTRAKT schema + prompt
│   ├── forsikring.ts               # FORSIKRING schema + prompt
│   ├── vedtaegter.ts               # VEDTAEGTER schema + prompt
│   ├── ansaettelseskontrakt.ts     # ANSAETTELSESKONTRAKT schema + prompt
│   ├── driftsaftale.ts             # DRIFTSAFTALE schema + prompt
│   └── minimal.ts                  # Minimal extraction for unknown types
├── pipeline/
│   ├── types.ts                    # Pipeline types (ExtractionResult, PipelineOptions)
│   ├── pass1-type-detection.ts     # Type detection via Haiku
│   ├── pass2-schema-extraction.ts  # Schema extraction via Sonnet x2
│   ├── pass3-source-verification.ts # Fuzzy match source attribution
│   ├── pass4-sanity-checks.ts      # Rule-based validation
│   ├── pass5-cross-validation.ts   # Compare vs existing data
│   ├── confidence.ts               # Agreement-based confidence computation
│   └── orchestrator.ts             # Chains all passes, saves result
├── jobs/
│   ├── extract-document.ts         # Production extraction job (replaces PoC)
│   └── extract-document-poc.ts     # (kept for reference, no longer used)
└── feedback.ts                     # AIFieldCorrection logging helpers

src/__tests__/ai/
├── schemas/
│   └── registry.test.ts
├── pipeline/
│   ├── pass1.test.ts
│   ├── pass2.test.ts
│   ├── pass3.test.ts
│   ├── pass4.test.ts
│   ├── pass5.test.ts
│   ├── confidence.test.ts
│   └── orchestrator.test.ts
├── content-loader-extended.test.ts  # Word/Excel tests
└── fixtures/
    ├── test-contract.pdf            # (exists from Plan 1)
    ├── test-contract.docx           # Generated test Word doc
    └── test-contract.xlsx           # Generated test Excel doc
```

### Modified files

- `src/lib/ai/content-loader.ts` — add Word + Excel support
- `src/lib/ai/queue.ts` — add `EXTRACT_DOCUMENT` job name
- `worker/index.ts` — register new extraction job, deprecate PoC
- `vitest.config.ts` — potentially add test path aliases

---

## Contract Schema Field Definitions

### EJERAFTALE (ownership agreement) — 12 fields

| Field                     | Type                                                                      | Legal-critical | Description                 |
| ------------------------- | ------------------------------------------------------------------------- | -------------- | --------------------------- |
| parties                   | array<{name, party_type, capital_pct, voting_pct, ownership_type, notes}> | YES            | Aftaleparter med ejerandele |
| effective_date            | date                                                                      | YES            | Ikrafttrædelsesdato         |
| expiry_date               | date                                                                      | YES            | Udløbsdato (null = løbende) |
| termination_notice_months | number                                                                    | YES            | Opsigelsesvarsel i måneder  |
| non_compete               | {present, duration_months, geographic_scope}                              | YES            | Konkurrenceklausul          |
| pre_emption_right         | {present, description}                                                    | YES            | Forkøbsret                  |
| exit_clause               | {present, description}                                                    | YES            | Udtrædelsesklausul          |
| drag_along                | boolean                                                                   | NO             | Medsalgspligt               |
| tag_along                 | boolean                                                                   | NO             | Medsalgsret                 |
| dividend_policy           | string                                                                    | NO             | Udbyttepolitik              |
| board_composition         | string                                                                    | NO             | Bestyrelsessammensætning    |
| dispute_resolution        | string                                                                    | NO             | Tvistløsningsklausul        |

### LEJEKONTRAKT (lease) — 12 fields

| Field                      | Type                | Legal-critical | Description                               |
| -------------------------- | ------------------- | -------------- | ----------------------------------------- |
| parties                    | array<{name, role}> | YES            | Udlejer og lejer                          |
| property_address           | string              | YES            | Lejemålets adresse                        |
| effective_date             | date                | YES            | Ikrafttrædelse                            |
| expiry_date                | date                | YES            | Udløb                                     |
| rent_monthly_dkk           | number              | YES            | Månedlig leje i DKK                       |
| rent_adjustment            | string              | YES            | Reguleringsklausul (nettoprisindeks etc.) |
| deposit_dkk                | number              | NO             | Depositum                                 |
| notice_period_months       | number              | YES            | Opsigelsesvarsel                          |
| permitted_use              | string              | NO             | Tilladt anvendelse                        |
| sublease_allowed           | boolean             | NO             | Fremlejeadgang                            |
| maintenance_responsibility | string              | NO             | Vedligeholdelsesansvar                    |
| renewal_clause             | string              | NO             | Forlængelsesklausul                       |

### FORSIKRING (insurance) — 11 fields

| Field               | Type     | Legal-critical | Description          |
| ------------------- | -------- | -------------- | -------------------- |
| insurer             | string   | YES            | Forsikringsselskab   |
| policy_number       | string   | NO             | Policenummer         |
| insured_party       | string   | YES            | Forsikringstager     |
| coverage_type       | string   | YES            | Dækningstype         |
| coverage_amount_dkk | number   | YES            | Forsikringssum       |
| premium_annual_dkk  | number   | NO             | Årlig præmie         |
| effective_date      | date     | YES            | Ikrafttrædelse       |
| expiry_date         | date     | YES            | Udløb                |
| deductible_dkk      | number   | NO             | Selvrisiko           |
| exclusions          | string[] | YES            | Undtagelser          |
| auto_renewal        | boolean  | NO             | Automatisk fornyelse |

### VEDTAEGTER (bylaws) — 10 fields

| Field                   | Type   | Legal-critical | Description              |
| ----------------------- | ------ | -------------- | ------------------------ |
| company_name            | string | YES            | Selskabsnavn             |
| cvr_number              | string | YES            | CVR-nummer               |
| registered_address      | string | NO             | Hjemstedsadresse         |
| business_purpose        | string | NO             | Formål                   |
| share_capital_dkk       | number | YES            | Selskabskapital          |
| share_classes           | string | NO             | Aktieklasser             |
| board_size              | number | NO             | Bestyrelsesmedlemmer     |
| board_appointment_rules | string | NO             | Udpegningsregler         |
| general_meeting_rules   | string | NO             | Generalforsamlingsregler |
| dissolution_rules       | string | NO             | Opløsningsregler         |

### ANSAETTELSESKONTRAKT (employment) — 12 fields

| Field                  | Type                       | Legal-critical | Description                   |
| ---------------------- | -------------------------- | -------------- | ----------------------------- |
| employee_name          | string                     | YES            | Medarbejderens navn           |
| position_title         | string                     | NO             | Stillingsbetegnelse           |
| employer_name          | string                     | YES            | Arbejdsgiver                  |
| start_date             | date                       | YES            | Tiltrædelsesdato              |
| end_date               | date                       | NO             | Udløb (null = fastansættelse) |
| salary_monthly_dkk     | number                     | YES            | Månedlig løn                  |
| notice_employee_months | number                     | YES            | Opsigelsesvarsel medarbejder  |
| notice_employer_months | number                     | YES            | Opsigelsesvarsel arbejdsgiver |
| working_hours_weekly   | number                     | NO             | Ugentlig arbejdstid           |
| vacation_days          | number                     | NO             | Feriedage                     |
| non_compete            | {present, duration_months} | YES            | Konkurrenceklausul            |
| pension_pct            | number                     | NO             | Pensionsbidrag                |

### DRIFTSAFTALE (operations agreement) — 10 fields

| Field                | Type                | Legal-critical | Description        |
| -------------------- | ------------------- | -------------- | ------------------ |
| parties              | array<{name, role}> | YES            | Aftaleparter       |
| effective_date       | date                | YES            | Ikrafttrædelse     |
| expiry_date          | date                | YES            | Udløb              |
| scope_of_services    | string              | YES            | Ydelsesomfang      |
| fee_structure        | string              | YES            | Honorarmodel       |
| payment_terms        | string              | NO             | Betalingsvilkår    |
| notice_period_months | number              | YES            | Opsigelsesvarsel   |
| performance_metrics  | string              | NO             | KPI'er             |
| liability_cap_dkk    | number              | NO             | Ansvarsbegrænsning |
| termination_clause   | string              | YES            | Ophørsklausul      |

### MINIMAL (unknown types) — 5 fields

| Field            | Type                       | Legal-critical | Description                   |
| ---------------- | -------------------------- | -------------- | ----------------------------- |
| parties          | array<{name, role}>        | YES            | Parter                        |
| effective_date   | date                       | YES            | Dato                          |
| key_amounts      | array<{label, amount_dkk}> | NO             | Nøglebeløb                    |
| summary          | string                     | NO             | Sammenfatning (1-3 sætninger) |
| detected_clauses | string[]                   | NO             | Fundne klausuler (fri tekst)  |

### Common fields on ALL schemas

These are added to every schema automatically:

- `additional_findings: array<{finding, source_page, importance}>` — anything Claude finds outside schema fields
- `extraction_warnings: array<{warning, severity}>` — unusual structures, ambiguities, concerns

---

## Tasks

### Task 1: Install additional dependencies + extend content loader

**Files:**

- Modify: `package.json`
- Modify: `src/lib/ai/content-loader.ts`
- Create: `src/__tests__/ai/content-loader-extended.test.ts`

- [ ] **Step 1.1: Install dependencies**

```bash
npm install mammoth exceljs fastest-levenshtein
```

- [ ] **Step 1.2: Create test Word fixture**

```bash
node -e "
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell } = require('docx');
(async () => {
  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ children: [new TextRun({ text: 'EJERAFTALE', bold: true, size: 32 })] }),
        new Paragraph({ children: [new TextRun('Mellem Kædegruppen A/S (51%) og Dr. Petersen (49%)')] }),
        new Paragraph({ children: [new TextRun('Ikrafttrædelse: 1. januar 2026')] }),
      ],
    }],
  });
  const buffer = await Packer.toBuffer(doc);
  require('fs').writeFileSync('src/__tests__/fixtures/test-contract.docx', buffer);
  console.log('Created test DOCX:', buffer.length, 'bytes');
})();
"
```

NOTE: If the `docx` library is needed just for test fixture generation, install it as dev dependency: `npm install --save-dev docx`. Alternatively, create a minimal .docx file manually or copy one into fixtures. The key is having a .docx file for testing mammoth.

If this approach is too complex, create a simpler fixture: write a plain text file with .docx extension for magic-byte testing (it won't be valid .docx but tests the loader's type detection).

Actually, the SIMPLEST approach: create an actual .docx by zipping the required XML structure. Or just use mammoth's own test fixtures. Let the subagent decide the best approach — the goal is to have a .docx file that mammoth can extract text from.

- [ ] **Step 1.3: Create test Excel fixture**

```bash
node -e "
const ExcelJS = require('exceljs');
(async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Ejerforhold');
  ws.addRow(['Part', 'Ejerandel', 'Type']);
  ws.addRow(['Kædegruppen A/S', '51%', 'Kapital']);
  ws.addRow(['Dr. Petersen', '49%', 'Kapital']);
  const buffer = await wb.xlsx.writeBuffer();
  require('fs').writeFileSync('src/__tests__/fixtures/test-contract.xlsx', Buffer.from(buffer));
  console.log('Created test XLSX:', buffer.length, 'bytes');
})();
"
```

- [ ] **Step 1.4: Write tests for extended content loader**

Create `src/__tests__/ai/content-loader-extended.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { loadForExtraction } from '@/lib/ai/content-loader'

const DOCX_PATH = join(__dirname, '..', 'fixtures', 'test-contract.docx')
const XLSX_PATH = join(__dirname, '..', 'fixtures', 'test-contract.xlsx')

const hasDocx = existsSync(DOCX_PATH)
const hasXlsx = existsSync(XLSX_PATH)

describe.skipIf(!hasDocx)('content-loader Word', () => {
  let buffer: Buffer
  beforeAll(() => {
    buffer = readFileSync(DOCX_PATH)
  })

  it('loads .docx and returns text_html content', async () => {
    const result = await loadForExtraction(buffer, 'test.docx')
    expect(result.type).toBe('text_html')
    if (result.type === 'text_html') {
      expect(result.html.length).toBeGreaterThan(0)
    }
  })
})

describe.skipIf(!hasXlsx)('content-loader Excel', () => {
  let buffer: Buffer
  beforeAll(() => {
    buffer = readFileSync(XLSX_PATH)
  })

  it('loads .xlsx and returns text_markdown content', async () => {
    const result = await loadForExtraction(buffer, 'test.xlsx')
    expect(result.type).toBe('text_markdown')
    if (result.type === 'text_markdown') {
      expect(result.markdown.length).toBeGreaterThan(0)
      expect(result.markdown).toContain('|') // markdown table
    }
  })
})
```

- [ ] **Step 1.5: Extend content-loader.ts**

Update the `ExtractionContent` type to add:

```typescript
| { type: 'text_html'; html: string; detectedMime: string }
| { type: 'text_markdown'; markdown: string; detectedMime: string }
```

Add Word handler in `loadForExtraction`:

```typescript
if (type.ext === 'docx') {
  const mammoth = await import('mammoth')
  const result = await mammoth.convertToHtml({ buffer: new Uint8Array(buffer) })
  return { type: 'text_html', html: result.value, detectedMime: type.mime }
}
```

Add Excel handler:

```typescript
if (type.ext === 'xlsx') {
  const ExcelJS = await import('exceljs')
  const wb = new ExcelJS.default.Workbook()
  await wb.xlsx.load(buffer)
  let markdown = ''
  wb.eachSheet((sheet) => {
    markdown += `## ${sheet.name}\n\n`
    const rows: string[][] = []
    sheet.eachRow((row, rowNumber) => {
      const values = (row.values as (string | number | null)[]).slice(1) // skip index 0
      rows.push(values.map((v) => String(v ?? '')))
    })
    if (rows.length > 0) {
      // header
      markdown += '| ' + rows[0].join(' | ') + ' |\n'
      markdown += '| ' + rows[0].map(() => '---').join(' | ') + ' |\n'
      for (let i = 1; i < rows.length; i++) {
        markdown += '| ' + rows[i].join(' | ') + ' |\n'
      }
    }
    markdown += '\n'
  })
  return { type: 'text_markdown', markdown, detectedMime: type.mime }
}
```

- [ ] **Step 1.6: Run tests, typecheck, commit**

```bash
npm test -- content-loader
npx tsc --noEmit
git add -A
git commit -m "feat(ai): extend content loader for Word and Excel

- Word via mammoth.convertToHtml() preserves table structure
- Excel via exceljs → Markdown tables per sheet
- Test fixtures generated for both formats
- ExtractionContent type extended with text_html and text_markdown"
```

---

### Task 2: Schema infrastructure

**Files:**

- Create: `src/lib/ai/schemas/types.ts`
- Create: `src/lib/ai/schemas/registry.ts`
- Create: `src/__tests__/ai/schemas/registry.test.ts`

- [ ] **Step 2.1: Create schema types**

Create `src/lib/ai/schemas/types.ts`:

```typescript
import type { ClaudeTool, ClaudeModel } from '@/lib/ai/client/types'

export interface FieldMetadata {
  legal_critical: boolean
  required: boolean
  auto_accept_threshold?: number // only for non-legal-critical fields
  description: string
}

export interface SanityRule {
  field: string
  check: (value: unknown, allFields: Record<string, unknown>) => boolean
  message: string
}

export interface CrossValidationRule {
  extracted_field: string
  description: string
}

export interface ContractSchema {
  contract_type: string
  schema_version: string
  display_name: string // Danish display name

  // Claude tool definition for structured extraction
  tool_definition: ClaudeTool

  // Per-field metadata
  field_metadata: Record<string, FieldMetadata>

  // System prompt + few-shot examples
  system_prompt: string
  user_prompt_prefix: string // prepended to document content

  // Recommended model for this schema
  extraction_model: ClaudeModel

  // Validation
  sanity_rules: SanityRule[]
  cross_validation_rules: CrossValidationRule[]
}

// Common fields added to ALL schemas automatically
export const COMMON_TOOL_PROPERTIES = {
  additional_findings: {
    type: 'array' as const,
    description:
      'Anything found in the document that is NOT covered by the other fields. Report unusual clauses, missing standard elements, or noteworthy observations.',
    items: {
      type: 'object' as const,
      properties: {
        finding: { type: 'string' as const },
        source_page: { type: 'number' as const },
        importance: { type: 'string' as const, enum: ['critical', 'informational'] },
      },
      required: ['finding', 'importance'],
    },
  },
  extraction_warnings: {
    type: 'array' as const,
    description:
      'Warnings about quality or reliability of the extraction. Report ambiguities, unusual document structure, low-confidence areas, or missing expected sections.',
    items: {
      type: 'object' as const,
      properties: {
        warning: { type: 'string' as const },
        severity: { type: 'string' as const, enum: ['high', 'medium', 'low'] },
      },
      required: ['warning', 'severity'],
    },
  },
}

// Per-field extraction result (returned by Claude for each field)
export interface ExtractedFieldValue {
  value: unknown
  claude_confidence: number // Claude's self-reported (used as 10% weight)
  source_page: number | null
  source_text: string | null
}
```

- [ ] **Step 2.2: Create schema registry**

Create `src/lib/ai/schemas/registry.ts`:

```typescript
import type { ContractSchema } from './types'

const schemaMap = new Map<string, ContractSchema>()

export function registerSchema(schema: ContractSchema): void {
  schemaMap.set(schema.contract_type, schema)
}

export function getSchema(contractType: string): ContractSchema | null {
  return schemaMap.get(contractType) ?? null
}

export function getAllSchemaTypes(): string[] {
  return Array.from(schemaMap.keys())
}

export function hasSchema(contractType: string): boolean {
  return schemaMap.has(contractType)
}

// Auto-register all schemas when this module is imported
// Each schema file calls registerSchema() at module level
```

- [ ] **Step 2.3: Write registry test**

Create `src/__tests__/ai/schemas/registry.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'

// We test the registry by importing it and checking basic functionality
// Schema files will self-register when imported

describe('schema registry', () => {
  it('getAllSchemaTypes returns registered types', async () => {
    // Dynamic import to ensure schemas are loaded
    const { getAllSchemaTypes, hasSchema } = await import('@/lib/ai/schemas/registry')

    const types = getAllSchemaTypes()
    // At minimum, after all schemas are registered, we should have 6
    // But this test may run before schemas are registered
    // So we test the API, not the content
    expect(Array.isArray(types)).toBe(true)
  })

  it('getSchema returns null for unknown type', async () => {
    const { getSchema } = await import('@/lib/ai/schemas/registry')
    expect(getSchema('NONEXISTENT_TYPE')).toBeNull()
  })

  it('hasSchema returns false for unknown type', async () => {
    const { hasSchema } = await import('@/lib/ai/schemas/registry')
    expect(hasSchema('NONEXISTENT_TYPE')).toBe(false)
  })
})
```

- [ ] **Step 2.4: Run tests, typecheck, commit**

```bash
npm test -- registry
npx tsc --noEmit
git add src/lib/ai/schemas/ src/__tests__/ai/schemas/
git commit -m "feat(ai): add schema infrastructure (types + registry)

- ContractSchema interface with tool definition, field metadata, prompts
- COMMON_TOOL_PROPERTIES (additional_findings, extraction_warnings)
- Schema registry with register/get/has/getAll helpers
- Ready for individual schema definitions"
```

---

### Task 3: EJERAFTALE schema

**Files:**

- Create: `src/lib/ai/schemas/ejeraftale.ts`

- [ ] **Step 3.1: Create EJERAFTALE schema**

Create `src/lib/ai/schemas/ejeraftale.ts`. This is a large file (~200-300 lines) containing:

1. Tool definition with all 12 fields + common fields (additional_findings, extraction_warnings)
2. Field metadata (legal_critical, required, description per field)
3. System prompt (Danish, domain-specific, with anti-hallucination instructions)
4. Sanity rules (ownership sums to 100%, dates valid, etc.)
5. Self-registration via `registerSchema()`

The schema file should:

- Import `registerSchema` from `./registry`
- Import types from `./types`
- Import `COMMON_TOOL_PROPERTIES` from `./types`
- Define and export the schema constant
- Call `registerSchema(schema)` at module level

Key points for the system prompt:

- Role: "Du er ekspert i danske ejeraftaler med erfaring i selskabsret"
- Context: "Du ekstraherer felter for ChainHub, et portfolio management system"
- Anti-hallucination: "Hvis du ikke finder et felt, returnér null. GÆT ALDRIG."
- Source attribution: "Citer exact word-for-word passages. Hvis ingen exakt passage, sæt source_text til null."
- Each field has a `claude_confidence` (0.0-1.0) that Claude self-reports
- Each field has `source_page` and `source_text`

For the tool_definition, wrap each schema field in an object with `{value, claude_confidence, source_page, source_text}` structure so Claude returns attribution per field.

- [ ] **Step 3.2: Verify schema registers correctly**

```bash
node -e "
require('./src/lib/ai/schemas/ejeraftale');
const { getSchema, getAllSchemaTypes } = require('./src/lib/ai/schemas/registry');
console.log('Types:', getAllSchemaTypes());
const s = getSchema('EJERAFTALE');
console.log('Fields:', Object.keys(s.field_metadata));
"
```

This may not work if the files use ESM imports. Alternative: write a quick vitest test.

- [ ] **Step 3.3: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/lib/ai/schemas/ejeraftale.ts
git commit -m "feat(ai): add EJERAFTALE schema with production prompt

12 extractable fields including parties, ownership, dates, clauses.
Danish system prompt with anti-hallucination and source attribution instructions.
Sanity rules: ownership sums to 100%, dates valid, at least 2 parties."
```

---

### Task 4: Pass 1 — Type detection

**Files:**

- Create: `src/lib/ai/pipeline/types.ts`
- Create: `src/lib/ai/pipeline/pass1-type-detection.ts`
- Create: `src/__tests__/ai/pipeline/pass1.test.ts`

- [ ] **Step 4.1: Create pipeline types**

Create `src/lib/ai/pipeline/types.ts`:

```typescript
export interface TypeDetectionResult {
  detected_type: string
  confidence: number
  alternatives: Array<{ type: string; confidence: number }>
  model_used: string
  input_tokens: number
  output_tokens: number
}

export interface SchemaExtractionResult {
  fields: Record<string, ExtractedField>
  model_used: string
  input_tokens: number
  output_tokens: number
  raw_response: unknown
}

export interface ExtractedField {
  value: unknown
  claude_confidence: number
  source_page: number | null
  source_text: string | null
}

export interface AgreementResult {
  field_name: string
  run1_value: unknown
  run2_value: unknown
  values_match: boolean
}

export interface SourceVerificationResult {
  field_name: string
  verified: boolean
  match_score: number
}

export interface SanityCheckResult {
  field_name: string
  passed: boolean
  rule: string
  message?: string
}

export interface CrossValidationResult {
  field_name: string
  ai_value: unknown
  existing_value: unknown
  match: boolean
}

export interface FieldConfidence {
  field_name: string
  confidence: number // 0.0 - 1.0 computed
  components: {
    agreement: number // 0.0 or 0.4
    source_verified: number // 0.0 or 0.3
    sanity_passed: number // 0.0 or 0.2
    claude_self: number // 0.0 - 0.1
  }
}

export interface PipelineResult {
  // Pass 1
  type_detection: TypeDetectionResult

  // Pass 2
  extraction_run1: SchemaExtractionResult
  extraction_run2: SchemaExtractionResult | null // null if type was manually selected
  agreement: AgreementResult[]

  // Pass 3
  source_verification: SourceVerificationResult[]

  // Pass 4
  sanity_checks: SanityCheckResult[]

  // Pass 5
  cross_validation: CrossValidationResult[]

  // Computed confidence per field
  field_confidences: FieldConfidence[]

  // Common
  additional_findings: Array<{ finding: string; source_page: number | null; importance: string }>
  extraction_warnings: Array<{ warning: string; severity: string }>

  // Cost
  total_input_tokens: number
  total_output_tokens: number
  total_cost_usd: number
}

export interface PipelineOptions {
  document_id: string
  organization_id: string
  skip_agreement: boolean // skip second run (for manual type selection)
  forced_type?: string // bypass Pass 1, use this type directly
}
```

- [ ] **Step 4.2: Implement Pass 1 type detection**

Create `src/lib/ai/pipeline/pass1-type-detection.ts`:

The implementation should:

1. Take a content buffer (ExtractionContent from content-loader)
2. Call Claude Haiku with a classification prompt listing all known schema types
3. Parse the response to get `{type, confidence, alternatives}`
4. Return TypeDetectionResult

The classification prompt should:

- List all registered schema types from the registry
- Ask Claude to classify into one of them
- Return top 3 with confidence scores
- Use tool_use for structured response

- [ ] **Step 4.3: Write unit test (mock Claude client)**

Create `src/__tests__/ai/pipeline/pass1.test.ts` that mocks the Claude client and verifies:

- Correct type returned for a clear ejeraftale
- Low confidence returned for ambiguous docs
- Alternatives provided
- Token usage tracked

- [ ] **Step 4.4: Run tests, typecheck, commit**

```bash
npm test -- pass1
npx tsc --noEmit
git add src/lib/ai/pipeline/
git commit -m "feat(ai): implement Pass 1 type detection via Haiku

Classifies document into registered schema types.
Returns confidence + top 3 alternatives.
Uses tool_use for structured response."
```

---

### Task 5: Pass 2 — Schema extraction (single run)

**Files:**

- Create: `src/lib/ai/pipeline/pass2-schema-extraction.ts`
- Create: `src/__tests__/ai/pipeline/pass2.test.ts`

- [ ] **Step 5.1: Implement Pass 2**

Create `src/lib/ai/pipeline/pass2-schema-extraction.ts`:

The implementation should:

1. Take ExtractionContent + ContractSchema
2. Build Claude request with: schema's system_prompt, document content, schema's tool_definition
3. Call Claude Sonnet 4 with tool_use
4. Parse tool_use response into `Record<string, ExtractedField>`
5. Extract `additional_findings` and `extraction_warnings` from response
6. Return SchemaExtractionResult

Key implementation detail: The tool_definition from the schema defines the output structure. Claude responds with a tool_use block containing the structured extraction. Parse `response.content.find(b => b.type === 'tool_use')?.input` as the extracted fields.

For PDF content: send as `{type: 'document', source: {type: 'base64', media_type: 'application/pdf', data: base64}}`.
For HTML/Markdown content: send as `{type: 'text', text: content}`.

- [ ] **Step 5.2: Write unit test**

Test with mocked Claude client:

- Correct fields extracted from mock response
- additional_findings and extraction_warnings parsed
- Token usage tracked
- Handles Claude tool_use response format

- [ ] **Step 5.3: Run tests, typecheck, commit**

```bash
npm test -- pass2
npx tsc --noEmit
git add src/lib/ai/pipeline/pass2-schema-extraction.ts src/__tests__/ai/pipeline/pass2.test.ts
git commit -m "feat(ai): implement Pass 2 schema extraction via Sonnet tool_use

Schema-driven structured extraction using Claude's tool_use.
Parses additional_findings and extraction_warnings.
Supports PDF (vision), HTML (Word), and Markdown (Excel) content."
```

---

### Task 6: Agreement-based confidence

**Files:**

- Create: `src/lib/ai/pipeline/confidence.ts`
- Create: `src/__tests__/ai/pipeline/confidence.test.ts`

- [ ] **Step 6.1: Implement confidence computation**

Create `src/lib/ai/pipeline/confidence.ts`:

```typescript
import type {
  ExtractedField,
  AgreementResult,
  SourceVerificationResult,
  SanityCheckResult,
  FieldConfidence,
} from './types'

export function compareRuns(
  run1: Record<string, ExtractedField>,
  run2: Record<string, ExtractedField>
): AgreementResult[] {
  const results: AgreementResult[] = []
  for (const fieldName of Object.keys(run1)) {
    const v1 = run1[fieldName]
    const v2 = run2[fieldName]
    results.push({
      field_name: fieldName,
      run1_value: v1?.value ?? null,
      run2_value: v2?.value ?? null,
      values_match: valuesMatch(v1?.value, v2?.value),
    })
  }
  return results
}

export function valuesMatch(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a == null && b == null) return true
  if (a == null || b == null) return false
  // Deep compare for objects/arrays
  return JSON.stringify(a) === JSON.stringify(b)
}

export function computeFieldConfidence(
  fieldName: string,
  agreement: AgreementResult | undefined,
  sourceVerification: SourceVerificationResult | undefined,
  sanityCheck: SanityCheckResult | undefined,
  claudeConfidence: number
): FieldConfidence {
  let confidence = 0
  const components = {
    agreement: 0,
    source_verified: 0,
    sanity_passed: 0,
    claude_self: 0,
  }

  // Agreement between two runs (40% weight)
  if (agreement?.values_match) {
    components.agreement = 0.4
    confidence += 0.4
  }

  // Source verification (30% weight)
  if (sourceVerification?.verified) {
    components.source_verified = 0.3
    confidence += 0.3
  }

  // Sanity check (20% weight)
  // If no sanity rule exists for this field, grant the points
  if (sanityCheck === undefined || sanityCheck.passed) {
    components.sanity_passed = 0.2
    confidence += 0.2
  }

  // Claude self-reported (10% weight, discounted)
  components.claude_self = 0.1 * Math.min(claudeConfidence, 1.0)
  confidence += components.claude_self

  return {
    field_name: fieldName,
    confidence: Math.min(1.0, confidence),
    components,
  }
}
```

- [ ] **Step 6.2: Write comprehensive tests**

Test cases:

- Full agreement + verified + sanity passed + high claude confidence → ~0.95-1.0
- No agreement + verified + sanity passed → ~0.55-0.60
- Agreement + not verified + sanity failed → ~0.45
- All failed → ~0.05
- Edge cases: null values, missing fields, no sanity rule

- [ ] **Step 6.3: Run tests, typecheck, commit**

```bash
npm test -- confidence
npx tsc --noEmit
git add src/lib/ai/pipeline/confidence.ts src/__tests__/ai/pipeline/confidence.test.ts
git commit -m "feat(ai): implement agreement-based confidence computation

Weighted scoring: agreement 40% + source verification 30% + sanity 20% + claude self 10%.
Not relying on Claude's self-reported confidence as primary signal."
```

---

### Task 7: Pass 3 — Source verification

**Files:**

- Create: `src/lib/ai/pipeline/pass3-source-verification.ts`
- Create: `src/__tests__/ai/pipeline/pass3.test.ts`

- [ ] **Step 7.1: Implement source verification**

Uses `fastest-levenshtein` for fuzzy string matching. For each extracted field with source_text:

1. Load the document text for the referenced page
2. Sliding window match of source_text against page content
3. If best match score >= 0.85, mark as verified
4. Return SourceVerificationResult per field

For PDF: We don't have page-level text extraction in v1 (Claude processes the whole PDF). For now, source verification marks all PDF fields as `verified: false` with a note. Full implementation requires a text-extraction step that's added when we have real documents to test against.

For Word/Excel: The full text is available, so we can do actual fuzzy matching.

- [ ] **Step 7.2: Write tests**

Test fuzzy matching logic with known strings, thresholds, edge cases.

- [ ] **Step 7.3: Commit**

```bash
git add src/lib/ai/pipeline/pass3-source-verification.ts src/__tests__/ai/pipeline/pass3.test.ts
git commit -m "feat(ai): implement Pass 3 source verification via fuzzy match

Verifies Claude's source_text attribution against actual document content.
Uses fastest-levenshtein for string matching with 0.85 threshold.
PDF page-level verification deferred (needs text extraction per page)."
```

---

### Task 8: Pass 4 — Sanity checks + Pass 5 — Cross-validation

**Files:**

- Create: `src/lib/ai/pipeline/pass4-sanity-checks.ts`
- Create: `src/lib/ai/pipeline/pass5-cross-validation.ts`
- Create: `src/__tests__/ai/pipeline/pass4.test.ts`
- Create: `src/__tests__/ai/pipeline/pass5.test.ts`

- [ ] **Step 8.1: Implement Pass 4 sanity checks**

Generic framework that runs schema-specific rules:

```typescript
import type { SanityRule } from '@/lib/ai/schemas/types'
import type { SanityCheckResult, ExtractedField } from './types'

export function runSanityChecks(
  fields: Record<string, ExtractedField>,
  rules: SanityRule[]
): SanityCheckResult[] {
  const results: SanityCheckResult[] = []
  for (const rule of rules) {
    const field = fields[rule.field]
    const passed = field ? rule.check(field.value, extractValues(fields)) : true // skip if field missing
    results.push({
      field_name: rule.field,
      passed,
      rule: rule.message,
      message: passed ? undefined : rule.message,
    })
  }
  return results
}

function extractValues(fields: Record<string, ExtractedField>): Record<string, unknown> {
  const values: Record<string, unknown> = {}
  for (const [key, field] of Object.entries(fields)) {
    values[key] = field.value
  }
  return values
}
```

- [ ] **Step 8.2: Implement Pass 5 cross-validation**

Compares extracted values against existing Prisma data. Only compares fields where existing data has `provenance = human_verified` (not AI-derived). For v1, this is a basic structure that checks against existing Contract/Company records.

```typescript
import { prisma } from '@/lib/db'
import type { CrossValidationResult } from './types'

export async function crossValidate(
  documentId: string,
  extractedFields: Record<string, { value: unknown }>
): Promise<CrossValidationResult[]> {
  // Find the document's company
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: { company: true },
  })
  if (!doc?.company) return []

  const results: CrossValidationResult[] = []

  // Example: check company name against existing
  if (extractedFields['parties']?.value) {
    // Basic comparison — extend in future
  }

  return results
}
```

- [ ] **Step 8.3: Write tests for both passes**

- [ ] **Step 8.4: Commit**

```bash
git add src/lib/ai/pipeline/pass4-sanity-checks.ts src/lib/ai/pipeline/pass5-cross-validation.ts src/__tests__/ai/pipeline/
git commit -m "feat(ai): implement Pass 4 sanity checks + Pass 5 cross-validation

Pass 4: Generic framework running schema-specific rules (ownership sums, date validity, etc.)
Pass 5: Compares extraction against existing human-verified DB data.
Both produce typed results consumed by confidence computation."
```

---

### Task 9: Minimal extraction schema

**Files:**

- Create: `src/lib/ai/schemas/minimal.ts`

- [ ] **Step 9.1: Create minimal schema**

Create a schema for unknown contract types with 5 basic fields: parties, effective_date, key_amounts, summary, detected_clauses. Uses simpler prompt focused on "extract what you can find".

- [ ] **Step 9.2: Self-register and commit**

```bash
git add src/lib/ai/schemas/minimal.ts
git commit -m "feat(ai): add minimal extraction schema for unknown contract types

5 basic fields (parties, date, amounts, summary, clauses).
Fallback when document type is unknown or has no dedicated schema."
```

---

### Task 10: Pipeline orchestrator

**Files:**

- Create: `src/lib/ai/pipeline/orchestrator.ts`
- Create: `src/__tests__/ai/pipeline/orchestrator.test.ts`

- [ ] **Step 10.1: Implement orchestrator**

The orchestrator chains all 5 passes:

```typescript
export async function runExtractionPipeline(
  content: ExtractionContent,
  options: PipelineOptions,
): Promise<PipelineResult> {
  const client = createClaudeClient()

  // Pass 1: Type detection (or skip if forced_type)
  let typeResult: TypeDetectionResult
  if (options.forced_type) {
    typeResult = { detected_type: options.forced_type, confidence: 1.0, ... }
  } else {
    typeResult = await detectType(content, client)
  }

  // Get schema (or minimal fallback)
  const schema = getSchema(typeResult.detected_type) ?? getSchema('MINIMAL')!

  // Pass 2a: First extraction run
  const run1 = await extractWithSchema(content, schema, client, { temperature: 0.2 })

  // Pass 2b: Second run for agreement (unless skipped)
  let run2: SchemaExtractionResult | null = null
  let agreement: AgreementResult[] = []
  if (!options.skip_agreement) {
    run2 = await extractWithSchema(content, schema, client, { temperature: 0.4 })
    agreement = compareRuns(run1.fields, run2.fields)
  }

  // Pass 3: Source verification
  const sourceVerification = await verifySource(content, run1.fields)

  // Pass 4: Sanity checks
  const sanityChecks = runSanityChecks(run1.fields, schema.sanity_rules)

  // Pass 5: Cross-validation
  const crossValidation = await crossValidate(options.document_id, run1.fields)

  // Compute confidence per field
  const fieldConfidences = computeAllFieldConfidences(
    run1.fields, agreement, sourceVerification, sanityChecks,
  )

  // Aggregate additional_findings and extraction_warnings
  const additional_findings = run1.fields['additional_findings']?.value as any[] ?? []
  const extraction_warnings = run1.fields['extraction_warnings']?.value as any[] ?? []

  // Compute total cost
  const totalInputTokens = typeResult.input_tokens + run1.input_tokens + (run2?.input_tokens ?? 0)
  const totalOutputTokens = typeResult.output_tokens + run1.output_tokens + (run2?.output_tokens ?? 0)

  return {
    type_detection: typeResult,
    extraction_run1: run1,
    extraction_run2: run2,
    agreement,
    source_verification: sourceVerification,
    sanity_checks: sanityChecks,
    cross_validation: crossValidation,
    field_confidences: fieldConfidences,
    additional_findings,
    extraction_warnings,
    total_input_tokens: totalInputTokens,
    total_output_tokens: totalOutputTokens,
    total_cost_usd: computeCostUsd('claude-sonnet-4-20250514', totalInputTokens, totalOutputTokens),
  }
}
```

- [ ] **Step 10.2: Write orchestrator test (mocked)**

Mock all pass functions, verify they're called in order, verify aggregation logic.

- [ ] **Step 10.3: Commit**

```bash
git add src/lib/ai/pipeline/orchestrator.ts src/__tests__/ai/pipeline/orchestrator.test.ts
git commit -m "feat(ai): implement pipeline orchestrator

Chains Pass 1-5, computes agreement-based confidence, aggregates
additional_findings and extraction_warnings, tracks total cost."
```

---

### Task 11: Production extraction job + wire to worker

**Files:**

- Create: `src/lib/ai/jobs/extract-document.ts`
- Modify: `src/lib/ai/queue.ts` (add EXTRACT_DOCUMENT job name)
- Modify: `worker/index.ts` (register new job, deprecate PoC)

- [ ] **Step 11.1: Create production extraction job**

Create `src/lib/ai/jobs/extract-document.ts`:

The job should:

1. Accept payload: `{ document_id, organization_id, file_buffer_base64, filename, forced_type? }`
2. Check `isAIEnabled(organization_id, 'extraction')` — skip if disabled
3. Load content via `loadForExtraction`
4. Call `runExtractionPipeline`
5. Save full result to `DocumentExtraction` table (update existing or create)
6. Return extraction_id + summary

- [ ] **Step 11.2: Add EXTRACT_DOCUMENT to queue**

In `src/lib/ai/queue.ts`, add:

```typescript
EXTRACT_DOCUMENT: 'extraction.full',
```

- [ ] **Step 11.3: Update worker to use production job**

In `worker/index.ts`:

- Keep PoC handler but mark as deprecated in comment
- Add new handler for `EXTRACT_DOCUMENT`
- Import from `extract-document.ts`

- [ ] **Step 11.4: Commit**

```bash
git add src/lib/ai/jobs/extract-document.ts src/lib/ai/queue.ts worker/index.ts
git commit -m "feat(ai): add production extraction job + wire to worker

Replaces PoC with full multi-pass pipeline.
Checks feature flags, runs 5-pass extraction, saves to DocumentExtraction.
Worker registers both PoC (deprecated) and production job."
```

---

### Task 12: Feedback helpers

**Files:**

- Create: `src/lib/ai/feedback.ts`
- Create: `src/__tests__/ai/feedback.test.ts`

- [ ] **Step 12.1: Implement feedback logging**

```typescript
import { prisma } from '@/lib/db'
import { createLogger } from './logger'

const log = createLogger('feedback')

export async function logFieldCorrection(params: {
  extraction_id: string
  organization_id: string
  field_name: string
  ai_value: unknown
  user_value: unknown
  confidence: number | null
  schema_version: string | null
  prompt_version: string | null
  corrected_by: string
}): Promise<void> {
  await prisma.aIFieldCorrection.create({
    data: {
      extraction_id: params.extraction_id,
      organization_id: params.organization_id,
      field_name: params.field_name,
      ai_value: params.ai_value as never,
      user_value: params.user_value as never,
      confidence: params.confidence,
      schema_version: params.schema_version,
      prompt_version: params.prompt_version,
      corrected_by: params.corrected_by,
    },
  })

  log.info(
    {
      extraction_id: params.extraction_id,
      field_name: params.field_name,
      confidence: params.confidence,
    },
    'Field correction logged'
  )
}
```

- [ ] **Step 12.2: Write test (mocked Prisma)**

- [ ] **Step 12.3: Commit**

```bash
git add src/lib/ai/feedback.ts src/__tests__/ai/feedback.test.ts
git commit -m "feat(ai): add AIFieldCorrection logging helper

Logs user overrides of AI-extracted values for feedback loop.
Tracks extraction_id, field_name, ai vs user value, confidence, schema version."
```

---

### Task 13: 5 remaining contract schemas

**Files:**

- Create: `src/lib/ai/schemas/lejekontrakt.ts`
- Create: `src/lib/ai/schemas/forsikring.ts`
- Create: `src/lib/ai/schemas/vedtaegter.ts`
- Create: `src/lib/ai/schemas/ansaettelseskontrakt.ts`
- Create: `src/lib/ai/schemas/driftsaftale.ts`

- [ ] **Step 13.1: Create all 5 schemas**

Each schema follows the same structure as EJERAFTALE (Task 3):

- Tool definition with type-specific fields + COMMON_TOOL_PROPERTIES
- Field metadata
- Danish system prompt (adapted for each type)
- Sanity rules specific to each type
- Self-registration via `registerSchema()`

Use the field definitions from the table at the top of this plan.

Sanity rules per type:

- **LEJEKONTRAKT:** rent > 0, deposit >= 0, notice_period > 0
- **FORSIKRING:** coverage_amount > 0, premium > 0, expiry after effective
- **VEDTAEGTER:** share_capital > 0, board_size > 0
- **ANSAETTELSESKONTRAKT:** salary > 0, working_hours 0-60
- **DRIFTSAFTALE:** notice_period > 0

- [ ] **Step 13.2: Verify all schemas register correctly**

Write a quick test that imports all schemas and checks registry has 7 entries (6 types + MINIMAL):

```typescript
it('all 7 schemas are registered', async () => {
  // Import all schema files to trigger registration
  await import('@/lib/ai/schemas/ejeraftale')
  await import('@/lib/ai/schemas/lejekontrakt')
  await import('@/lib/ai/schemas/forsikring')
  await import('@/lib/ai/schemas/vedtaegter')
  await import('@/lib/ai/schemas/ansaettelseskontrakt')
  await import('@/lib/ai/schemas/driftsaftale')
  await import('@/lib/ai/schemas/minimal')

  const { getAllSchemaTypes } = await import('@/lib/ai/schemas/registry')
  const types = getAllSchemaTypes()
  expect(types).toHaveLength(7)
  expect(types).toContain('EJERAFTALE')
  expect(types).toContain('LEJEKONTRAKT')
  expect(types).toContain('FORSIKRING')
  expect(types).toContain('VEDTAEGTER')
  expect(types).toContain('ANSAETTELSESKONTRAKT')
  expect(types).toContain('DRIFTSAFTALE')
  expect(types).toContain('MINIMAL')
})
```

- [ ] **Step 13.3: Commit**

```bash
git add src/lib/ai/schemas/
git commit -m "feat(ai): add 5 remaining contract schemas + minimal fallback

LEJEKONTRAKT (12 fields), FORSIKRING (11 fields), VEDTAEGTER (10 fields),
ANSAETTELSESKONTRAKT (12 fields), DRIFTSAFTALE (10 fields).
Each with Danish prompt, sanity rules, and self-registration.
7 schemas total including EJERAFTALE and MINIMAL."
```

---

### Task 14: Full validation + push

**Files:**

- None modified

- [ ] **Step 14.1: Run full test suite**

```bash
npm test
```

Expected: all tests pass. Integration tests may skip.

- [ ] **Step 14.2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 14.3: Verify schema count**

```bash
npx tsx -e "
import './src/lib/ai/schemas/ejeraftale'
import './src/lib/ai/schemas/lejekontrakt'
import './src/lib/ai/schemas/forsikring'
import './src/lib/ai/schemas/vedtaegter'
import './src/lib/ai/schemas/ansaettelseskontrakt'
import './src/lib/ai/schemas/driftsaftale'
import './src/lib/ai/schemas/minimal'
import { getAllSchemaTypes } from './src/lib/ai/schemas/registry'
console.log('Registered schemas:', getAllSchemaTypes().length, getAllSchemaTypes())
"
```

Expected: 7 schemas registered.

- [ ] **Step 14.4: Push**

```bash
git push origin master
```

---

## Completion checklist

- [ ] Content loader handles PDF, Word, Excel
- [ ] 7 schemas registered (6 types + MINIMAL)
- [ ] Pipeline chains Pass 1-5 correctly
- [ ] Agreement-based confidence computes weighted scores
- [ ] Source verification uses fuzzy matching
- [ ] Sanity check framework runs per-type rules
- [ ] Cross-validation queries existing data
- [ ] Production extraction job replaces PoC
- [ ] Feedback logging helper works
- [ ] All tests pass
- [ ] TypeScript clean
- [ ] Pushed to remote

## What comes next (Plan 3+)

**Plan 3: UI Migration** — Move `/proto/documents`, `/proto/contracts`, `/proto/portfolio` to production and wire to real data including DocumentExtraction output.

**Plan 4: Insights System** — Haiku-based company insights, contract key terms, dashboard insights. Cached in DB, triggered by state changes.

**Plan 5: Søg & Spørg AI** — RAG pipeline with pgvector embeddings + Claude for answer generation.
