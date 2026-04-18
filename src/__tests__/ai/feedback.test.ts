import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Prisma client before importing feedback
vi.mock('@/lib/db', () => ({
  prisma: {
    aIFieldCorrection: {
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/ai/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

import { logFieldCorrection } from '@/lib/ai/feedback'
import { prisma } from '@/lib/db'

describe('logFieldCorrection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a correction record with correct params', async () => {
    vi.mocked(prisma.aIFieldCorrection.create).mockResolvedValue({
      id: 'corr-abc-123',
      extraction_id: 'extr-1',
      organization_id: 'org-1',
      field_name: 'company_name',
      ai_value: 'Test A/S' as never,
      user_value: 'Test ApS' as never,
      confidence: 0.87,
      schema_version: 'v1.0.0',
      prompt_version: 'v1.0.0',
      corrected_by: 'user-xyz',
      corrected_at: new Date(),
    })

    const id = await logFieldCorrection({
      extraction_id: 'extr-1',
      organization_id: 'org-1',
      field_name: 'company_name',
      ai_value: 'Test A/S',
      user_value: 'Test ApS',
      confidence: 0.87,
      schema_version: 'v1.0.0',
      prompt_version: 'v1.0.0',
      corrected_by: 'user-xyz',
    })

    expect(id).toBe('corr-abc-123')
    expect(prisma.aIFieldCorrection.create).toHaveBeenCalledTimes(1)
    expect(prisma.aIFieldCorrection.create).toHaveBeenCalledWith({
      data: {
        extraction_id: 'extr-1',
        organization_id: 'org-1',
        field_name: 'company_name',
        ai_value: 'Test A/S',
        user_value: 'Test ApS',
        confidence: 0.87,
        schema_version: 'v1.0.0',
        prompt_version: 'v1.0.0',
        corrected_by: 'user-xyz',
      },
    })
  })

  it('returns the generated correction id', async () => {
    vi.mocked(prisma.aIFieldCorrection.create).mockResolvedValue({
      id: 'corr-unique-id',
    } as never)

    const id = await logFieldCorrection({
      extraction_id: 'extr-2',
      organization_id: 'org-2',
      field_name: 'ownership_percentage',
      ai_value: 49,
      user_value: 51,
      confidence: 0.72,
      schema_version: 'v1.0.0',
      prompt_version: 'v1.0.0',
      corrected_by: 'user-abc',
    })

    expect(id).toBe('corr-unique-id')
  })

  it('handles null confidence and version fields', async () => {
    vi.mocked(prisma.aIFieldCorrection.create).mockResolvedValue({
      id: 'corr-null-fields',
    } as never)

    await logFieldCorrection({
      extraction_id: 'extr-3',
      organization_id: 'org-3',
      field_name: 'contract_date',
      ai_value: null,
      user_value: '2024-01-15',
      confidence: null,
      schema_version: null,
      prompt_version: null,
      corrected_by: 'user-def',
    })

    expect(prisma.aIFieldCorrection.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        confidence: null,
        schema_version: null,
        prompt_version: null,
        ai_value: null,
        user_value: '2024-01-15',
      }),
    })
  })

  it('handles complex object values (arrays, nested objects)', async () => {
    vi.mocked(prisma.aIFieldCorrection.create).mockResolvedValue({
      id: 'corr-complex',
    } as never)

    const aiValue = [{ name: 'Partner A', percentage: 30 }]
    const userValue = [
      { name: 'Partner A', percentage: 35 },
      { name: 'Partner B', percentage: 15 },
    ]

    await logFieldCorrection({
      extraction_id: 'extr-4',
      organization_id: 'org-4',
      field_name: 'ownership_structure',
      ai_value: aiValue,
      user_value: userValue,
      confidence: 0.55,
      schema_version: 'v1.0.0',
      prompt_version: 'v1.0.0',
      corrected_by: 'user-ghi',
    })

    expect(prisma.aIFieldCorrection.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ai_value: aiValue,
        user_value: userValue,
      }),
    })
  })

  it('propagates Prisma errors', async () => {
    vi.mocked(prisma.aIFieldCorrection.create).mockRejectedValue(
      new Error('Database connection lost')
    )

    await expect(
      logFieldCorrection({
        extraction_id: 'extr-5',
        organization_id: 'org-5',
        field_name: 'field',
        ai_value: 'old',
        user_value: 'new',
        confidence: 0.5,
        schema_version: 'v1.0.0',
        prompt_version: 'v1.0.0',
        corrected_by: 'user-jkl',
      })
    ).rejects.toThrow('Database connection lost')
  })
})
