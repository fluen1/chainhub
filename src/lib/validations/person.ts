import { z } from 'zod'

export const createPersonSchema = z.object({
  firstName: z.string().min(1, 'Fornavn er påkrævet').max(100),
  lastName: z.string().min(1, 'Efternavn er påkrævet').max(100),
  email: z.string().email('Ugyldig email').optional().or(z.literal('')),
  phone: z.string().optional(),
  notes: z.string().optional(),
})

export const updatePersonSchema = createPersonSchema.partial().extend({
  personId: z.string().uuid(),
})

export type CreatePersonInput = z.infer<typeof createPersonSchema>
export type UpdatePersonInput = z.infer<typeof updatePersonSchema>
