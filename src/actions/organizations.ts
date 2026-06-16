'use server'

import type { Organization } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { withActionLogging } from '@/lib/action-helpers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { captureError } from '@/lib/logger'
import { canAccessModule } from '@/lib/permissions'
import { checkActionRateLimit } from '@/lib/rate-limit'
import {
  updateOrganizationSchema,
  type UpdateOrganizationInput,
} from '@/lib/validations/organization'
import type { ActionResult } from '@/types/actions'

export async function updateOrganization(
  input: UpdateOrganizationInput
): Promise<ActionResult<Organization>> {
  return withActionLogging('updateOrganization', async () => {
    const session = await auth()
    if (!session) return { error: 'Ikke autoriseret' }

    const hasAccess = await canAccessModule(
      session.user.id,
      'settings',
      session.user.organizationId
    )
    if (!hasAccess) return { error: 'Ingen adgang til indstillinger' }

    const rl = await checkActionRateLimit(session.user.organizationId)
    if (rl.limited) return { error: 'For mange handlinger. Vent venligst.' }

    const parsed = updateOrganizationSchema.safeParse(input)
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? 'Ugyldigt input' }
    }

    try {
      const updated = await prisma.organization.update({
        where: { id: session.user.organizationId },
        data: {
          name: parsed.data.name,
          cvr: parsed.data.cvr === '' ? null : (parsed.data.cvr ?? null),
          chain_structure: parsed.data.chain_structure,
        },
      })

      revalidatePath('/settings')
      return { data: updated }
    } catch (err) {
      captureError(err, {
        namespace: 'action:updateOrganization',
        extra: { orgId: session.user.organizationId },
      })
      return { error: 'Organisation kunne ikke opdateres — prøv igen' }
    }
  })
}
