'use server'

import { contactSchema, type ContactFormData } from '@/lib/validations/contact'
import { sendContactEmail } from '@/lib/email/resend'
import type { ActionResult } from '@/types/actions'

export type ContactSubmission = ContactFormData & { honeypot?: string }

export async function submitContactForm(input: ContactSubmission): Promise<ActionResult<true>> {
  // Spam-guard: honeypot-feltet er skjult for mennesker. Er det udfyldt, er afsenderen en bot.
  // Vi svarer "success" (så botten ikke kan probe), men sender ingen mail.
  if (input.honeypot && input.honeypot.trim() !== '') {
    return { data: true }
  }

  const parsed = contactSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Ugyldigt input' }
  }

  try {
    await sendContactEmail(parsed.data)
    return { data: true }
  } catch {
    return {
      error:
        'Vi kunne ikke sende din besked lige nu. Skriv venligst direkte til kontakt@chainhub.dk, så vender vi tilbage.',
    }
  }
}
