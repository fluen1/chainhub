import { resend, FROM_EMAIL } from './resend'
import { 
  generateContractReminderSubject, 
  generateContractReminderHtml, 
  generateContractReminderText 
} from './templates/contract-reminder'
import { DeadlineInfo } from '@/lib/contracts/deadline-calculator'

interface SendReminderParams {
  recipientEmail: string
  recipientName: string
  deadline: DeadlineInfo
  companyName: string
  organizationName: string
}

interface SendReminderResult {
  success: boolean
  messageId?: string
  error?: string
}

export async function sendContractReminder(params: SendReminderParams): Promise<SendReminderResult> {
  if (!resend) {
    console.warn('Resend er ikke konfigureret - email springes over')
    return { success: false, error: 'Email service ikke konfigureret' }
  }
  
  const { recipientEmail, recipientName, deadline, companyName, organizationName } = params
  
  try {
    const subject = generateContractReminderSubject(deadline)
    const html = generateContractReminderHtml({ recipientName, deadline, companyName, organizationName })
    const text = generateContractReminderText({ recipientName, deadline, companyName, organizationName })
    
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: recipientEmail,
      subject,
      html,
      text,
      tags: [
        { name: 'type', value: 'contract-reminder' },
        { name: 'contract_id', value: deadline.contractId },
        { name: 'reminder_type', value: deadline.reminderType },
      ],
    })
    
    if (result.error) {
      console.error('Resend API fejl:', result.error)
      return { success: false, error: result.error.message }
    }
    
    return { success: true, messageId: result.data?.id }
  } catch (error) {
    console.error('Fejl ved afsendelse af reminder email:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Ukendt fejl' 
    }
  }
}

export async function sendBulkContractReminders(
  reminders: SendReminderParams[]
): Promise<{ sent: number; failed: number; errors: string[] }> {
  const results = {
    sent: 0,
    failed: 0,
    errors: [] as string[],
  }
  
  // Send emails sekventielt for at undgå rate limiting
  for (const reminder of reminders) {
    const result = await sendContractReminder(reminder)
    
    if (result.success) {
      results.sent++
    } else {
      results.failed++
      results.errors.push(
        `${reminder.recipientEmail}: ${result.error || 'Ukendt fejl'}`
      )
    }
    
    // Kort pause mellem emails for at undgå rate limiting
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  return results
}