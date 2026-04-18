import { z } from 'zod'
import { createClaudeClient, computeCostUsd } from '@/lib/ai/client'
import type { ClaudeModel, ClaudeResponse } from '@/lib/ai/client'

// -----------------------------------------------------------------
// Typer
// -----------------------------------------------------------------

export interface CompanySnapshot {
  company: {
    name: string
    cvr: string | null
    city: string | null
    status: string
    founded_year: number | null
    company_type: string | null
  }
  cluster: {
    name: string
    peers: Array<{ name: string; omsaetning_2025: number }>
  }
  contracts: Array<{
    id: string
    type: string
    status: string
    expiry_date: string | null
    days_until_expiry: number | null
    parties: string[]
  }>
  cases: Array<{
    id: string
    title: string
    type: string
    status: string
    days_open: number
  }>
  finance: {
    omsaetning_2025: number
    omsaetning_2024: number | null
    ebitda_2025: number
    ebitda_2024: number | null
    margin_2025: number
    margin_2024: number | null
    margin_delta_pp: number | null
  } | null
  visits: {
    last_visit_date: string | null
    days_since_last: number | null
    planned_count: number
  }
  persons: Array<{ name: string; role: string }>
  documents: {
    total: number
    recently_uploaded: number
    awaiting_review: number
  }
}

export const CompanyAlertSchema = z.object({
  severity: z.enum(['critical', 'warning']),
  title: z.string().max(60),
  sub: z.string().max(100),
  action_label: z.string().max(20),
  action_href: z.string().startsWith('/'),
  roles: z.array(z.enum(['owner', 'legal', 'finance', 'admin', 'manager'])).min(1),
})
export type CompanyAlert = z.infer<typeof CompanyAlertSchema>

export const AiInsightSchema = z.object({
  headline_md: z.string().max(80),
  body_md: z.string().max(280),
})
export type AiInsight = z.infer<typeof AiInsightSchema>

export const CompanyInsightsResultSchema = z.object({
  alerts: z.array(CompanyAlertSchema).max(5),
  insight: AiInsightSchema.nullable(),
})
export type CompanyInsightsResult = z.infer<typeof CompanyInsightsResultSchema>

export interface GenerateInsightsSuccess {
  ok: true
  data: CompanyInsightsResult
  cost_usd: number
  model_name: string
}
export interface GenerateInsightsFailure {
  ok: false
  error: string
}
export type GenerateInsightsOutcome = GenerateInsightsSuccess | GenerateInsightsFailure

// -----------------------------------------------------------------
// System prompt
// -----------------------------------------------------------------

const SYSTEM_PROMPT = `Du analyserer et selskab i en kaedegruppes portefoelje og identificerer hvad hovedkontoret boer vide. Returner JSON med to felter:

1. "alerts": array af 0-5 advarsler. Hver advarsel har:
   - severity: "critical" | "warning"
   - title: max 60 tegn, kort kernen
   - sub: max 100 tegn, forklarer kontekst med navne/tal/kausalitet
   - action_label: max 20 tegn, fx "Se kontrakt"
   - action_href: skal starte med "/" og pege paa en ChainHub-rute: /contracts/<id>, /cases/<id>, /persons/<id>
   - roles: array af relevante roller fra: "owner", "legal", "finance", "admin", "manager". Kun inkluder roller hvor alarmen er relevant.

2. "insight": en strategisk anbefaling, eller null hvis intet kritisk.
   - headline_md: max 80 tegn, foerste saetning, kan have **bold**
   - body_md: max 280 tegn, kausal analyse, sammenligning med klyngen, konkret handling med tidsfrist

Regler:
- Brug navne fra data naar du naevner personer
- Sammenlign tal mod klynge-peers og YoY naar relevant
- Forklar kausalitet, ikke kun fakta
- Du foreslaar handlinger, du beslutter ikke for brugeren
- Daekningssprog: amber for gaps, ikke roed
- Returnerer tom alerts-array og null insight hvis selskabet er sundt
- Returner KUN JSON, ingen forklarende tekst udenfor

Hvis klyngen har faerre end 3 peers, undgaa sammenligninger og fokuser paa YoY.`

// -----------------------------------------------------------------
// Hoved-funktion
// -----------------------------------------------------------------

const TIMEOUT_MS = 8000
const MODEL: ClaudeModel = 'claude-sonnet-4-20250514'

export async function generateCompanyInsights(
  snapshot: CompanySnapshot
): Promise<GenerateInsightsOutcome> {
  try {
    const client = createClaudeClient()

    const userMessage = `Analyser foelgende selskab og returner JSON:\n\n${JSON.stringify(snapshot, null, 2)}`

    const callPromise = client.complete({
      model: MODEL,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('AI timeout')), TIMEOUT_MS)
    )

    const response: ClaudeResponse = await Promise.race([callPromise, timeoutPromise])

    const textBlock = response.content.find((b) => b.type === 'text')
    const rawText = textBlock && textBlock.type === 'text' ? textBlock.text : ''
    const jsonText = extractJson(rawText)
    if (!jsonText) {
      return { ok: false, error: 'No JSON in response' }
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(jsonText)
    } catch {
      return { ok: false, error: 'Malformed JSON' }
    }

    const validated = CompanyInsightsResultSchema.safeParse(parsed)
    if (!validated.success) {
      return {
        ok: false,
        error: `Schema validation: ${validated.error.issues[0]?.message ?? 'unknown'}`,
      }
    }

    const costUsd = computeCostUsd(MODEL, response.usage.input_tokens, response.usage.output_tokens)

    return {
      ok: true,
      data: validated.data,
      cost_usd: costUsd,
      model_name: MODEL,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}

function extractJson(text: string): string | null {
  const fenceMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
  if (fenceMatch) return fenceMatch[1]
  const first = text.indexOf('{')
  const last = text.lastIndexOf('}')
  if (first !== -1 && last > first) return text.slice(first, last + 1)
  return null
}
