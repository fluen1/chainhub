import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import {
  sendContractReminder,
  sendAutoRenewalWarning,
  sendDeadlineReminder,
} from '@/lib/reminders/email'
import { differenceInDays, addDays, subDays, startOfDay } from 'date-fns'

// Adviserings-intervaller for faste kontrakter
const FIXED_CONTRACT_REMINDER_DAYS = [90, 30, 7] as const

// System-typer med auto-renewal
const AUTO_RENEWAL_TYPES = ['LEVERANDOERKONTRAKT'] as const

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Validér CRON_SECRET
  const cronSecret = request.headers.get('x-cron-secret')
  if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Uautoriseret' }, { status: 401 })
  }

  const now = new Date()
  const today = startOfDay(now)

  let processed = 0
  let sent = 0
  let errors = 0

  try {
    // ==================== 1. FASTE KONTRAKTER ====================
    // Kontrakter med udløbsdato der udløber inden for 90 dage
    const fixedContracts = await prisma.contract.findMany({
      where: {
        deletedAt: null,
        expiryDate: {
          not: null,
          gte: today,
          lte: addDays(today, 90),
        },
        status: {
          in: ['UDKAST', 'TIL_REVIEW', 'TIL_UNDERSKRIFT', 'AKTIV'],
        },
      },
      include: {
        organization: {
          select: { id: true, name: true },
        },
        company: {
          select: { id: true, name: true },
        },
        reminders: {
          where: {
            sentAt: { not: null },
          },
          select: {
            reminderType: true,
            sentAt: true,
          },
        },
      },
    })

    for (const contract of fixedContracts) {
      if (!contract.expiryDate) continue

      processed++
      const daysUntilExpiry = differenceInDays(contract.expiryDate, today)

      for (const days of FIXED_CONTRACT_REMINDER_DAYS) {
        // Tjek om den specifikke reminder er aktiveret på kontrakten
        if (days === 90 && !contract.reminder90Days) continue
        if (days === 30 && !contract.reminder30Days) continue
        if (days === 7 && !contract.reminder7Days) continue

        const reminderType = `DAYS_${days}` as const

        // Send kun hvis vi er på det præcise antal dage (±0 da cron kører dagligt)
        if (daysUntilExpiry !== days) continue

        // Tjek om denne type allerede er sendt for denne kontrakt
        const alreadySent = contract.reminders.some((r) => r.reminderType === reminderType)
        if (alreadySent) continue

        // Hent modtagere
        const recipients = await getRecipients(
          contract.organizationId,
          contract.reminderRecipients
        )

        if (recipients.length === 0) continue

        try {
          await sendContractReminder({
            contract: {
              id: contract.id,
              displayName: contract.displayName,
              systemType: contract.systemType,
              expiryDate: contract.expiryDate,
              companyName: contract.company.name,
              organizationName: contract.organization.name,
            },
            daysUntilExpiry,
            reminderType,
            recipients,
          })

          // Markér som sendt i reminder-tabellen
          await prisma.reminder.upsert({
            where: {
              // Vi bruger en kombination der unikt identificerer denne reminder
              // Prøv at finde en eksisterende unsent record
              id: (
                await prisma.reminder.findFirst({
                  where: {
                    contractId: contract.id,
                    organizationId: contract.organizationId,
                    reminderType,
                    sentAt: null,
                  },
                  select: { id: true },
                })
              )?.id ?? 'non-existent-id',
            },
            update: {
              sentAt: now,
            },
            create: {
              organizationId: contract.organizationId,
              contractId: contract.id,
              reminderType,
              triggerDate: subDays(contract.expiryDate, days),
              sentAt: now,
              recipientIds: recipients.map((r) => r.id),
            },
          })

          sent++
        } catch (emailError) {
          console.error(
            `[Cron] Fejl ved ${reminderType} for kontrakt ${contract.id}:`,
            emailError
          )
          errors++
        }
      }
    }

    // ==================== 2. LØBENDE KONTRAKTER ====================
    // Kontrakter uden udløbsdato — advis notice_period_days + 30 dage i forvejen
    const ongoingContracts = await prisma.contract.findMany({
      where: {
        deletedAt: null,
        expiryDate: null,
        noticePeriodDays: {
          not: null,
          gte: 1,
        },
        status: { in: ['AKTIV'] },
      },
      include: {
        organization: {
          select: { id: true, name: true },
        },
        company: {
          select: { id: true, name: true },
        },
        reminders: {
          where: {
            reminderType: 'ONGOING_NOTICE',
          },
          select: {
            reminderType: true,
            sentAt: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
    })

    for (const contract of ongoingContracts) {
      if (!contract.noticePeriodDays) continue

      processed++

      const advanceDays = contract.noticePeriodDays + 30

      // Bestem om vi skal sende:
      // 1. Aldrig sendt → send nu
      // 2. Sidst sendt for mere end 365 dage siden → send igen
      const lastReminder = contract.reminders[0]
      let shouldSend = false

      if (!lastReminder || !lastReminder.sentAt) {
        shouldSend = true
      } else {
        const daysSinceLast = differenceInDays(now, lastReminder.sentAt)
        shouldSend = daysSinceLast >= 365
      }

      if (!shouldSend) continue

      const recipients = await getRecipients(
        contract.organizationId,
        contract.reminderRecipients
      )

      if (recipients.length === 0) continue

      try {
        await sendContractReminder({
          contract: {
            id: contract.id,
            displayName: contract.displayName,
            systemType: contract.systemType,
            expiryDate: null,
            companyName: contract.company.name,
            organizationName: contract.organization.name,
          },
          daysUntilExpiry: null,
          reminderType: 'ONGOING_NOTICE',
          recipients,
          noticePeriodDays: contract.noticePeriodDays,
          advanceDays,
        })

        await prisma.reminder.create({
          data: {
            organizationId: contract.organizationId,
            contractId: contract.id,
            reminderType: 'ONGOING_NOTICE',
            triggerDate: now,
            sentAt: now,
            recipientIds: recipients.map((r) => r.id),
          },
        })

        sent++
      } catch (emailError) {
        console.error(
          `[Cron] Fejl ved ONGOING_NOTICE for kontrakt ${contract.id}:`,
          emailError
        )
        errors++
      }
    }

    // ==================== 3. AUTO-RENEWAL ADVARSLER ====================
    // Leverandørkontrakter med udløbsdato og notice_period
    const autoRenewalContracts = await prisma.contract.findMany({
      where: {
        deletedAt: null,
        systemType: { in: [...AUTO_RENEWAL_TYPES] },
        expiryDate: {
          not: null,
          gte: today,
          lte: addDays(today, 120),
        },
        noticePeriodDays: {
          not: null,
          gte: 1,
        },
        status: { in: ['AKTIV'] },
      },
      include: {
        organization: {
          select: { id: true, name: true },
        },
        company: {
          select: { id: true, name: true },
        },
        reminders: {
          where: {
            reminderType: 'AUTO_RENEWAL_WARNING',
            sentAt: { not: null },
          },
          select: { reminderType: true },
        },
      },
    })

    for (const contract of autoRenewalContracts) {
      if (!contract.expiryDate || !contract.noticePeriodDays) continue

      processed++

      const warningDays = contract.noticePeriodDays + 14
      const daysUntilExpiry = differenceInDays(contract.expiryDate, today)

      // Send kun på det præcise trigger-punkt
      if (daysUntilExpiry !== warningDays) continue

      // Tjek for duplikat
      const alreadySent = contract.reminders.some(
        (r) => r.reminderType === 'AUTO_RENEWAL_WARNING'
      )
      if (alreadySent) continue

      const recipients = await getRecipients(
        contract.organizationId,
        contract.reminderRecipients
      )

      if (recipients.length === 0) continue

      try {
        await sendAutoRenewalWarning({
          contract: {
            id: contract.id,
            displayName: contract.displayName,
            systemType: contract.systemType,
            expiryDate: contract.expiryDate,
            companyName: contract.company.name,
            organizationName: contract.organization.name,
          },
          noticePeriodDays: contract.noticePeriodDays,
          daysUntilExpiry,
          recipients,
        })

        await prisma.reminder.upsert({
          where: {
            id: (
              await prisma.reminder.findFirst({
                where: {
                  contractId: contract.id,
                  organizationId: contract.organizationId,
                  reminderType: 'AUTO_RENEWAL_WARNING',
                  sentAt: null,
                },
                select: { id: true },
              })
            )?.id ?? 'non-existent-id',
          },
          update: { sentAt: now },
          create: {
            organizationId: contract.organizationId,
            contractId: contract.id,
            reminderType: 'AUTO_RENEWAL_WARNING',
            triggerDate: subDays(contract.expiryDate, warningDays),
            sentAt: now,
            recipientIds: recipients.map((r) => r.id),
          },
        })

        sent++
      } catch (emailError) {
        console.error(
          `[Cron] Fejl ved AUTO_RENEWAL_WARNING for kontrakt ${contract.id}:`,
          emailError
        )
        errors++
      }
    }

    // ==================== 4. DEADLINE-ADVISERINGER ====================
    const deadlinesToAdvise = await prisma.deadline.findMany({
      where: {
        deletedAt: null,
        completedAt: null,
        adviseSentAt: null, // Ikke sendt — duplikat-check
        dueDate: {
          gte: today,
          lte: addDays(today, 30),
        },
      },
      include: {
        organization: {
          select: { id: true, name: true },
        },
      },
    })

    for (const deadline of deadlinesToAdvise) {
      processed++

      const daysUntilDue = differenceInDays(deadline.dueDate, today)

      // Send kun hvis vi er inden for advise_days_before
      if (daysUntilDue > deadline.adviseDaysBefore) continue

      const recipients = await getDeadlineRecipients(
        deadline.organizationId,
        deadline.assignedTo
      )

      if (recipients.length === 0) continue

      try {
        await sendDeadlineReminder({
          deadline: {
            id: deadline.id,
            title: deadline.title,
            dueDate: deadline.dueDate,
            priority: deadline.priority,
            organizationName: deadline.organization.name,
          },
          daysUntilDue,
          recipients,
        })

        // Sæt advise_sent_at — forhindrer duplikater (DEC-031)
        await prisma.deadline.update({
          where: {
            id: deadline.id,
            organizationId: deadline.organizationId,
          },
          data: { adviseSentAt: now },
        })

        sent++
      } catch (emailError) {
        console.error(
          `[Cron] Fejl ved deadline-advis for ${deadline.id}:`,
          emailError
        )
        errors++
      }
    }

    console.log(
      `[Cron] check-deadlines afsluttet: processed=${processed}, sent=${sent}, errors=${errors}`
    )

    return NextResponse.json({
      success: true,
      processed,
      sent,
      errors,
      timestamp: now.toISOString(),
    })
  } catch (error) {
    console.error('[Cron] check-deadlines fatal fejl:', error)
    return NextResponse.json(
      {
        error: 'Intern fejl ved behandling af deadlines',
        details: error instanceof Error ? error.message : 'Ukendt fejl',
      },
      { status: 500 }
    )
  }
}

// ==================== HJÆLPEFUNKTIONER ====================

interface Recipient {
  id: string
  email: string
  name: string
}

async function getRecipients(
  organizationId: string,
  reminderRecipientIds: string[]
): Promise<Recipient[]> {
  // Tomme reminder_recipients → brug GROUP_OWNER og GROUP_ADMIN
  if (reminderRecipientIds.length === 0) {
    const assignments = await prisma.userRoleAssignment.findMany({
      where: {
        organizationId,
        role: { in: ['GROUP_OWNER', 'GROUP_ADMIN'] },
      },
      include: {
        user: {
          select: { id: true, email: true, name: true, deletedAt: true },
        },
      },
    })

    return assignments
      .filter((a) => a.user.deletedAt === null)
      .map((a) => ({
        id: a.user.id,
        email: a.user.email,
        name: a.user.name,
      }))
  }

  // Specificerede modtagere
  const users = await prisma.user.findMany({
    where: {
      id: { in: reminderRecipientIds },
      organizationId,
      deletedAt: null,
    },
    select: { id: true, email: true, name: true },
  })

  return users
}

async function getDeadlineRecipients(
  organizationId: string,
  assignedTo: string | null
): Promise<Recipient[]> {
  if (assignedTo) {
    const user = await prisma.user.findFirst({
      where: {
        id: assignedTo,
        organizationId,
        deletedAt: null,
      },
      select: { id: true, email: true, name: true },
    })

    if (user) return [user]
  }

  // Fallback: GROUP_OWNER og GROUP_ADMIN
  return getRecipients(organizationId, [])
}