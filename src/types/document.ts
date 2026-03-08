import type { Document, Company, Case, SensitivityLevel } from '@prisma/client'

export type DocumentWithRelations = Document & {
  company: Pick<Company, 'id' | 'name'> | null
  case: Pick<Case, 'id' | 'title'> | null
}

export type DocumentUploadUrlResponse = {
  uploadUrl: string
  fileKey: string
  fileUrl: string
}

export type DocumentListResult = {
  documents: DocumentWithRelations[]
  total: number
  page: number
  pageSize: number
}

export type ActionResult<T> =
  | { data: T; error?: never }
  | { error: string; data?: never }

export type SensitivityInfo = {
  level: SensitivityLevel
  label: string
  color: string
  bgColor: string
}

export const SENSITIVITY_INFO: Record<SensitivityLevel, SensitivityInfo> = {
  PUBLIC: {
    level: 'PUBLIC',
    label: 'Offentlig',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
  },
  STANDARD: {
    level: 'STANDARD',
    label: 'Standard',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
  },
  INTERN: {
    level: 'INTERN',
    label: 'Intern',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-50',
  },
  FORTROLIG: {
    level: 'FORTROLIG',
    label: 'Fortrolig',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
  },
  STRENGT_FORTROLIG: {
    level: 'STRENGT_FORTROLIG',
    label: 'Strengt fortrolig',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
  },
}

export const FILE_TYPE_LABELS: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
  'image/png': 'PNG',
  'image/jpeg': 'JPEG',
}

export const FILE_TYPE_ICONS: Record<string, string> = {
  'application/pdf': '📄',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📝',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '📊',
  'image/png': '🖼️',
  'image/jpeg': '🖼️',
}