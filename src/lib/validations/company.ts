import { z } from 'zod'

export const createCompanySchema = z.object({
  name: z.string().min(1, 'Navn er påkrævet').max(255),
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

export type CreateCompanyInput = z.infer<typeof createCompanySchema>

export const updateCompanySchema = z.object({
  companyId: z.string().min(1),
  name: z.string().min(1, 'Navn er påkrævet').max(255).optional(),
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

export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>

export const getCompanySchema = z.object({
  companyId: z.string().min(1),
})

export type GetCompanyInput = z.infer<typeof getCompanySchema>

export const deleteCompanySchema = z.object({
  companyId: z.string().min(1),
})

export type DeleteCompanyInput = z.infer<typeof deleteCompanySchema>

export const createCompanyPersonSchema = z.object({
  companyId: z.string().min(1),
  personId: z.string().min(1),
  role: z.string().min(1),
  employmentType: z
    .enum(['funktionær', 'ikke-funktionær', 'vikar', 'elev'])
    .optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  anciennityStart: z.string().optional(),
  contractId: z.string().optional(),
})

export type CreateCompanyPersonInput = z.infer<typeof createCompanyPersonSchema>

export const updateCompanyPersonSchema = z.object({
  companyId: z.string().min(1),
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

export type UpdateCompanyPersonInput = z.infer<typeof updateCompanyPersonSchema>

export const createOwnershipSchema = z.object({
  companyId: z.string().min(1),
  ownerType: z.enum(['person', 'company']),
  ownerPersonId: z.string().optional(),
  ownerCompanyId: z.string().optional(),
  ownershipPct: z.number().min(0).max(100),
  shareClass: z.string().optional(),
  effectiveDate: z.string().optional(),
  contractId: z.string().optional(),
})

export type CreateOwnershipInput = z.infer<typeof createOwnershipSchema>

export const updateOwnershipSchema = z.object({
  id: z.string().min(1),
  ownershipPct: z.number().min(0).max(100).optional(),
  shareClass: z.string().optional(),
  effectiveDate: z.string().optional(),
  contractId: z.string().optional(),
})

export type UpdateOwnershipInput = z.infer<typeof updateOwnershipSchema>