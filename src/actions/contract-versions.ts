'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canAccessCompany, canAccessSensitivity } from '@/lib/permissions'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { ActionResult } from '@/types/actions'
import type { ContractVersion } from '@prisma/client'
import { captureError } from '@/lib/logger'
import { zodChangeType } from '@/lib/zod-enums'

const createContractVersionSchema = z.object({
  contractId: z.string().min(1),
  fileUrl: z.string().min(1),
  fileName: z.string().min(1),
  fileSizeBytes: z.number().int().nonnegative(),
  changeType: zodChangeType,
  changeNote: z.string().optional(),
})

type CreateContractVersionInput = z.infer<typeof createContractVersionSchema>

export async function createContractVersion(
  input: CreateContractVersionInput
): Promise<ActionResult<ContractVersion>> {
  const parsed = createContractVersionSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Ugyldigt input' }
  const data = parsed.data
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  // Find contract + verify access
  const contract = await prisma.contract.findFirst({
    where: {
      id: data.contractId,
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
      contract_id: data.contractId,
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
        where: { contract_id: data.contractId, is_current: true },
        data: { is_current: false },
      })

      // Create new version
      return tx.contractVersion.create({
        data: {
          organization_id: session.user.organizationId,
          contract_id: data.contractId,
          version_number: nextVersionNumber,
          file_url: data.fileUrl,
          file_name: data.fileName,
          file_size_bytes: data.fileSizeBytes,
          is_current: true,
          change_type: data.changeType,
          change_note: data.changeNote || null,
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
          contractId: data.contractId,
          versionNumber: nextVersionNumber,
          changeType: data.changeType,
        },
      },
    })

    revalidatePath(`/contracts/${data.contractId}`)
    return { data: version }
  } catch (err) {
    captureError(err, {
      namespace: 'action:createContractVersion',
      extra: { contractId: data.contractId, changeType: data.changeType },
    })
    return { error: 'Versionen kunne ikke oprettes — prøv igen' }
  }
}
