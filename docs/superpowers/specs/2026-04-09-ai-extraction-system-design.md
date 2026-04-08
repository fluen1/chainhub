# AI Extraction System — Design Spec

**Date:** 2026-04-09
**Status:** Design approved, pending implementation plan
**Owner:** ChainHub team

---

## Executive Summary

ChainHub's prototype defines a rich set of AI-powered features (document extraction, contract key terms, company insights, search AI answers, AI-extracted calendar events). The production codebase currently has **zero** AI integration. This spec defines the architecture, LLM strategy, extraction pipeline, and rollout plan for building the AI backend over ~26-40 weeks.

**Key decisions:**
1. **Materialized insights architecture** — AI results are cached as DB fields, regenerated on state change, never computed live on page view
2. **LLM stack:** Claude Sonnet 4 (primary) + Claude Haiku 3.5 (cheap tier) via Anthropic Direct API during development, AWS Bedrock Frankfurt for production
3. **Job queue:** pg-boss on existing Supabase Postgres
4. **Confidence strategy:** Agreement-based (multi-pass) + rule-based sanity checks, NOT Claude's self-reported confidence
5. **Schema-driven extraction** with structured output (tool use) for 6 priority contract types in v1
6. **Data provenance tracking** — every AI-derived field tracks its source (human/ai/external) and verification status
7. **No auto-accept for legal-critical fields** — always requires explicit human approval
8. **Shadow mode → beta → gradual rollout** — non-negotiable for legal data
9. **UI migration runs in parallel with AI backend** — move `/proto/*` pages to production, wire to real data
10. **Minimal third-party setup on day 1** — only Anthropic signup, all else deferred

---

## Goals and Non-Goals

### Goals

- Reliably extract structured data from legal documents (PDF, scans, Word, Excel) with ≥90% accuracy on core fields after prompt iteration
- Generate materialized insights for companies and contracts, cached in DB and regenerated on state change
- Power Søg & Spørg AI-svar with grounding in extracted data
- Provide full audit trail of AI decisions and human corrections
- Support EU data residency for production data
- Operate within realistic cost envelope (~$15-40/customer/month steady state)

### Non-Goals (for v1)

- Multi-language support (Danish only; English/Swedish deferred)
- Multi-document splitting (one contract per upload is the contract)
- Fine-tuning of models on customer data
- Self-hosted LLM option (deferred to v2 if enterprise demand)
- Real-time collaborative review of AI extractions
- AI-generated contract drafts (we extract, we don't author)
- OCR for extremely degraded scans (Claude vision's limits are acceptable)

---

## Architecture Overview

### Materialized Insights Pattern

The single most important architectural decision: **AI results are DB fields, not live computations.**

```
┌─────────────────────────────────────────────────────────────┐
│                     User browses site                       │
│  Dashboard → Contract detail → Company detail               │
└────────────────────────────┬────────────────────────────────┘
                             │
                             │  ZERO AI calls.
                             │  Just Prisma reads.
                             ▼
┌─────────────────────────────────────────────────────────────┐
│              Supabase Postgres (insights cached)            │
│  company.ai_insight, contract.ai_key_terms, etc.            │
└─────────────────────────────────────────────────────────────┘
                             ▲
                             │ Regenerated only on
                             │ state change via
                             │ background jobs
                             │
┌────────────────────────────┴────────────────────────────────┐
│                      pg-boss job queue                      │
│  Jobs triggered by: upload, edit, contract-updated, etc.    │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  Worker process (local in dev, Hetzner VPS in prod)         │
│  Executes extraction and insight regeneration jobs          │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│    Claude API (Anthropic direct in dev, Bedrock in prod)    │
└─────────────────────────────────────────────────────────────┘
```

**Why this matters:** Without materialized insights, cost scales with user activity (every page view = AI calls). With materialized insights, cost scales only with state changes (every upload or edit = small burst of jobs). Difference at 50 customers with 20 users each: ~$150k/year vs ~$15k/year.

### Job Queue Responsibilities

pg-boss queues these job types:
- `document.extract` — extract structured data from uploaded document
- `document.verify_source` — validate extracted field source attribution
- `document.cross_validate` — compare extracted data with existing system data
- `company.regenerate_insight` — Haiku-based company insight
- `contract.regenerate_key_terms` — Haiku-based contract key terms
- `contract.regenerate_insight` — critical insight if contract is expiring/expired
- `dashboard.regenerate_insight` — per-user daily dashboard insight
- `extraction.reprocess_on_schema_update` — re-extract old documents with new schema

**Job dependency graph:** `document.extract` spawns `document.cross_validate` → `company.regenerate_insight` + `contract.regenerate_key_terms`. All jobs are retry-safe with max retries and exponential backoff.

---

## LLM Strategy

### Model selection

| Task | Model | Reason |
|---|---|---|
| Document extraction (Pass 1: type detection) | Claude Haiku 3.5 | Simple classification, cheap |
| Document extraction (Pass 2: schema extraction) | Claude Sonnet 4 | Complex structured output, high precision required |
| Document extraction (Pass 2 second run for agreement) | Claude Sonnet 4 | Same model for valid agreement check |
| Company insights | Claude Haiku 3.5 | Lower criticality, cached |
| Contract key terms | Claude Haiku 3.5 | Lower criticality, cached |
| Contract critical insight (expired/expiring) | Claude Sonnet 4 | User-facing, higher importance |
| Dashboard insights | Claude Haiku 3.5 | Role-specific, refreshed daily |
| Søg & Spørg AI answers | Claude Sonnet 4 | User-facing quality requirement |
| Query type detection (search/question/action) | Claude Haiku 3.5 | Simple classification |

### Deployment strategy

**Development phase (weeks 1-16):**
- **Anthropic Direct API** (`@anthropic-ai/sdk`)
- Signup: 5 minutes, $20 credit, instant access
- US-hosted by default — acceptable because dev uses only test documents, not real customer data
- All prompt engineering and iteration happens against real Claude from day 1
- No AWS approval dependency

**Production phase (week 16+):**
- **AWS Bedrock Frankfurt** via `@aws-sdk/client-bedrock-runtime`
- EU data residency for customer data
- AWS Customer Agreement + Bedrock terms of service constitute the DPA
- Application submitted day 1 (runs in background during development)
- Switch from Anthropic Direct to Bedrock is ~1 day of code work (same model, same capabilities, different client)

**Client abstraction:** A single `ClaudeClient` interface in `src/lib/ai/client.ts` with two implementations: `AnthropicDirectClient` and `BedrockClient`. Selected via environment variable `AI_PROVIDER=anthropic|bedrock`.

### Cost model

**Per-document extraction (realistic, including retries and 30% scan share):**
- Average: ~$0.15-0.25
- Worst case (large scanned contract): ~$0.40

**Per customer (22 locations, 10 active users) steady state:**
- Document extraction: $5 (50 docs/month)
- Insights regeneration: $3 (triggered on uploads and edits)
- Søg & Spørg: $18 (3 queries/user/day × 30 days × $0.01)
- Dashboard insights: $3 (10 users × 30 days × $0.01)
- **Total: ~$29/month per customer**

**Per customer onboarding (500 docs upload):**
- Document extraction: $75-125
- Insight regeneration: $15-20
- Søg & Spørg: $18
- **Total: ~$110-165/month per customer during onboarding**

**At 50 customers steady state: ~$1,450/month = $17,400/year** (with caching architecture)

Cost is dominated by document extraction and Søg & Spørg. Insights cost is negligible with caching.

---

## File Handling Pipeline

### Supported file types

| Extension | Handler | Notes |
|---|---|---|
| `.pdf` | Claude native PDF API | Handles both text-based and scanned PDFs via vision |
| `.png`, `.jpg`, `.jpeg` | Claude vision API | Single-page image documents |
| `.docx` | `mammoth.convertToHtml()` + Claude text API | HTML preserves table structure |
| `.xlsx` | `exceljs` → Markdown tables + Claude text API | Sheet-by-sheet, max 10 sheets |
| `.doc` (legacy Word) | Not supported in v1 | Show error: "Konverter til .docx eller PDF" |

### File size limits

- **Max file size:** 50 MB (warning at 30 MB)
- **Max PDF pages:** 100 (hard limit)
- **Max Word/Excel tokens:** 40k extracted tokens (hard limit)

### File type detection

**Never trust filename extensions.** Use `file-type` library to detect MIME type via magic bytes:

```typescript
import { fileTypeFromBuffer } from 'file-type'

const type = await fileTypeFromBuffer(buffer)
if (!type) throw new Error('Ukendt filtype')
// type.ext === 'pdf' | 'docx' | 'xlsx' | 'png' | 'jpg'
```

### Content loader interface

```typescript
// src/lib/ai/content-loader.ts
type ExtractionContent =
  | { type: 'pdf_binary'; data: Buffer }
  | { type: 'image'; data: Buffer; mime: string }
  | { type: 'text_html'; html: string }
  | { type: 'text_markdown'; markdown: string }

async function loadForExtraction(file: Buffer, filename: string): Promise<ExtractionContent>
```

### Error handling

**Extraction failure modes and responses:**

| Scenario | Handler |
|---|---|
| Password-protected PDF | Detect via `pdf-lib`, show error: "Dokumentet er beskyttet — fjern password og upload igen" |
| Corrupt file | Mark `status=failed`, log error, notify user |
| File too large | Reject at upload, before queue |
| Unsupported type | Reject at upload |
| Claude API timeout | Retry with exponential backoff (max 3 retries) |
| Claude API rate limit | Requeue with longer delay |
| Claude returns malformed output | Retry once with stricter prompt, then fail |
| Low confidence across all fields | Complete extraction but mark `requires_manual_review` |

---

## Extraction Pipeline

### Multi-pass approach

```
Upload → Content Loader → Detected filetype
                              │
                              ▼
                        Pass 1: Type detection
                        (Haiku, reads metadata + first 5 pages + last page)
                              │
                              │ ┌─ confidence < 0.75 ─┐
                              │ │                     │
                              │ ▼                     ▼
                              │ Manual type selection
                              │                     │
                              │◄────────────────────┘
                              ▼
                        Pass 2a: Schema extraction (first run)
                        (Sonnet 4, tool use with type-specific schema)
                              │
                              ▼
                        Pass 2b: Schema extraction (second run)
                        (Sonnet 4, temperature=0.3 for variation)
                              │
                              ▼
                        Agreement check:
                        Compare Pass 2a vs Pass 2b per field
                              │
                              ▼
                        Pass 3: Source verification
                        (fuzzy-match extracted source_text against document)
                              │
                              ▼
                        Pass 4: Rule-based sanity checks
                        (dates parse, ownership sums to 100%, etc.)
                              │
                              ▼
                        Pass 5: Cross-validation (Prisma only, no AI)
                        (compare extracted vs existing system data)
                              │
                              ▼
                        Save DocumentExtraction with all metadata
```

### Pass details

**Pass 1: Type detection**
- Model: Haiku 3.5
- Input: First 5 pages + last page of document (signatures often on last page indicate contract type)
- Output: `{contract_type: <enum>, confidence: <float>, alternatives: [<top 2 alternatives>]}`
- Cost: ~$0.005 per document
- If confidence < 0.75, flag for manual type selection before running Pass 2

**Pass 2: Schema extraction (2x for agreement)**
- Model: Sonnet 4
- Input: Full document (via Claude native PDF for PDFs, or loaded text/HTML/markdown for other formats)
- Output: Structured JSON matching type-specific schema via tool_use
- Two runs with slightly different temperatures (0.2 and 0.4) to measure agreement
- Cost: ~$0.15-0.25 per run × 2 = $0.30-0.50 per document

**Pass 3: Source verification**
- Pure code, no AI
- For each extracted field with `source_page` and `source_text`:
  - Load the referenced page text
  - Fuzzy-match source_text against page content (Levenshtein distance ≤ 0.15)
  - If match: field is verified
  - If no match: mark `source_verified: false`, show warning in UI

**Pass 4: Rule-based sanity checks**
- Pure code, no AI
- Type-specific rules:
  - Dates: Must parse as valid Date within reasonable range (1900-2100)
  - Ownership percentages: Sum to 100%
  - CVR numbers: 8 digits, valid checksum
  - Parties: At least 2 required for ejeraftale
  - Amounts: Must be numeric, positive
- Each failed rule reduces confidence of affected field

**Pass 5: Cross-validation**
- Pure Prisma queries
- Compare extracted values against existing records
- Generate `Discrepancy[]` with ai_value, existing_value, severity
- **Important:** Only compares against `provenance=human_verified` data (not AI-derived data)

### Confidence computation

**Agreement-based confidence per field:**
```typescript
function computeFieldConfidence(
  pass2a: ExtractedField,
  pass2b: ExtractedField,
  sourceVerified: boolean,
  sanityCheckPassed: boolean,
): number {
  let confidence = 0

  // Agreement between two passes (40% weight)
  if (valuesMatch(pass2a.value, pass2b.value)) confidence += 0.4

  // Source verification (30% weight)
  if (sourceVerified) confidence += 0.3

  // Sanity check (20% weight)
  if (sanityCheckPassed) confidence += 0.2

  // Claude self-reported confidence (10% weight, discounted)
  confidence += 0.1 * Math.min(pass2a.claude_confidence, pass2b.claude_confidence)

  return Math.min(1.0, confidence)
}
```

**Thresholds (conservative for legal data):**

| Level | Confidence range | Behavior |
|---|---|---|
| **High** | ≥ 0.90 | Visible in "Høj konfidence (auto)" section, default collapsed. User can approve individually but no auto-commit for legal-critical fields. |
| **Medium** | 0.70 - 0.90 | Visible in "Kræver opmærksomhed" section, default open. Shows AI value vs existing value side-by-side. |
| **Low** | < 0.70 | Visible in "Lav konfidence" section. Only shown as suggestion, user must manually edit. |
| **Missing** | — | Expected field not found. Visible in "Manglende klausuler" section. |

**No auto-accept for legal-critical fields.** Even at confidence 0.99, fields like `parties`, `ownership_percentage`, `effective_date`, `termination_clause` require explicit user approval. Non-critical fields (subtitle, document_description, tags) may auto-commit at confidence ≥ 0.90 — this is configurable per field type in the schema.

---

## Schema-Driven Extraction

### Schemas for v1 (6 priority types)

1. **EJERAFTALE** — ownership agreement (most complex, highest priority)
2. **LEJEKONTRAKT** — lease agreement
3. **FORSIKRING** — insurance policy
4. **VEDTAEGTER** — company bylaws
5. **ANSAETTELSESKONTRAKT** — employment contract
6. **DRIFTSAFTALE** — operations agreement

Each schema defines:
- Tool use definition for Claude (`name`, `description`, `input_schema`)
- Field metadata (type, required, legal-critical flag)
- System prompt (Danish, domain-specific)
- Few-shot examples (2-3 per schema)
- Sanity check rules
- Cross-validation mappings to Prisma fields

### Schema structure

```typescript
// src/lib/ai/schemas/types.ts
interface ContractSchema {
  contract_type: string
  schema_version: string           // 'v1.0.0'
  tool_definition: AnthropicTool
  field_metadata: Record<string, FieldMetadata>
  prompt_template: string          // includes few-shot examples
  sanity_rules: SanityRule[]
  cross_validation_rules: CrossValidationRule[]
}

interface FieldMetadata {
  legal_critical: boolean          // requires human approval even at high confidence
  required: boolean
  auto_accept_threshold?: number   // if set, auto-commit above this confidence
  description: string
}

interface SanityRule {
  field: string
  check: (value: unknown, allFields: Record<string, unknown>) => boolean
  message: string
}
```

### Schema-first design for complex fields

**For EJERAFTALE, the `parties` field is structured:**

```typescript
parties: {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      party_type: { enum: ['KAEDE_GRUPPE', 'LOKAL_PARTNER', 'HOLDING', 'OTHER'] },
      capital_ownership_percentage: { type: 'number' },
      voting_ownership_percentage: { type: 'number', description: 'If different from capital' },
      ownership_type: { enum: ['DIRECT', 'CONDITIONAL', 'OPTION', 'VESTING'] },
      notes: { type: 'string', description: 'For complex or atypical ownership structures' },
      source_page: { type: 'number' },
      source_text: { type: 'string' }
    }
  }
}
```

The `ownership_type` enum and `notes` field handle real-world variability: vesting schedules, earnouts, conditional ownership, separate voting/capital classes. When Claude encounters unusual structures, it can use `ownership_type: OTHER` + free-text `notes`.

### Structured output strategy

**Use Claude's tool use (function calling) for structured extraction.** Tool use is more reliable than asking for JSON in the response text because:
- Claude is trained to respect tool schemas
- Partial/malformed output fails loudly
- We can validate against JSON schema before accepting

However, keep schemas **flat when possible** to avoid tool use failures on deeply nested structures. For very complex contracts, break into multiple tool calls:
- Tool 1: `extract_contract_metadata` (type, dates, language)
- Tool 2: `extract_parties_and_ownership`
- Tool 3: `extract_key_clauses` (termination, competition, pre-emption)
- Tool 4: `extract_financial_terms` (if applicable)

### Prompt engineering discipline

**Each schema has a production prompt** that includes:

1. **System role:** "Du er ekspert i danske ejeraftaler med 20+ års erfaring med selskabsret."
2. **Context about ChainHub:** "Du ekstraherer felter fra en ejeraftale for ChainHub, et portfolio management system for kædegrupper."
3. **Schema explanation in natural language:** Prose description of what each field means
4. **Few-shot examples:** 2-3 full extraction examples with real Danish contract excerpts
5. **Anti-hallucination instructions:** "Hvis du ikke finder et felt, returnér null. Gæt ALDRIG. Citer exact word-for-word passages."
6. **Ambiguity handling:** "Hvis flere værdier er mulige, returnér den mest eksplicitte og sænk confidence."
7. **Output format enforcement:** "Returnér altid via tool_use. Returnér aldrig fri tekst."
8. **Language handling:** "Returnér felter på dansk når det er passende (fx party_type labels). Returnér source_text på originalsproget."

Prompts are stored in `src/lib/ai/prompts/<contract_type>.ts` with version numbers (`v1.0`, `v1.1`, etc.). Each extraction logs which prompt version was used.

**Prompt iteration happens continuously against the gold standard test set** (see Feedback Loop section).

---

## Data Provenance

### Core concept

Every AI-derived value is tagged with its provenance so we know:
1. Where the value came from
2. Whether a human has verified it
3. Which AI version produced it (for audit)

### Schema changes

Add `provenance` metadata to relevant Prisma models:

```prisma
model Contract {
  // ... existing fields

  // AI-extracted key fields
  ai_key_terms        Json?     // structured extraction from latest DocumentExtraction
  ai_key_terms_version String?  // schema version used
  ai_key_terms_computed_at DateTime?

  // Field-level provenance
  field_provenance    Json?     // {field_name: {source: 'human_verified' | 'ai_extracted' | 'ai_approved' | 'external_api', ai_extraction_id?: string, verified_by?: string, verified_at?: DateTime}}
}

model Company {
  // ... existing fields

  ai_insight          String?
  ai_insight_version  String?
  ai_insight_computed_at DateTime?

  ai_dimensions       Json?     // {kontrakter: 'red'|'amber'|'green', sager: ..., økonomi: ..., governance: ...}
  ai_dimensions_computed_at DateTime?
}

model DocumentExtraction {
  id                  String    @id @default(cuid())
  document_id         String    @unique
  document            Document  @relation(fields: [document_id], references: [id])

  // Type detection (Pass 1)
  detected_type       String
  type_confidence     Float
  type_alternatives   Json?

  // Extraction (Pass 2)
  schema_version      String
  prompt_version      String
  model_name          String    // 'claude-sonnet-4-20250514'
  model_temperature   Float
  extracted_fields    Json      // structured output from Pass 2a
  extracted_fields_run2 Json    // structured output from Pass 2b (for agreement)
  agreement_score     Float     // 0.0-1.0 overall agreement

  // Source verification (Pass 3)
  source_verification Json      // {field_name: {verified: bool, match_score: float}}

  // Sanity checks (Pass 4)
  sanity_check_results Json     // {field_name: {passed: bool, rule: string, message?: string}}

  // Cross-validation (Pass 5)
  discrepancies       Json?     // [{field, ai_value, existing_value, severity}]

  // Cost tracking
  input_tokens        Int
  output_tokens       Int
  total_cost_usd      Decimal   @db.Decimal(10, 4)

  // User decisions
  reviewed_by         String?
  reviewed_at         DateTime?
  field_decisions     Json?     // {field_name: {decision: 'ai'|'existing'|'manual'|'skip', value: any, decided_at: DateTime}}

  // Metadata
  created_at          DateTime  @default(now())
  updated_at          DateTime  @updatedAt

  @@index([document_id])
  @@index([detected_type])
  @@index([reviewed_at])
}

model AIFieldCorrection {
  // Logged every time a user overrides AI output
  id                  String    @id @default(cuid())
  extraction_id       String
  extraction          DocumentExtraction @relation(fields: [extraction_id], references: [id])
  field_name          String
  ai_value            Json
  user_value          Json
  confidence          Float     // AI's reported confidence
  schema_version      String
  prompt_version      String
  corrected_by        String
  corrected_at        DateTime  @default(now())

  @@index([field_name])
  @@index([schema_version])
}
```

### Cross-validation only against verified data

**Pass 5 (cross-validation) only compares against fields with `provenance.source = 'human_verified'`.** This prevents circular logic where AI-extracted data is compared against other AI-extracted data.

If no human-verified data exists, cross-validation is skipped and the extraction is marked as `cross_validated: false`.

---

## Confidence and Validation

### Field categorization

Fields are categorized by **legal criticality**:

**Legal-critical (require human approval even at high confidence):**
- `parties` (names, ownership percentages)
- `effective_date`, `termination_date`
- `termination_notice_months`
- `non_compete_clause`
- `pre_emption_right`
- `exit_clauses`
- All financial terms (rent, deposits, milestones)

**Non-critical (may auto-commit at confidence ≥ 0.90):**
- `document_title`
- `document_language`
- `detected_contract_type` (already approved in Pass 1)
- `party_type` enum (when name is approved, type can auto-suggest)
- `document_summary` (if enabled)

### User decision flow

For each field in the review UI:

1. **Auto-approved (legal-critical, high confidence):** Shown in "Auto-verified" section, user can one-click approve or override
2. **Requires attention:** Shown with AI value + existing value side-by-side, user picks one or enters manual
3. **Low confidence:** Shown as suggestion, user must manually edit or mark "accept as suggested"
4. **Missing:** Shown with "expected but not found", user can add manually or mark "confirmed absent"

Every user decision logs to `AIFieldCorrection`, forming the feedback loop dataset.

---

## Feedback Loop

### Continuous improvement infrastructure

**Problem:** Without feedback, extraction quality is frozen at day 1 and degrades over time as Claude models change.

**Solution:** Log every user correction and use the data to improve prompts and thresholds.

### What gets logged

1. **Every user override** → `AIFieldCorrection`
2. **Every extraction's full context** → `DocumentExtraction` (includes prompt_version, schema_version, model_name)
3. **Every failed extraction** → error + cause
4. **Every sanity check failure** → which rule, which value
5. **Every source verification failure** → which field, match score

### Analytics (Phase 2)

**Weekly aggregation queries:**
- Per-field correction rate (how often users override each field)
- Per-contract-type accuracy (estimated from correction rate)
- Per-prompt-version performance (A/B test old vs new prompts)
- Per-schema accuracy drift (is accuracy degrading?)

**Dashboard for internal use:**
- Top 10 fields with highest correction rate → candidates for prompt improvement
- Cost per extraction by contract type → identify expensive outliers
- Extraction success rate over time → alert on degradation

### Gold standard test set

**Build from day 1:**
- Collect 20-30 sample documents per contract type (120-180 total)
- Manually annotate expected outputs for each field
- Use as regression test when updating prompts or models
- Run before every prompt version bump: if accuracy drops, don't ship

### Prompt version management

- Prompts stored in `src/lib/ai/prompts/<type>.ts` with explicit version numbers
- Each extraction logs `prompt_version`
- New prompt versions are opt-in for 1 week (shadow mode via feature flag) before replacing old
- Old prompt versions kept in git history for rollback

---

## Source Verification

### Problem

Claude sometimes hallucinates page numbers and source quotes when asked to attribute extractions to specific locations in a document. This makes visual linking (hover field → highlight text in PDF) unreliable.

### Solution

**Verify every extracted `source_text` against the actual document content.**

```typescript
async function verifySource(
  document: Document,
  page: number,
  sourceText: string,
): Promise<{ verified: boolean; matchScore: number }> {
  const pageText = await loadPageText(document, page)
  if (!pageText) return { verified: false, matchScore: 0 }

  // Sliding window fuzzy match
  const matchScore = findBestFuzzyMatch(pageText, sourceText)

  return {
    verified: matchScore >= 0.85,
    matchScore,
  }
}
```

### UI behavior

- **Verified source:** Hover field → highlight exact text on page
- **Unverified source:** Hover field → highlight page number only, show warning "Kilde ikke verificeret"
- **No source provided:** No highlight, show "Manuelt indtastet" label

### Prompt instructions for accurate sourcing

The schema prompt explicitly instructs:
> "Du SKAL citere exact word-for-word passages fra dokumentet. Hvis du ikke kan finde en exakt passage der understøtter værdien, sæt source_text til null. Gæt ALDRIG om sideplacering — kun rapporter side-nummer hvis du er 100% sikker."

---

## Rollout Strategy

### Phase 1: Shadow mode (4 weeks minimum after extraction is functional)

**Purpose:** Validate extraction quality against real-world documents before exposing results to users.

**Implementation:**
- Extraction runs on every document upload
- Results stored in `DocumentExtraction` table
- **Users see nothing** — upload UI behaves like a normal file upload
- When users manually enter contract data into existing fields (Server Action input forms), the system silently compares with AI extraction and logs agreement/disagreement
- Dashboard for internal review of shadow-mode accuracy

**Exit criteria:**
- ≥85% agreement between manual entry and AI extraction on core fields (parties, dates, ownership)
- <5% extraction failures
- No critical hallucinations (fabricated parties, wrong dates)
- Costs within budget envelope

**Key challenge:** Shadow mode needs "ground truth" data to validate against. If users don't manually enter data, we can't validate. Solution: recruit 2-3 pilot customers who agree to manually verify AI extractions as part of shadow evaluation.

### Phase 2: Beta (4-6 weeks)

**Purpose:** Real users experience full AI UX, provide feedback, help iterate.

**Implementation:**
- Feature flag: `organization.ai_mode = 'beta'` enables AI UI for specific organizations
- Beta customers see:
  - Prototype-style hero cards with AI extractions
  - Confidence levels and visual linking
  - Decision tracking in review flow
  - Company/contract insights
- Weekly sync calls with beta customers
- Rapid iteration on prompts, thresholds, UX

**Exit criteria:**
- Positive feedback from ≥2 beta customers
- No legal accuracy issues reported
- Feature flag tested in production

### Phase 3: Gradual rollout (2-3 weeks)

**Purpose:** Safe rollout to all customers.

**Implementation:**
- 10% → 25% → 50% → 100% over 2-3 weeks
- Each step requires all metrics healthy
- Kill switch: `organization.ai_mode = 'off'` disables all AI for that customer with one admin action
- Automatic pause if error rate spikes

### Phase 4: Live standard

- AI is default-on for new customers
- Existing customers can opt out

### Feature flag infrastructure

Required before Phase 1:

```prisma
model OrganizationAISettings {
  id                  String   @id @default(cuid())
  organization_id     String   @unique
  ai_mode             AIMode   @default(OFF)    // OFF, SHADOW, BETA, LIVE
  shadow_comparison_enabled Boolean @default(false)
  beta_features       String[] // ['insights', 'search_ai', 'calendar_events']
  rate_limit_per_day  Int      @default(1000)
  monthly_cost_cap_usd Decimal? @db.Decimal(10, 2)
  kill_switch         Boolean  @default(false)  // emergency disable
  created_at          DateTime @default(now())
  updated_at          DateTime @updatedAt
}

enum AIMode {
  OFF
  SHADOW
  BETA
  LIVE
}
```

Helper: `isAIEnabled(orgId: string, feature: string): Promise<boolean>` checked before every AI call.

---

## Infrastructure

### Development environment (weeks 1-16)

- **Database:** Supabase Postgres (existing)
- **LLM:** Anthropic Direct API (`@anthropic-ai/sdk`)
- **Job queue:** pg-boss against local Supabase
- **Worker process:** Runs locally via `npm run worker` in separate terminal
- **Storage:** Existing Supabase Storage or local filesystem for test files
- **No new third-party services required**

### Production environment (week 16+)

- **Database:** Supabase Postgres (unchanged)
- **LLM:** AWS Bedrock Frankfurt (`@aws-sdk/client-bedrock-runtime`)
- **Job queue:** pg-boss against production Supabase
- **Worker process:** Hetzner Cloud CX11 in Germany (~€5/month)
  - Ubuntu 22.04 LTS
  - systemd service for worker
  - Automated deploys via git push + webhook
- **Email:** Resend with custom domain `noreply@chainhub.dk`

### Worker process design

```typescript
// worker/index.ts
import PgBoss from 'pg-boss'
import { extractDocument } from '@/lib/ai/jobs/extract-document'
import { regenerateCompanyInsight } from '@/lib/ai/jobs/regenerate-company-insight'
// ... other job handlers

async function main() {
  const boss = new PgBoss(process.env.DATABASE_URL!)
  await boss.start()

  await boss.work('document.extract', extractDocument)
  await boss.work('company.regenerate_insight', regenerateCompanyInsight)
  await boss.work('contract.regenerate_key_terms', regenerateContractKeyTerms)
  // ... register all handlers

  console.log('Worker running')
}

main().catch(console.error)
```

### Deployment of worker to Hetzner

- Clone repo to `/opt/chainhub-worker`
- Create systemd unit `/etc/systemd/system/chainhub-worker.service`
- Environment variables in `/opt/chainhub-worker/.env`
- `systemctl enable chainhub-worker && systemctl start chainhub-worker`
- Logs: `journalctl -u chainhub-worker -f`

---

## UI Migration (Parallel Track)

### Approach: Move `/proto/*` to production

The prototype pages under `src/app/proto/*` are the new UI. They use mock data today. To promote them to production:

1. Copy `/proto/xxx/page.tsx` to `/(dashboard)/xxx/page.tsx`
2. Replace mock imports (e.g., `getCompanies(dataScenario, companyCount)`) with real Server Actions
3. Remove `usePrototype()` role switcher, use `useSession()` from NextAuth
4. Add permission checks (`canAccessCompany`, `canAccessSensitivity`, etc.)
5. Delete old production page
6. Update sidebar navigation

### Priority order

**Week 1-8 (parallel with Pre-Phase and Phase 1):**
1. `/documents` (list) + `/documents/review/[id]` — needed for AI review UX
2. `/contracts` (list) + `/contracts/[id]` — receives AI key terms
3. `/portfolio` (list) + `/portfolio/[id]` — receives AI insights

**Week 9-14 (during Phase 2):**
4. `/dashboard`
5. `/tasks` (list) + `/tasks/[id]`
6. `/calendar`

**Week 15+ (nice-to-haves):**
7. `/search`
8. `/settings`

### AI binding

When AI features become available, the migrated pages bind to:
- `contract.ai_key_terms` (for contract detail hero)
- `company.ai_insight` + `company.ai_dimensions` (for selskab detail)
- `document.ai_extraction` (for document review flow)
- etc.

Pages degrade gracefully: if AI fields are null (extraction not yet run), show a non-AI fallback.

---

## Security and Compliance

### Data residency

- **Development (weeks 1-16):** Test documents only, no real customer data. Anthropic Direct API (US-hosted) is acceptable for non-customer test data.
- **Production (week 16+):** All customer data processed via AWS Bedrock Frankfurt. No customer data leaves EU.

### DPA chain

- **Anthropic Direct (dev):** Standard B2B terms, no customer data involved
- **AWS Bedrock (prod):** AWS Customer Agreement + Bedrock terms
- **Supabase:** Existing DPA
- **Hetzner:** Existing DPA (automatic, German company)
- **Resend:** Standard DPA (configured with custom domain)

### Audit trail

Every AI decision is auditable:
- `DocumentExtraction` logs model name, prompt version, inputs, outputs, cost
- `AIFieldCorrection` logs every user override
- `field_provenance` on every entity field tracks source of data
- Legal question "Who decided this value, and based on what AI version?" is always answerable

### Sensitive data handling

- CPR numbers, bank details, and other PII are **extracted if present** but treated with `sensitivity=STRENGT_FORTROLIG` and permission-gated
- Existing `canAccessSensitivity()` permission helper applies
- AI extraction results inherit the sensitivity of the source document

### Kill switches

- Per-organization: `OrganizationAISettings.kill_switch` disables all AI for one customer
- Global: Feature flag `AI_EXTRACTION_ENABLED` in environment variable disables all extraction across platform
- Per-feature: `beta_features` array lets us disable specific touchpoints (e.g., disable search AI while keeping extraction active)

### Rate limiting and cost guards

- Per-organization daily limit: `rate_limit_per_day` (default 1000 extractions/day)
- Per-organization monthly cost cap: `monthly_cost_cap_usd` (optional, admin alert when approaching)
- Global rate limit: anti-runaway guard at service level
- Cost anomaly alerts: if a customer's daily cost exceeds 3x their 7-day average, alert ops

---

## Success Metrics

### Extraction quality (measured continuously)

- **Core field accuracy:** ≥90% for parties, dates, ownership on EJERAFTALE (v1 target)
- **Extraction success rate:** ≥95% (not marked `failed`)
- **Hallucination rate:** <1% (defined as extracted values with no source in document)
- **Missing clause false positive rate:** <5% (flagging clauses as missing when they are present)

### Operational metrics

- **Extraction latency (P95):** < 45 seconds per document
- **Cost per extraction (P95):** < $0.50
- **Worker uptime:** ≥99.5%
- **pg-boss queue depth:** < 100 jobs pending under normal load

### User satisfaction

- **Correction rate:** After Phase 3 (live), should stabilize at <20% user overrides
- **Time saved:** Manually entering contract data takes ~10-15 min per contract. AI + review should take ~2-3 min per contract.
- **Beta customer feedback:** Weekly NPS-style surveys, target ≥8/10

### Cost discipline

- **Cost per customer per month (steady state):** <$40
- **Cost per customer per month (onboarding):** <$200
- **Total AI spend (steady state at 50 customers):** <$2,000/month

---

## Phasing and Timeline

### Pre-Phase: Setup (weeks 1-3, mostly background)

**User actions (~30 min total on day 1):**
- ~~Sign up for Anthropic API + $20 credit~~ (already done)
- Submit AWS Bedrock model access application (30 min)

**Dev work:**
- Repository scaffolding for `src/lib/ai/*`
- Prisma migrations for new fields (DocumentExtraction, OrganizationAISettings, field_provenance)
- Feature flag infrastructure
- Gold standard test dataset collection (ongoing)
- Begin UI migration: `/documents` + `/documents/review/[id]`

### Phase 1: AI Foundation (weeks 4-10)

**AI track:**
- pg-boss local setup + worker scaffold
- ClaudeClient abstraction (Anthropic Direct implementation)
- Content loader for all 4 file types
- File type detection via magic bytes
- Error handling (password PDFs, corrupt files, etc.)
- EJERAFTALE schema v1.0 with production prompt
- Multi-pass extraction pipeline (Pass 1-5)
- Agreement-based confidence computation
- Source verification
- Sanity check rules for EJERAFTALE
- Cross-validation logic
- Data provenance tracking
- `DocumentExtraction` table + audit trail
- `AIFieldCorrection` logging
- Observability (structured logging, metrics)
- Feature flag: shadow mode toggle (default ON)

**UI track (parallel):**
- Migrate `/contracts` + `/contracts/[id]`
- Migrate `/portfolio` + `/portfolio/[id]`
- Wire to real Server Actions
- Permission checks

**Success criteria:** EJERAFTALE extraction works end-to-end on 20+ test documents. Shadow mode toggle functional. Priority pages migrated.

### Phase 2: Scale extraction + analytics (weeks 11-16)

**AI track:**
- Add schemas: LEJEKONTRAKT, FORSIKRING, VEDTAEGTER, ANSAETTELSESKONTRAKT, DRIFTSAFTALE
- Feedback loop analytics queries
- Internal accuracy dashboard
- Cost tracking per organization
- Rate limiting and cost caps
- Prompt version management system
- Gold standard regression tests

**Infrastructure:**
- AWS Bedrock approval (should be done by now)
- Setup Hetzner Cloud worker
- Switch ClaudeClient to Bedrock for staging
- Setup Resend custom domain
- Deploy worker to Hetzner

**UI track:**
- Migrate `/dashboard`, `/tasks`, `/calendar`

**Success criteria:** 6 schemas working. All priority pages migrated. Production infrastructure deployed. Shadow mode validated on 100+ real documents.

### Phase 3: Beta (weeks 17-22)

- Recruit 2-3 pilot customers
- Enable `ai_mode = 'beta'` for pilot orgs
- Weekly feedback calls
- Prompt iteration based on real corrections
- UX polish based on user feedback

**Success criteria:** 2-3 customers actively using AI features with positive feedback. Accuracy holding in beta.

### Phase 4: Insights system (weeks 23-26)

- Haiku-based company insights (cached)
- Haiku-based contract key terms (cached)
- Insight regeneration triggers on state changes
- Dashboard insights (role-aware)
- Critical insights for expired/expiring contracts (Sonnet)

**Success criteria:** Insights visible on portfolio and contract detail pages. Regeneration happens within 2 minutes of state change.

### Phase 5: Gradual rollout + Søg & Spørg (weeks 27-34)

**Rollout track:**
- 10% → 25% → 50% → 100% of customers over 2-3 weeks
- Monitor metrics closely
- Kill switch tested

**Search track:**
- Query type detection (search/question/action)
- RAG pipeline (vector search + context building)
- pgvector extension on Supabase
- Embedding generation for extracted fields + document summaries
- Search AI answer generation
- Response caching

**Success criteria:** 100% of customers have AI access. Søg & Spørg functional in beta.

### Phase 6: Polish (weeks 35-40)

- AWS Textract table extraction fallback (for complex tables Claude vision misses)
- Advanced feedback loop analytics
- Cost optimization (batch API for bulk onboarding, aggressive caching)
- Calendar event auto-extraction from contracts
- Multi-language support exploration (Swedish, English)
- Email notifications via Resend custom domain

**Success criteria:** Full prototype vision in production. Cost optimized. Stable operation.

### Total realistic timeline

- **Minimum (compressed, focused work):** 26 weeks = 6 months
- **Realistic:** 32-34 weeks = 7-8 months
- **Conservative:** 40 weeks = 10 months

---

## Open Questions / Deferred Items

### Deferred to v2 or later

- **Multi-language support:** Swedish, English, German contracts. Claude handles them natively but we need language-specific prompts and schemas.
- **Multi-document splitting:** When a single PDF contains multiple contracts. Require customer to upload separately for v1.
- **Fine-tuning:** Using customer corrections to fine-tune a model. Requires significant infrastructure; pending market demand.
- **Self-hosted LLM:** For customers requiring data never-leaves-infra. Defer until specific enterprise request.
- **Advanced RAG for Søg & Spørg:** Current plan is simple grounding. Advanced features (multi-hop reasoning, cross-document synthesis) deferred.
- **AI-generated contract drafts:** We extract, we don't author. Drafting is a separate product question.
- **Real-time collaborative review:** Multiple users reviewing same extraction simultaneously. Single-user for v1.
- **Prompt marketplace / customer-customizable schemas:** Enterprise feature, not v1.

### Needs verification before implementation

- **AWS Bedrock Frankfurt PDF support:** Verify feature parity with Anthropic Direct before production switch
- **Claude Sonnet 4 vs 3.5 Sonnet:** Which specific model version is production-ready at implementation time
- **Supabase Postgres extensions for pgvector:** Confirm available on current plan for Phase 5
- **Hetzner Cloud CX11 specs vs worker memory needs:** May need to upgrade to CX21 if memory-intensive

### Known risks

- **Anthropic Direct → Bedrock migration risk:** Small chance of unexpected behavioral differences. Mitigated by thorough testing in staging before shadow mode starts.
- **Prompt engineering time estimate:** The 2-3 days per schema estimate assumes solid prompt engineering skills. First prompts may take longer.
- **Gold standard dataset collection:** Requires legal expert time to annotate. Budget for 2-3 days of legal expert consulting per schema.
- **Shadow mode "ground truth" problem:** If pilot customers don't manually enter data, shadow mode can't validate. May need to pay pilot customers for validation time.
- **Cost overrun:** If accuracy is lower than hoped, users reject more AI output, triggering more re-extraction and iteration. Monitor closely.

---

## Appendix A: Example EJERAFTALE schema (partial)

```typescript
// src/lib/ai/schemas/ejeraftale.ts
import type { ContractSchema } from './types'

export const EJERAFTALE_V1: ContractSchema = {
  contract_type: 'EJERAFTALE',
  schema_version: 'v1.0.0',

  tool_definition: {
    name: 'extract_ejeraftale',
    description: 'Ekstraherer strukturerede felter fra en dansk ejeraftale (ownership agreement)',
    input_schema: {
      type: 'object',
      properties: {
        parties: {
          type: 'array',
          description: 'Aftaleparterne med deres ejerandele',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              party_type: { enum: ['KAEDE_GRUPPE', 'LOKAL_PARTNER', 'HOLDING', 'OTHER'] },
              capital_ownership_percentage: { type: 'number', minimum: 0, maximum: 100 },
              voting_ownership_percentage: { type: 'number', minimum: 0, maximum: 100 },
              ownership_type: { enum: ['DIRECT', 'CONDITIONAL', 'OPTION', 'VESTING'] },
              notes: { type: 'string' },
              source_page: { type: 'number' },
              source_text: { type: 'string' },
              claude_confidence: { type: 'number', minimum: 0, maximum: 1 },
            },
            required: ['name', 'capital_ownership_percentage', 'claude_confidence'],
          },
        },
        effective_date: {
          type: 'object',
          properties: {
            value: { type: 'string', format: 'date' },
            source_page: { type: 'number' },
            source_text: { type: 'string' },
            claude_confidence: { type: 'number' },
          },
        },
        termination_notice_months: {
          type: 'object',
          properties: {
            value: { type: 'number', minimum: 0 },
            source_page: { type: 'number' },
            source_text: { type: 'string' },
            claude_confidence: { type: 'number' },
          },
        },
        non_compete_clause: {
          type: 'object',
          properties: {
            present: { type: 'boolean' },
            duration_months: { type: 'number' },
            geographic_scope: { type: 'string' },
            source_page: { type: 'number' },
            source_text: { type: 'string' },
            claude_confidence: { type: 'number' },
          },
        },
        pre_emption_right: {
          type: 'object',
          properties: {
            present: { type: 'boolean' },
            notes: { type: 'string' },
            source_page: { type: 'number' },
            source_text: { type: 'string' },
            claude_confidence: { type: 'number' },
          },
        },
      },
      required: ['parties', 'effective_date'],
    },
  },

  field_metadata: {
    'parties': { legal_critical: true, required: true, description: 'Aftaleparterne' },
    'effective_date': { legal_critical: true, required: true, description: 'Ikrafttrædelse' },
    'termination_notice_months': { legal_critical: true, required: false, description: 'Opsigelsesvarsel' },
    'non_compete_clause': { legal_critical: true, required: false, description: 'Konkurrenceforbud' },
    'pre_emption_right': { legal_critical: false, required: false, description: 'Forkøbsret' },
  },

  prompt_template: `Du er ekspert i danske ejeraftaler med 20+ års erfaring i selskabsret.

Din opgave: Ekstraher strukturerede felter fra en ejeraftale til brug i ChainHub, et portfolio management system for kædegrupper.

VIGTIGE REGLER:
1. Citer ALTID exact word-for-word passages fra dokumentet som source_text.
2. Hvis du ikke finder et felt, sæt det til null. GÆT ALDRIG.
3. Hvis en værdi er tvetydig, returnér den mest eksplicitte version og angiv lav confidence.
4. Returnér source_page kun hvis du er 100% sikker på sideplacering.
5. Returnér altid via extract_ejeraftale tool. Ingen fri tekst.

DOMAIN KONTEKST:
- "KædeGruppen" er typisk majoritetsejer (51%+) i ChainHub-systemet
- "Partner" (fx "Dr. Petersen") er typisk minoritetsejer (49%-)
- Kapital- og stemmeandel kan være forskellige (fx kædegruppen har 51% stemmer men kun 45% kapital)
- Non-compete er altid angivet i måneder, ikke år
- Ejeraftaler er typisk 10-30 sider

EKSEMPLER:
[2-3 few-shot examples with real contract excerpts and expected extractions]

Analyser nu den vedlagte ejeraftale og returnér struktureret ekstraktion.`,

  sanity_rules: [
    {
      field: 'parties',
      check: (value) => {
        const parties = value as Array<{ capital_ownership_percentage: number }>
        const sum = parties.reduce((acc, p) => acc + p.capital_ownership_percentage, 0)
        return Math.abs(sum - 100) < 0.5
      },
      message: 'Ejerandelene summerer ikke til 100%',
    },
    {
      field: 'effective_date',
      check: (value) => {
        const date = new Date((value as { value: string }).value)
        return !isNaN(date.getTime()) && date.getFullYear() >= 1900 && date.getFullYear() <= 2100
      },
      message: 'Ikrafttrædelsesdato er ikke gyldig',
    },
  ],

  cross_validation_rules: [
    {
      extracted_field: 'parties',
      prisma_model: 'Ownership',
      compare: (extracted, existing) => {
        // Compare extracted parties with existing Ownership records
        // Return discrepancies
      },
    },
  ],
}
```

---

## Appendix B: Cost model spreadsheet

| Scenario | Customers | Extraction | Insights | Search | Total/month |
|---|---|---|---|---|---|
| Single pilot customer, steady | 1 | $5 | $3 | $18 | **$26** |
| Single pilot customer, onboarding | 1 | $100 | $20 | $18 | **$138** |
| 20 customers, steady | 20 | $100 | $60 | $360 | **$520** |
| 50 customers, steady | 50 | $250 | $150 | $900 | **$1,300** |
| 100 customers, steady | 100 | $500 | $300 | $1,800 | **$2,600** |

**All numbers assume materialized insights architecture.** Without caching, multiply by ~10x.

---

## Appendix C: Key dependencies summary

**New npm dependencies:**
- `@anthropic-ai/sdk` (dev + staging)
- `@aws-sdk/client-bedrock-runtime` (prod)
- `pg-boss`
- `mammoth`
- `exceljs`
- `file-type`
- `pdf-lib` (for password detection)

**New services (deferred to week 16+):**
- Hetzner Cloud CX11 VPS
- AWS Bedrock access (approved during dev phase)
- Resend custom domain

**No changes to existing stack:**
- Next.js 14
- Prisma 5
- Supabase Postgres
- NextAuth
- Tailwind
- shadcn/ui

---

## Approval

Design approved on 2026-04-09 after iterative brainstorming and ruthless critique cycles. Key critical decisions validated:

- Materialized insights architecture (not live AI calls)
- Claude Sonnet 4 primary + Haiku 3.5 tiered
- Anthropic Direct for dev, Bedrock Frankfurt for prod
- pg-boss on Supabase + Hetzner worker for prod
- Agreement-based confidence (not Claude self-reported)
- No auto-accept for legal-critical fields
- Shadow mode → beta → gradual rollout (non-negotiable)
- UI migration parallel with AI backend
- 6 priority contract schemas in v1
- Conservative 0.90/0.70 confidence thresholds
- Data provenance tracking from day 1
- Feedback loop infrastructure from day 1

**Next step:** Implementation plan via `writing-plans` skill.
