import { z } from 'zod'

export const contactSchema = z.object({
  name: z.string().min(2, 'Angiv dit navn').max(100, 'Navn må maks. være 100 tegn'),
  email: z.string().email('Ugyldig e-mail-adresse'),
  company: z.string().max(200, 'Firmanavn må maks. være 200 tegn').optional(),
  message: z
    .string()
    .min(10, 'Skriv en kort besked (mindst 10 tegn)')
    .max(3000, 'Besked må maks. være 3000 tegn'),
})

export type ContactFormData = z.infer<typeof contactSchema>
