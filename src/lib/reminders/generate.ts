import { prisma } from '@/lib/db'
import { subDays } from 'date-fns'

// Adviser-typer for faste kontrakter
const REMINDER_DAYS = [90, 30, 7] as const

// Auto-renewal typer (leverandørkontrakter fornyes automatisk)
const AUTO_RENEWAL_SYSTEM_TYPES = ['LEVERANDOERKONTRAKT'] as const

/**
 * Generér Reminder-records for en kontrakt.
 * Kaldes ved oprettelse og opdatering af kontrakt.
 * Eksisterende usent reminder-records slettes og genoprettes.
 */
export async function generateReminders(contractId: string, organizationId: string): Promise<void> {
  // Hent kontrakten
  const contract = await prisma.contract.findUnique({
    where: {
      id: contractId,
      organizationId,
      deletedAt: null,
    },
    select: {
      id: true,
      organizationId: true,
      expiryDate: true,
      noticePeriodDays: true,
      systemType: true,
      reminderRecipients: true,
      reminder90Days: true,
      reminder30Days: true,
      reminder7Days: true,
      status: true,
    },
  })

  if (!contract) return

  // Slet eksisterende usendte reminders
  await prisma.reminder.deleteMany({
    where: {
      contractId,
      organizationId,
      sentAt: null, // Kun slet dem der ikke er sendt endnu
    },
  })

  // Hent modtager-IDs til brug i records
  const recipientIds = contract.reminderRecipients

  const remindersToCreate: Array<{
    organizationId: string
    contractId: string
    reminderType: string
    triggerDate: Date
    sentAt: null
    recipientIds: string[]
  }> = []

  // ==================== FASTE KONTRAKTER ====================
  if (contract.expiryDate) {
    for (const days of REMINDER_DAYS) {
      // Tjek om reminder er aktiveret
      if (days === 90 && !contract.reminder90Days) continue
      if (days === 30 && !contract.reminder30Days) continue
      if (days === 7 && !contract.reminder7Days) continue

      const triggerDate = subDays(contract.expiryDate, days)

      // Opret kun fremtidige reminders
      if (triggerDate <= new Date()) continue

      remindersToCreate.push({
        organizationId,
        contractId,
        reminderType: `DAYS_${days}`,
        triggerDate,
        sentAt: null,
        recipientIds,
      })
    }

    // ==================== AUTO-RENEWAL ====================
    // For leverandørkontrakter: advis notice_period_days + 14 dage før udløb
    if (
      AUTO_RENEWAL_SYSTEM_TYPES.includes(
        contract.systemType as (typeof AUTO_RENEWAL_SYSTEM_TYPES)[number]
      ) &&
      contract.noticePeriodDays
    ) {
      const warningDays = contract.noticePeriodDays + 14
      const autoRenewalTrigger = subDays(contract.expiryDate, warningDays)

      if (autoRenewalTrigger > new Date()) {
        remindersToCreate.push({
          organizationId,
          contractId,
          reminderType: 'AUTO_RENEWAL_WARNING',
          triggerDate: autoRenewalTrigger,
          sentAt: null,
          recipientIds,
        })
      }
    }
  }

  // ==================== LØBENDE KONTRAKTER ====================
  // For løbende kontrakter oprettes ingen pre-planlagte reminders —
  // Cron-jobbet håndterer dette med ONGOING_NOTICE baseret på tid siden sidst.
  // (Se route.ts for logikken)

  // Bulk-opret reminder-records
  if (remindersToCreate.length > 0) {
    await prisma.reminder.createMany({
      data: remindersToCreate,
    })
  }
}

/**
 * Slet alle reminders for en kontrakt (ved sletning af kontrakten).
 */
export async function deleteContractReminders(
  contractId: string,
  organizationId: string
): Promise<void> {
  await prisma.reminder.deleteMany({
    where: {
      contractId,
      organizationId,
      sentAt: null, // Bevar sendte reminders til audit-formål
    },
  })
}