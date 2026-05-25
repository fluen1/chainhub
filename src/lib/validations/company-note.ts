import { z } from 'zod'

export const createCompanyNoteSchema = z.object({
  companyId: z.string().min(1, 'Selskab er påkrævet'),
  content: z
    .string()
    .min(1, 'Notat må ikke være tomt')
    .max(5000, 'Notat er for langt (max 5000 tegn)'),
})

export const updateCompanyNoteSchema = z.object({
  noteId: z.string().min(1),
  content: z
    .string()
    .min(1, 'Notat må ikke være tomt')
    .max(5000, 'Notat er for langt (max 5000 tegn)'),
})

export const togglePinNoteSchema = z.object({
  noteId: z.string().min(1),
})

export type CreateCompanyNoteInput = z.infer<typeof createCompanyNoteSchema>
export type UpdateCompanyNoteInput = z.infer<typeof updateCompanyNoteSchema>
