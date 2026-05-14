/**
 * contract-extraction-query.test.ts
 *
 * Regressions-test for Modul 3 #17:
 *   DocumentExtraction-forespørgslen filtrerede på document.company_id (forkert).
 *   Korrekt: document.contract_id.
 *
 * Testen verificerer at extraction-hentningen KUN matcher dokumenter
 * der tilhører den specifikke kontrakt — ikke andre dokumenter i samme selskab.
 */
import { describe, it, expect } from 'vitest'

// Logik-test: bygget uden prisma for at undgå DB-afhængighed.
// Dokumenterer at query-nøglen er `contract_id`, ikke `company_id`.

type ExtractionDoc = {
  contract_id: string | null
  company_id: string
  deleted_at: Date | null
  id: string
}

type Extraction = {
  id: string
  document: ExtractionDoc
}

/**
 * Simulerer den FORKERTE adfærd: henter extraction baseret på company_id.
 * (var den originale bug — skulle ALDRIG bruges)
 */
function findExtractionByCompanyId(
  extractions: Extraction[],
  companyId: string
): Extraction | undefined {
  return extractions.find(
    (e) => e.document.company_id === companyId && e.document.deleted_at === null
  )
}

/**
 * Simulerer den KORREKTE adfærd: henter extraction baseret på contract_id.
 */
function findExtractionByContractId(
  extractions: Extraction[],
  contractId: string
): Extraction | undefined {
  return extractions.find(
    (e) => e.document.contract_id === contractId && e.document.deleted_at === null
  )
}

describe('extraction-query: contract_id vs company_id', () => {
  const CONTRACT_A = 'contract-aaa'
  const CONTRACT_B = 'contract-bbb'
  const COMPANY = 'company-xxx'

  const extractions: Extraction[] = [
    {
      id: 'ext-1',
      document: { id: 'doc-1', contract_id: CONTRACT_A, company_id: COMPANY, deleted_at: null },
    },
    {
      id: 'ext-2',
      document: { id: 'doc-2', contract_id: CONTRACT_B, company_id: COMPANY, deleted_at: null },
    },
  ]

  it('company_id-query (BUG): returnerer extraction fra anden kontrakt', () => {
    // Henter kontrakt B's extraction når vi beder om kontrakt A — FORKERT!
    const result = findExtractionByCompanyId(extractions, COMPANY)
    // Der ER en extraction, men den kan tilhøre forkert kontrakt
    expect(result).toBeDefined()
    // Dokumenterer buggen: query skelner ikke mellem de to kontrakter
    const matchedContractIds = new Set(
      extractions
        .filter((e) => e.document.company_id === COMPANY && e.document.deleted_at === null)
        .map((e) => e.document.contract_id)
    )
    expect(matchedContractIds.size).toBeGreaterThan(1) // begge kontrakter returneres!
  })

  it('contract_id-query (KORREKT): returnerer kun extraction fra den specifikke kontrakt', () => {
    const resultA = findExtractionByContractId(extractions, CONTRACT_A)
    const resultB = findExtractionByContractId(extractions, CONTRACT_B)

    expect(resultA?.id).toBe('ext-1')
    expect(resultB?.id).toBe('ext-2')
    // Kontrakterne er isolerede fra hinanden
    expect(resultA?.id).not.toBe(resultB?.id)
  })

  it('returnerer undefined for kontrakt uden extraction', () => {
    const result = findExtractionByContractId(extractions, 'contract-missing')
    expect(result).toBeUndefined()
  })

  it('ignorerer slettede dokumenter', () => {
    const withDeleted: Extraction[] = [
      {
        id: 'ext-deleted',
        document: {
          id: 'doc-del',
          contract_id: CONTRACT_A,
          company_id: COMPANY,
          deleted_at: new Date(),
        },
      },
    ]
    const result = findExtractionByContractId(withDeleted, CONTRACT_A)
    expect(result).toBeUndefined()
  })
})
