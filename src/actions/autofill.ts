'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { lookupByCvr } from '@/lib/integrations/cvr/client'
import type { ActionResult } from '@/types/actions'

export interface AutofillSuggestion {
  field: string
  value: string | number | null
  source: 'cvr_api' | 'internal' | 'document_extraction'
  confidence: number
}

export interface AutofillInput {
  entityType: 'company' | 'contract' | 'person'
  cvr?: string
  personName?: string
  companyId?: string
}

export interface AutofillResult {
  suggestions: AutofillSuggestion[]
  existingEntityId?: string
}

// ─────────────────────────────────────────────────────────────
// Hjælpefunktion: dedupliker på felt — bevar højeste confidence
// ─────────────────────────────────────────────────────────────
function deduplicateSuggestions(suggestions: AutofillSuggestion[]): AutofillSuggestion[] {
  const byField = new Map<string, AutofillSuggestion>()
  for (const s of suggestions) {
    const existing = byField.get(s.field)
    if (!existing || s.confidence > existing.confidence) {
      byField.set(s.field, s)
    }
  }
  return Array.from(byField.values())
}

// ─────────────────────────────────────────────────────────────
// getAutofillSuggestions
// ─────────────────────────────────────────────────────────────
export async function getAutofillSuggestions(
  input: AutofillInput
): Promise<ActionResult<AutofillResult>> {
  const session = await auth()
  if (!session?.user) return { error: 'Ikke autoriseret' }

  const orgId = session.user.organizationId
  const allSuggestions: AutofillSuggestion[] = []
  let existingEntityId: string | undefined

  // ── Kilde 1: CVR API ──────────────────────────────────────
  if (input.cvr && input.entityType === 'company') {
    const cvrResult = await lookupByCvr(input.cvr)
    if (cvrResult.found && cvrResult.data) {
      const d = cvrResult.data
      const fields: Array<[string, string | number | null]> = [
        ['name', d.name],
        ['cvr', d.cvr],
        ['address', d.address],
        ['city', d.city],
        ['postalCode', d.postalCode],
        ['companyType', d.companyType],
        ['foundedDate', d.foundedDate],
        ['capital', d.capital],
        ['status', d.status],
        ['signingRule', d.signingRule],
      ]
      for (const [field, value] of fields) {
        if (value !== null) {
          allSuggestions.push({ field, value, source: 'cvr_api', confidence: 0.99 })
        }
      }
    }
  }

  // ── Kilde 2: Internt — eksisterende selskab i org ─────────
  if (input.cvr && input.entityType === 'company') {
    const existing = await prisma.company.findFirst({
      where: {
        organization_id: orgId,
        cvr: input.cvr,
        deleted_at: null,
      },
      select: {
        id: true,
        name: true,
        cvr: true,
        address: true,
        city: true,
        postal_code: true,
        company_type: true,
        status: true,
      },
    })

    if (existing) {
      existingEntityId = existing.id
      const internalFields: Array<[string, string | null]> = [
        ['name', existing.name],
        ['cvr', existing.cvr ?? null],
        ['address', existing.address],
        ['city', existing.city],
        ['postalCode', existing.postal_code],
        ['companyType', existing.company_type],
        ['status', existing.status],
      ]
      for (const [field, value] of internalFields) {
        if (value !== null) {
          allSuggestions.push({ field, value, source: 'internal', confidence: 1.0 })
        }
      }
    }
  }

  // ── Kilde 3: Dokument-ekstraktioner ───────────────────────
  if (input.cvr && input.entityType === 'company') {
    const extractions = await prisma.documentExtraction.findMany({
      where: {
        organization_id: orgId,
        extraction_status: 'completed',
      },
      select: {
        extracted_fields: true,
      },
      orderBy: { reviewed_at: 'desc' },
      take: 20,
    })

    for (const extraction of extractions) {
      const fields = extraction.extracted_fields as Record<string, unknown>
      if (typeof fields !== 'object' || fields === null) continue

      // Match kun ekstraktioner der indeholder samme CVR
      const extractedCvr =
        (fields['cvr'] as string | undefined) ?? (fields['company_cvr'] as string | undefined)
      if (extractedCvr !== input.cvr) continue

      for (const [field, value] of Object.entries(fields)) {
        if (field === 'cvr' || field === 'company_cvr') continue
        if (value !== null && value !== undefined && value !== '') {
          allSuggestions.push({
            field,
            value: value as string | number,
            source: 'document_extraction',
            confidence: 0.8,
          })
        }
      }
    }
  }

  const suggestions = deduplicateSuggestions(allSuggestions)

  return {
    data: {
      suggestions,
      ...(existingEntityId ? { existingEntityId } : {}),
    },
  }
}
