import { z } from 'zod'

export const companyStatusSchema = z.enum([
  'aktiv',
  'inaktiv',
  'under_stiftelse',
  'opløst',
])

export const companyTypeSchema = z.enum([
  'ApS',
  'A/S',
  'I/S',
  'K/S',
  'P/S',
  'Enkeltmandsvirksomhed',
  'Holding',
  'Andet',
])

export const createCompanySchema = z.object({
  name: z.string().min(1, 'Navn er påkrævet').max(255, 'Navn må højst være 255 tegn'),
  cvr: z
    .string()
    .regex(/^\d{8}$/, 'CVR skal være 8 cifre')
    .optional()
    .nullable(),
  companyType: companyTypeSchema.optional().nullable(),
  address: z.string().max(500, 'Adresse må højst være 500 tegn').optional().nullable(),
  city: z.string().max(100, 'By må højst være 100 tegn').optional().nullable(),
  postalCode: z
    .string()
    .regex(/^\d{4}$/, 'Postnummer skal være 4 cifre')
    .optional()
    .nullable(),
  foundedDate: z.coerce.date().optional().nullable(),
  status: companyStatusSchema.default('aktiv'),
  notes: z.string().max(5000, 'Noter må højst være 5000 tegn').optional().nullable(),
})

export const updateCompanySchema = createCompanySchema.partial().extend({
  id: z.string().uuid('Ugyldigt selskabs-ID'),
})

export const ownerTypeSchema = z.enum(['person', 'company'])

export const createOwnershipSchema = z.object({
  companyId: z.string().uuid('Ugyldigt selskabs-ID'),
  ownerType: ownerTypeSchema,
  ownerPersonId: z.string().uuid('Ugyldigt person-ID').optional().nullable(),
  ownerCompanyId: z.string().uuid('Ugyldigt ejerselskabs-ID').optional().nullable(),
  ownershipPct: z
    .number()
    .min(0.01, 'Ejerskab skal være mindst 0,01%')
    .max(100, 'Ejerskab kan højst være 100%'),
  shareClass: z.string().max(50, 'Anpartsklasse må højst være 50 tegn').optional().nullable(),
  effectiveDate: z.coerce.date().optional().nullable(),
  contractId: z.string().uuid('Ugyldigt kontrakt-ID').optional().nullable(),
}).refine(
  (data) => {
    if (data.ownerType === 'person') {
      return !!data.ownerPersonId
    }
    if (data.ownerType === 'company') {
      return !!data.ownerCompanyId
    }
    return false
  },
  {
    message: 'Vælg enten en person eller et selskab som ejer',
    path: ['ownerType'],
  }
)

export const updateOwnershipSchema = z.object({
  id: z.string().uuid('Ugyldigt ejerskabs-ID'),
  ownershipPct: z
    .number()
    .min(0.01, 'Ejerskab skal være mindst 0,01%')
    .max(100, 'Ejerskab kan højst være 100%')
    .optional(),
  shareClass: z.string().max(50).optional().nullable(),
  effectiveDate: z.coerce.date().optional().nullable(),
  contractId: z.string().uuid().optional().nullable(),
})

export const governanceRoleSchema = z.enum([
  'direktør',
  'bestyrelsesformand',
  'bestyrelsesmedlem',
  'revisor',
])

export const employmentTypeSchema = z.enum([
  'funktionær',
  'ikke-funktionær',
  'vikar',
  'elev',
])

export const createCompanyPersonSchema = z.object({
  companyId: z.string().uuid('Ugyldigt selskabs-ID'),
  personId: z.string().uuid('Ugyldigt person-ID'),
  role: z.string().min(1, 'Rolle er påkrævet').max(50, 'Rolle må højst være 50 tegn'),
  employmentType: employmentTypeSchema.optional().nullable(),
  startDate: z.coerce.date().optional().nullable(),
  endDate: z.coerce.date().optional().nullable(),
  anciennityStart: z.coerce.date().optional().nullable(),
  contractId: z.string().uuid('Ugyldigt kontrakt-ID').optional().nullable(),
})

export const updateCompanyPersonSchema = z.object({
  id: z.string().uuid('Ugyldigt ID'),
  role: z.string().min(1).max(50).optional(),
  employmentType: employmentTypeSchema.optional().nullable(),
  startDate: z.coerce.date().optional().nullable(),
  endDate: z.coerce.date().optional().nullable(),
  anciennityStart: z.coerce.date().optional().nullable(),
  contractId: z.string().uuid().optional().nullable(),
})

export type CreateCompanyInput = z.infer<typeof createCompanySchema>
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>
export type CreateOwnershipInput = z.infer<typeof createOwnershipSchema>
export type UpdateOwnershipInput = z.infer<typeof updateOwnershipSchema>
export type CreateCompanyPersonInput = z.infer<typeof createCompanyPersonSchema>
export type UpdateCompanyPersonInput = z.infer<typeof updateCompanyPersonSchema>