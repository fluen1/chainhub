import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/logger', () => ({
  captureError: vi.fn(),
  createLogger: vi.fn(() => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn() })),
}))

const prismaMock = vi.hoisted(() => ({
  person: { create: vi.fn() },
  companyPerson: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/permissions', () => ({
  canAccessCompany: vi.fn().mockResolvedValue(true),
}))
vi.mock('@/lib/rate-limit', () => ({
  checkActionRateLimit: vi.fn().mockResolvedValue({ limited: false }),
}))
vi.mock('@/lib/audit', () => ({ recordAuditEvent: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { auth } from '@/lib/auth'
import { canAccessCompany } from '@/lib/permissions'
import { checkActionRateLimit } from '@/lib/rate-limit'
import { addCompanyPerson, endCompanyPerson } from '@/actions/governance'

const mockSession = {
  user: { id: 'u1', organizationId: 'org-1', email: 'test@test.dk', name: 'Test' },
  expires: '',
}

const validCompanyId = '00000000-0000-0000-0000-000000000001'
const validPersonId = '00000000-0000-0000-0000-000000000002'
const validCompanyPersonId = '00000000-0000-0000-0000-000000000003'

const fakeCompanyPerson = {
  id: validCompanyPersonId,
  organization_id: 'org-1',
  company_id: validCompanyId,
  person_id: validPersonId,
  role: 'bestyrelsesmedlem',
  employment_type: null,
  start_date: null,
  end_date: null,
  contract_id: null,
  created_by: 'u1',
  created_at: new Date(),
  updated_at: new Date(),
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(auth).mockResolvedValue(mockSession as never)
  vi.mocked(canAccessCompany).mockResolvedValue(true)
  vi.mocked(checkActionRateLimit).mockResolvedValue({ limited: false } as never)
})

// ---------------------------------------------------------------------------
// addCompanyPerson
// ---------------------------------------------------------------------------

describe('addCompanyPerson', () => {
  const validInput = {
    companyId: validCompanyId,
    personId: validPersonId,
    role: 'bestyrelsesmedlem',
    startDate: '2025-01-01',
  }

  it('returnerer fejl uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    const result = await addCompanyPerson(validInput)
    expect('error' in result).toBe(true)
    if ('error' in result) expect(result.error).toBe('Ikke autoriseret')
  })

  it('returnerer fejl ved ugyldigt input', async () => {
    const result = await addCompanyPerson({} as never)
    expect('error' in result).toBe(true)
  })

  it('returnerer fejl uden company-adgang', async () => {
    vi.mocked(canAccessCompany).mockResolvedValue(false)
    const result = await addCompanyPerson(validInput)
    expect('error' in result).toBe(true)
    if ('error' in result) expect(result.error).toMatch(/adgang/)
  })

  it('returnerer fejl ved rate limit', async () => {
    vi.mocked(checkActionRateLimit).mockResolvedValue({ limited: true } as never)
    const result = await addCompanyPerson(validInput)
    expect('error' in result).toBe(true)
    if ('error' in result) expect(result.error).toMatch(/mange handlinger/)
  })

  it('returnerer fejl ved eksisterende aktiv direktør', async () => {
    prismaMock.companyPerson.findFirst.mockResolvedValue({ id: 'existing-dir' })
    prismaMock.companyPerson.create.mockResolvedValue(fakeCompanyPerson)

    const result = await addCompanyPerson({
      ...validInput,
      role: 'direktoer',
    })
    expect('error' in result).toBe(true)
    if ('error' in result) expect(result.error).toMatch(/direktør/)
  })

  it('happy path — opretter companyPerson', async () => {
    prismaMock.companyPerson.findFirst.mockResolvedValue(null)
    prismaMock.companyPerson.create.mockResolvedValue(fakeCompanyPerson)

    const result = await addCompanyPerson(validInput)
    expect('data' in result).toBe(true)
    if ('data' in result) expect((result.data as { id: string }).id).toBe(validCompanyPersonId)
  })

  it('happy path med direktør-rolle — ingen eksisterende direktør', async () => {
    prismaMock.companyPerson.findFirst.mockResolvedValue(null)
    prismaMock.companyPerson.create.mockResolvedValue({
      ...fakeCompanyPerson,
      role: 'direktoer',
    })

    const result = await addCompanyPerson({ ...validInput, role: 'direktoer' })
    expect('data' in result).toBe(true)
  })

  it('returnerer fejl når firstName/lastName mangler ved ny person', async () => {
    const result = await addCompanyPerson({
      companyId: validCompanyId,
      role: 'bestyrelsesmedlem',
      // personId mangler — men også firstName/lastName
    } as never)
    expect('error' in result).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// endCompanyPerson
// ---------------------------------------------------------------------------

describe('endCompanyPerson', () => {
  const validInput = {
    companyPersonId: validCompanyPersonId,
    endDate: '2025-12-31',
  }

  const existingRecord = {
    organization_id: 'org-1',
    company_id: validCompanyId,
    person_id: validPersonId,
    role: 'bestyrelsesmedlem',
  }

  it('returnerer fejl uden session', async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    const result = await endCompanyPerson(validInput)
    expect('error' in result).toBe(true)
    if ('error' in result) expect(result.error).toBe('Ikke autoriseret')
  })

  it('returnerer fejl ved ugyldigt input', async () => {
    const result = await endCompanyPerson({} as never)
    expect('error' in result).toBe(true)
  })

  it('returnerer fejl når tilknytning ikke tilhører org', async () => {
    prismaMock.companyPerson.findFirst.mockResolvedValue({
      ...existingRecord,
      organization_id: 'other-org',
    })
    const result = await endCompanyPerson(validInput)
    expect('error' in result).toBe(true)
    if ('error' in result) expect(result.error).toMatch(/ikke fundet/)
  })

  it('returnerer fejl når tilknytning ikke eksisterer', async () => {
    prismaMock.companyPerson.findFirst.mockResolvedValue(null)
    const result = await endCompanyPerson(validInput)
    expect('error' in result).toBe(true)
  })

  it('returnerer fejl uden company-adgang', async () => {
    prismaMock.companyPerson.findFirst.mockResolvedValue(existingRecord)
    vi.mocked(canAccessCompany).mockResolvedValue(false)
    const result = await endCompanyPerson(validInput)
    expect('error' in result).toBe(true)
    if ('error' in result) expect(result.error).toMatch(/adgang/)
  })

  it('returnerer fejl ved rate limit', async () => {
    prismaMock.companyPerson.findFirst.mockResolvedValue(existingRecord)
    vi.mocked(checkActionRateLimit).mockResolvedValue({ limited: true } as never)
    const result = await endCompanyPerson(validInput)
    expect('error' in result).toBe(true)
  })

  it('happy path — afregistrerer tilknytning', async () => {
    prismaMock.companyPerson.findFirst.mockResolvedValue(existingRecord)
    prismaMock.companyPerson.update.mockResolvedValue({
      ...fakeCompanyPerson,
      end_date: new Date('2025-12-31'),
    })

    const result = await endCompanyPerson(validInput)
    expect('data' in result).toBe(true)
  })
})
