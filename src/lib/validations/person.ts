import { z } from 'zod'

// ==================== PERSON SCHEMAS ====================

export const createPersonSchema = z.object({
  firstName: z
    .string()
    .min(1, 'Fornavn er påkrævet')
    .max(100, 'Fornavn må maks være 100 tegn'),
  lastName: z
    .string()
    .min(1, 'Efternavn er påkrævet')
    .max(100, 'Efternavn må maks være 100 tegn'),
  email: z
    .string()
    .email('Ugyldig e-mailadresse')
    .optional()
    .nullable()
    .or(z.literal('')),
  phone: z
    .string()
    .max(50, 'Telefonnummer må maks være 50 tegn')
    .optional()
    .nullable(),
  notes: z.string().max(5000, 'Noter må maks være 5000 tegn').optional().nullable(),
  microsoftContactId: z.string().optional().nullable(),
})

export const updatePersonSchema = z.object({
  id: z.string().uuid('Ugyldigt person-ID'),
  firstName: z
    .string()
    .min(1, 'Fornavn er påkrævet')
    .max(100, 'Fornavn må maks være 100 tegn')
    .optional(),
  lastName: z
    .string()
    .min(1, 'Efternavn er påkrævet')
    .max(100, 'Efternavn må maks være 100 tegn')
    .optional(),
  email: z
    .string()
    .email('Ugyldig e-mailadresse')
    .optional()
    .nullable()
    .or(z.literal('')),
  phone: z
    .string()
    .max(50, 'Telefonnummer må maks være 50 tegn')
    .optional()
    .nullable(),
  notes: z.string().max(5000, 'Noter må maks være 5000 tegn').optional().nullable(),
  microsoftContactId: z.string().optional().nullable(),
})

export const personSearchSchema = z.object({
  query: z.string().max(200, 'Søgetekst må maks være 200 tegn').optional(),
  companyId: z.string().uuid('Ugyldigt selskabs-ID').optional(),
  role: z.string().max(100, 'Rolle må maks være 100 tegn').optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
})

// ==================== COMPANY-PERSON SCHEMAS ====================

export const linkPersonToCompanySchema = z.object({
  personId: z.string().uuid('Ugyldigt person-ID'),
  companyId: z.string().uuid('Ugyldigt selskabs-ID'),
  role: z.enum(['direktør', 'bestyrelsesmedlem', 'ansat', 'revisor', 'advokat', 'anden'], {
    errorMap: () => ({ message: 'Ugyldig rolle' }),
  }),
  employmentType: z
    .enum(['funktionær', 'ikke-funktionær', 'vikar', 'elev'])
    .optional()
    .nullable(),
  startDate: z.coerce.date().optional().nullable(),
  endDate: z.coerce.date().optional().nullable(),
  anciennityStart: z.coerce.date().optional().nullable(),
  contractId: z.string().uuid('Ugyldigt kontrakt-ID').optional().nullable(),
})

export const updatePersonCompanyLinkSchema = z.object({
  id: z.string().uuid('Ugyldigt ID'),
  role: z
    .enum(['direktør', 'bestyrelsesmedlem', 'ansat', 'revisor', 'advokat', 'anden'])
    .optional(),
  employmentType: z
    .enum(['funktionær', 'ikke-funktionær', 'vikar', 'elev'])
    .optional()
    .nullable(),
  startDate: z.coerce.date().optional().nullable(),
  endDate: z.coerce.date().optional().nullable(),
  anciennityStart: z.coerce.date().optional().nullable(),
  contractId: z.string().uuid('Ugyldigt kontrakt-ID').optional().nullable(),
})

// ==================== OUTLOOK IMPORT SCHEMAS ====================

export const outlookContactSchema = z.object({
  microsoftContactId: z.string(),
  displayName: z.string().optional(),
  givenName: z.string().optional(),
  surname: z.string().optional(),
  emailAddresses: z
    .array(
      z.object({
        address: z.string().email().optional(),
        name: z.string().optional(),
      })
    )
    .optional(),
  mobilePhone: z.string().optional().nullable(),
  businessPhones: z.array(z.string()).optional(),
})

export const importOutlookContactsSchema = z.object({
  contacts: z.array(outlookContactSchema).min(1, 'Vælg mindst én kontakt'),
})

// ==================== TYPES ====================

export type CreatePersonInput = z.infer<typeof createPersonSchema>
export type UpdatePersonInput = z.infer<typeof updatePersonSchema>
export type PersonSearchInput = z.infer<typeof personSearchSchema>
export type LinkPersonToCompanyInput = z.infer<typeof linkPersonToCompanySchema>
export type UpdatePersonCompanyLinkInput = z.infer<typeof updatePersonCompanyLinkSchema>
export type OutlookContact = z.infer<typeof outlookContactSchema>
export type ImportOutlookContactsInput = z.infer<typeof importOutlookContactsSchema>