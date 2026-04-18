'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canAccessModule } from '@/lib/permissions'
import {
  updateOrganizationSchema,
  type UpdateOrganizationInput,
} from '@/lib/validations/organization'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/types/actions'
import type { Organization } from '@prisma/client'

export async function updateOrganization(
  input: UpdateOrganizationInput
): Promise<ActionResult<Organization>> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  const hasAccess = await canAccessModule(session.user.id, 'settings')
  if (!hasAccess) return { error: 'Ingen adgang til indstillinger' }

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
  } catch {
    return { error: 'Organisation kunne ikke opdateres — prøv igen' }
  }
}
