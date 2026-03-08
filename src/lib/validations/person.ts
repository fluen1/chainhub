import { z } from 'zod'

export const createPersonSchema = z.object({
  firstName: z
    .string()
    .min(1, 'Fornavn er påkrævet')
    .max(100, 'Fornavn må højst være 100 tegn'),
  lastName: z
    .string()
    .min(1, 'Efternavn er påkrævet')
    .max(100, 'Efternavn må højst være 100 tegn'),
  email: z
    .string()
    .email('Ugyldig e-mailadresse')
    .max(255, 'E-mail må højst være 255 tegn')
    .optional()
    .or(z.literal('')),
  phone: z
    .string()
    .max(50, 'Telefonnummer må højst være 50 tegn')
    .optional()
    .or(z.literal('')),
  notes: z
    .string()
    .max(5000, 'Notater må højst være 5000 tegn')
    .optional()
    .or(z.literal('')),
})

export const updatePersonSchema = z.object({
  personId: z.string().uuid('Ugyldigt person-ID'),
  firstName: z
    .string()
    .min(1, 'Fornavn er påkrævet')
    .max(100, 'Fornavn må højst være 100 tegn')
    .optional(),
  lastName: z
    .string()
    .min(1, 'Efternavn er påkrævet')
    .max(100, 'Efternavn må højst være 100 tegn')
    .optional(),
  email: z
    .string()
    .email('Ugyldig e-mailadresse')
    .max(255, 'E-mail må højst være 255 tegn')
    .optional()
    .or(z.literal('')),
  phone: z
    .string()
    .max(50, 'Telefonnummer må højst være 50 tegn')
    .optional()
    .or(z.literal('')),
  notes: z
    .string()
    .max(5000, 'Notater må højst være 5000 tegn')
    .optional()
    .or(z.literal('')),
})

export const deletePersonSchema = z.object({
  personId: z.string().uuid('Ugyldigt person-ID'),
})

export const getPersonSchema = z.object({
  personId: z.string().uuid('Ugyldigt person-ID'),
})

export const listPersonsSchema = z.object({
  search: z.string().max(255).optional(),
  companyId: z.string().uuid().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
})

export const addPersonToCompanySchema = z.object({
  personId: z.string().uuid('Ugyldigt person-ID'),
  companyId: z.string().uuid('Ugyldigt selskabs-ID'),
  role: z
    .string()
    .min(1, 'Rolle er påkrævet')
    .max(100, 'Rolle må højst være 100 tegn'),
  employmentType: z
    .enum(['funktionær', 'ikke-funktionær', 'vikar', 'elev'])
    .optional(),
  startDate: z.string().optional().or(z.literal('')),
  endDate: z.string().optional().or(z.literal('')),
  anciennityStart: z.string().optional().or(z.literal('')),
  contractId: z.string().uuid().optional(),
})

export const removePersonFromCompanySchema = z.object({
  companyPersonId: z.string().uuid('Ugyldigt tilknytnings-ID'),
  companyId: z.string().uuid('Ugyldigt selskabs-ID'),
})

export const updatePersonCompanyRoleSchema = z.object({
  companyPersonId: z.string().uuid('Ugyldigt tilknytnings-ID'),
  companyId: z.string().uuid('Ugyldigt selskabs-ID'),
  role: z
    .string()
    .min(1, 'Rolle er påkrævet')
    .max(100, 'Rolle må højst være 100 tegn')
    .optional(),
  employmentType: z
    .enum(['funktionær', 'ikke-funktionær', 'vikar', 'elev'])
    .optional()
    .nullable(),
  startDate: z.string().optional().or(z.literal('')).nullable(),
  endDate: z.string().optional().or(z.literal('')).nullable(),
  anciennityStart: z.string().optional().or(z.literal('')).nullable(),
})

export const importOutlookContactSchema = z.object({
  microsoftContactId: z.string().min(1, 'Microsoft kontakt-ID er påkrævet'),
  firstName: z.string().min(1, 'Fornavn er påkrævet').max(100),
  lastName: z.string().min(1, 'Efternavn er påkrævet').max(100),
  email: z.string().email('Ugyldig e-mailadresse').optional().or(z.literal('')),
  phone: z.string().max(50).optional().or(z.literal('')),
})

export const importOutlookContactsBatchSchema = z.object({
  contacts: z
    .array(importOutlookContactSchema)
    .min(1, 'Mindst én kontakt skal vælges')
    .max(100, 'Højst 100 kontakter kan importeres ad gangen'),
})