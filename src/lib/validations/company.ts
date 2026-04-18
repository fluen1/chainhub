import { z } from 'zod'

export const createCompanySchema = z.object({
  name: z.string().min(1, 'Selskabsnavn er påkrævet').max(200),
  cvr: z
    .string()
    .regex(/^\d{8}$/, 'CVR skal være 8 cifre')
    .optional()
    .or(z.literal('')),
  companyType: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  foundedDate: z.string().optional(),
  status: z.string().optional(),
  notes: z.string().optional(),
})

export const updateCompanySchema = createCompanySchema.partial().extend({
  companyId: z.string().min(1),
})

export type CreateCompanyInput = z.infer<typeof createCompanySchema>
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>
