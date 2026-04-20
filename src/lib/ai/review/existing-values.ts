import type { Contract, ContractParty, Person, Ownership } from '@prisma/client'

export type ContractWithRelations = Contract & {
  parties: (ContractParty & { person: Person | null })[]
  ownerships: Ownership[]
}

function isoDate(date: Date | null | undefined): string | null {
  return date ? date.toISOString().slice(0, 10) : null
}

/**
 * Map AI-schema field-name to the existing value on a Contract + relations.
 * Returnerer null når Contract er null eller feltet ikke er sat.
 * Bruges af review-UI til at vise "I systemet: ..."-værdien ved siden af AI-forslag.
 */
export function getExistingValue(
  fieldName: string,
  contract: ContractWithRelations | null,
  schemaType: string
): string | null {
  // schemaType reserveret til fremtidig type-specifik mapping
  void schemaType
  if (!contract) return null

  if (fieldName === 'effective_date') return isoDate(contract.effective_date)
  if (fieldName === 'expiry_date') return isoDate(contract.expiry_date)
  if (fieldName === 'signed_date') return isoDate(contract.signed_date)
  if (fieldName === 'termination_notice_months') {
    return contract.notice_period_days != null
      ? String(Math.round(contract.notice_period_days / 30))
      : null
  }
  if (fieldName === 'contract_name') return contract.display_name

  if (fieldName === 'parties') {
    const names = contract.parties
      .map((p) => {
        if (p.counterparty_name) return p.counterparty_name
        if (p.person) {
          const full = `${p.person.first_name ?? ''} ${p.person.last_name ?? ''}`.trim()
          return full.length > 0 ? full : null
        }
        return null
      })
      .filter((v): v is string => v !== null && v.length > 0)
    return names.length > 0 ? names.join(', ') : null
  }

  if (fieldName === 'ownership_split' || fieldName === 'ownerships') {
    if (contract.ownerships.length === 0) return null
    return contract.ownerships.map((o) => `${o.ownership_pct.toString()}%`).join(', ')
  }

  const typeData = contract.type_data as Record<string, unknown> | null
  if (typeData && fieldName in typeData) {
    const val = typeData[fieldName]
    return val != null ? String(val) : null
  }

  return null
}
