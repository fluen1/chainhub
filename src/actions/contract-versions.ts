'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canAccessCompany, canAccessSensitivity } from '@/lib/permissions'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/types/actions'
import type { ContractVersion } from '@prisma/client'

export async function createContractVersion(input: {
  contractId: string
  fileUrl: string
  fileName: string
  fileSizeBytes: number
  changeType: string
  changeNote?: string
}): Promise<ActionResult<ContractVersion>> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  // Find contract + verify access
  const contract = await prisma.contract.findFirst({
    where: {
      id: input.contractId,
      organization_id: session.user.organizationId,
      deleted_at: null,
    },
  })
  if (!contract) return { error: 'Kontrakt ikke fundet' }

  const hasCompanyAccess = await canAccessCompany(session.user.id, contract.company_id)
  if (!hasCompanyAccess) return { error: 'Ingen adgang til dette selskab' }

  const hasSensitivity = await canAccessSensitivity(session.user.id, contract.sensitivity)
  if (!hasSensitivity) return { error: 'Ingen adgang til denne kontrakt' }

  // Get next version number
  const latestVersion = await prisma.contractVersion.findFirst({
    where: {
      contract_id: input.contractId,
      organization_id: session.user.organizationId,
    },
    orderBy: { version_number: 'desc' },
  })
  const nextVersionNumber = (latestVersion?.version_number ?? 0) + 1

  // Create new version and mark as current (unmark old current)
  try {
    const version = await prisma.$transaction(async (tx) => {
      // Unmark previous current version
      await tx.contractVersion.updateMany({
        where: { contract_id: input.contractId, is_current: true },
        data: { is_current: false },
      })

      // Create new version
      return tx.contractVersion.create({
        data: {
          organization_id: session.user.organizationId,
          contract_id: input.contractId,
          version_number: nextVersionNumber,
          file_url: input.fileUrl,
          file_name: input.fileName,
          file_size_bytes: input.fileSizeBytes,
          is_current: true,
          change_type: input.changeType as never,
          change_note: input.changeNote || null,
          uploaded_by: session.user.id,
        },
      })
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        organization_id: session.user.organizationId,
        user_id: session.user.id,
        action: 'CREATE',
        resource_type: 'contract_version',
        resource_id: version.id,
        changes: {
          contractId: input.contractId,
          versionNumber: nextVersionNumber,
          changeType: input.changeType,
        },
      },
    })

    revalidatePath(`/contracts/${input.contractId}`)
    return { data: version }
  } catch {
    return { error: 'Versionen kunne ikke oprettes — prøv igen' }
  }
}
