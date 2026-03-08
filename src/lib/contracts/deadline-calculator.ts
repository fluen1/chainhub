/**
 * Deadline Calculator for ChainHub
 * Beregner adviseringsdatoer baseret på kontrakttype og datoer
 * 
 * Logik:
 * - Faste kontrakter: advis 90, 30, 7 dage før expiry_date
 * - Løbende kontrakter: advis notice_period_days + 30 dage før seneste opsigelsesdato
 * - Auto-renewal: leverandørkontrakter fornyes automatisk medmindre OPSAGT
 */

import { Contract, ContractSystemType } from '@prisma/client'

export interface DeadlineInfo {
  contractId: string
  contractName: string
  companyId: string
  deadlineDate: Date
  daysUntilDeadline: number
  reminderType: 'DAYS_90' | 'DAYS_30' | 'DAYS_7' | 'NOTICE_PERIOD'
  isAutoRenewal: boolean
  noticePeriodDays: number | null
}

// Kontrakttyper der typisk har auto-renewal
const AUTO_RENEWAL_TYPES: ContractSystemType[] = [
  'LEVERANDOERKONTRAKT',
  'LEASINGAFTALE',
  'LEJEKONTRAKT_ERHVERV',
  'FORSIKRING',
  'IT_SYSTEMAFTALE',
  'INTERN_SERVICEAFTALE',
]

/**
 * Beregner om en kontrakt er en fast eller løbende kontrakt
 * Fast: har expiry_date
 * Løbende: har notice_period_days men ingen expiry_date
 */
export function isFixedTermContract(contract: Contract): boolean {
  return contract.expiryDate !== null
}

/**
 * Beregner om en kontrakt har auto-renewal
 */
export function hasAutoRenewal(contract: Contract): boolean {
  // Tjek type_data for explicit auto_renewal felt
  const typeData = contract.typeData as Record<string, unknown> | null
  if (typeData?.auto_renewal === true) {
    return true
  }
  if (typeData?.auto_renewal === false) {
    return false
  }
  
  // Default baseret på kontrakttype
  return AUTO_RENEWAL_TYPES.includes(contract.systemType)
}

/**
 * Beregner den seneste dato for opsigelse af en løbende kontrakt
 * For auto-renewal kontrakter: expiry_date - notice_period_days
 * For løbende uden expiry: beregnes ud fra nuværende dato og notice_period
 */
export function calculateLatestTerminationNoticeDate(contract: Contract): Date | null {
  const noticePeriodDays = contract.noticePeriodDays
  
  if (!noticePeriodDays || noticePeriodDays <= 0) {
    return null
  }
  
  if (contract.expiryDate) {
    // Fast kontrakt med opsigelsesvarsel
    const latestNoticeDate = new Date(contract.expiryDate)
    latestNoticeDate.setDate(latestNoticeDate.getDate() - noticePeriodDays)
    return latestNoticeDate
  }
  
  // Løbende kontrakt - beregn næste mulige opsigelsestidspunkt
  // Antager månedlig periode som standard
  const now = new Date()
  const effectiveDate = contract.effectiveDate || contract.createdAt
  
  // Find næste "årsdag" for kontrakten
  const nextAnniversary = new Date(effectiveDate)
  while (nextAnniversary <= now) {
    nextAnniversary.setFullYear(nextAnniversary.getFullYear() + 1)
  }
  
  // Seneste opsigelsesdato er notice_period_days før næste årsdag
  const latestNoticeDate = new Date(nextAnniversary)
  latestNoticeDate.setDate(latestNoticeDate.getDate() - noticePeriodDays)
  
  return latestNoticeDate
}

/**
 * Beregner alle relevante adviseringsdatoer for en kontrakt
 */
export function calculateDeadlines(contract: Contract): DeadlineInfo[] {
  const deadlines: DeadlineInfo[] = []
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  
  const isAutoRenewal = hasAutoRenewal(contract)
  
  if (isFixedTermContract(contract) && contract.expiryDate) {
    // Fast kontrakt - advis 90, 30, 7 dage før udløb
    const expiryDate = new Date(contract.expiryDate)
    expiryDate.setHours(0, 0, 0, 0)
    
    const reminderDays = [
      { days: 90, type: 'DAYS_90' as const },
      { days: 30, type: 'DAYS_30' as const },
      { days: 7, type: 'DAYS_7' as const },
    ]
    
    for (const reminder of reminderDays) {
      // Tjek om kontrakten har aktiveret denne reminder
      if (reminder.days === 90 && !contract.reminder90Days) continue
      if (reminder.days === 30 && !contract.reminder30Days) continue
      if (reminder.days === 7 && !contract.reminder7Days) continue
      
      const deadlineDate = new Date(expiryDate)
      deadlineDate.setDate(deadlineDate.getDate() - reminder.days)
      
      const daysUntilDeadline = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      
      // Kun inkluder fremtidige deadlines
      if (daysUntilDeadline >= 0) {
        deadlines.push({
          contractId: contract.id,
          contractName: contract.displayName,
          companyId: contract.companyId,
          deadlineDate,
          daysUntilDeadline,
          reminderType: reminder.type,
          isAutoRenewal,
          noticePeriodDays: contract.noticePeriodDays,
        })
      }
    }
  } else if (contract.noticePeriodDays) {
    // Løbende kontrakt - advis notice_period_days + 30 dage før seneste opsigelsesdato
    const latestNoticeDate = calculateLatestTerminationNoticeDate(contract)
    
    if (latestNoticeDate) {
      // Advis 30 dage før seneste opsigelsesdato
      const adviseDate = new Date(latestNoticeDate)
      adviseDate.setDate(adviseDate.getDate() - 30)
      
      const daysUntilDeadline = Math.ceil((adviseDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      
      if (daysUntilDeadline >= 0) {
        deadlines.push({
          contractId: contract.id,
          contractName: contract.displayName,
          companyId: contract.companyId,
          deadlineDate: adviseDate,
          daysUntilDeadline,
          reminderType: 'NOTICE_PERIOD',
          isAutoRenewal,
          noticePeriodDays: contract.noticePeriodDays,
        })
      }
    }
  }
  
  return deadlines
}

/**
 * Finder kontrakter der skal adviseres i dag
 */
export function findContractsToAdviseToday(
  contracts: Contract[],
  alreadyAdvisedContractIds: Set<string>
): DeadlineInfo[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const contractsToAdvise: DeadlineInfo[] = []
  
  for (const contract of contracts) {
    // Spring over kontrakter der allerede er adviseret i dag
    if (alreadyAdvisedContractIds.has(contract.id)) {
      continue
    }
    
    // Spring over kontrakter med status OPSAGT eller ARKIVERET
    if (contract.status === 'OPSAGT' || contract.status === 'ARKIVERET') {
      continue
    }
    
    const deadlines = calculateDeadlines(contract)
    
    for (const deadline of deadlines) {
      // Tjek om deadline er i dag (daysUntilDeadline === 0)
      if (deadline.daysUntilDeadline === 0) {
        contractsToAdvise.push(deadline)
      }
    }
  }
  
  return contractsToAdvise
}

/**
 * Formaterer antal dage til læsbar tekst
 */
export function formatDaysUntilDeadline(days: number): string {
  if (days === 0) return 'i dag'
  if (days === 1) return 'i morgen'
  if (days < 7) return `om ${days} dage`
  if (days < 30) {
    const weeks = Math.floor(days / 7)
    return weeks === 1 ? 'om 1 uge' : `om ${weeks} uger`
  }
  if (days < 90) {
    const months = Math.floor(days / 30)
    return months === 1 ? 'om 1 måned' : `om ${months} måneder`
  }
  return `om ${days} dage`
}