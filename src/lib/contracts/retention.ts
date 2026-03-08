import { ContractSystemType } from '@prisma/client'

// Opbevaringsperiode i måneder baseret på CONTRACT-TYPES.md DEC-001
// -1 = permanent (så længe selskabet eksisterer)
export const RETENTION_PERIODS: Record<ContractSystemType, number> = {
  // Permanent
  VEDTAEGTER: -1,
  GF_REFERAT: -1,
  
  // 10 år (120 måneder)
  EJERAFTALE: 120,
  DIREKTOERKONTRAKT: 120,
  OVERDRAGELSESAFTALE: 120,
  OPTIONSAFTALE: 120,
  VOA: 120,
  TILTRAEDELSESDOKUMENT: 120,
  
  // 5 år (60 måneder) - bogføringsloven
  AKTIONERLAN: 60,
  PANTSAETNING: 60,
  LEJEKONTRAKT_ERHVERV: 60,
  LEASINGAFTALE: 60,
  LEVERANDOERKONTRAKT: 60,
  IT_SYSTEMAFTALE: 60,
  FORSIKRING: 60,
  KASSEKREDIT: 60,
  INTERCOMPANY_LAN: 60,
  CASH_POOL: 60,
  INTERN_SERVICEAFTALE: 60,
  ROYALTY_LICENS: 60,
  ANSAETTELSE_FUNKTIONAER: 60,
  ANSAETTELSE_IKKE_FUNKTIONAER: 60,
  VIKARAFTALE: 60,
  UDDANNELSESAFTALE: 60,
  FRATRAEDELSESAFTALE: 60,
  KONKURRENCEKLAUSUL: 60,
  PERSONALEHÅNDBOG: 60,
  SELSKABSGARANTI: 60,
  
  // 3 år (36 måneder) - forældelsesloven
  NDA: 36,
  SAMARBEJDSAFTALE: 36,
  DBA: 36,
  
  // Anbefaling: 10 år
  BESTYRELSESREFERAT: 120,
  FORRETNINGSORDEN: 120,
  DIREKTIONSINSTRUKS: 120,
}

/**
 * Beregner must_retain_until baseret på system_type og relevante datoer
 * Brugeren kan forlænge men aldrig forkorte
 */
export function calculateRetentionDate(
  systemType: ContractSystemType,
  signedDate: Date | null,
  terminationDate: Date | null,
  existingRetainUntil: Date | null
): Date | null {
  const periodMonths = RETENTION_PERIODS[systemType]
  
  // Permanent opbevaring
  if (periodMonths === -1) {
    return null // null = permanent
  }
  
  // Beregn startdato for opbevaringsperiode
  const baseDate = terminationDate || signedDate || new Date()
  
  // Tilføj opbevaringsperiode
  const calculatedDate = new Date(baseDate)
  calculatedDate.setMonth(calculatedDate.getMonth() + periodMonths)
  
  // Hvis bruger har sat en længere periode, behold den
  if (existingRetainUntil && existingRetainUntil > calculatedDate) {
    return existingRetainUntil
  }
  
  return calculatedDate
}

/**
 * Tjekker om en brugerdefineret retention-dato er gyldig
 * (må ikke være kortere end lovkravet)
 */
export function isValidRetentionDate(
  systemType: ContractSystemType,
  signedDate: Date | null,
  terminationDate: Date | null,
  proposedDate: Date
): boolean {
  const minimumDate = calculateRetentionDate(
    systemType,
    signedDate,
    terminationDate,
    null
  )
  
  // Permanent opbevaring - alle datoer er gyldige (de ignoreres)
  if (minimumDate === null) {
    return true
  }
  
  return proposedDate >= minimumDate
}