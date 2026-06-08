import { z } from 'zod'

export const contactSchema = z.object({
  name: z.string().min(2, 'Angiv dit navn'),
  email: z.string().email('Ugyldig e-mail-adresse'),
  company: z.string().optional(),
  message: z.string().min(10, 'Skriv en kort besked (mindst 10 tegn)'),
})

export type ContactFormData = z.infer<typeof contactSchema>
