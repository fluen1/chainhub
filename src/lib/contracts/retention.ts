import { ContractSystemType } from '@prisma/client'

/**
 * Opbevaringsperioder baseret på dansk lovgivning
 * Se DEC-001 i DECISIONS.md
 */

interface RetentionRule {
  years: number
  basis: string
  fromField: 'signed_date' | 'termination_date' | 'fiscal_year_end' | 'permanent'
}

const RETENTION_RULES: Partial<Record<ContractSystemType, RetentionRule>> = {
  // Bogføringsloven § 10: 5 år fra regnskabsårets udløb
  LEJEKONTRAKT_ERHVERV: { years: 5, basis: 'Bogføringsloven § 10', fromField: 'fiscal_year_end' },
  LEVERANDOERKONTRAKT: { years: 5, basis: 'Bogføringsloven § 10', fromField: 'fiscal_year_end' },
  LEASINGAFTALE: { years: 5, basis: 'Bogføringsloven § 10', fromField: 'fiscal_year_end' },
  AKTIONERLAN: { years: 5, basis: 'Bogføringsloven § 10', fromField: 'fiscal_year_end' },
  INTERCOMPANY_LAN: { years: 5, basis: 'Bogføringsloven § 10', fromField: 'fiscal_year_end' },
  KASSEKREDIT: { years: 5, basis: 'Bogføringsloven § 10', fromField: 'fiscal_year_end' },
  FORSIKRING: { years: 5, basis: 'Bogføringsloven § 10', fromField: 'fiscal_year_end' },
  CASH_POOL: { years: 5, basis: 'Bogføringsloven § 10', fromField: 'fiscal_year_end' },
  
  // Selskabsloven §§ 50-53: permanent
  VEDTAEGTER: { years: 999, basis: 'Selskabsloven §§ 50-53', fromField: 'permanent' },
  GF_REFERAT: { years: 999, basis: 'Selskabsloven', fromField: 'permanent' },
  
  // Forældelsesloven § 3/§ 4: 10 år
  EJERAFTALE: { years: 10, basis: 'Forældelsesloven § 3', fromField: 'signed_date' },
  DIREKTOERKONTRAKT: { years: 10, basis: 'Forældelsesloven § 3', fromField: 'termination_date' },
  OVERDRAGELSESAFTALE: { years: 10, basis: 'Forældelsesloven § 3', fromField: 'signed_date' },
  OPTIONSAFTALE: { years: 10, basis: 'Forældelsesloven § 3', fromField: 'signed_date' },
  
  // Ansættelsesret: 5 år efter fratrædelse
  ANSAETTELSE_FUNKTIONAER: { years: 5, basis: 'Ligebehandlingsloven/Forskelsbehandlingsloven', fromField: 'termination_date' },
  ANSAETTELSE_IKKE_FUNKTIONAER: { years: 5, basis: 'Ligebehandlingsloven/Forskelsbehandlingsloven', fromField: 'termination_date' },
  FRATRAEDELSESAFTALE: { years: 5, basis: 'Ligebehandlingsloven/Forskelsbehandlingsloven', fromField: 'signed_date' },
  VIKARAFTALE: { years: 5, basis: 'Ansættelsesretlig dokumentation', fromField: 'termination_date' },
  UDDANNELSESAFTALE: { years: 5, basis: 'Ansættelsesretlig dokumentation', fromField: 'termination_date' },
  
  // Andre typer: 5 år som standard
  NDA: { years: 5, basis: 'Kontraktretlig dokumentation', fromField: 'termination_date' },
  SAMARBEJDSAFTALE: { years: 5, basis: 'Kontraktretlig dokumentation', fromField: 'termination_date' },
  IT_SYSTEMAFTALE: { years: 5, basis: 'Bogføringsloven § 10', fromField: 'fiscal_year_end' },
  DBA: { years: 10, basis: 'GDPR dokumentationskrav', fromField: 'termination_date' },
  BESTYRELSESREFERAT: { years: 10, basis: 'God selskabsskik', fromField: 'signed_date' },
  FORRETNINGSORDEN: { years: 999, basis: 'Selskabsstyring', fromField: 'permanent' },
  DIREKTIONSINSTRUKS: { years: 999, basis: 'Selskabsstyring', fromField: 'permanent' },
  KONKURRENCEKLAUSUL: { years: 5, basis: 'Ansættelsesretlig dokumentation', fromField: 'termination_date' },
  PERSONALEHÅNDBOG: { years: 5, basis: 'HR dokumentation', fromField: 'termination_date' },
  PANTSAETNING: { years: 10, basis: 'Forældelsesloven', fromField: 'termination_date' },
  VOA: { years: 5, basis: 'Skattemæssig dokumentation', fromField: 'fiscal_year_end' },
  INTERN_SERVICEAFTALE: { years: 5, basis: 'Transfer pricing dokumentation', fromField: 'fiscal_year_end' },
  ROYALTY_LICENS: { years: 5, basis: 'Transfer pricing dokumentation', fromField: 'fiscal_year_end' },
  TILTRAEDELSESDOKUMENT: { years: 10, basis: 'Selskabsretlig dokumentation', fromField: 'signed_date' },
  SELSKABSGARANTI: { years: 10, basis: 'Forældelsesloven', fromField: 'termination_date' },
}

const DEFAULT_RETENTION: RetentionRule = {
  years: 5,
  basis: 'Standard opbevaringsperiode',
  fromField: 'signed_date',
}

/**
 * Beregner must_retain_until baseret på kontrakttype og relevante datoer
 * Brugeren kan forlænge men aldrig forkorte under lovkravet
 */
export function calculateRetentionDate(
  systemType: ContractSystemType,
  signedDate: Date | null,
  terminationDate: Date | null,
  userProvidedRetention: Date | null
): Date | null {
  const rule = RETENTION_RULES[systemType] || DEFAULT_RETENTION
  
  // Permanent opbevaring
  if (rule.fromField === 'permanent') {
    // Sæt til 100 år fra nu som "permanent"
    const permanent = new Date()
    permanent.setFullYear(permanent.getFullYear() + 100)
    return permanent
  }
  
  let baseDate: Date | null = null
  
  switch (rule.fromField) {
    case 'signed_date':
      baseDate = signedDate
      break
    case 'termination_date':
      baseDate = terminationDate || signedDate
      break
    case 'fiscal_year_end':
      // Beregn udgangen af regnskabsåret (antager kalenderår)
      const referenceDate = terminationDate || signedDate || new Date()
      baseDate = new Date(referenceDate.getFullYear(), 11, 31) // 31. december
      break
  }
  
  if (!baseDate) {
    // Hvis ingen basisdato, brug nuværende dato
    baseDate = new Date()
  }
  
  // Beregn opbevaringsslutdato
  const calculatedRetention = new Date(baseDate)
  calculatedRetention.setFullYear(calculatedRetention.getFullYear() + rule.years)
  
  // Bruger kan forlænge men ikke forkorte
  if (userProvidedRetention && userProvidedRetention > calculatedRetention) {
    return userProvidedRetention
  }
  
  return calculatedRetention
}

/**
 * Henter opbevaringsregel for en kontrakttype
 */
export function getRetentionRule(systemType: ContractSystemType): RetentionRule {
  return RETENTION_RULES[systemType] || DEFAULT_RETENTION
}