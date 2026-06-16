import { z } from 'zod'

export const submitForReviewSchema = z.object({
  documentId: z.string().min(1),
})

export const reviewDocumentSchema = z.object({
  documentId: z.string().min(1),
  decision: z.enum(['GODKENDT', 'AFVIST']),
  comment: z.string().max(2000, 'Kommentar må maks. være 2000 tegn').optional(),
})
