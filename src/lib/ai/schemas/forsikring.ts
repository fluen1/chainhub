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

const forsikringSchema: ContractSchema = {
  contract_type: 'FORSIKRING',
  schema_version: 'v1.0.0',
  display_name: 'Forsikring',

  tool_definition: {
    name: 'extract_forsikring',
    description:
      'Ekstraher strukturerede data fra en dansk forsikringspolice. Returnér alle felter med value, claude_confidence, source_page og source_text.',
    input_schema: {
      type: 'object',
      properties: {
        insurer: extractedField(
          'Forsikringsselskabets navn (fx Tryg, Alm. Brand, Topdanmark)',
          { type: 'string', description: 'Forsikringsselskabets fulde navn' },
        ),

        policy_number: extractedField(
          'Policenummer / aftalenummer. Null hvis ikke angivet.',
          {
            type: ['string', 'null'] as unknown as 'string',
            description: 'Policenummer som angivet i dokumentet',
          },
        ),

        insured_party: extractedField(
          'Den forsikrede parts fulde navn (person eller selskab)',
          { type: 'string', description: 'Den forsikredes fulde navn' },
        ),

        coverage_type: extractedField(
          'Dækningstype (fx erhvervsansvar, produktansvar, bygningsforsikring, tingsforsikring). Null hvis ikke specificeret.',
          {
            type: ['string', 'null'] as unknown as 'string',
            description: 'Beskrivelse af forsikringens dækningstype',
          },
        ),

        coverage_amount_dkk: extractedField(
          'Forsikringssum / maksimal dækning i DKK. Null hvis ikke angivet.',
          {
            type: ['number', 'null'] as unknown as 'number',
            description: 'Forsikringssum i DKK (positivt tal)',
            minimum: 0,
          },
        ),

        premium_annual_dkk: extractedField(
          'Årlig præmie i DKK ekskl. afgifter. Null hvis ikke angivet.',
          {
            type: ['number', 'null'] as unknown as 'number',
            description: 'Årlig præmie i DKK (positivt tal)',
            minimum: 0,
          },
        ),

        effective_date: extractedField(
          'Ikrafttrædelsesdato for policen (ISO 8601 format: YYYY-MM-DD)',
          { type: 'string', description: 'Dato i format YYYY-MM-DD' },
        ),

        expiry_date: extractedField(
          'Udløbsdato for policen (ISO 8601 format: YYYY-MM-DD). Null hvis løbende uden fast udløb.',
          {
            type: ['string', 'null'] as unknown as 'string',
            description: 'Dato i format YYYY-MM-DD, eller null hvis løbende',
          },
        ),

        deductible_dkk: extractedField(
          'Selvrisiko i DKK pr. skade. Null hvis ingen selvrisiko eller ikke angivet.',
          {
            type: ['number', 'null'] as unknown as 'number',
            description: 'Selvrisiko i DKK (0 eller positivt tal)',
            minimum: 0,
          },
        ),

        exclusions: extractedField(
          'Liste over undtagelser og eksklussioner i forsikringsdækningen. Tom liste hvis ingen undtagelser er angivet.',
          {
            type: 'array',
            items: {
              type: 'string',
              description: 'Beskrivelse af en enkelt undtagelse',
            },
          },
        ),

        auto_renewal: extractedField(
          'Fornyes policen automatisk? Null hvis ikke angivet.',
          {
            type: ['boolean', 'null'] as unknown as 'boolean',
            description: 'True hvis automatisk fornyelse, false hvis manuel fornyelse, null hvis ikke angivet',
          },
        ),

        ...COMMON_TOOL_PROPERTIES,
      },
      required: ['insurer', 'insured_party', 'effective_date'],
    },
  },

  field_metadata: {
    insurer: {
      legal_critical: true,
      required: true,
      auto_accept_threshold: 0.9,
      description: 'Forsikringsselskab — identificerer kontraktparten',
    },
    policy_number: {
      legal_critical: false,
      required: false,
      auto_accept_threshold: 0.9,
      description: 'Policenummer — nødvendig ved skadesanmeldelse',
    },
    insured_party: {
      legal_critical: true,
      required: true,
      auto_accept_threshold: 0.9,
      description: 'Den forsikrede — verificerer dækningens omfang',
    },
    coverage_type: {
      legal_critical: true,
      required: false,
      auto_accept_threshold: 0.85,
      description: 'Dækningstype — afgørende for risikovurdering',
    },
    coverage_amount_dkk: {
      legal_critical: true,
      required: false,
      auto_accept_threshold: 0.9,
      description: 'Forsikringssum — maksimal dækning ved skade',
    },
    premium_annual_dkk: {
      legal_critical: false,
      required: false,
      auto_accept_threshold: 0.9,
      description: 'Årlig præmie — økonomibudgettering',
    },
    effective_date: {
      legal_critical: true,
      required: true,
      auto_accept_threshold: 0.9,
      description: 'Ikrafttrædelsesdato — dækning gælder fra denne dato',
    },
    expiry_date: {
      legal_critical: true,
      required: false,
      auto_accept_threshold: 0.9,
      description: 'Udløbsdato — kritisk for at sikre kontinuerlig dækning',
    },
    deductible_dkk: {
      legal_critical: false,
      required: false,
      auto_accept_threshold: 0.85,
      description: 'Selvrisiko — relevant for skadesberegning',
    },
    exclusions: {
      legal_critical: true,
      required: false,
      auto_accept_threshold: 0.8,
      description: 'Undtagelser — afgørende for at forstå dækningens begrænsninger',
    },
    auto_renewal: {
      legal_critical: false,
      required: false,
      auto_accept_threshold: 0.8,
      description: 'Automatisk fornyelse — vigtigt for kontraktstyring',
    },
  },

  system_prompt: `Du er ekspert i danske erhvervsforsikringspolicer med 20+ års erfaring i forsikringsret.

Du ekstraherer felter for ChainHub, et portfolio management system for kædegrupper der co-ejer lokationsselskaber med lokale partnere.

## Domænekontekst
Forsikringen dækker typisk erhvervsaktiviteter i klinik- eller kontormiljø. Den forsikrede part er oftest et lokationsselskab (ApS). Vær opmærksom på om der er tale om en tegningsbekræftelse, police eller certifikat — alle er gyldige forsikringsdokumenter.

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

## Forsikringssum og præmie
Adskil forsikringssum (coverage_amount_dkk) fra præmie (premium_annual_dkk). Forsikringssummen er det maksimale dækningsbeløb. Præmien er hvad der betales. Hvis præmien er angivet månedligt, konverter til årlig og noter dette.

## Datoer
Returner datoer i ISO 8601 format (YYYY-MM-DD). Policers forsikringsperiode starter typisk kl. 00:00 på ikrafttrædelsesdatoen. Angiv kun datoen, ikke tidspunktet.

## Sprog
Dokumenter er på dansk. Returner feltværdier på dansk hvor relevant (fx beskrivelser, undtagelser). Enum-værdier returneres på engelsk som angivet.

## Yderligere fund
Brug additional_findings til at rapportere usædvanlige klausuler, særlige betingelser eller bemærkelsesværdige observationer der ikke er dækket af de definerede felter. Brug extraction_warnings til at rapportere problemer med ekstrationsqualiteten.`,

  user_prompt_prefix: 'Analyser denne forsikringspolice og ekstraher alle felter via extract_forsikring tool.',

  extraction_model: 'claude-sonnet-4-20250514',

  sanity_rules: [
    {
      field: 'coverage_amount_dkk',
      check: (value) => {
        if (value == null) return true // valgfrit felt
        return typeof value === 'number' && value > 0
      },
      message: 'Forsikringssum skal være et positivt tal',
    },
    {
      field: 'premium_annual_dkk',
      check: (value) => {
        if (value == null) return true // valgfrit felt
        return typeof value === 'number' && value > 0
      },
      message: 'Præmie skal være et positivt tal',
    },
    {
      field: 'expiry_date',
      check: (value, allFields) => {
        if (value == null) return true // valgfrit felt
        const effective = allFields['effective_date'] as string | null
        if (!effective) return true
        return new Date(value as string) > new Date(effective)
      },
      message: 'Udløbsdato skal være efter ikrafttrædelsesdato',
    },
  ],

  cross_validation_rules: [
    {
      extracted_field: 'insured_party',
      description: 'Verificér at den forsikrede part matcher det kendte lokationsselskab (CVR)',
    },
    {
      extracted_field: 'effective_date',
      description: 'Verificér at ikrafttrædelsesdato ikke er efter eventuel udløbsdato (expiry_date)',
    },
    {
      extracted_field: 'coverage_amount_dkk',
      description: 'Verificér at forsikringssummen er tilstrækkelig ift. selskabets aktiviteter',
    },
  ],
}

// Registrér schema ved modulindlæsning
registerSchema(forsikringSchema)

export default forsikringSchema
