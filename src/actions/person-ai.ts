'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canAccessCompany } from '@/lib/permissions'
import { createLogger } from '@/lib/logger'
import type { ActionResult } from '@/types/actions'

const log = createLogger('action:person-ai')

export interface PersonContractExtraction {
  contractId: string
  contractDisplayName: string
  contractSystemType: string
  companyId: string
  companyName: string | null
  documentId: string
  extractionId: string
  detectedType: string | null
  extractedAt: Date
  fields: Record<
    string,
    {
      value: unknown
      confidence: number
      sourcePage: number | null
      sourceText: string | null
    }
  >
}

/**
 * Hent AI-ekstraherede kontrakt-vilkår for en person på tværs af de
 * kontrakter hvor personen er part. Data kommer fra DocumentExtraction
 * linket via ContractParty → Contract → Document.
 *
 * Permission-check pr. contract.company_id før data returneres.
 */
export async function getPersonAIExtractions(
  personId: string
): Promise<ActionResult<PersonContractExtraction[]>> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  try {
    const parties = await prisma.contractParty.findMany({
      where: {
        person_id: personId,
        organization_id: session.user.organizationId,
      },
      include: {
        contract: {
          include: {
            documents: {
              where: { deleted_at: null },
              include: { extraction: true },
            },
            company: { select: { id: true, name: true } },
          },
        },
      },
    })

    const result: PersonContractExtraction[] = []
    for (const party of parties) {
      const contract = party.contract
      if (!contract || contract.deleted_at) continue

      // Permission-check pr. contract — springer contracts over hvis ingen adgang
      const hasAccess = await canAccessCompany(session.user.id, contract.company_id)
      if (!hasAccess) continue

      for (const doc of contract.documents) {
        if (!doc.extraction) continue

        const rawFields = (doc.extraction.extracted_fields ?? {}) as Record<string, unknown>
        const normalizedFields: PersonContractExtraction['fields'] = {}

        for (const [key, rawValue] of Object.entries(rawFields)) {
          if (rawValue && typeof rawValue === 'object' && 'value' in rawValue) {
            const v = rawValue as Record<string, unknown>
            normalizedFields[key] = {
              value: v.value,
              confidence: typeof v.claude_confidence === 'number' ? v.claude_confidence : 0,
              sourcePage: typeof v.source_page === 'number' ? v.source_page : null,
              sourceText: typeof v.source_text === 'string' ? v.source_text : null,
            }
          }
        }

        result.push({
          contractId: contract.id,
          contractDisplayName: contract.display_name ?? 'Ukendt kontrakt',
          contractSystemType: contract.system_type,
          companyId: contract.company.id,
          companyName: contract.company.name,
          documentId: doc.id,
          extractionId: doc.extraction.id,
          detectedType: doc.extraction.detected_type ?? null,
          extractedAt: doc.extraction.created_at,
          fields: normalizedFields,
        })
      }
    }

    return { data: result }
  } catch (err) {
    log.error(
      { err: err instanceof Error ? err.message : String(err), personId },
      'getPersonAIExtractions failed'
    )
    return { error: 'Kunne ikke hente AI-ekstraktioner' }
  }
}
