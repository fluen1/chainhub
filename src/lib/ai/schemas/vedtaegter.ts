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

const vedtaegterSchema: ContractSchema = {
  contract_type: 'VEDTAEGTER',
  schema_version: 'v1.0.0',
  display_name: 'Vedtægter',

  tool_definition: {
    name: 'extract_vedtaegter',
    description:
      'Ekstraher strukturerede data fra danske selskabsvedtægter. Returnér alle felter med value, claude_confidence, source_page og source_text.',
    input_schema: {
      type: 'object',
      properties: {
        company_name: extractedField('Selskabets fulde navn som registreret i vedtægterne', {
          type: 'string',
          description: 'Selskabets fulde navn',
        }),

        cvr_number: extractedField('CVR-nummer (8 cifre). Null hvis ikke angivet i vedtægterne.', {
          type: ['string', 'null'] as unknown as 'string',
          description: 'CVR-nummer som 8-cifret string',
        }),

        registered_address: extractedField(
          'Selskabets registrerede hjemsted (by eller adresse). Null hvis ikke specificeret.',
          {
            type: ['string', 'null'] as unknown as 'string',
            description: 'Hjemsted eller registreret adresse',
          }
        ),

        business_purpose: extractedField(
          'Selskabets formål som angivet i vedtægterne. Null hvis ikke specificeret.',
          {
            type: ['string', 'null'] as unknown as 'string',
            description: 'Beskrivelse af selskabets formål',
          }
        ),

        share_capital_dkk: extractedField(
          'Selskabskapital / anpartskapital i DKK. Null hvis ikke angivet.',
          {
            type: ['number', 'null'] as unknown as 'number',
            description: 'Selskabskapital i DKK (positivt tal)',
            minimum: 0,
          }
        ),

        share_classes: extractedField(
          'Beskrivelse af anpartsklasser og deres rettigheder (fx A-anparter, B-anparter). Null hvis kun én klasse.',
          {
            type: ['string', 'null'] as unknown as 'string',
            description: 'Beskrivelse af anpartsklasser og særlige rettigheder',
          }
        ),

        board_size: extractedField(
          'Antal bestyrelsesmedlemmer (minimum og/eller maksimum). Null hvis ikke specificeret.',
          {
            type: ['number', 'null'] as unknown as 'number',
            description: 'Antal bestyrelsesmedlemmer (1-15)',
            minimum: 1,
            maximum: 15,
          }
        ),

        board_appointment_rules: extractedField(
          'Regler for udpegning af bestyrelsesmedlemmer — hvem udpeger hvem. Null hvis ikke specificeret.',
          {
            type: ['string', 'null'] as unknown as 'string',
            description: 'Beskrivelse af bestyrelsesudpegningsregler',
          }
        ),

        general_meeting_rules: extractedField(
          'Regler for generalforsamling (indkaldelse, stemmeregler, quorum). Null hvis ikke specificeret.',
          {
            type: ['string', 'null'] as unknown as 'string',
            description: 'Beskrivelse af generalforsamlingsregler',
          }
        ),

        dissolution_rules: extractedField(
          'Regler for selskabets opløsning (stemmekrav, procedure). Null hvis ikke specificeret.',
          {
            type: ['string', 'null'] as unknown as 'string',
            description: 'Beskrivelse af opløsningsregler',
          }
        ),

        ...COMMON_TOOL_PROPERTIES,
      },
      required: ['company_name'],
    },
  },

  field_metadata: {
    company_name: {
      legal_critical: true,
      required: true,
      auto_accept_threshold: 0.95,
      description: 'Selskabsnavn — fundamental identifikation',
    },
    cvr_number: {
      legal_critical: true,
      required: false,
      auto_accept_threshold: 0.95,
      description: 'CVR-nummer — entydigt selskabsidentifikation',
    },
    registered_address: {
      legal_critical: false,
      required: false,
      auto_accept_threshold: 0.85,
      description: 'Hjemsted — registreret forretningsadresse',
    },
    business_purpose: {
      legal_critical: false,
      required: false,
      auto_accept_threshold: 0.8,
      description: 'Formål — definerer selskabets aktivitetsområde',
    },
    share_capital_dkk: {
      legal_critical: true,
      required: false,
      auto_accept_threshold: 0.9,
      description: 'Selskabskapital — fundamentalt for selskabets kapitalgrundlag',
    },
    share_classes: {
      legal_critical: false,
      required: false,
      auto_accept_threshold: 0.8,
      description: 'Anpartsklasser — afgørende for stemme- og udbyttefordeling',
    },
    board_size: {
      legal_critical: false,
      required: false,
      auto_accept_threshold: 0.85,
      description: 'Bestyrelsesstørrelse — governance-struktur',
    },
    board_appointment_rules: {
      legal_critical: false,
      required: false,
      auto_accept_threshold: 0.8,
      description: 'Bestyrelsesudpegning — kontrol og governance',
    },
    general_meeting_rules: {
      legal_critical: false,
      required: false,
      auto_accept_threshold: 0.75,
      description: 'Generalforsamlingsregler — beslutningsprocedurer',
    },
    dissolution_rules: {
      legal_critical: false,
      required: false,
      auto_accept_threshold: 0.8,
      description: 'Opløsningsregler — exit-scenarie',
    },
  },

  system_prompt: `Du er ekspert i danske selskabsvedtægter med 20+ års erfaring i selskabsret og selskabsloven (ApS/A/S).

Du ekstraherer felter for ChainHub, et portfolio management system for kædegrupper der co-ejer lokationsselskaber med lokale partnere.

## Domænekontekst
Vedtægterne tilhører typisk et lokationsselskab (ApS) der er co-ejet af kædegruppen og en lokal partner. Vær opmærksom på anpartsklasser og særlige stemmerettigheder som kan afvige fra ejerandele. Vedtægterne er det juridiske fundament for selskabets drift.

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

## Kapital og anparter
Selskabskapitalen er den samlede nominelle kapital. Angiv den i DKK. Beskriv alle anpartsklasser og deres særlige rettigheder (stemme, udbytte, likvidation) i share_classes.

## Sprog
Dokumenter er på dansk. Returner feltværdier på dansk hvor relevant (fx beskrivelser, regler). Enum-værdier returneres på engelsk som angivet.

## Yderligere fund
Brug additional_findings til at rapportere usædvanlige klausuler, ændringer fra standardvedtægter eller bemærkelsesværdige observationer der ikke er dækket af de definerede felter. Brug extraction_warnings til at rapportere problemer med ekstrationsqualiteten.`,

  user_prompt_prefix:
    'Analyser disse selskabsvedtægter og ekstraher alle felter via extract_vedtaegter tool.',

  extraction_model: 'claude-sonnet-4-20250514',

  sanity_rules: [
    {
      field: 'share_capital_dkk',
      check: (value) => {
        if (value == null) return true // valgfrit felt
        return typeof value === 'number' && value > 0
      },
      message: 'Selskabskapital skal være et positivt tal',
    },
    {
      field: 'board_size',
      check: (value) => {
        if (value == null) return true // valgfrit felt
        return typeof value === 'number' && value >= 1 && value <= 15
      },
      message: 'Bestyrelsesstørrelse skal være mellem 1 og 15 medlemmer',
    },
  ],

  cross_validation_rules: [
    {
      extracted_field: 'company_name',
      description: 'Verificér at selskabsnavnet matcher det kendte selskabsnavn fra CVR',
    },
    {
      extracted_field: 'cvr_number',
      description: 'Verificér at CVR-nummeret er gyldigt og matcher selskabet i CVR-registret',
    },
    {
      extracted_field: 'share_capital_dkk',
      description: 'Verificér at selskabskapitalen opfylder minimumskravet (40.000 DKK for ApS)',
    },
  ],
}

// Registrér schema ved modulindlæsning
registerSchema(vedtaegterSchema)

export default vedtaegterSchema
