import { z } from 'zod'

const userRoles = [
  'GROUP_OWNER',
  'GROUP_ADMIN',
  'GROUP_LEGAL',
  'GROUP_FINANCE',
  'GROUP_READONLY',
  'COMPANY_MANAGER',
  'COMPANY_LEGAL',
  'COMPANY_READONLY',
] as const

export const createUserSchema = z.object({
  email: z.string().email('Ugyldig email'),
  name: z.string().min(2, 'Navn skal være mindst 2 tegn'),
  password: z.string().min(8, 'Adgangskode skal være mindst 8 tegn'),
  role: z.enum(userRoles),
  companyIds: z.array(z.string().min(1)).default([]),
})

export const updateUserRoleSchema = z.object({
  userId: z.string().min(1, 'Bruger-ID mangler'),
  role: z.enum(userRoles),
  companyIds: z.array(z.string().min(1)).default([]),
})

export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>
