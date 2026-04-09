import type { ContractSchema } from './types'
import { COMMON_TOOL_PROPERTIES } from './types'
import { registerSchema } from './registry'

// Hjælpefunktion til at wrappe et felt i ExtractedFieldValue-struktur
function extractedField(
  description: string,
  valueSchema: Record<string, unknown>,
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

const ejeraftaleSchema: ContractSchema = {
  contract_type: 'EJERAFTALE',
  schema_version: 'v1.0.0',
  display_name: 'Ejeraftale',

  tool_definition: {
    name: 'extract_ejeraftale',
    description:
      'Ekstraher strukturerede data fra en dansk ejeraftale. Returnér alle felter med value, claude_confidence, source_page og source_text.',
    input_schema: {
      type: 'object',
      properties: {
        parties: extractedField(
          'Liste over aftaleparter med ejerandele og stemmeret. Skal inkludere alle parter i aftalen.',
          {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Partens fulde navn (person eller selskab)',
                },
                party_type: {
                  type: 'string',
                  enum: ['KAEDE_GRUPPE', 'LOKAL_PARTNER', 'HOLDING', 'OTHER'],
                  description:
                    'Type af part: KAEDE_GRUPPE (kædegruppen/hovedkontoret), LOKAL_PARTNER (fx tandlægen), HOLDING (holdingselskab), OTHER',
                },
                capital_pct: {
                  type: 'number',
                  description: 'Kapitalandel i procent (0-100)',
                  minimum: 0,
                  maximum: 100,
                },
                voting_pct: {
                  type: 'number',
                  description: 'Stemmeandel i procent (0-100). Kan afvige fra kapitalandel.',
                  minimum: 0,
                  maximum: 100,
                },
                ownership_type: {
                  type: 'string',
                  enum: ['DIRECT', 'CONDITIONAL', 'OPTION', 'VESTING', 'OTHER'],
                  description:
                    'Ejerforhold: DIRECT (direkte), CONDITIONAL (betinget), OPTION (option), VESTING (vesting), OTHER',
                },
                notes: {
                  type: 'string',
                  description: 'Eventuelle bemærkninger om partens særlige rettigheder eller vilkår',
                },
              },
              required: ['name', 'party_type', 'capital_pct', 'voting_pct', 'ownership_type'],
            },
          },
        ),

        effective_date: extractedField(
          'Ikrafttrædelsesdato for ejeraftalen (ISO 8601 format: YYYY-MM-DD)',
          { type: 'string', description: 'Dato i format YYYY-MM-DD' },
        ),

        expiry_date: extractedField(
          'Udløbsdato for ejeraftalen (ISO 8601 format: YYYY-MM-DD). Null hvis aftalen er løbende uden fast udløb.',
          {
            type: ['string', 'null'] as unknown as 'string',
            description: 'Dato i format YYYY-MM-DD, eller null hvis løbende',
          },
        ),

        termination_notice_months: extractedField(
          'Opsigelsesvarsel i antal måneder. Null hvis ikke angivet i aftalen.',
          {
            type: ['number', 'null'] as unknown as 'number',
            description: 'Antal måneder (heltal)',
            minimum: 1,
            maximum: 120,
          },
        ),

        non_compete: extractedField(
          'Konkurrenceklausul. Angiv om den er til stede, varighed og geografisk omfang.',
          {
            type: 'object',
            properties: {
              present: {
                type: 'boolean',
                description: 'Er der en konkurrenceklausul?',
              },
              duration_months: {
                type: 'number',
                description: 'Varighed i måneder (0 hvis ikke angivet)',
              },
              geographic_scope: {
                type: 'string',
                description: 'Geografisk omfang (fx "Danmark", "lokalområde", "")',
              },
            },
            required: ['present', 'duration_months', 'geographic_scope'],
          },
        ),

        pre_emption_right: extractedField(
          'Forkøbsret. Angiv om den er til stede og beskriv vilkårene.',
          {
            type: 'object',
            properties: {
              present: {
                type: 'boolean',
                description: 'Er der forkøbsret?',
              },
              description: {
                type: 'string',
                description: 'Beskrivelse af forkøbsrettens vilkår',
              },
            },
            required: ['present', 'description'],
          },
        ),

        exit_clause: extractedField('Exit-klausul. Angiv om den er til stede og beskriv vilkårene.', {
          type: 'object',
          properties: {
            present: {
              type: 'boolean',
              description: 'Er der en exit-klausul?',
            },
            description: {
              type: 'string',
              description: 'Beskrivelse af exit-klausulens vilkår',
            },
          },
          required: ['present', 'description'],
        }),

        drag_along: extractedField(
          'Drag-along rettighed (medsalgsret for majoritetsejer). True hvis til stede, false hvis ikke.',
          { type: 'boolean', description: 'Er der drag-along rettighed?' },
        ),

        tag_along: extractedField(
          'Tag-along rettighed (medsalgsret for minoritetsejer). True hvis til stede, false hvis ikke.',
          { type: 'boolean', description: 'Er der tag-along rettighed?' },
        ),

        dividend_policy: extractedField(
          'Udbyttepolitik. Beskriv regler for udbytteudlodning, reservekrav mv.',
          {
            type: 'string',
            description: 'Beskrivelse af udbyttepolitikken',
          },
        ),

        board_composition: extractedField(
          'Bestyrelsessammensætning. Beskriv regler for antal medlemmer og hvem der udpeger dem.',
          {
            type: 'string',
            description: 'Beskrivelse af bestyrelsessammensætning og udpegningsregler',
          },
        ),

        dispute_resolution: extractedField(
          'Tvistløsning. Beskriv hvordan tvister afgøres (voldgift, domstol, mægling mv.).',
          {
            type: 'string',
            description: 'Beskrivelse af tvistløsningsmekanisme og værneting',
          },
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
      description:
        'Aftaleparter med ejerandele og stemmeret — fundamentalt for governance og kontrol',
    },
    effective_date: {
      legal_critical: true,
      required: true,
      auto_accept_threshold: 0.9,
      description: 'Ikrafttrædelsesdato — afgørende for aftalens gyldighed',
    },
    expiry_date: {
      legal_critical: true,
      required: false,
      auto_accept_threshold: 0.9,
      description: 'Udløbsdato — null betyder løbende aftale',
    },
    termination_notice_months: {
      legal_critical: true,
      required: false,
      auto_accept_threshold: 0.85,
      description: 'Opsigelsesvarsel i måneder — kritisk for exit-planlægning',
    },
    non_compete: {
      legal_critical: true,
      required: false,
      auto_accept_threshold: 0.8,
      description: 'Konkurrenceklausul — begrænser partners muligheder efter udtræden',
    },
    pre_emption_right: {
      legal_critical: true,
      required: false,
      auto_accept_threshold: 0.8,
      description: 'Forkøbsret — regulerer overdragelse af anparter',
    },
    exit_clause: {
      legal_critical: true,
      required: false,
      auto_accept_threshold: 0.8,
      description: 'Exit-klausul — regulerer vilkår ved parternes udtræden',
    },
    drag_along: {
      legal_critical: false,
      required: false,
      auto_accept_threshold: 0.85,
      description: 'Drag-along — majoritetsejerens ret til at trække minoritet med ved salg',
    },
    tag_along: {
      legal_critical: false,
      required: false,
      auto_accept_threshold: 0.85,
      description: 'Tag-along — minoritetsejers ret til at deltage ved majoritetens salg',
    },
    dividend_policy: {
      legal_critical: false,
      required: false,
      auto_accept_threshold: 0.75,
      description: 'Udbyttepolitik — regler for udlodning',
    },
    board_composition: {
      legal_critical: false,
      required: false,
      auto_accept_threshold: 0.8,
      description: 'Bestyrelsessammensætning — governance-struktur',
    },
    dispute_resolution: {
      legal_critical: false,
      required: false,
      auto_accept_threshold: 0.8,
      description: 'Tvistløsning — hvordan uenigheder afgøres',
    },
  },

  system_prompt: `Du er ekspert i danske ejeraftaler med 20+ års erfaring i selskabsret.

Du ekstraherer felter for ChainHub, et portfolio management system for kædegrupper der co-ejer lokationsselskaber med lokale partnere.

## Domænekontekst
KædeGruppen er typisk majoritetsejer (51%+). "Partner" (fx tandlægen) er typisk minoritetsejer. Kapital- og stemmeandele kan være forskellige — læs begge dele nøje. Holdingselskaber optræder ofte som mellemmænd for de reelle ejere.

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

## Ejerandele
Summer altid kapitalandelene for alle parter. Afvigelse fra 100% skal rapporteres som extraction_warning. Angiv både capital_pct (kapitalandel) og voting_pct (stemmeandel) — disse kan være forskellige pga. særlige stemmerettigheder.

## Datoer
Returner datoer i ISO 8601 format (YYYY-MM-DD). Hvis kun år og måned er angivet, brug den 1. i måneden. Hvis aftalen er "løbende" uden fast udløbsdato, sæt expiry_date value til null.

## Sprog
Dokumenter er på dansk. Returner feltværdier på dansk hvor relevant (fx beskrivelser, noter). Enum-værdier returneres på engelsk som angivet.

## Yderligere fund
Brug additional_findings til at rapportere usædvanlige klausuler, manglende standardelementer eller bemærkelsesværdige observationer der ikke er dækket af de definerede felter. Brug extraction_warnings til at rapportere problemer med ekstrationsqualiteten.`,

  user_prompt_prefix: 'Analyser denne ejeraftale og ekstraher alle felter via extract_ejeraftale tool.',

  extraction_model: 'claude-sonnet-4-20250514',

  sanity_rules: [
    {
      field: 'parties',
      check: (value) => {
        if (!Array.isArray(value)) return false
        const parties = value as Array<{ capital_pct: number }>
        if (parties.length < 2) return false
        const sum = parties.reduce((acc, p) => acc + (p.capital_pct ?? 0), 0)
        return Math.abs(sum - 100) < 1 // tillad afrunding
      },
      message: 'Ejerandelene skal summere til 100% og have mindst 2 parter',
    },
    {
      field: 'effective_date',
      check: (value) => {
        if (value == null) return false
        const date = new Date(value as string)
        return (
          !isNaN(date.getTime()) &&
          date.getFullYear() >= 1900 &&
          date.getFullYear() <= 2100
        )
      },
      message: 'Ikrafttrædelsesdato skal være en gyldig dato',
    },
    {
      field: 'termination_notice_months',
      check: (value) => {
        if (value == null) return true // valgfrit felt
        return typeof value === 'number' && value > 0 && value <= 120
      },
      message: 'Opsigelsesvarsel skal være mellem 1 og 120 måneder',
    },
  ],

  cross_validation_rules: [
    {
      extracted_field: 'parties',
      description:
        'Verificér at ekstraherede parter matcher kendte parter fra selskabsregistret (CVR)',
    },
    {
      extracted_field: 'effective_date',
      description:
        'Verificér at ikrafttrædelsesdato ikke er efter eventuel udløbsdato (expiry_date)',
    },
    {
      extracted_field: 'non_compete',
      description:
        'Verificér at konkurrenceklausulens varighed er lovlig iht. dansk funktionærlov (maks 12 måneder for funktionærer)',
    },
  ],
}

// Registrér schema ved modulindlæsning
registerSchema(ejeraftaleSchema)

export default ejeraftaleSchema
