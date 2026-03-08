import { prisma } from '@/lib/db'
import { calculateDeadlines, DeadlineInfo } from '@/lib/contracts/deadline-calculator'
import { sendContractReminder } from '@/lib/email/send-reminder'
import { Contract } from '@prisma/client'

interface CheckDeadlinesResult {
  processedContracts: number
  remindersCreated: number
  emailsSent: number
  emailsFailed: number
  errors: string[]
}

/**
 * Hovedfunktion der køres af cron job
 * Tjekker alle kontrakter og sender adviserings-emails
 */
export async function checkContractDeadlines(): Promise<CheckDeadlinesResult> {
  const result: CheckDeadlinesResult = {
    processedContracts: 0,
    remindersCreated: 0,
    emailsSent: 0,
    emailsFailed: 0,
    errors: [],
  }
  
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  try {
    // Hent alle aktive kontrakter med relevante relationer
    const contracts = await prisma.contract.findMany({
      where: {
        deletedAt: null,
        status: {
          in: ['AKTIV', 'TIL_UNDERSKRIFT', 'TIL_REVIEW'],
        },
        OR: [
          // Fast kontrakt med udløbsdato
          { expiryDate: { not: null } },
          // Løbende kontrakt med opsigelsesvarsel
          { noticePeriodDays: { not: null, gt: 0 } },
        ],
      },
      include: {
        company: true,
        organization: true,
      },
    })
    
    result.processedContracts = contracts.length
    
    for (const contract of contracts) {
      try {
        const deadlines = calculateDeadlines(contract)
        
        for (const deadline of deadlines) {
          // Tjek om deadline er i dag
          if (deadline.daysUntilDeadline !== 0) {
            continue
          }
          
          // Tjek om vi allerede har sendt denne reminder
          const existingReminder = await prisma.reminder.findFirst({
            where: {
              contractId: contract.id,
              reminderType: deadline.reminderType,
              sentAt: { not: null },
              triggerDate: {
                gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
                lt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1),
              },
            },
          })
          
          if (existingReminder) {
            // Allerede sendt
            continue
          }
          
          // Bestem modtagere
          const recipientIds = contract.reminderRecipients.length > 0
            ? contract.reminderRecipients
            : [contract.createdBy]
          
          // Hent modtagerinfo
          const recipients = await prisma.user.findMany({
            where: {
              id: { in: recipientIds },
              organizationId: contract.organizationId,
              deletedAt: null,
            },
          })
          
          if (recipients.length === 0) {
            result.errors.push(
              `Ingen gyldige modtagere for kontrakt ${contract.id}`
            )
            continue
          }
          
          // Opret reminder record
          const reminder = await prisma.reminder.create({
            data: {
              organizationId: contract.organizationId,
              contractId: contract.id,
              reminderType: deadline.reminderType,
              triggerDate: today,
              recipientIds: recipients.map(r => r.id),
            },
          })
          
          result.remindersCreated++
          
          // Send emails til alle modtagere
          for (const recipient of recipients) {
            const emailResult = await sendContractReminder({
              recipientEmail: recipient.email,
              recipientName: recipient.name,
              deadline,
              companyName: contract.company.name,
              organizationName: contract.organization.name,
            })
            
            if (emailResult.success) {
              result.emailsSent++
            } else {
              result.emailsFailed++
              result.errors.push(
                `Email til ${recipient.email} for kontrakt ${contract.id}: ${emailResult.error}`
              )
            }
          }
          
          // Opdater reminder med sent_at
          await prisma.reminder.update({
            where: { id: reminder.id },
            data: { sentAt: new Date() },
          })
        }
      } catch (contractError) {
        result.errors.push(
          `Fejl ved behandling af kontrakt ${contract.id}: ${
            contractError instanceof Error ? contractError.message : 'Ukendt fejl'
          }`
        )
      }
    }
    
    // Håndter auto-renewal logik for leverandørkontrakter
    await handleAutoRenewals(today, result)
    
  } catch (error) {
    result.errors.push(
      `Generel fejl: ${error instanceof Error ? error.message : 'Ukendt fejl'}`
    )
  }
  
  return result
}

/**
 * Håndterer auto-renewal for leverandørkontrakter
 * Kontrakter med auto_renewal og passeret expiry_date uden OPSAGT status fornyes
 */
async function handleAutoRenewals(
  today: Date,
  result: CheckDeadlinesResult
): Promise<void> {
  try {
    // Find kontrakter der skal fornyes
    const contractsToRenew = await prisma.contract.findMany({
      where: {
        deletedAt: null,
        status: 'AKTIV',
        systemType: {
          in: [
            'LEVERANDOERKONTRAKT',
            'LEASINGAFTALE',
            'LEJEKONTRAKT_ERHVERV',
            'FORSIKRING',
            'IT_SYSTEMAFTALE',
            'INTERN_SERVICEAFTALE',
          ],
        },
        expiryDate: {
          lt: today,
        },
      },
    })
    
    for (const contract of contractsToRenew) {
      // Tjek om kontrakten har auto_renewal aktiveret
      const typeData = contract.typeData as Record<string, unknown> | null
      const hasAutoRenewal = typeData?.auto_renewal !== false
      
      if (!hasAutoRenewal) {
        // Opdater status til UDLOEBET
        await prisma.contract.update({
          where: { id: contract.id },
          data: { status: 'UDLOEBET' },
        })
        continue
      }
      
      // Auto-renewal: forlæng kontrakten med 1 år
      const currentExpiry = contract.expiryDate!
      const newExpiry = new Date(currentExpiry)
      newExpiry.setFullYear(newExpiry.getFullYear() + 1)
      
      await prisma.contract.update({
        where: { id: contract.id },
        data: {
          status: 'FORNYET',
          expiryDate: newExpiry,
          typeData: {
            ...(contract.typeData as object || {}),
            last_renewal_date: today.toISOString(),
            previous_expiry_date: currentExpiry.toISOString(),
          },
        },
      })
      
      // Log i audit
      await prisma.auditLog.create({
        data: {
          organizationId: contract.organizationId,
          userId: 'system',
          action: 'UPDATE',
          resourceType: 'contract',
          resourceId: contract.id,
          changes: {
            auto_renewal: true,
            previous_status: 'AKTIV',
            new_status: 'FORNYET',
            previous_expiry: currentExpiry.toISOString(),
            new_expiry: newExpiry.toISOString(),
          },
        },
      })
    }
  } catch (error) {
    result.errors.push(
      `Fejl ved auto-renewal håndtering: ${
        error instanceof Error ? error.message : 'Ukendt fejl'
      }`
    )
  }
}

/**
 * Opretter manglende reminder records for eksisterende kontrakter
 * Køres ved behov for at synkronisere reminder-tabellen
 */
export async function syncReminderRecords(): Promise<{
  created: number
  errors: string[]
}> {
  const result = { created: 0, errors: [] as string[] }
  
  try {
    const contracts = await prisma.contract.findMany({
      where: {
        deletedAt: null,
        status: { in: ['AKTIV', 'TIL_UNDERSKRIFT', 'TIL_REVIEW'] },
        OR: [
          { expiryDate: { not: null } },
          { noticePeriodDays: { not: null, gt: 0 } },
        ],
      },
    })
    
    for (const contract of contracts) {
      const deadlines = calculateDeadlines(contract)
      
      for (const deadline of deadlines) {
        // Tjek om reminder allerede eksisterer
        const existing = await prisma.reminder.findFirst({
          where: {
            contractId: contract.id,
            reminderType: deadline.reminderType,
            triggerDate: deadline.deadlineDate,
          },
        })
        
        if (!existing) {
          await prisma.reminder.create({
            data: {
              organizationId: contract.organizationId,
              contractId: contract.id,
              reminderType: deadline.reminderType,
              triggerDate: deadline.deadlineDate,
              recipientIds: contract.reminderRecipients.length > 0
                ? contract.reminderRecipients
                : [contract.createdBy],
            },
          })
          result.created++
        }
      }
    }
  } catch (error) {
    result.errors.push(
      `Sync fejl: ${error instanceof Error ? error.message : 'Ukendt fejl'}`
    )
  }
  
  return result
}