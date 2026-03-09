import { ContractSystemType } from '@prisma/client'

// Opbevaringsregler per system_type jf. CONTRACT-TYPES.md v0.5 DEC-001
// Perioder i år; -1 = permanent

type RetentionRule = {
  years: number | 'permanent'
  basis: 'signed_date' | 'termination_date' | 'expiry_date' | 'fiscal_year' | 'permanent'
  law: string
}

const RETENTION_RULES: Record<ContractSystemType, RetentionRule> = {
  // PERMANENT
  VEDTAEGTER: {
    years: 'permanent',
    basis: 'permanent',
    law: 'Selskabsloven §§ 50-53',
  },
  GF_REFERAT: {
    years: 'permanent',
    basis: 'permanent',
    law: 'Selskabsloven § 100',
  },

  // 10 ÅR (fra kontraktophør/underskrift)
  EJERAFTALE: { years: 10, basis: 'termination_date', law: 'Forældelsesloven § 4' },
  DIREKTOERKONTRAKT: { years: 10, basis: 'termination_date', law: 'Forældelsesloven § 4' },
  OVERDRAGELSESAFTALE: { years: 10, basis: 'signed_date', law: 'Forældelsesloven § 4' },
  OPTIONSAFTALE: { years: 10, basis: 'signed_date', law: 'Forældelsesloven § 4' },
  VOA: { years: 10, basis: 'signed_date', law: 'Forældelsesloven § 4' },
  TILTRAEDELSESDOKUMENT: { years: 10, basis: 'signed_date', law: 'Forældelsesloven § 4' },

  // 5 ÅR (fra regnskabsårets udløb eller fratrædelse)
  AKTIONERLAN: { years: 5, basis: 'fiscal_year', law: 'Bogføringsloven § 10' },
  PANTSAETNING: { years: 5, basis: 'termination_date', law: 'Bogføringsloven § 10' },
  LEJEKONTRAKT_ERHVERV: { years: 5, basis: 'termination_date', law: 'Bogføringsloven § 10' },
  LEASINGAFTALE: { years: 5, basis: 'termination_date', law: 'Bogføringsloven § 10' },
  LEVERANDOERKONTRAKT: { years: 5, basis: 'termination_date', law: 'Bogføringsloven § 10' },
  IT_SYSTEMAFTALE: { years: 5, basis: 'termination_date', law: 'Bogføringsloven § 10' },
  FORSIKRING: { years: 5, basis: 'termination_date', law: 'Bogføringsloven § 10' },
  KASSEKREDIT: { years: 5, basis: 'termination_date', law: 'Bogføringsloven § 10' },
  INTERCOMPANY_LAN: { years: 5, basis: 'fiscal_year', law: 'Bogføringsloven § 10' },
  CASH_POOL: { years: 5, basis: 'fiscal_year', law: 'Bogføringsloven § 10' },
  INTERN_SERVICEAFTALE: { years: 5, basis: 'fiscal_year', law: 'Bogføringsloven § 10' },
  ROYALTY_LICENS: { years: 5, basis: 'fiscal_year', law: 'Bogføringsloven § 10' },
  ANSAETTELSE_FUNKTIONAER: {
    years: 5,
    basis: 'termination_date',
    law: '5 år efter fratrædelse',
  },
  ANSAETTELSE_IKKE_FUNKTIONAER: {
    years: 5,
    basis: 'termination_date',
    law: '5 år efter fratrædelse',
  },
  VIKARAFTALE: { years: 5, basis: 'termination_date', law: '5 år efter ophør' },
  UDDANNELSESAFTALE: { years: 5, basis: 'termination_date', law: '5 år efter ophør' },
  FRATRAEDELSESAFTALE: { years: 5, basis: 'signed_date', law: '5 år efter indgåelse' },
  KONKURRENCEKLAUSUL: { years: 5, basis: 'expiry_date', law: '5 år efter udløb' },
  PERSONALEHAANDBOG: { years: 5, basis: 'termination_date', law: '5 år efter erstatning' },
  SELSKABSGARANTI: { years: 5, basis: 'termination_date', law: 'Bogføringsloven § 10' },

  // 3 ÅR (fra ophør)
  NDA: { years: 3, basis: 'termination_date', law: 'Forældelsesloven § 3' },
  SAMARBEJDSAFTALE: { years: 3, basis: 'termination_date', law: 'Forældelsesloven § 3' },
  DBA: { years: 3, basis: 'termination_date', law: 'Følger hovedaftalen' },

  // INGEN LOVKRAV (anbefaling)
  BESTYRELSESREFERAT: { years: 'permanent', basis: 'permanent', law: 'Anbefaling: permanent' },
  FORRETNINGSORDEN: { years: 'permanent', basis: 'permanent', law: 'Anbefaling: permanent' },
  DIREKTIONSINSTRUKS: { years: 10, basis: 'termination_date', law: 'Anbefaling: 10 år' },
}

/**
 * Beregner must_retain_until dato baseret på system_type og relevante datoer.
 * DEC-001: Auto-beregnet af systemet. Brugeren kan forlænge men aldrig forkorte.
 */
export function calculateRetentionDate(
  systemType: ContractSystemType,
  dates: {
    signedDate?: Date | null
    terminationDate?: Date | null
    expiryDate?: Date | null
  }
): Date | null {
  const rule = RETENTION_RULES[systemType]
  if (!rule) return null

  // Permanent opbevaring — returnér en fjern fremtidsdato som sentinel
  if (rule.years === 'permanent') {
    return new Date('9999-12-31')
  }

  // Find base-dato baseret på rule.basis
  let baseDate: Date | null = null

  switch (rule.basis) {
    case 'signed_date':
      baseDate = dates.signedDate ?? null
      break
    case 'termination_date':
      // Brug terminationDate hvis tilgængelig, ellers expiryDate, ellers signedDate
      baseDate = dates.terminationDate ?? dates.expiryDate ?? dates.signedDate ?? null
      break
    case 'expiry_date':
      baseDate = dates.expiryDate ?? dates.terminationDate ?? dates.signedDate ?? null
      break
    case 'fiscal_year':
      // Fra regnskabsårets udløb — brug signedDate eller terminationDate
      const refDate = dates.terminationDate ?? dates.expiryDate ?? dates.signedDate
      if (refDate) {
        // Regnskabsåret udløber typisk 31. december
        baseDate = new Date(refDate.getFullYear(), 11, 31) // 31. dec samme år
      }
      break
  }

  if (!baseDate) return null

  // Tilføj antal år
  const retentionDate = new Date(baseDate)
  retentionDate.setFullYear(retentionDate.getFullYear() + (rule.years as number))

  return retentionDate
}

/**
 * Returnerer lovhjemmel for opbevaringspligten
 */
export function getRetentionLaw(systemType: ContractSystemType): string {
  return RETENTION_RULES[systemType]?.law ?? 'Ikke specificeret'
}

/**
 * Returnerer antal år for opbevaringspligten (eller 'permanent')
 */
export function getRetentionYears(systemType: ContractSystemType): number | 'permanent' {
  return RETENTION_RULES[systemType]?.years ?? 5
}