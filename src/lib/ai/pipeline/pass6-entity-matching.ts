import { createClaudeClient, computeCostUsd } from '@/lib/ai/client'
import type { ClaudeModel } from '@/lib/ai/client'
import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/ai/logger'

const log = createLogger('pass6-entity-matching')

const MODEL: ClaudeModel = 'gpt-5-nano'

// ---------------------------------------------------------------------------
// Typer
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Kandidat-typer (intern)
// ---------------------------------------------------------------------------

interface CompanyCandidate {
  id: string
  name: string
  cvr: string | null
}

interface PersonCandidate {
  id: string
  first_name: string
  last_name: string
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `Du er et entity-matching system. Du modtager:
1. En liste af kendte entiteter (selskaber og personer) fra en kædegruppe
2. Indhold fra et dokument (uddrag + udtrukne felter)

Din opgave er at identificere hvilke kendte entiteter der er nævnt eller refereret til i dokumentet.

Returner et JSON-array (kun arrayet, ingen ekstra tekst) med matches:
[
  {
    "entity_type": "company" | "person",
    "entity_id": "<id fra kandidatlisten>",
    "entity_name": "<navn på entiteten>",
    "confidence": <0.0-1.0>,
    "match_reason": "<kort forklaring, fx 'CVR 12345678 matcher direkte'>"
  }
]

Regler:
- Inkluder KUN matches med confidence >= 0.5 (lavere filtreres bagefter)
- CVR-match i udtrukne felter giver confidence 0.95+
- Fuldt navnematch (fornavn + efternavn) giver confidence 0.85+
- Delnavn- eller kontekstbaseret match giver confidence 0.5-0.75
- Returner tomt array [] hvis ingen matches findes
- Returner KUN JSON-arrayet, ingen forklarende tekst`

// ---------------------------------------------------------------------------
// Hoved-funktion
// ---------------------------------------------------------------------------

export async function runEntityMatching(input: EntityMatchingInput): Promise<EntityMatchingResult> {
  const { extractedFields, organizationId, documentText } = input

  // Hent kandidater fra DB
  const [companies, persons] = await Promise.all([
    prisma.company.findMany({
      where: { organization_id: organizationId, deleted_at: null },
      select: { id: true, name: true, cvr: true },
    }) as Promise<CompanyCandidate[]>,
    prisma.person.findMany({
      where: { organization_id: organizationId, deleted_at: null },
      select: { id: true, first_name: true, last_name: true },
    }) as Promise<PersonCandidate[]>,
  ])

  const totalCandidates = companies.length + persons.length

  log.debug(
    {
      organization_id: organizationId,
      companies: companies.length,
      persons: persons.length,
    },
    'Entity matching startet'
  )

  // Ingen kandidater → returnér tom result uden LLM-kald
  if (totalCandidates === 0) {
    return {
      matches: [],
      input_tokens: 0,
      output_tokens: 0,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
      cost_usd: 0,
    }
  }

  // Byg kandidatliste til LLM
  const candidateLines: string[] = []

  for (const c of companies) {
    const cvrPart = c.cvr ? ` (CVR: ${c.cvr})` : ''
    candidateLines.push(`[SELSKAB] id="${c.id}" navn="${c.name}"${cvrPart}`)
  }

  for (const p of persons) {
    const fullName = `${p.first_name} ${p.last_name}`
    candidateLines.push(`[PERSON] id="${p.id}" navn="${fullName}"`)
  }

  const candidateList = candidateLines.join('\n')

  // Byg bruger-besked
  const fieldsJson = JSON.stringify(extractedFields, null, 2)
  const userMessage = `## Kendte entiteter i kædegruppen

${candidateList}

## Udtrukne felter fra dokumentet

${fieldsJson}

## Dokumenttekst (uddrag)

${documentText.slice(0, 2000)}

Match dokumentindholdet mod de kendte entiteter og returnér JSON-arrayet.`

  // Kald LLM
  const client = createClaudeClient()
  const response = await client.complete({
    model: MODEL,
    max_tokens: 1024,
    temperature: 0,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  })

  const inputTokens = response.usage.input_tokens
  const outputTokens = response.usage.output_tokens
  const cacheReadTokens = response.usage.cache_read_input_tokens ?? 0
  const cacheWriteTokens = response.usage.cache_creation_input_tokens ?? 0

  const costUsd = computeCostUsd(MODEL, inputTokens, outputTokens, {
    cacheReadTokens,
    cacheWriteTokens,
  })

  // Parse LLM-svar
  const textBlock = response.content.find((b) => b.type === 'text')
  const rawText = textBlock && textBlock.type === 'text' ? textBlock.text : ''

  const rawMatches = parseMatchesJson(rawText)

  // Filtrer til confidence >= 0.7
  const matches = rawMatches.filter((m) => m.confidence >= 0.7)

  log.info(
    {
      organization_id: organizationId,
      candidates: totalCandidates,
      raw_matches: rawMatches.length,
      filtered_matches: matches.length,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
    },
    'Entity matching fuldført'
  )

  return {
    matches,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cache_read_tokens: cacheReadTokens,
    cache_write_tokens: cacheWriteTokens,
    cost_usd: costUsd,
  }
}

// ---------------------------------------------------------------------------
// Hjælpefunktioner
// ---------------------------------------------------------------------------

function parseMatchesJson(text: string): EntityMatch[] {
  if (!text.trim()) return []

  // Forsøg direkte JSON-parse
  try {
    const trimmed = text.trim()
    // Prøv at finde JSON-array i teksten
    const arrayStart = trimmed.indexOf('[')
    const arrayEnd = trimmed.lastIndexOf(']')

    if (arrayStart === -1 || arrayEnd === -1) return []

    const jsonSlice = trimmed.slice(arrayStart, arrayEnd + 1)
    const parsed = JSON.parse(jsonSlice)

    if (!Array.isArray(parsed)) return []

    return parsed.filter(isValidEntityMatch)
  } catch {
    return []
  }
}

function isValidEntityMatch(item: unknown): item is EntityMatch {
  if (!item || typeof item !== 'object') return false
  const m = item as Record<string, unknown>
  return (
    (m.entity_type === 'company' || m.entity_type === 'person') &&
    typeof m.entity_id === 'string' &&
    typeof m.entity_name === 'string' &&
    typeof m.confidence === 'number' &&
    typeof m.match_reason === 'string'
  )
}
