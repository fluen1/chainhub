import { z } from 'zod'

export const GOVERNANCE_ROLES = [
  'direktoer',
  'bestyrelsesformand',
  'bestyrelsesmedlem',
  'tegningsberettiget',
  'revisor',
] as const

export type GovernanceRole = (typeof GOVERNANCE_ROLES)[number]

export const addCompanyPersonSchema = z.object({
  companyId: z.string().min(1),
  personId: z.string().min(1).optional(),
  // new person if no personId
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  personEmail: z.string().email().optional().or(z.literal('')),
  role: z.string().min(1, 'Rolle er påkrævet'),
  employmentType: z.string().optional(),
  startDate: z.string().optional(),
  contractId: z.string().min(1).optional().or(z.literal('')),
})

export const endCompanyPersonSchema = z.object({
  companyPersonId: z.string().min(1),
  endDate: z.string(),
})

export type AddCompanyPersonInput = z.infer<typeof addCompanyPersonSchema>
export type EndCompanyPersonInput = z.infer<typeof endCompanyPersonSchema>
