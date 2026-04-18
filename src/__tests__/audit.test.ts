import { describe, it, expect, vi, beforeEach } from 'vitest'
import { recordAuditEvent } from '@/lib/audit'

vi.mock('@/lib/db', () => ({
  prisma: {
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: 'log-1' }),
    },
  },
}))

describe('recordAuditEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('writes audit entry with required fields', async () => {
    const { prisma } = await import('@/lib/db')
    await recordAuditEvent({
      organizationId: 'org-1',
      userId: 'user-1',
      action: 'UPDATE',
      resourceType: 'contract',
      resourceId: 'contract-1',
    })
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organization_id: 'org-1',
        user_id: 'user-1',
        action: 'UPDATE',
        resource_type: 'contract',
        resource_id: 'contract-1',
      }),
    })
  })

  it('includes sensitivity when provided', async () => {
    const { prisma } = await import('@/lib/db')
    await recordAuditEvent({
      organizationId: 'org-1',
      userId: 'user-1',
      action: 'CREATE',
      resourceType: 'contract',
      resourceId: 'contract-1',
      sensitivity: 'FORTROLIG',
    })
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ sensitivity: 'FORTROLIG' }),
    })
  })

  it('includes changes JSON when provided', async () => {
    const { prisma } = await import('@/lib/db')
    await recordAuditEvent({
      organizationId: 'org-1',
      userId: 'user-1',
      action: 'UPDATE',
      resourceType: 'case',
      resourceId: 'case-1',
      changes: { oldStatus: 'NY', newStatus: 'AKTIV' },
    })
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        changes: { oldStatus: 'NY', newStatus: 'AKTIV' },
      }),
    })
  })

  it('swallows DB errors silently (logs via captureError, does not throw)', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.auditLog.create).mockRejectedValueOnce(new Error('DB down'))
    await expect(
      recordAuditEvent({
        organizationId: 'org-1',
        userId: 'user-1',
        action: 'CREATE',
        resourceType: 'task',
        resourceId: 'task-1',
      })
    ).resolves.toBeUndefined()
  })
})
