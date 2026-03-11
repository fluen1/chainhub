import { z } from 'zod'

export const addOwnerSchema = z.object({
  companyId: z.string().uuid(),
  personId: z.string().uuid().optional(),
  // new person fields if no personId
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  personEmail: z.string().email().optional().or(z.literal('')),
  ownershipPct: z.coerce.number().min(0.01).max(100),
  ownerType: z.enum(['PERSON', 'HOLDINGSELSKAB', 'ANDET_SELSKAB']),
  acquiredAt: z.string().optional(),
  contractId: z.string().uuid().optional().or(z.literal('')),
})

export const updateOwnershipSchema = z.object({
  ownershipId: z.string().uuid(),
  ownershipPct: z.coerce.number().min(0.01).max(100).optional(),
  acquiredAt: z.string().optional(),
  contractId: z.string().uuid().optional().or(z.literal('')),
})

export const endOwnershipSchema = z.object({
  ownershipId: z.string().uuid(),
  endDate: z.string(),
})

export type AddOwnerInput = z.infer<typeof addOwnerSchema>
export type UpdateOwnershipInput = z.infer<typeof updateOwnershipSchema>
export type EndOwnershipInput = z.infer<typeof endOwnershipSchema>
