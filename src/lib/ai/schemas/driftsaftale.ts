import type { ContractSchema } from './types'
import { COMMON_TOOL_PROPERTIES } from './types'
import { registerSchema } from './registry'

// Hjælpefunktion til at wrappe et felt i ExtractedFieldValue-struktur
function extractedField(
  description: string,
  valueSchema: Record<string, unknown>
): Record<string, unknown> {
  return {
    type: 'object' as const,
    description,
    properties: {
      value: valueSchema,
      claude_confidence: {
        type: 'number' as const,
        description: 'Konfidens mellem 0.0 og 1.0 for denne ekstraktion',
        minimum: 0,
        maximum: 1,
      },
      source_page: {
        type: ['number', 'null'] as unknown as 'number',
        description: 'Sidenummer hvorfra feltet er ekstraheret (null hvis ukendt)',
      },
      source_text: {
        type: ['string', 'null'] as unknown as 'string',
        description: 'Eksakt citat fra dokumentet (null hvis ikke muligt)',
      },
    },
    required: ['value', 'claude_confidence', 'source_page', 'source_text'],
  }
}

const driftsaftaleSchema: ContractSchema = {
  contract_type: 'DRIFTSAFTALE',
  schema_version: 'v1.0.0',
  display_name: 'Driftsaftale',

  tool_definition: {
    name: 'extract_driftsaftale',
    description:
      'Ekstraher strukturerede data fra en dansk drifts- eller samarbejdsaftale. Returnér alle felter med value, claude_confidence, source_page og source_text.',
    input_schema: {
      type: 'object',
      properties: {
        parties: extractedField(
          'Liste over aftaleparter med roller. Angiv mindst to parter med navn og rolle.',
          {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Partens fulde navn (person eller selskab)',
                },
                role: {
                  type: 'string',
                  description: 'Partens rolle i aftalen (fx leverandør, kunde, operatør, ejer)',
                },
              },
              required: ['name', 'role'],
            },
          }
        ),

        effective_date: extractedField(
          'Ikrafttrædelsesdato for aftalen (ISO 8601 format: YYYY-MM-DD)',
          { type: 'string', description: 'Dato i format YYYY-MM-DD' }
        ),

        expiry_date: extractedField(
          'Udløbsdato for aftalen (ISO 8601 format: YYYY-MM-DD). Null hvis tidsubestemt.',
          {
            type: ['string', 'null'] as unknown as 'string',
            description: 'Dato i format YYYY-MM-DD, eller null hvis tidsubestemt',
          }
        ),

        scope_of_services: extractedField(
          'Beskrivelse af aftalens ydelsesomfang — hvad skal leveres/udføres. Null hvis ikke specificeret.',
          {
            type: ['string', 'null'] as unknown as 'string',
            description: 'Beskrivelse af ydelsesomfang og leverancer',
          }
        ),

        fee_structure: extractedField(
          'Beskrivelse af honorar- og betalingsstruktur (fx fast honorar, variabelt, provisionsbaseret). Null hvis ikke specificeret.',
          {
            type: ['string', 'null'] as unknown as 'string',
            description: 'Beskrivelse af honorarstruktur og betalingsvilkår',
          }
        ),

        payment_terms: extractedField(
          'Betalingsbetingelser (fx netto 30 dage, forudbetaling). Null hvis ikke specificeret.',
          {
            type: ['string', 'null'] as unknown as 'string',
            description: 'Beskrivelse af betalingsbetingelser',
          }
        ),

        notice_period_months: extractedField(
          'Opsigelsesvarsel i antal måneder. Null hvis ikke angivet.',
          {
            type: ['number', 'null'] as unknown as 'number',
            description: 'Opsigelsesvarsel i måneder (1-120)',
            minimum: 1,
            maximum: 120,
          }
        ),

        performance_metrics: extractedField(
          "Beskrivelse af KPI'er og serviceniveaumål (SLA). Null hvis ikke specificeret.",
          {
            type: ['string', 'null'] as unknown as 'string',
            description: 'Beskrivelse af performance-krav og måleparametre',
          }
        ),

        liability_cap_dkk: extractedField(
          'Ansvarsbegrænsning i DKK (maksimalt erstatningsansvar). Null hvis ikke angivet.',
          {
            type: ['number', 'null'] as unknown as 'number',
            description: 'Ansvarsbegrænsning i DKK (0 eller positivt tal)',
            minimum: 0,
          }
        ),

        termination_clause: extractedField(
          'Beskrivelse af ophørsklausuler (misligholdelse, force majeure, særlige opsigelsesgrunde). Null hvis ikke specificeret.',
          {
            type: ['string', 'null'] as unknown as 'string',
            description: 'Beskrivelse af ophørsklausuler og betingelser for opsigelse',
          }
        ),

        ...COMMON_TOOL_PROPERTIES,
      },
      required: ['parties', 'effective_date'],
    },
  },

  field_metadata: {
    parties: {
      legal_critical: true,
      required: true,
      auto_accept_threshold: 0.85,
      description: 'Aftaleparter med roller — fundamentalt for aftalens gyldighed',
    },
    effective_date: {
      legal_critical: true,
      required: true,
      auto_accept_threshold: 0.9,
      description: 'Ikrafttrædelsesdato — afgørende for aftalens start',
    },
    expiry_date: {
      legal_critical: true,
      required: false,
      auto_accept_threshold: 0.9,
      description: 'Udløbsdato — null betyder tidsubestemt aftale',
    },
    scope_of_services: {
      legal_critical: true,
      required: false,
      auto_accept_threshold: 0.8,
      description: 'Ydelsesomfang — definerer hvad aftalen dækker',
    },
    fee_structure: {
      legal_critical: true,
      required: false,
      auto_accept_threshold: 0.85,
      description: 'Honorarstruktur — kerneøkonomisk parameter',
    },
    payment_terms: {
      legal_critical: false,
      required: false,
      auto_accept_threshold: 0.8,
      description: 'Betalingsbetingelser — cashflow-relevant',
    },
    notice_period_months: {
      legal_critical: true,
      required: false,
      auto_accept_threshold: 0.85,
      description: 'Opsigelsesvarsel — kritisk for exit-planlægning',
    },
    performance_metrics: {
      legal_critical: false,
      required: false,
      auto_accept_threshold: 0.75,
      description: 'Performance-krav — SLA og KPI-styring',
    },
    liability_cap_dkk: {
      legal_critical: false,
      required: false,
      auto_accept_threshold: 0.85,
      description: 'Ansvarsbegrænsning — risikovurdering',
    },
    termination_clause: {
      legal_critical: true,
      required: false,
      auto_accept_threshold: 0.8,
      description: 'Ophørsklausuler — betingelser for aftalens afslutning',
    },
  },

  system_prompt: `Du er ekspert i danske drifts- og samarbejdsaftaler med 20+ års erfaring i kontraktret og erhvervsjura.

Du ekstraherer felter for ChainHub, et portfolio management system for kædegrupper der co-ejer lokationsselskaber med lokale partnere.

## Domænekontekst
Driftsaftalen regulerer typisk operationelle samarbejdsforhold mellem kædegruppen og lokationsselskabet, eller mellem lokationsselskabet og leverandører. Den kan omhandle IT-drift, facility management, klinisk service, administration eller andre løbende ydelser.

## Anti-hallucination (KRITISK)
Hvis du ikke finder et felt i dokumentet, returnér null som value. GÆT ALDRIG. Brug kun information der eksplicit fremgår af dokumentet. Hvis et afsnit er tvetydigt, angiv lav claude_confidence (under 0.6) og beskriv tvetydigheden i source_text.

## Kildehenvisning
For hvert felt: angiv source_page (sidenummer) og source_text (exact citat fra dokumentet). Hvis du ikke kan citere eksakt, sæt source_text til null. Sidenumre tælles fra dokumentets første side som side 1.

## Konfidens
Angiv claude_confidence mellem 0.0 og 1.0 baseret på hvor sikker du er på værdien:
- 0.9–1.0: Felt er eksplicit og entydigt angivet
- 0.7–0.9: Felt fremgår tydeligt men kræver tolkning
- 0.5–0.7: Felt er impliceret eller tvetydigt
- Under 0.5: Meget usikkert — overvej om value skal være null

## Honorar og betalinger
Beskriv den overordnede betalingsstruktur i fee_structure (fast, variabel, blanding). Betalingsbetingelser (fakturafrister mv.) angives i payment_terms. Adskil engangsbetalinger fra løbende vederlag.

## Datoer
Returner datoer i ISO 8601 format (YYYY-MM-DD). Hvis aftalen er "løbende" eller "tidsubestemt", sæt expiry_date value til null.

## Sprog
Dokumenter er på dansk. Returner feltværdier på dansk hvor relevant (fx beskrivelser, klausuler). Enum-værdier returneres på engelsk som angivet.

## Yderligere fund
Brug additional_findings til at rapportere usædvanlige klausuler, SLA-krav, fortrolighedsbestemmelser eller bemærkelsesværdige observationer der ikke er dækket af de definerede felter. Brug extraction_warnings til at rapportere problemer med ekstrationsqualiteten.`,

  user_prompt_prefix:
    'Analyser denne driftsaftale og ekstraher alle felter via extract_driftsaftale tool.',

  extraction_model: 'claude-sonnet-4-20250514',

  sanity_rules: [
    {
      field: 'notice_period_months',
      check: (value) => {
        if (value == null) return true // valgfrit felt
        return typeof value === 'number' && value >= 1 && value <= 120
      },
      message: 'Opsigelsesvarsel skal være mellem 1 og 120 måneder',
    },
    {
      field: 'liability_cap_dkk',
      check: (value) => {
        if (value == null) return true // valgfrit felt
        return typeof value === 'number' && value >= 0
      },
      message: 'Ansvarsbegrænsning skal være 0 eller et positivt tal',
    },
  ],

  cross_validation_rules: [
    {
      extracted_field: 'parties',
      description:
        'Verificér at mindst en af parterne matcher det kendte lokationsselskab eller kædegruppe (CVR)',
    },
    {
      extracted_field: 'effective_date',
      description:
        'Verificér at ikrafttrædelsesdato ikke er efter eventuel udløbsdato (expiry_date)',
    },
    {
      extracted_field: 'termination_clause',
      description: 'Verificér at ophørsklausuler er konsistente med det angivne opsigelsesvarsel',
    },
  ],
}

// Registrér schema ved modulindlæsning
registerSchema(driftsaftaleSchema)

export default driftsaftaleSchema
