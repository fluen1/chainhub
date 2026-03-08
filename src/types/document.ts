import { Document, Company, Case, Contract } from '@prisma/client'

export type ActionResult<T> =
  | { data: T; error?: never }
  | { error: string; data?: never }

export type DocumentWithRelations = Document & {
  company: Company | null
  case: Case | null
}

export type UploadUrlResponse = {
  uploadUrl: string
  storagePath: string
  expiresAt: Date
}

export type DownloadUrlResponse = {
  downloadUrl: string
  expiresAt: Date
}