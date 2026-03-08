import { z } from 'zod'
import { SensitivityLevel } from '@prisma/client'
import { ALLOWED_FILE_TYPES, MAX_FILE_SIZE_BYTES } from '@/lib/storage'

// ==================== CREATE ====================

export const createDocumentSchema = z.object({
  title: z.string().min(1, 'Titel er påkrævet').max(255, 'Titel må maks være 255 tegn'),
  companyId: z.string().uuid('Ugyldigt selskabs-ID').optional().nullable(),
  caseId: z.string().uuid('Ugyldigt sags-ID').optional().nullable(),
  contractId: z.string().uuid('Ugyldigt kontrakt-ID').optional().nullable(),
  sensitivity: z.nativeEnum(SensitivityLevel).optional().default('STANDARD'),
  folderPath: z.string().max(500).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  // Fil-metadata (sættes efter upload)
  fileUrl: z.string().min(1, 'Fil-URL er påkrævet'),
  fileName: z.string().min(1, 'Filnavn er påkrævet').max(255),
  fileSizeBytes: z.number().min(1).max(MAX_FILE_SIZE_BYTES, 'Filen er for stor (maks 50MB)'),
  fileType: z.string().refine(
    (type) => (ALLOWED_FILE_TYPES as readonly string[]).includes(type),
    'Filtypen er ikke tilladt'
  ),
})

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>

// ==================== UPDATE ====================

export const updateDocumentSchema = z.object({
  id: z.string().uuid('Ugyldigt dokument-ID'),
  title: z.string().min(1).max(255).optional(),
  companyId: z.string().uuid().optional().nullable(),
  caseId: z.string().uuid().optional().nullable(),
  sensitivity: z.nativeEnum(SensitivityLevel).optional(),
  folderPath: z.string().max(500).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
})

export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>

// ==================== LIST FILTER ====================

export const listDocumentsFilterSchema = z.object({
  companyId: z.string().uuid().optional(),
  caseId: z.string().uuid().optional(),
  contractId: z.string().uuid().optional(),
  sensitivity: z.nativeEnum(SensitivityLevel).optional(),
  fileType: z.string().optional(),
  folderPath: z.string().optional(),
  search: z.string().optional(),
  limit: z.number().min(1).max(100).optional().default(50),
  offset: z.number().min(0).optional().default(0),
})

export type ListDocumentsFilter = z.infer<typeof listDocumentsFilterSchema>

// ==================== UPLOAD REQUEST ====================

export const requestUploadUrlSchema = z.object({
  fileName: z.string().min(1, 'Filnavn er påkrævet').max(255),
  fileType: z.string().refine(
    (type) => (ALLOWED_FILE_TYPES as readonly string[]).includes(type),
    'Filtypen er ikke tilladt. Tilladt: PDF, DOCX, XLSX, PNG, JPG'
  ),
  fileSizeBytes: z.number()
    .min(1, 'Filstørrelse skal være større end 0')
    .max(MAX_FILE_SIZE_BYTES, 'Filen er for stor (maks 50MB)'),
  entityType: z.enum(['document', 'contract-version', 'contract-attachment']),
  entityId: z.string().uuid().optional(), // Kan være tom ved ny oprettelse
})

export type RequestUploadUrlInput = z.infer<typeof requestUploadUrlSchema>

// ==================== HELPERS ====================

/**
 * Formatér filstørrelse til læsbar tekst
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

/**
 * Hent læsbar filtype-navn
 */
export function getFileTypeName(mimeType: string): string {
  const names: Record<string, string> = {
    'application/pdf': 'PDF',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
    'image/png': 'PNG-billede',
    'image/jpeg': 'JPG-billede',
  }
  return names[mimeType] || 'Ukendt'
}