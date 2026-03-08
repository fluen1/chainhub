import { z } from 'zod'
import { ACCEPTED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from '@/lib/storage'

export const uploadDocumentSchema = z.object({
  title: z.string().min(1, 'Titel er påkrævet').max(255, 'Titel må maks. være 255 tegn'),
  fileName: z.string().min(1, 'Filnavn er påkrævet'),
  fileType: z.enum(
    ACCEPTED_MIME_TYPES as [string, ...string[]],
    { errorMap: () => ({ message: 'Filtypen er ikke tilladt. Accepter: PDF, DOCX, XLSX, PNG, JPG' }) }
  ),
  fileSizeBytes: z
    .number()
    .int()
    .positive('Filstørrelse skal være positiv')
    .max(MAX_FILE_SIZE_BYTES, `Filen må maks. være 50MB`),
  companyId: z.string().uuid('Ugyldigt selskabs-ID').optional().nullable(),
  caseId: z.string().uuid('Ugyldigt sags-ID').optional().nullable(),
  sensitivity: z.enum(['PUBLIC', 'STANDARD', 'INTERN', 'FORTROLIG', 'STRENGT_FORTROLIG']),
  folderPath: z.string().max(500).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
})

export const confirmDocumentUploadSchema = z.object({
  title: z.string().min(1, 'Titel er påkrævet').max(255),
  fileKey: z.string().min(1, 'Filnøgle er påkrævet'),
  fileName: z.string().min(1, 'Filnavn er påkrævet'),
  fileType: z.string().min(1),
  fileSizeBytes: z.number().int().positive().max(MAX_FILE_SIZE_BYTES),
  companyId: z.string().uuid().optional().nullable(),
  caseId: z.string().uuid().optional().nullable(),
  sensitivity: z.enum(['PUBLIC', 'STANDARD', 'INTERN', 'FORTROLIG', 'STRENGT_FORTROLIG']),
  folderPath: z.string().max(500).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
})

export const listDocumentsSchema = z.object({
  companyId: z.string().uuid().optional(),
  caseId: z.string().uuid().optional(),
  sensitivity: z
    .enum(['PUBLIC', 'STANDARD', 'INTERN', 'FORTROLIG', 'STRENGT_FORTROLIG'])
    .optional(),
  fileType: z.string().optional(),
  search: z.string().max(200).optional(),
  folderPath: z.string().optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
})

export const getDocumentSchema = z.object({
  documentId: z.string().uuid('Ugyldigt dokument-ID'),
})

export const updateDocumentSchema = z.object({
  documentId: z.string().uuid('Ugyldigt dokument-ID'),
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional().nullable(),
  folderPath: z.string().max(500).optional().nullable(),
  sensitivity: z
    .enum(['PUBLIC', 'STANDARD', 'INTERN', 'FORTROLIG', 'STRENGT_FORTROLIG'])
    .optional(),
  companyId: z.string().uuid().optional().nullable(),
  caseId: z.string().uuid().optional().nullable(),
})

export const deleteDocumentSchema = z.object({
  documentId: z.string().uuid('Ugyldigt dokument-ID'),
})

export const requestDocumentUploadUrlSchema = z.object({
  fileName: z.string().min(1, 'Filnavn er påkrævet'),
  fileType: z.enum(
    ACCEPTED_MIME_TYPES as [string, ...string[]],
    { errorMap: () => ({ message: 'Filtypen er ikke tilladt' }) }
  ),
  fileSizeBytes: z.number().int().positive().max(MAX_FILE_SIZE_BYTES, 'Filen er for stor (maks. 50MB)'),
  companyId: z.string().uuid().optional().nullable(),
  caseId: z.string().uuid().optional().nullable(),
})

export const getDownloadUrlSchema = z.object({
  documentId: z.string().uuid('Ugyldigt dokument-ID'),
})