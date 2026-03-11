import { z } from 'zod'

// Sensitivity minimum pr. ContractSystemType
export const SENSITIVITY_MINIMUM = {
  EJERAFTALE: 'STRENGT_FORTROLIG',
  DIREKTOERKONTRAKT: 'STRENGT_FORTROLIG',
  OVERDRAGELSESAFTALE: 'STRENGT_FORTROLIG',
  AKTIONAERLAAN: 'STRENGT_FORTROLIG',
  PANTSAETNING: 'STRENGT_FORTROLIG',
  VEDTAEGTER: 'INTERN',
  ANSAETTELSE_FUNKTIONAER: 'FORTROLIG',
  ANSAETTELSE_IKKE_FUNKTIONAER: 'FORTROLIG',
  VIKARAFTALE: 'STANDARD',
  UDDANNELSESAFTALE: 'STANDARD',
  FRATRAEDELSESAFTALE: 'FORTROLIG',
  KONKURRENCEKLAUSUL: 'FORTROLIG',
  PERSONALHAANDBOG: 'INTERN',
  LEJEKONTRAKT_ERHVERV: 'INTERN',
  LEASINGAFTALE: 'INTERN',
  LEVERANDOERKONTRAKT: 'INTERN',
  SAMARBEJDSAFTALE: 'FORTROLIG',
  NDA: 'FORTROLIG',
  IT_SYSTEMAFTALE: 'INTERN',
  DBA: 'INTERN',
  FORSIKRING: 'INTERN',
  GF_REFERAT: 'FORTROLIG',
  BESTYRELSESREFERAT: 'FORTROLIG',
  FORRETNINGSORDEN: 'FORTROLIG',
  DIREKTIONSINSTRUKS: 'FORTROLIG',
  VOA: 'STRENGT_FORTROLIG',
  INTERN_SERVICEAFTALE: 'STRENGT_FORTROLIG',
  ROYALTY_LICENS: 'STRENGT_FORTROLIG',
  OPTIONSAFTALE: 'STRENGT_FORTROLIG',
  TILTRAEDELSESDOKUMENT: 'STRENGT_FORTROLIG',
  KASSEKREDIT: 'FORTROLIG',
  CASH_POOL: 'STRENGT_FORTROLIG',
  INTERCOMPANY_LAAN: 'STRENGT_FORTROLIG',
  SELSKABSGARANTI: 'STRENGT_FORTROLIG',
} as const

export type ContractSystemTypeKey = keyof typeof SENSITIVITY_MINIMUM
export type SensitivityLevelValue = 'PUBLIC' | 'STANDARD' | 'INTERN' | 'FORTROLIG' | 'STRENGT_FORTROLIG'

const SENSITIVITY_ORDER: SensitivityLevelValue[] = [
  'PUBLIC', 'STANDARD', 'INTERN', 'FORTROLIG', 'STRENGT_FORTROLIG',
]

export function meetsMinimumSensitivity(
  actual: SensitivityLevelValue,
  minimum: SensitivityLevelValue
): boolean {
  return SENSITIVITY_ORDER.indexOf(actual) >= SENSITIVITY_ORDER.indexOf(minimum)
}

export const CONTRACT_SYSTEM_TYPES = Object.keys(SENSITIVITY_MINIMUM) as ContractSystemTypeKey[]

// Display-navne til UI
export const CONTRACT_TYPE_LABELS: Record<ContractSystemTypeKey, string> = {
  EJERAFTALE: 'Ejeraftale',
  DIREKTOERKONTRAKT: 'Direktørkontrakt',
  OVERDRAGELSESAFTALE: 'Overdragelsesaftale (SPA)',
  AKTIONAERLAAN: 'Aktionærlåneaftale',
  PANTSAETNING: 'Pantsætningsaftale',
  VEDTAEGTER: 'Vedtægter',
  ANSAETTELSE_FUNKTIONAER: 'Ansættelseskontrakt — Funktionær',
  ANSAETTELSE_IKKE_FUNKTIONAER: 'Ansættelseskontrakt — Ikke-funktionær',
  VIKARAFTALE: 'Vikaraftale',
  UDDANNELSESAFTALE: 'Uddannelsesaftale (elev)',
  FRATRAEDELSESAFTALE: 'Fratrædelsesaftale',
  KONKURRENCEKLAUSUL: 'Konkurrenceklausulaftale',
  PERSONALHAANDBOG: 'Personalehåndbog',
  LEJEKONTRAKT_ERHVERV: 'Lejekontrakt — Erhverv',
  LEASINGAFTALE: 'Leasingaftale',
  LEVERANDOERKONTRAKT: 'Leverandørkontrakt',
  SAMARBEJDSAFTALE: 'Samarbejdsaftale',
  NDA: 'Fortrolighedsaftale (NDA)',
  IT_SYSTEMAFTALE: 'IT-/Systemaftale',
  DBA: 'Databehandleraftale (DBA)',
  FORSIKRING: 'Forsikringsaftale',
  GF_REFERAT: 'Generalforsamlingsreferat',
  BESTYRELSESREFERAT: 'Bestyrelsesreferat',
  FORRETNINGSORDEN: 'Forretningsorden for bestyrelse',
  DIREKTIONSINSTRUKS: 'Direktionsinstruks',
  VOA: 'Virksomhedsoverdragelsesaftale (VOA)',
  INTERN_SERVICEAFTALE: 'Intern serviceaftale (Management Fee)',
  ROYALTY_LICENS: 'Royalty-/Licensaftale',
  OPTIONSAFTALE: 'Optionsaftale (andele)',
  TILTRAEDELSESDOKUMENT: 'Tiltrædelsesdokument til ejeraftale',
  KASSEKREDIT: 'Kassekreditaftale',
  CASH_POOL: 'Cash pool-aftale',
  INTERCOMPANY_LAAN: 'Intercompany-lån',
  SELSKABSGARANTI: 'Selskabsgaranti / Kaution',
}

export const createContractSchema = z.object({
  companyId: z.string().uuid(),
  systemType: z.string().min(1),
  displayName: z.string().min(1, 'Kontraktnavn er påkrævet').max(255),
  sensitivity: z.enum(['PUBLIC', 'STANDARD', 'INTERN', 'FORTROLIG', 'STRENGT_FORTROLIG']),
  status: z.enum(['UDKAST', 'TIL_REVIEW', 'TIL_UNDERSKRIFT', 'AKTIV', 'UDLOEBET', 'OPSAGT', 'FORNYET', 'ARKIVERET']).optional(),
  effectiveDate: z.string().optional(),
  expiryDate: z.string().optional().or(z.literal('')),
  noticePeriodDays: z.coerce.number().int().min(0).optional(),
  notes: z.string().optional(),
  reminder90Days: z.boolean().optional(),
  reminder30Days: z.boolean().optional(),
  reminder7Days: z.boolean().optional(),
  parentContractId: z.string().uuid().optional().or(z.literal('')),
})

export const updateContractStatusSchema = z.object({
  contractId: z.string().uuid(),
  status: z.enum(['UDKAST', 'TIL_REVIEW', 'TIL_UNDERSKRIFT', 'AKTIV', 'UDLOEBET', 'OPSAGT', 'FORNYET', 'ARKIVERET']),
  note: z.string().optional(),
})

export type CreateContractInput = z.infer<typeof createContractSchema>
export type UpdateContractStatusInput = z.infer<typeof updateContractStatusSchema>
