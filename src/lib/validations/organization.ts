import { z } from 'zod'

export const updateOrganizationSchema = z.object({
  name: z
    .string()
    .min(1, 'Navn er påkrævet')
    .max(255, 'Navn kan højst være 255 tegn'),
  cvr: z
    .string()
    .trim()
    .regex(/^\d{8}$/, 'CVR skal være 8 cifre')
    .optional()
    .or(z.literal('')),
  chain_structure: z.boolean(),
})

export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>
