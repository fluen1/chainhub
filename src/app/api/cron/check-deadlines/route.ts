import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import {
  sendContractReminder,
  sendAutoRenewalWarning,
  sendDeadlineReminder,
} from '@/lib/reminders/email'
import { differenceInDays, addDays, startOfDay } from 'date-fns'

// Adviserings-intervaller for faste kontrakter
const FIXED_CONTRACT_REMINDER_DAYS = [90, 30, 7] as const

// System-typer med auto-renewal
const AUTO_RENEWAL_TYPES = ['LEVERANDØRKONTRAKT'] as const

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
            },
            daysUntilExpiry,
            recipients,
            organizationName: contract.organization.name,
          })

          // Registrér at reminder er sendt
          await prisma.contractReminder.create({
            data: {
              organizationId: contract.organizationId,
              contractId: contract.id,
              reminderType,
              scheduledFor: today,
              sentAt: now,
            },
          })

          sent++
        } catch (err) {
          console.error(`Fejl ved afsendelse af reminder for kontrakt ${contract.id}:`, err)
          errors++
        }
      }
    }

    // ==================== 2. AUTO-RENEWAL KONTRAKTER ====================
    // Kontrakter med auto-renewal der udløber inden for 30 dage
    const autoRenewalContracts = await prisma.contract.findMany({
      where: {
        deletedAt: null,
        autoRenewal: true,
        expiryDate: {
          not: null,
          gte: today,
          lte: addDays(today, 30),
        },
        status: 'AKTIV',
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
            reminderType: 'AUTO_RENEWAL',
            sentAt: { not: null },
          },
          select: {
            reminderType: true,
            sentAt: true,
          },
        },
      },
    })

    for (const contract of autoRenewalContracts) {
      if (!contract.expiryDate) continue

      processed++

      // Tjek om auto-renewal reminder allerede er sendt
      const alreadySent = contract.reminders.length > 0
      if (alreadySent) continue

      const daysUntilExpiry = differenceInDays(contract.expiryDate, today)

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
            autoRenewalDays: contract.autoRenewalDays,
            companyName: contract.company.name,
          },
          daysUntilExpiry,
          recipients,
          organizationName: contract.organization.name,
        })

        await prisma.contractReminder.create({
          data: {
            organizationId: contract.organizationId,
            contractId: contract.id,
            reminderType: 'AUTO_RENEWAL',
            scheduledFor: today,
            sentAt: now,
          },
        })

        sent++
      } catch (err) {
        console.error(`Fejl ved afsendelse af auto-renewal warning for kontrakt ${contract.id}:`, err)
        errors++
      }
    }

    // ==================== 3. ABSOLUTTE DEADLINES ====================
    const absoluteDeadlineContracts = await prisma.contract.findMany({
      where: {
        deletedAt: null,
        deadlineType: 'ABSOLUT',
        absoluteDeadline: {
          not: null,
          gte: today,
          lte: addDays(today, 30),
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
            reminderType: 'ABSOLUT_DEADLINE',
            sentAt: { not: null },
          },
          select: {
            reminderType: true,
            sentAt: true,
          },
        },
      },
    })

    for (const contract of absoluteDeadlineContracts) {
      if (!contract.absoluteDeadline) continue

      processed++

      const alreadySent = contract.reminders.length > 0
      if (alreadySent) continue

      const daysUntilDeadline = differenceInDays(contract.absoluteDeadline, today)

      const recipients = await getRecipients(
        contract.organizationId,
        contract.reminderRecipients
      )

      if (recipients.length === 0) continue

      try {
        await sendDeadlineReminder({
          contract: {
            id: contract.id,
            displayName: contract.displayName,
            systemType: contract.systemType,
            deadline: contract.absoluteDeadline,
            deadlineType: 'ABSOLUT',
            companyName: contract.company.name,
          },
          daysUntilDeadline,
          recipients,
          organizationName: contract.organization.name,
        })

        await prisma.contractReminder.create({
          data: {
            organizationId: contract.organizationId,
            contractId: contract.id,
            reminderType: 'ABSOLUT_DEADLINE',
            scheduledFor: today,
            sentAt: now,
          },
        })

        sent++
      } catch (err) {
        console.error(`Fejl ved afsendelse af deadline reminder for kontrakt ${contract.id}:`, err)
        errors++
      }
    }

    // ==================== 4. OPERATIONELLE DEADLINES ====================
    const operationalDeadlineContracts = await prisma.contract.findMany({
      where: {
        deletedAt: null,
        deadlineType: 'OPERATIONEL',
        operationalDeadline: {
          not: null,
          gte: today,
          lte: addDays(today, 14),
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
            reminderType: 'OPERATIONEL_DEADLINE',
            sentAt: { not: null },
          },
          select: {
            reminderType: true,
            sentAt: true,
          },
        },
      },
    })

    for (const contract of operationalDeadlineContracts) {
      if (!contract.operationalDeadline) continue

      processed++

      const alreadySent = contract.reminders.length > 0
      if (alreadySent) continue

      const daysUntilDeadline = differenceInDays(contract.operationalDeadline, today)

      const recipients = await getRecipients(
        contract.organizationId,
        contract.reminderRecipients
      )

      if (recipients.length === 0) continue

      try {
        await sendDeadlineReminder({
          contract: {
            id: contract.id,
            displayName: contract.displayName,
            systemType: contract.systemType,
            deadline: contract.operationalDeadline,
            deadlineType: 'OPERATIONEL',
            companyName: contract.company.name,
          },
          daysUntilDeadline,
          recipients,
          organizationName: contract.organization.name,
        })

        await prisma.contractReminder.create({
          data: {
            organizationId: contract.organizationId,
            contractId: contract.id,
            reminderType: 'OPERATIONEL_DEADLINE',
            scheduledFor: today,
            sentAt: now,
          },
        })

        sent++
      } catch (err) {
        console.error(`Fejl ved afsendelse af operationel deadline reminder for kontrakt ${contract.id}:`, err)
        errors++
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      sent,
      errors,
      timestamp: now.toISOString(),
    })
  } catch (err) {
    console.error('Kritisk fejl i check-deadlines cron:', err)
    return NextResponse.json(
      {
        error: 'Intern serverfejl',
        processed,
        sent,
        errors,
      },
      { status: 500 }
    )
  }
}

// ==================== HELPERS ====================

async function getRecipients(
  organizationId: string,
  contractRecipients: string[]
): Promise<string[]> {
  // Hvis kontrakten har specifikke modtagere, brug dem
  if (contractRecipients.length > 0) {
    return contractRecipients
  }

  // Ellers hent organisation-niveau modtagere (GROUP_OWNER + GROUP_ADMIN + GROUP_LEGAL)
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