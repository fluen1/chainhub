import { prisma } from '@/lib/db'
import { startOfDay, addDays } from 'date-fns'

export interface NotificationPayload {
  organizationId: string
  contractId: string
  displayName: string
  daysUntil: number
  deadlineType: 'expiry' | 'absolute' | 'operational'
  recipients: string[]
}

export interface NotificationResult {
  contractId: string
  reminderType: string
  recipientCount: number
  success: boolean
  error?: string
}

/**
 * Henter aktive reminder-modtagere for en organisation
 */
export async function getOrganizationReminderRecipients(
  organizationId: string
): Promise<string[]> {
  const users = await prisma.organizationUser.findMany({
    where: {
      organizationId,
      role: {
        in: ['GROUP_OWNER', 'GROUP_ADMIN', 'GROUP_LEGAL'],
      },
    },
    select: {
      user: {
        select: { email: true },
      },
    },
  })

  return users
    .map((u) => u.user.email)
    .filter((email): email is string => Boolean(email))
}

/**
 * Markerer en reminder som sendt i databasen
 */
export async function markReminderSent(
  organizationId: string,
  contractId: string,
  reminderType: string,
  scheduledFor: Date
): Promise<void> {
  await prisma.contractReminder.upsert({
    where: {
      // Ingen unik constraint på kombination — brug create/findFirst pattern
      id: 'placeholder', // trigger create path
    },
    create: {
      organizationId,
      contractId,
      reminderType,
      scheduledFor,
      sentAt: new Date(),
    },
    update: {
      sentAt: new Date(),
    },
  })
}

/**
 * Tjekker om en specifik reminder allerede er sendt for en kontrakt
 */
export async function isReminderAlreadySent(
  contractId: string,
  reminderType: string
): Promise<boolean> {
  const reminder = await prisma.contractReminder.findFirst({
    where: {
      contractId,
      reminderType,
      sentAt: { not: null },
    },
  })

  return Boolean(reminder)
}

/**
 * Opretter en ny reminder-record (ikke sendt endnu)
 */
export async function scheduleReminder(
  organizationId: string,
  contractId: string,
  reminderType: string,
  scheduledFor: Date
): Promise<void> {
  // Undgå duplikater
  const existing = await prisma.contractReminder.findFirst({
    where: {
      contractId,
      reminderType,
    },
  })

  if (existing) return

  await prisma.contractReminder.create({
    data: {
      organizationId,
      contractId,
      reminderType,
      scheduledFor,
    },
  })
}

/**
 * Henter alle usendede reminders der er forfaldne
 */
export async function getDueReminders(): Promise<
  Array<{
    id: string
    organizationId: string
    contractId: string
    reminderType: string
    scheduledFor: Date
    contract: {
      displayName: string
      companyId: string
      reminderRecipients: string[]
    }
  }>
> {
  const now = new Date()

  return prisma.contractReminder.findMany({
    where: {
      sentAt: null,
      scheduledFor: {
        lte: now,
      },
    },
    select: {
      id: true,
      organizationId: true,
      contractId: true,
      reminderType: true,
      scheduledFor: true,
      contract: {
        select: {
          displayName: true,
          companyId: true,
          reminderRecipients: true,
        },
      },
    },
  })
}

/**
 * Markerer en reminder som sendt via ID
 */
export async function markReminderSentById(reminderId: string): Promise<void> {
  await prisma.contractReminder.update({
    where: { id: reminderId },
    data: { sentAt: new Date() },
  })
}