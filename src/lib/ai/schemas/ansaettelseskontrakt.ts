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

const ansaettelseskontraktSchema: ContractSchema = {
  contract_type: 'ANSAETTELSESKONTRAKT',
  schema_version: 'v1.0.0',
  display_name: 'Ansættelseskontrakt',

  tool_definition: {
    name: 'extract_ansaettelseskontrakt',
    description:
      'Ekstraher strukturerede data fra en dansk ansættelseskontrakt. Returnér alle felter med value, claude_confidence, source_page og source_text.',
    input_schema: {
      type: 'object',
      properties: {
        employee_name: extractedField('Medarbejderens fulde navn', {
          type: 'string',
          description: 'Medarbejderens fulde navn',
        }),

        position_title: extractedField('Stillingsbetegnelse / jobtitel. Null hvis ikke angivet.', {
          type: ['string', 'null'] as unknown as 'string',
          description: 'Stillingsbetegnelse som angivet i kontrakten',
        }),

        employer_name: extractedField('Arbejdsgiverens fulde navn (person eller selskab)', {
          type: 'string',
          description: 'Arbejdsgiverens fulde navn',
        }),

        start_date: extractedField('Ansættelsens startdato (ISO 8601 format: YYYY-MM-DD)', {
          type: 'string',
          description: 'Dato i format YYYY-MM-DD',
        }),

        end_date: extractedField(
          'Ansættelsens slutdato ved tidsbegrænset ansættelse (ISO 8601 format: YYYY-MM-DD). Null hvis tidsubestemt.',
          {
            type: ['string', 'null'] as unknown as 'string',
            description: 'Dato i format YYYY-MM-DD, eller null hvis tidsubestemt',
          }
        ),

        salary_monthly_dkk: extractedField(
          'Månedlig grundløn i DKK ekskl. tillæg og pension. Null hvis ikke angivet.',
          {
            type: ['number', 'null'] as unknown as 'number',
            description: 'Månedlig grundløn i DKK (positivt tal)',
            minimum: 0,
          }
        ),

        notice_employee_months: extractedField(
          'Medarbejderens opsigelsesvarsel over for arbejdsgiver i måneder. Null hvis ikke angivet.',
          {
            type: ['number', 'null'] as unknown as 'number',
            description: 'Opsigelsesvarsel fra medarbejder i måneder',
            minimum: 0,
          }
        ),

        notice_employer_months: extractedField(
          'Arbejdsgiverens opsigelsesvarsel over for medarbejder i måneder. Null hvis ikke angivet.',
          {
            type: ['number', 'null'] as unknown as 'number',
            description: 'Opsigelsesvarsel fra arbejdsgiver i måneder',
            minimum: 0,
          }
        ),

        working_hours_weekly: extractedField(
          'Ugentlig arbejdstid i timer. Null hvis ikke specificeret.',
          {
            type: ['number', 'null'] as unknown as 'number',
            description: 'Ugentlig arbejdstid i timer (0-60)',
            minimum: 0,
            maximum: 60,
          }
        ),

        vacation_days: extractedField(
          'Antal feriedage pr. år. Null hvis ikke specificeret (antag ferieloven gælder).',
          {
            type: ['number', 'null'] as unknown as 'number',
            description: 'Feriedage pr. år (0-60)',
            minimum: 0,
            maximum: 60,
          }
        ),

        non_compete: extractedField(
          'Konkurrenceklausul. Angiv om den er til stede og dens varighed i måneder.',
          {
            type: 'object',
            properties: {
              present: {
                type: 'boolean',
                description: 'Er der en konkurrenceklausul?',
              },
              duration_months: {
                type: 'number',
                description: 'Varighed i måneder (0 hvis ikke angivet eller ingen klausul)',
              },
            },
            required: ['present', 'duration_months'],
          }
        ),

        pension_pct: extractedField(
          'Pensionsbidrag i procent af løn (arbejdsgivers andel). Null hvis ikke specificeret.',
          {
            type: ['number', 'null'] as unknown as 'number',
            description: 'Pensionsbidrag i procent (0-100)',
            minimum: 0,
            maximum: 100,
          }
        ),

        ...COMMON_TOOL_PROPERTIES,
      },
      required: ['employee_name', 'employer_name', 'start_date'],
    },
  },

  field_metadata: {
    employee_name: {
      legal_critical: true,
      required: true,
      auto_accept_threshold: 0.95,
      description: 'Medarbejderens navn — fundamental identifikation',
    },
    position_title: {
      legal_critical: false,
      required: false,
      auto_accept_threshold: 0.9,
      description: 'Stillingsbetegnelse — relevant for rolleforståelse',
    },
    employer_name: {
      legal_critical: true,
      required: true,
      auto_accept_threshold: 0.95,
      description: 'Arbejdsgiverens navn — kontraktpart',
    },
    start_date: {
      legal_critical: true,
      required: true,
      auto_accept_threshold: 0.9,
      description: 'Startdato — ansættelsens begyndelse',
    },
    end_date: {
      legal_critical: false,
      required: false,
      auto_accept_threshold: 0.9,
      description: 'Slutdato — null betyder tidsubestemt ansættelse',
    },
    salary_monthly_dkk: {
      legal_critical: true,
      required: false,
      auto_accept_threshold: 0.9,
      description: 'Grundløn — kerneøkonomisk parameter',
    },
    notice_employee_months: {
      legal_critical: true,
      required: false,
      auto_accept_threshold: 0.85,
      description: 'Medarbejderens opsigelsesvarsel — planlægningsrelevant',
    },
    notice_employer_months: {
      legal_critical: true,
      required: false,
      auto_accept_threshold: 0.85,
      description: 'Arbejdsgiverens opsigelsesvarsel — kritisk for personplanlægning',
    },
    working_hours_weekly: {
      legal_critical: false,
      required: false,
      auto_accept_threshold: 0.85,
      description: 'Ugentlig arbejdstid — fuldtid/deltid',
    },
    vacation_days: {
      legal_critical: false,
      required: false,
      auto_accept_threshold: 0.8,
      description: 'Feriedage — HR-relevant',
    },
    non_compete: {
      legal_critical: true,
      required: false,
      auto_accept_threshold: 0.8,
      description: 'Konkurrenceklausul — begrænser medarbejderens muligheder efter ansættelse',
    },
    pension_pct: {
      legal_critical: false,
      required: false,
      auto_accept_threshold: 0.85,
      description: 'Pensionsbidrag — lønomkostningsrelevant',
    },
  },

  system_prompt: `Du er ekspert i danske ansættelseskontrakter med 20+ års erfaring i ansættelsesret og funktionærloven.

Du ekstraherer felter for ChainHub, et portfolio management system for kædegrupper der co-ejer lokationsselskaber med lokale partnere.

## Domænekontekst
Ansættelseskontrakten er typisk for en medarbejder ansat i et lokationsselskab (ApS). Arbejdsgiver er oftest lokationsselskabet. Funktionærloven gælder for de fleste administrative medarbejdere. Konkurrenceklausuler er underlagt lov om ansættelsesbeviser og konkurrenceklausuler.

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

## Løn og tillæg
Adskil grundløn fra variable tillæg, bonusser og pension. Rapportér kun grundlønnen i salary_monthly_dkk. Beskriv øvrige lønkomponenter i additional_findings.

## Opsigelsesvarsel
Funktionærloven angiver minimumsvarsler baseret på anciennitet. Kontrakten kan angive længere varsler. Rapportér det kontraktuelle varsel — ikke lovens minimum.

## Datoer
Returner datoer i ISO 8601 format (YYYY-MM-DD). Angiv null for end_date hvis ansættelsen er tidsubestemt.

## Sprog
Dokumenter er på dansk. Returner feltværdier på dansk hvor relevant. Enum-værdier returneres på engelsk som angivet.

## Yderligere fund
Brug additional_findings til at rapportere usædvanlige klausuler, særlige betingelser (bonus, firmabil, aktieoptioner mv.) eller bemærkelsesværdige observationer. Brug extraction_warnings til at rapportere problemer med ekstrationsqualiteten.`,

  user_prompt_prefix:
    'Analyser denne ansættelseskontrakt og ekstraher alle felter via extract_ansaettelseskontrakt tool.',

  extraction_model: 'claude-sonnet-4-6',

  sanity_rules: [
    {
      field: 'salary_monthly_dkk',
      check: (value) => {
        if (value == null) return true // valgfrit felt
        return typeof value === 'number' && value > 0
      },
      message: 'Månedlig løn skal være et positivt tal',
    },
    {
      field: 'working_hours_weekly',
      check: (value) => {
        if (value == null) return true // valgfrit felt
        return typeof value === 'number' && value >= 0 && value <= 60
      },
      message: 'Ugentlig arbejdstid skal være mellem 0 og 60 timer',
    },
    {
      field: 'vacation_days',
      check: (value) => {
        if (value == null) return true // valgfrit felt
        return typeof value === 'number' && value >= 0 && value <= 60
      },
      message: 'Feriedage skal være mellem 0 og 60 dage',
    },
  ],

  cross_validation_rules: [
    {
      extracted_field: 'employer_name',
      description: 'Verificér at arbejdsgiveren matcher det kendte lokationsselskab (CVR)',
    },
    {
      extracted_field: 'non_compete',
      description:
        'Verificér at konkurrenceklausulens varighed er lovlig iht. dansk ret (maks 12 måneder for funktionærer)',
    },
    {
      extracted_field: 'notice_employer_months',
      description: 'Verificér at opsigelsesvarsel overholder funktionærlovens minimumskrav',
    },
  ],
}

// Registrér schema ved modulindlæsning
registerSchema(ansaettelseskontraktSchema)

export default ansaettelseskontraktSchema
