import { z } from 'zod'

export const createCompanySchema = z.object({
  name: z
    .string()
    .min(1, 'Navn er påkrævet')
    .max(255, 'Navn må højst være 255 tegn'),
  cvr: z
    .string()
    .regex(/^\d{8}$/, 'CVR-nummer skal bestå af 8 cifre')
    .optional()
    .or(z.literal('')),
  companyType: z
    .enum(['ApS', 'A/S', 'I/S', 'enkeltmandsvirksomhed', 'P/S', 'K/S', 'Andet'])
    .optional(),
  address: z.string().max(500).optional().or(z.literal('')),
  city: z.string().max(100).optional().or(z.literal('')),
  postalCode: z
    .string()
    .regex(/^\d{4}$/, 'Postnummer skal bestå af 4 cifre')
    .optional()
    .or(z.literal('')),
  foundedDate: z.string().optional().or(z.literal('')),
  status: z.enum(['aktiv', 'inaktiv', 'under_stiftelse', 'opløst']).default('aktiv'),
  notes: z.string().max(5000).optional().or(z.literal('')),
})

export type CreateCompanyInput = z.input<typeof createCompanySchema>

export const updateCompanySchema = z.object({
  companyId: z.string().uuid('Ugyldigt selskabs-ID'),
  name: z
    .string()
    .min(1, 'Navn er påkrævet')
    .max(255, 'Navn må højst være 255 tegn')
    .optional(),
  cvr: z
    .string()
    .regex(/^\d{8}$/, 'CVR-nummer skal bestå af 8 cifre')
    .optional()
    .or(z.literal('')),
  companyType: z
    .enum(['ApS', 'A/S', 'I/S', 'enkeltmandsvirksomhed', 'P/S', 'K/S', 'Andet'])
    .optional(),
  address: z.string().max(500).optional().or(z.literal('')),
  city: z.string().max(100).optional().or(z.literal('')),
  postalCode: z
    .string()
    .regex(/^\d{4}$/, 'Postnummer skal bestå af 4 cifre')
    .optional()
    .or(z.literal('')),
  foundedDate: z.string().optional().or(z.literal('')),
  status: z.enum(['aktiv', 'inaktiv', 'under_stiftelse', 'opløst']).optional(),
  notes: z.string().max(5000).optional().or(z.literal('')),
})

export const deleteCompanySchema = z.object({
  companyId: z.string().uuid('Ugyldigt selskabs-ID'),
})

// Ejerskab
export const createOwnershipSchema = z.object({
  companyId: z.string().uuid('Ugyldigt selskabs-ID'),
  ownerType: z.enum(['person', 'company'], {
    required_error: 'Ejertype er påkrævet',
  }),
  ownerPersonId: z.string().uuid().optional(),
  ownerCompanyId: z.string().uuid().optional(),
  ownershipPct: z
    .number()
    .min(0.01, 'Ejerandel skal være større end 0')
    .max(100, 'Ejerandel kan ikke overstige 100%'),
  shareClass: z.string().max(100).optional().or(z.literal('')),
  effectiveDate: z.string().optional().or(z.literal('')),
  contractId: z.string().uuid().optional(),
}).refine(
  (data) => {
    if (data.ownerType === 'person') return !!data.ownerPersonId
    if (data.ownerType === 'company') return !!data.ownerCompanyId
    return false
  },
  {
    message: 'Ejer-ID er påkrævet',
    path: ['ownerPersonId'],
  }
)

export const updateOwnershipSchema = z.object({
  ownershipId: z.string().uuid('Ugyldigt ejerskabs-ID'),
  companyId: z.string().uuid('Ugyldigt selskabs-ID'),
  ownershipPct: z
    .number()
    .min(0.01, 'Ejerandel skal være større end 0')
    .max(100, 'Ejerandel kan ikke overstige 100%')
    .optional(),
  shareClass: z.string().max(100).optional().or(z.literal('')),
  effectiveDate: z.string().optional().or(z.literal('')),
  contractId: z.string().uuid().optional(),
})

export const deleteOwnershipSchema = z.object({
  ownershipId: z.string().uuid('Ugyldigt ejerskabs-ID'),
  companyId: z.string().uuid('Ugyldigt selskabs-ID'),
})

// Governance / CompanyPerson
export const createCompanyPersonSchema = z.object({
  companyId: z.string().uuid('Ugyldigt selskabs-ID'),
  personId: z.string().uuid('Ugyldigt person-ID'),
  role: z.enum([
    'direktør',
    'bestyrelsesformand',
    'bestyrelsesmedlem',
    'ansat',
    'revisor',
    'advokat',
    'suppleant',
  ], { required_error: 'Rolle er påkrævet' }),
  employmentType: z
    .enum(['funktionær', 'ikke-funktionær', 'vikar', 'elev'])
    .optional(),
  startDate: z.string().optional().or(z.literal('')),
  endDate: z.string().optional().or(z.literal('')),
  anciennityStart: z.string().optional().or(z.literal('')),
  contractId: z.string().uuid().optional(),
})

export const updateCompanyPersonSchema = z.object({
  companyPersonId: z.string().uuid('Ugyldigt ID'),
  companyId: z.string().uuid('Ugyldigt selskabs-ID'),
  role: z
    .enum([
      'direktør',
      'bestyrelsesformand',
      'bestyrelsesmedlem',
      'ansat',
      'revisor',
      'advokat',
      'suppleant',
    ])
    .optional(),
  employmentType: z
    .enum(['funktionær', 'ikke-funktionær', 'vikar', 'elev'])
    .optional(),
  startDate: z.string().optional().or(z.literal('')),
  endDate: z.string().optional().or(z.literal('')),
  anciennityStart: z.string().optional().or(z.literal('')),
  contractId: z.string().uuid().optional(),
})

export const deleteCompanyPersonSchema = z.object({
  companyPersonId: z.string().uuid('Ugyldigt ID'),
  companyId: z.string().uuid('Ugyldigt selskabs-ID'),
})

export const getCompanySchema = z.object({
  companyId: z.string().uuid('Ugyldigt selskabs-ID'),
})

export const listCompanyPersonsSchema = z.object({
  companyId: z.string().uuid('Ugyldigt selskabs-ID'),
  role: z.string().optional(),
})

export const listOwnershipsSchema = z.object({
  companyId: z.string().uuid('Ugyldigt selskabs-ID'),
})

export const getActivityLogSchema = z.object({
  companyId: z.string().uuid('Ugyldigt selskabs-ID'),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
})