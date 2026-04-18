'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canAccessModule } from '@/lib/permissions'
import {
  createUserSchema,
  updateUserRoleSchema,
  type CreateUserInput,
  type UpdateUserRoleInput,
} from '@/lib/validations/user'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/types/actions'
import type { User, UserRoleAssignment } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { captureError } from '@/lib/logger'

export type UserWithRoles = User & {
  roles: UserRoleAssignment[]
}

export async function getOrganizationUsers(): Promise<ActionResult<UserWithRoles[]>> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  const hasAccess = await canAccessModule(session.user.id, 'user_management')
  if (!hasAccess) return { error: 'Du har ikke adgang til brugerstyring' }

  try {
    const users = await prisma.user.findMany({
      where: {
        organization_id: session.user.organizationId,
        deleted_at: null,
      },
      include: {
        roles: true,
      },
      orderBy: { created_at: 'desc' },
    })

    return { data: users }
  } catch (err) {
    captureError(err, { namespace: 'action:getOrganizationUsers' })
    return { error: 'Kunne ikke hente brugere — prøv igen' }
  }
}

export async function createUser(input: CreateUserInput): Promise<ActionResult<User>> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  const parsed = createUserSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'Ugyldigt input'
    return { error: firstError }
  }

  const hasAccess = await canAccessModule(session.user.id, 'user_management')
  if (!hasAccess) return { error: 'Du har ikke adgang til at oprette brugere' }

  // Check for duplicate email in organization
  const existing = await prisma.user.findFirst({
    where: {
      organization_id: session.user.organizationId,
      email: parsed.data.email,
      deleted_at: null,
    },
  })
  if (existing) {
    return { error: `En bruger med email ${parsed.data.email} findes allerede` }
  }

  const isGroupRole = parsed.data.role.startsWith('GROUP_')
  const scope = isGroupRole ? 'ALL' : 'ASSIGNED'
  const companyIds = isGroupRole ? [] : parsed.data.companyIds

  try {
    const passwordHash = await bcrypt.hash(parsed.data.password, 12)

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          organization_id: session.user.organizationId,
          email: parsed.data.email,
          name: parsed.data.name,
          password_hash: passwordHash,
        },
      })

      await tx.userRoleAssignment.create({
        data: {
          organization_id: session.user.organizationId,
          user_id: newUser.id,
          role: parsed.data.role,
          scope,
          company_ids: companyIds,
          created_by: session.user.id,
        },
      })

      return newUser
    })

    revalidatePath('/settings')
    return { data: user }
  } catch (err) {
    captureError(err, {
      namespace: 'action:createUser',
      extra: { email: parsed.data.email, role: parsed.data.role },
    })
    return { error: 'Brugeren kunne ikke oprettes — prøv igen' }
  }
}

export async function updateUserRole(input: UpdateUserRoleInput): Promise<ActionResult<void>> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  const parsed = updateUserRoleSchema.safeParse(input)
  if (!parsed.success) {
    console.error(
      'updateUserRole validation error:',
      JSON.stringify(parsed.error.issues),
      'input:',
      JSON.stringify(input)
    )
    return { error: 'Ugyldigt input' }
  }

  const hasAccess = await canAccessModule(session.user.id, 'user_management')
  if (!hasAccess) return { error: 'Du har ikke adgang til at ændre brugerroller' }

  // Verify user belongs to organization
  const targetUser = await prisma.user.findFirst({
    where: {
      id: parsed.data.userId,
      organization_id: session.user.organizationId,
      deleted_at: null,
    },
  })
  if (!targetUser) return { error: 'Bruger ikke fundet' }

  const isGroupRole = parsed.data.role.startsWith('GROUP_')
  const scope = isGroupRole ? 'ALL' : 'ASSIGNED'
  const companyIds = isGroupRole ? [] : parsed.data.companyIds

  try {
    await prisma.$transaction(async (tx) => {
      // Delete existing role assignments for this user
      await tx.userRoleAssignment.deleteMany({
        where: {
          user_id: parsed.data.userId,
          organization_id: session.user.organizationId,
        },
      })

      // Create new assignment
      await tx.userRoleAssignment.create({
        data: {
          organization_id: session.user.organizationId,
          user_id: parsed.data.userId,
          role: parsed.data.role,
          scope,
          company_ids: companyIds,
          created_by: session.user.id,
        },
      })
    })

    revalidatePath('/settings')
    return { data: undefined }
  } catch (err) {
    captureError(err, {
      namespace: 'action:updateUserRole',
      extra: { userId: parsed.data.userId, role: parsed.data.role },
    })
    return { error: 'Rollen kunne ikke opdateres — prøv igen' }
  }
}

export async function toggleUserActive(userId: string): Promise<ActionResult<void>> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  const hasAccess = await canAccessModule(session.user.id, 'user_management')
  if (!hasAccess) return { error: 'Du har ikke adgang til at ændre brugerstatus' }

  // Cannot deactivate yourself
  if (userId === session.user.id) {
    return { error: 'Du kan ikke deaktivere dig selv' }
  }

  const targetUser = await prisma.user.findFirst({
    where: {
      id: userId,
      organization_id: session.user.organizationId,
      deleted_at: null,
    },
    include: { roles: true },
  })

  if (!targetUser) return { error: 'Bruger ikke fundet' }

  // Cannot deactivate last GROUP_OWNER
  if (targetUser.active) {
    const isOwner = targetUser.roles.some((r) => r.role === 'GROUP_OWNER')
    if (isOwner) {
      const otherOwners = await prisma.user.count({
        where: {
          organization_id: session.user.organizationId,
          deleted_at: null,
          active: true,
          id: { not: userId },
          roles: {
            some: { role: 'GROUP_OWNER' },
          },
        },
      })
      if (otherOwners === 0) {
        return { error: 'Du kan ikke deaktivere den sidste kædeejer' }
      }
    }
  }

  try {
    await prisma.user.update({
      where: {
        id: userId,
        organization_id: session.user.organizationId,
      },
      data: { active: !targetUser.active },
    })

    revalidatePath('/settings')
    return { data: undefined }
  } catch (err) {
    captureError(err, {
      namespace: 'action:toggleUserActive',
      extra: { userId },
    })
    return { error: 'Brugerstatus kunne ikke ændres — prøv igen' }
  }
}
