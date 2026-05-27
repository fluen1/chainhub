import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({
  prisma: {
    company: { findFirst: vi.fn() },
    documentExtraction: { findMany: vi.fn() },
  },
}))
vi.mock('@/lib/permissions', () => ({
  canAccessModule: vi.fn().mockResolvedValue(true),
}))
vi.mock('@/lib/integrations/cvr/client', () => ({
  lookupByCvr: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({ captureError: vi.fn() }))

import { getAutofillSuggestions } from '@/actions/autofill'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { lookupByCvr } from '@/lib/integrations/cvr/client'
import { canAccessModule } from '@/lib/permissions'

const mockSession = {
  user: { id: 'user1', organizationId: 'org1' },
}

describe('getAutofillSuggestions', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(canAccessModule).mockResolvedValue(true)
    vi.mocked(prisma.company.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.documentExtraction.findMany).mockResolvedValue([])
    vi.mocked(lookupByCvr).mockResolvedValue({ found: false, data: null, source: 'cvr_api' })
  })

  // ── Auth ──────────────────────────────────────────────────

  it('returnerer fejl uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const result = await getAutofillSuggestions({ entityType: 'company' })

    expect(result.error).toBe('Ikke autoriseret')
  })

  // ── CVR API-kilde ─────────────────────────────────────────

  it('returnerer CVR API-forslag ved gyldigt CVR', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession as never)
    vi.mocked(lookupByCvr).mockResolvedValue({
      found: true,
      source: 'cvr_api',
      data: {
        cvr: '12345678',
        name: 'Test ApS',
        address: 'Testvej 1',
        city: 'København',
        postalCode: '2100',
        companyType: 'ApS',
        foundedDate: '2010-01-01',
        capital: 50000,
        status: 'NORMAL',
        signingRule: 'Tegnes af direktøren',
      },
    })

    const result = await getAutofillSuggestions({ entityType: 'company', cvr: '12345678' })

    expect(result.error).toBeUndefined()
    expect(result.data).toBeDefined()

    const suggestions = result.data!.suggestions
    const nameS = suggestions.find((s) => s.field === 'name')
    expect(nameS).toBeDefined()
    expect(nameS!.value).toBe('Test ApS')
    expect(nameS!.source).toBe('cvr_api')
    expect(nameS!.confidence).toBe(0.99)
  })

  // ── Intern kilde ─────────────────────────────────────────

  it('returnerer interne forslag med højere confidence ved eksisterende selskab', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession as never)
    vi.mocked(lookupByCvr).mockResolvedValue({
      found: true,
      source: 'cvr_api',
      data: {
        cvr: '12345678',
        name: 'Test ApS (API)',
        address: null,
        city: null,
        postalCode: null,
        companyType: null,
        foundedDate: null,
        capital: null,
        status: null,
        signingRule: null,
      },
    })
    vi.mocked(prisma.company.findFirst).mockResolvedValue({
      id: 'company-uuid-1',
      name: 'Test ApS (Intern)',
      cvr: '12345678',
      address: 'Intern Vej 5',
      city: 'Aarhus',
      postal_code: '8000',
      company_type: 'ApS',
      status: 'aktiv',
    } as never)

    const result = await getAutofillSuggestions({ entityType: 'company', cvr: '12345678' })

    expect(result.data).toBeDefined()
    expect(result.data!.existingEntityId).toBe('company-uuid-1')

    const suggestions = result.data!.suggestions
    const nameS = suggestions.find((s) => s.field === 'name')
    // Intern confidence (1.0) > CVR API confidence (0.99) → intern vinder
    expect(nameS!.source).toBe('internal')
    expect(nameS!.confidence).toBe(1.0)
    expect(nameS!.value).toBe('Test ApS (Intern)')
  })

  // ── Tom resultat ─────────────────────────────────────────

  it('returnerer tomt suggestions-array når ingen data findes', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession as never)
    vi.mocked(lookupByCvr).mockResolvedValue({ found: false, data: null, source: 'cvr_api' })
    vi.mocked(prisma.company.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.documentExtraction.findMany).mockResolvedValue([])

    const result = await getAutofillSuggestions({ entityType: 'company', cvr: '99999999' })

    expect(result.data).toBeDefined()
    expect(result.data!.suggestions).toEqual([])
    expect(result.data!.existingEntityId).toBeUndefined()
  })

  // ── Dokument-ekstraktion ─────────────────────────────────

  it('tilføjer dokument-ekstraktionsforslag med confidence 0.8', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession as never)
    vi.mocked(prisma.documentExtraction.findMany).mockResolvedValue([
      {
        extracted_fields: {
          cvr: '12345678',
          signingRule: 'Tegnes af to direktører i forening',
          someOtherField: 'ekstraværdi',
        },
      },
    ] as never)

    const result = await getAutofillSuggestions({ entityType: 'company', cvr: '12345678' })

    expect(result.data).toBeDefined()
    const suggestions = result.data!.suggestions
    const signingS = suggestions.find((s) => s.field === 'signingRule')
    expect(signingS).toBeDefined()
    expect(signingS!.source).toBe('document_extraction')
    expect(signingS!.confidence).toBe(0.8)
  })

  // ── Ingen CVR → CVR API kaldes ikke ───────────────────────

  it('kalder ikke CVR API hvis intet CVR angives', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession as never)

    await getAutofillSuggestions({ entityType: 'company' })

    expect(lookupByCvr).not.toHaveBeenCalled()
  })

  // ── Kun company-entityType bruger CVR ────────────────────

  it('kalder ikke CVR API hvis entityType ikke er company', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession as never)

    await getAutofillSuggestions({ entityType: 'person', cvr: '12345678' })

    expect(lookupByCvr).not.toHaveBeenCalled()
  })
})
