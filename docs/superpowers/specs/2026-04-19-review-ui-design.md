# Review-UI A+ (Phase B.1b) — Design Spec

**Dato:** 2026-04-19
**Scope:** Pilot-ready review-UI for AI-extraherede kontraktfelter
**Status:** Design godkendt, klar til implementation-plan

---

## 1. Formål og scope

Gør den eksisterende 817-linjers `review-client.tsx`-skeleton production-klar til første pilot. Luk funktionshul så pilot-kunder kan:

1. Se AI-extraherede felter fra deres kontrakter med korrekte confidence-tal
2. Godkende høj-konfidens-felter hurtigt og reviewe lav-konfidens + juridisk kritiske felter
3. Rette felter manuelt via inline tekst-input
4. Afvise et helt dokument (extraction_status → 'rejected')
5. Sammenligne AI-forslag mod eksisterende Contract-data når data findes

**Ambition:** A+ (pilot-ready) — ikke B (production-grade med PDF-rendering) og ikke C (enterprise multi-reviewer). Ca. 1-1½ dags arbejde.

**Ikke-mål for denne iteration:**

- Embedded PDF.js-rendering (mock-blokke erstattes kun af actual source_text, ikke visuel PDF)
- Keyboard shortcuts (J/K, bulk-accept)
- Multi-reviewer conflict-resolution
- Discrepancy-computation ved første upload (per design-beslutning D)

## 2. Problemanalyse — reelle huller i skeletonet

Efter inspektion af `src/app/(dashboard)/documents/review/[id]/`:

| #   | Hul                                                                                                                                                          | Impact                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| 1   | `page.tsx:36` læser `field.confidence`, men pipeline-output bruger `claude_confidence`                                                                       | Alle felter viser 0% konfidens → alle klassificeres som "low"        |
| 2   | "Ret manuelt"-knap sætter `decision: 'manual'`, men åbner ingen input. User kan ikke gemme en værdi                                                          | Central review-funktion virker ikke                                  |
| 3   | `formatFieldLabel()` producerer generiske labels ("Parties", "Effective Date"), schema-metadata med danske beskrivelser og `legal_critical`-flag bruges ikke | Svagere UX; juridisk vigtige felter highlightes ikke                 |
| 4   | `mockPdfBlocks` er hardcoded placeholder-tekst — hover-highlight matcher aldrig real extraction source_text                                                  | Bruger kan ikke verificere hvor AI fandt værdien                     |
| 5   | `existingValue` er altid null ved første upload (intet kode populerer det fra Contract-data)                                                                 | Comparison-værdi mangler                                             |
| 6   | Per-felt `auto_accept_threshold` fra schema (0.75-0.9 afhængigt af felt) ignoreres — global 0.85 bruges                                                      | Legal-critical-felter med 0.8-threshold bliver forkert klassificeret |
| 7   | "Afvis"-knap viser kun toast "funktion kommer senere"                                                                                                        | Pilot-bruger kan ikke afvise fejlagtige extractions                  |
| 8   | Ingen tests for review-flow                                                                                                                                  | Regression-risiko ved fremtidige ændringer                           |

`AIFieldCorrection`-writes + `approveDocumentReview`-flow fungerer allerede korrekt i `saveFieldDecision` + `approveDocumentReview`.

## 3. Arkitektur — Approach A (surgical fixes)

Behold skeleton-arkitektur. Server Component henter + enricher data. Client Component renderer + håndterer lokal state.

```
page.tsx (Server)
  ├─ Henter Document + DocumentExtraction
  ├─ Henter Contract (hvis document.contract_id er sat) m/ relations
  ├─ Henter schema via registry (getSchema(extraction.detected_type))
  ├─ Berigelse: per felt tilføjes description, legal_critical, auto_accept_threshold, existingValue
  ├─ Byg sourceBlocks fra unikke extracted_fields.source_text
  └─ Render <ReviewClient document={reviewDoc} reviewQueue={...} sourceBlocks={...} />

review-client.tsx (Client)
  ├─ AttentionFieldRow m/ inline manual edit-state
  ├─ HighConfidenceRow (uændret)
  ├─ MissingClauseRow (uændret)
  ├─ Source-panel renderer sourceBlocks prop (ikke hardcoded mockPdfBlocks)
  └─ Rejection-dialog (ny)
```

Ingen ny arkitektur. Ingen fil-splits (review-client.tsx forbliver ~900 linjer — accepteres for pilot).

## 4. Data flow + shape-ændringer

### 4.1 Confidence-field-fix

`page.tsx:mapExtractedFields`:

```typescript
// FØR
const confidence = typeof field.confidence === 'number' ? field.confidence : 0

// EFTER
const confidence = typeof field.claude_confidence === 'number' ? field.claude_confidence : 0
```

### 4.2 Schema-metadata enrichment (server-side)

I `page.tsx`, efter Contract er hentet:

```typescript
import { getSchema } from '@/lib/ai/schemas/registry'

const schema = extraction?.detected_type ? getSchema(extraction.detected_type) : null

// Udvidet mapExtractedFields-signatur:
function mapExtractedFields(
  extractedFields: unknown,
  discrepancies: unknown,
  schema: ContractSchema | null,
  contract: ContractWithRelations | null
): ReviewField[]
```

Per felt:

```typescript
const meta = schema?.field_metadata?.[key]
const fieldLabel = meta?.description ?? formatFieldLabel(key)
const threshold = meta?.auto_accept_threshold ?? 0.85
const legalCritical = meta?.legal_critical ?? false
const confidenceLevel =
  confidence >= threshold ? 'high' : confidence >= threshold - 0.25 ? 'medium' : 'low'
```

### 4.3 Existing-value helper

Ny fil `src/lib/ai/review/existing-values.ts`:

```typescript
import type { Contract, ContractParty, Person, Ownership } from '@prisma/client'

type ContractWithRelations = Contract & {
  parties: (ContractParty & { person: Person | null })[]
  ownerships: Ownership[]
}

export function getExistingValue(
  fieldName: string,
  contract: ContractWithRelations | null,
  _schemaType: string
): string | null {
  if (!contract) return null

  const directMap: Record<string, () => string | null> = {
    effective_date: () => contract.effective_date?.toISOString().slice(0, 10) ?? null,
    expiry_date: () => contract.expiry_date?.toISOString().slice(0, 10) ?? null,
    signed_date: () => contract.signed_date?.toISOString().slice(0, 10) ?? null,
    termination_notice_months: () =>
      contract.notice_period_days != null
        ? String(Math.round(contract.notice_period_days / 30))
        : null,
    contract_name: () => contract.display_name,
  }
  if (directMap[fieldName]) return directMap[fieldName]()

  if (fieldName === 'parties') {
    return contract.parties.length > 0
      ? contract.parties
          .map((p) => p.counterparty_name ?? p.person?.name)
          .filter((v): v is string => !!v)
          .join(', ')
      : null
  }

  if (fieldName === 'ownership_split' || fieldName === 'ownerships') {
    return contract.ownerships.length > 0
      ? contract.ownerships.map((o) => `${o.party_name ?? 'ukendt'} ${o.percentage}%`).join(', ')
      : null
  }

  const typeData = contract.type_data as Record<string, unknown> | null
  if (typeData && fieldName in typeData) {
    const val = typeData[fieldName]
    return val != null ? String(val) : null
  }

  return null
}
```

Brugt i `mapExtractedFields`:

```typescript
const existingValue = getExistingValue(key, contract, schema?.contract_type ?? '')
```

### 4.4 source_text → sourceBlocks

Slet hardcoded `mockPdfBlocks` fra client. Byg dynamiske blokke i page.tsx:

```typescript
interface SourceBlock {
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

Sendes til `ReviewClient` som ny prop `sourceBlocks: SourceBlock[]`. Client erstatter `mockPdfBlocks` med dette.

### 4.5 Legal-critical override

I `page.tsx`, efter mapping:

```typescript
const reviewFields = fields.map((f) => ({
  ...f,
  isAttention: f.confidenceLevel !== 'high' || f.legalCritical,
}))
```

Client-split filtrering baseret på `isAttention` i stedet for confidence alene.

### 4.6 ReviewField-type udvides

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

## 5. Komponent-ændringer (review-client.tsx)

### 5.1 Manual edit inline

`AttentionFieldRow`:

```tsx
const [isEditing, setIsEditing] = useState(false)
const [manualValue, setManualValue] = useState('')

function startManualEdit() {
  setIsEditing(true)
  setManualValue(field.extractedValue ?? '')
}

function saveManual() {
  startTransition(async () => {
    const result = await saveFieldDecision({
      extractionId,
      fieldName: field.fieldName,
      decision: 'manual',
      aiValue: field.extractedValue,
      existingValue: field.existingValue,
      confidence: field.confidence,
      manualValue, // NY parameter
    })
    if (result.error) {
      toast.error(result.error)
      return
    }
    setIsEditing(false)
    onDecide?.(field.id)
    toast.success(`${field.fieldLabel}: rettet manuelt til "${manualValue}"`)
  })
}

// "Ret manuelt"-knap:
;<button onClick={startManualEdit}>Ret manuelt</button>

// Inline editor (renderet under beslutningsknap-rækken):
{
  isEditing && (
    <div className="ml-3.5 mt-2 flex items-center gap-1.5">
      <input
        value={manualValue}
        onChange={(e) => setManualValue(e.target.value)}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') saveManual()
          if (e.key === 'Escape') setIsEditing(false)
        }}
        className="flex-1 text-[11px] font-medium text-slate-900 bg-white ring-1 ring-slate-300 rounded-md px-2 py-1 focus:outline-none focus:ring-slate-900"
      />
      <button
        disabled={isPending}
        onClick={saveManual}
        className="bg-slate-900 text-white text-[11px] font-medium px-2.5 py-1 rounded-md"
      >
        Gem
      </button>
      <button onClick={() => setIsEditing(false)} className="text-[11px] text-slate-500 px-2 py-1">
        Annullér
      </button>
    </div>
  )
}
```

### 5.2 Legal-critical-markør

I label-rækken ved siden af confidence:

```tsx
{
  field.legalCritical && (
    <span className="text-[9px] font-semibold uppercase tracking-wider text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
      Juridisk
    </span>
  )
}
```

### 5.3 Source-panel bruger sourceBlocks-prop

```tsx
interface ReviewClientProps {
  document: ReviewDocument
  reviewQueue: ReviewQueueItem[]
  sourceBlocks: SourceBlock[] // NY
}

// I JSX:
{
  sourceBlocks.map((block) => {
    const isHighlighted =
      hoveredSourceText !== null && block.text.includes(hoveredSourceText.slice(0, 20))
    return (
      <div key={block.id}>
        <p className="text-[10px] font-semibold ...">{block.paragraph}</p>
        <p
          className={cn('transition-all', isHighlighted && 'bg-amber-200/70 ring-1 ring-amber-300')}
        >
          {block.text}
        </p>
      </div>
    )
  })
}
```

Fallback hvis `sourceBlocks.length === 0`: "AI-extraktion har ikke registreret source-blokke."

### 5.4 Rejection-dialog

Ny state:

```tsx
const [rejecting, setRejecting] = useState(false)
const [rejectReason, setRejectReason] = useState('')
const [isRejecting, startReject] = useTransition()

function confirmReject() {
  startReject(async () => {
    if (!doc.extractionId) return
    const result = await rejectDocumentExtraction({
      extractionId: doc.extractionId,
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

Dialog-JSX renders som fixed inset overlay når `rejecting === true`.

## 6. Server-action-ændringer (`src/actions/document-review.ts`)

### 6.1 `saveFieldDecision`: manualValue-parameter

```typescript
const fieldDecisionSchema = z.object({
  extractionId: z.string().min(1),
  fieldName: z.string().min(1),
  decision: z.enum(['use_ai', 'keep_existing', 'manual', 'accept_missing', 'add_manual']),
  aiValue: z.unknown(),
  existingValue: z.unknown(),
  confidence: z.number().nullable(),
  manualValue: z.string().max(1000).optional(),
})

// userValue-beregning udvidet:
const userValue =
  params.decision === 'use_ai'
    ? params.aiValue
    : params.decision === 'keep_existing'
      ? params.existingValue
      : params.decision === 'manual'
        ? params.manualValue
        : params.decision === 'add_manual'
          ? params.manualValue
          : params.existingValue // accept_missing

// field_decisions objektet udvides:
updatedDecisions[params.fieldName] = {
  decision: params.decision,
  decided_at: new Date().toISOString(),
  decided_by: session.user.id,
  correction_id: correctionId,
  manual_value: params.manualValue ?? null,
}
```

### 6.2 `rejectDocumentExtraction` (ny action)

Se sektion 4 i brainstorm — fuld signature:

```typescript
export async function rejectDocumentExtraction(params: {
  extractionId: string
  reason?: string
}): Promise<ActionResult<void>>
```

Opdaterer `extraction_status = 'rejected'`, `reviewed_by`, `reviewed_at`, og tilføjer `__rejection__`-nøgle til `field_decisions` JSON med reason.

## 7. Filter-opdatering på /documents

Listen over dokumenter skal vise rejected-status. `src/app/(dashboard)/documents/documents-client.tsx` får ny visual:

| extraction_status                | Badge                       |
| -------------------------------- | --------------------------- |
| `completed` + `reviewed_at` null | "Afventer review" (amber)   |
| `completed` + `reviewed_at` set  | "Godkendt" (emerald)        |
| `rejected`                       | "Afvist" (rose)             |
| `failed`                         | "Extraction fejlet" (slate) |

Kun minimalt UI-change — ingen ny filter-dropdown i denne iteration.

## 8. Testing

### 8.1 Integration-tests (`src/__tests__/actions/document-review.test.ts`)

```
describe('approveDocumentReview')
  - happy path sætter reviewed_at + reviewed_by
  - returnerer error ved forkert tenant
  - returnerer error ved manglende canAccessCompany
  - idempotent: godkend to gange overskriver reviewed_at

describe('saveFieldDecision')
  - decision: use_ai gemmer aiValue som user_value
  - decision: keep_existing gemmer existingValue
  - decision: manual gemmer manualValue (ikke aiValue)
  - AIFieldCorrection-row oprettes pr. decision
  - field_decisions JSON opdateres idempotent
  - rejekter invalid manualValue (>1000 chars)

describe('rejectDocumentExtraction')
  - sætter extraction_status=rejected + reviewed_at + rejection-JSON
  - reason valgfri; tom string normaliseres til null
  - max 500 chars på reason
  - tenant-isolation
  - permission-check på company
```

### 8.2 Component-test (`src/__tests__/review/review-client.test.tsx`)

Vitest + Testing Library:

```
- Renderer attention + high-confidence sektioner med mock data
- Manual edit: klik "Ret manuelt" → input vises med extractedValue pre-udfyldt
- Manual edit: Enter-tast gemmer → saveFieldDecision kaldet med manualValue
- Manual edit: Escape annullerer uden at kalde action
- Progress-bar opdaterer når decidedIds ændres
- Godkend-knap disabled når ikke alle attention-felter besluttet
- Legal-critical-felt vises med rose badge + opmærksomheds-promotion
- Rejection-dialog åbner ved klik + afsendes ved Bekræft
```

### 8.3 Helper-test (`src/__tests__/review/existing-values.test.ts`)

```
- getExistingValue med null contract returnerer null
- Direct mapping: effective_date, expiry_date, signed_date formaterer ISO-dato
- termination_notice_months: 90 dage → "3" måneder
- parties: join af counterparty_name og person.name
- ownerships: formatering af percentage
- type_data fallback for schema-felt ikke i direct/relation map
- type_data null returnerer null for ukendt felt
```

## 9. Filer berørt — summary

**Nye filer:**

- `src/lib/ai/review/existing-values.ts`
- `src/__tests__/actions/document-review.test.ts`
- `src/__tests__/review/review-client.test.tsx`
- `src/__tests__/review/existing-values.test.ts`

**Modificerede filer:**

- `src/app/(dashboard)/documents/review/[id]/page.tsx` — enrichment + sourceBlocks-beregning + Contract-load
- `src/app/(dashboard)/documents/review/[id]/review-client.tsx` — manual edit, legal-critical badge, sourceBlocks-prop, rejection-dialog
- `src/actions/document-review.ts` — manualValue param, rejectDocumentExtraction
- `src/app/(dashboard)/documents/documents-client.tsx` — rejected-badge

**Ikke berørt:** `src/lib/ai/pipeline/*`, schema-filer, feedback.ts, cost-cap.ts — sprintens safeguards bevares.

## 10. Ikke-mål — eksplicit

- **Embedded PDF.js** — source_text-citater er pilot-tilstrækkeligt
- **Bulk "accepter alle høj-konfidens"** — behandles i efterfølgende iteration efter målt friktion
- **Keyboard shortcuts** — samme
- **Discrepancy-computation ved første upload** — `hasDiscrepancy` forbliver false; classification baseret på confidence + legal_critical
- **Multi-reviewer / audit-trail** — enterprise-feature for Plus/Enterprise-tier
- **Rejected-filter-dropdown** — minimal badge-visning kun

## 11. Success-kriterier

Pilot-kunden kan:

1. Åbne `/documents/review/[id]` og se alle AI-felter med KORREKTE confidence-procenter
2. For lav-konfidens-felt: klikke "Ret manuelt", skrive værdi, trykke Enter → gemmes
3. For høj-konfidens-felt: se i auto-godkendt sektion, ikke behøve at behandle
4. For legal-critical-felt (selv ved 95% confidence): se det i attention-sektion med rødt "Juridisk"-flag
5. Hover et felt → se det relevante citat fra dokumentet i venstre panel
6. Tryk "Godkend" når alle attention-felter er besluttet → extraction.reviewed_at sættes, router til /documents
7. Tryk "Afvis" med valgfri begrundelse → extraction_status=rejected, dokumentet forsvinder fra review-kø
8. Genåbne dokumentet → se "Allerede godkendt" eller "Allerede afvist"-state

**Tests grønne:** minimum 725+ tests passerer fortsat (ingen regression på safeguards-sprint); 15-20 nye tests tilføjes for review-flow.

**TypeScript + Prisma:** `npx tsc --noEmit` = 0 fejl. Ingen `any`.

**Build:** `npx next build` færdig uden fejl.
