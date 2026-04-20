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

const lejekontraktSchema: ContractSchema = {
  contract_type: 'LEJEKONTRAKT',
  schema_version: 'v1.0.0',
  display_name: 'Lejekontrakt',

  tool_definition: {
    name: 'extract_lejekontrakt',
    description:
      'Ekstraher strukturerede data fra en dansk lejekontrakt. Returnér alle felter med value, claude_confidence, source_page og source_text.',
    input_schema: {
      type: 'object',
      properties: {
        parties: extractedField(
          'Liste over aftaleparter med roller. Skal inkludere udlejer og lejer.',
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
                  enum: ['UDLEJER', 'LEJER'],
                  description: 'Partens rolle: UDLEJER eller LEJER',
                },
              },
              required: ['name', 'role'],
            },
          }
        ),

        property_address: extractedField('Lejemålets adresse inkl. etage og postnummer', {
          type: 'string',
          description: 'Fuld adresse på lejemålet',
        }),

        effective_date: extractedField(
          'Ikrafttrædelsesdato / overtagelsesdato (ISO 8601 format: YYYY-MM-DD)',
          { type: 'string', description: 'Dato i format YYYY-MM-DD' }
        ),

        expiry_date: extractedField(
          'Udløbsdato for lejekontrakten (ISO 8601 format: YYYY-MM-DD). Null hvis tidsubestemt.',
          {
            type: ['string', 'null'] as unknown as 'string',
            description: 'Dato i format YYYY-MM-DD, eller null hvis tidsubestemt',
          }
        ),

        rent_monthly_dkk: extractedField(
          'Månedlig leje i DKK ekskl. forbrug og moms. Null hvis ikke angivet.',
          {
            type: ['number', 'null'] as unknown as 'number',
            description: 'Månedlig leje i DKK (positivt tal)',
            minimum: 0,
          }
        ),

        rent_adjustment: extractedField(
          'Reguleringsklausul for lejen (fx NPI-regulering, fast stigning, markedsregulering). Null hvis ingen regulering.',
          {
            type: ['string', 'null'] as unknown as 'string',
            description: 'Beskrivelse af lejens reguleringsklausul',
          }
        ),

        deposit_dkk: extractedField('Depositum i DKK. Null hvis ikke angivet.', {
          type: ['number', 'null'] as unknown as 'number',
          description: 'Depositum i DKK (0 eller positivt tal)',
          minimum: 0,
        }),

        notice_period_months: extractedField(
          'Opsigelsesvarsel i antal måneder. Null hvis ikke angivet.',
          {
            type: ['number', 'null'] as unknown as 'number',
            description: 'Opsigelsesvarsel i måneder (1-120)',
            minimum: 1,
            maximum: 120,
          }
        ),

        permitted_use: extractedField(
          'Tilladt anvendelse af lejemålet (fx klinik, kontor, butik). Null hvis ikke specificeret.',
          {
            type: ['string', 'null'] as unknown as 'string',
            description: 'Beskrivelse af tilladt anvendelse',
          }
        ),

        sublease_allowed: extractedField('Er fremlejning tilladt? Null hvis ikke angivet.', {
          type: ['boolean', 'null'] as unknown as 'boolean',
          description:
            'True hvis fremlejning er tilladt, false hvis forbudt, null hvis ikke angivet',
        }),

        maintenance_responsibility: extractedField(
          'Vedligeholdelsespligt — hvem er ansvarlig for hvad (indvendig/udvendig). Null hvis ikke specificeret.',
          {
            type: ['string', 'null'] as unknown as 'string',
            description: 'Beskrivelse af vedligeholdelsesansvarsfordeling',
          }
        ),

        renewal_clause: extractedField(
          'Fornyelsesklausul — vilkår for forlængelse af lejekontrakten. Null hvis ingen klausul.',
          {
            type: ['string', 'null'] as unknown as 'string',
            description: 'Beskrivelse af fornyelsesklausul',
          }
        ),

        ...COMMON_TOOL_PROPERTIES,
      },
      required: ['parties', 'property_address', 'effective_date'],
    },
  },

  field_metadata: {
    parties: {
      legal_critical: true,
      required: true,
      auto_accept_threshold: 0.85,
      description: 'Udlejer og lejer — fundamentalt for lejekontraktens gyldighed',
    },
    property_address: {
      legal_critical: true,
      required: true,
      auto_accept_threshold: 0.9,
      description: 'Lejemålets adresse — identificerer det konkrete lejemål',
    },
    effective_date: {
      legal_critical: true,
      required: true,
      auto_accept_threshold: 0.9,
      description: 'Overtagelsesdato — afgørende for lejeforholdets start',
    },
    expiry_date: {
      legal_critical: true,
      required: false,
      auto_accept_threshold: 0.9,
      description: 'Udløbsdato — null betyder tidsubestemt lejemål',
    },
    rent_monthly_dkk: {
      legal_critical: true,
      required: false,
      auto_accept_threshold: 0.9,
      description: 'Månedlig leje — kerneøkonomisk parameter',
    },
    rent_adjustment: {
      legal_critical: true,
      required: false,
      auto_accept_threshold: 0.8,
      description: 'Reguleringsklausul — afgørende for fremtidige lejeudgifter',
    },
    deposit_dkk: {
      legal_critical: false,
      required: false,
      auto_accept_threshold: 0.85,
      description: 'Depositum — likviditetsrelevant',
    },
    notice_period_months: {
      legal_critical: true,
      required: false,
      auto_accept_threshold: 0.85,
      description: 'Opsigelsesvarsel — kritisk for exit-planlægning',
    },
    permitted_use: {
      legal_critical: false,
      required: false,
      auto_accept_threshold: 0.8,
      description: 'Tilladt anvendelse — compliance-relevant',
    },
    sublease_allowed: {
      legal_critical: false,
      required: false,
      auto_accept_threshold: 0.8,
      description: 'Fremlejningsret — relevant ved overdragelse',
    },
    maintenance_responsibility: {
      legal_critical: false,
      required: false,
      auto_accept_threshold: 0.75,
      description: 'Vedligeholdelsespligt — driftsøkonomisk relevant',
    },
    renewal_clause: {
      legal_critical: false,
      required: false,
      auto_accept_threshold: 0.8,
      description: 'Fornyelsesklausul — vigtig for langsigtet planlægning',
    },
  },

  system_prompt: `Du er ekspert i danske erhvervslejekontrakter med 20+ års erfaring i ejendomsret og erhvervslejeret.

Du ekstraherer felter for ChainHub, et portfolio management system for kædegrupper der co-ejer lokationsselskaber med lokale partnere.

## Domænekontekst
Lejemålet er typisk et klinik- eller kontorlejemål tilhørende en kædegruppe. Udlejer er ofte en ekstern ejendomsejer. Lejer er lokationsselskabet (ApS). Vær opmærksom på om lejekontrakten er erhvervslejeloven eller boliglejeloven — erhvervslejemål har andre regler.

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

## Leje og betalinger
Adskil månedlig leje fra aconto-forbrug, driftsbidrag og moms. Rapportér kun basislejen i rent_monthly_dkk. Beskriv alle øvrige betalinger i additional_findings.

## Datoer
Returner datoer i ISO 8601 format (YYYY-MM-DD). Hvis kun år og måned er angivet, brug den 1. i måneden. Hvis lejemålet er "tidsubestemt" eller "løbende", sæt expiry_date value til null.

## Sprog
Dokumenter er på dansk. Returner feltværdier på dansk hvor relevant (fx beskrivelser, noter). Enum-værdier returneres på engelsk som angivet.

## Yderligere fund
Brug additional_findings til at rapportere usædvanlige klausuler, manglende standardelementer eller bemærkelsesværdige observationer der ikke er dækket af de definerede felter. Brug extraction_warnings til at rapportere problemer med ekstrationsqualiteten.`,

  user_prompt_prefix:
    'Analyser denne lejekontrakt og ekstraher alle felter via extract_lejekontrakt tool.',

  extraction_model: 'claude-sonnet-4-6',

  sanity_rules: [
    {
      field: 'rent_monthly_dkk',
      check: (value) => {
        if (value == null) return true // valgfrit felt
        return typeof value === 'number' && value > 0
      },
      message: 'Månedlig leje skal være et positivt tal',
    },
    {
      field: 'deposit_dkk',
      check: (value) => {
        if (value == null) return true // valgfrit felt
        return typeof value === 'number' && value >= 0
      },
      message: 'Depositum skal være 0 eller et positivt tal',
    },
    {
      field: 'notice_period_months',
      check: (value) => {
        if (value == null) return true // valgfrit felt
        return typeof value === 'number' && value >= 1 && value <= 120
      },
      message: 'Opsigelsesvarsel skal være mellem 1 og 120 måneder',
    },
  ],

  cross_validation_rules: [
    {
      extracted_field: 'parties',
      description: 'Verificér at lejer matcher det kendte lokationsselskab (CVR)',
    },
    {
      extracted_field: 'effective_date',
      description:
        'Verificér at ikrafttrædelsesdato ikke er efter eventuel udløbsdato (expiry_date)',
    },
    {
      extracted_field: 'rent_monthly_dkk',
      description: 'Verificér at lejen er i et rimeligt interval for erhvervslejemål i Danmark',
    },
  ],
}

// Registrér schema ved modulindlæsning
registerSchema(lejekontraktSchema)

export default lejekontraktSchema
