import { z } from 'zod'

// ==================== COMPANY ====================

export const createCompanySchema = z.object({
  name: z.string().min(1, 'Navn er påkrævet'),
  cvr: z.string().optional(),
  companyType: z
    .enum(['ApS', 'A/S', 'I/S', 'enkeltmandsvirksomhed', 'P/S', 'K/S', 'Andet'])
    .optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  foundedDate: z.string().optional(),
  status: z
    .enum(['aktiv', 'inaktiv', 'under_stiftelse', 'opløst'])
    .optional()
    .default('aktiv'),
  notes: z.string().optional(),
})

export const updateCompanySchema = z.object({
  companyId: z.string().min(1, 'Selskabs-ID er påkrævet'),
  name: z.string().min(1, 'Navn er påkrævet').optional(),
  cvr: z.string().optional(),
  companyType: z
    .enum(['ApS', 'A/S', 'I/S', 'enkeltmandsvirksomhed', 'P/S', 'K/S', 'Andet'])
    .optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  foundedDate: z.string().optional(),
  status: z.enum(['aktiv', 'inaktiv', 'under_stiftelse', 'opløst']).optional(),
  notes: z.string().optional(),
})

export const deleteCompanySchema = z.object({
  companyId: z.string().min(1, 'Selskabs-ID er påkrævet'),
})

export const getCompanySchema = z.object({
  companyId: z.string().min(1, 'Selskabs-ID er påkrævet'),
})

export const listCompaniesSchema = z.object({
  search: z.string().optional(),
  status: z.enum(['aktiv', 'inaktiv', 'under_stiftelse', 'opløst']).optional(),
  companyType: z
    .enum(['ApS', 'A/S', 'I/S', 'enkeltmandsvirksomhed', 'P/S', 'K/S', 'Andet'])
    .optional(),
})

export type CreateCompanyInput = z.infer<typeof createCompanySchema>
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>
export type DeleteCompanyInput = z.infer<typeof deleteCompanySchema>
export type GetCompanyInput = z.infer<typeof getCompanySchema>

// ==================== OWNERSHIP ====================

export const createOwnershipSchema = z.object({
  companyId: z.string().min(1, 'Selskabs-ID er påkrævet'),
  ownerType: z.enum(['person', 'company']),
  ownerPersonId: z.string().optional(),
  ownerCompanyId: z.string().optional(),
  ownershipPct: z.number().min(0).max(100),
  shareClass: z.string().optional(),
  effectiveDate: z.string().optional(),
  contractId: z.string().optional(),
})

export const updateOwnershipSchema = z.object({
  id: z.string().min(1, 'Ejerskabs-ID er påkrævet'),
  ownershipPct: z.number().min(0).max(100).optional(),
  shareClass: z.string().optional(),
  effectiveDate: z.string().optional(),
  contractId: z.string().optional(),
})

export const deleteOwnershipSchema = z.object({
  id: z.string().min(1, 'Ejerskabs-ID er påkrævet'),
})

export const listOwnershipsSchema = z.object({
  companyId: z.string().min(1, 'Selskabs-ID er påkrævet'),
})

export type CreateOwnershipInput = z.infer<typeof createOwnershipSchema>
export type UpdateOwnershipInput = z.infer<typeof updateOwnershipSchema>
export type DeleteOwnershipInput = z.infer<typeof deleteOwnershipSchema>

// ==================== COMPANY PERSON ====================

export const createCompanyPersonSchema = z.object({
  companyId: z.string().min(1, 'Selskabs-ID er påkrævet'),
  personId: z.string().optional(),
  role: z.string().min(1, 'Rolle er påkrævet').optional(),
  employmentType: z
    .enum(['funktionær', 'ikke-funktionær', 'vikar', 'elev'])
    .optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  anciennityStart: z.string().optional(),
  contractId: z.string().optional(),
})

export const updateCompanyPersonSchema = z.object({
  id: z.string().min(1, 'Person-ID er påkrævet'),
  companyId: z.string().optional(),
  personId: z.string().optional(),
  role: z.string().optional(),
  employmentType: z
    .enum(['funktionær', 'ikke-funktionær', 'vikar', 'elev'])
    .optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  anciennityStart: z.string().optional(),
  contractId: z.string().optional(),
})

export const deleteCompanyPersonSchema = z.object({
  id: z.string().min(1, 'Person-ID er påkrævet'),
})

export const listCompanyPersonsSchema = z.object({
  companyId: z.string().min(1, 'Selskabs-ID er påkrævet'),
  role: z.string().optional(),
})

export const getActivityLogSchema = z.object({
  companyId: z.string().min(1, 'Selskabs-ID er påkrævet'),
  limit: z.number().optional(),
  offset: z.number().optional(),
})

export type CreateCompanyPersonInput = z.infer<typeof createCompanyPersonSchema>
export type UpdateCompanyPersonInput = z.infer<typeof updateCompanyPersonSchema>
export type DeleteCompanyPersonInput = z.infer<typeof deleteCompanyPersonSchema>