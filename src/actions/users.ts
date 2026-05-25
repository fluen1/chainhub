'use server'

import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canAccessModule } from '@/lib/permissions'
import {
  createUserSchema,
  updateUserRoleSchema,
  inviteUserSchema,
  acceptInviteSchema,
  type CreateUserInput,
  type UpdateUserRoleInput,
  type InviteUserInput,
  type AcceptInviteInput,
} from '@/lib/validations/user'
import { sendInviteEmail } from '@/lib/email/resend'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/types/actions'
import type { User, UserRoleAssignment, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { captureError } from '@/lib/logger'
import { env } from '@/lib/env'

export type UserWithRoles = User & {
  roles: UserRoleAssignment[]
}

export async function getOrganizationUsers(): Promise<ActionResult<UserWithRoles[]>> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  const hasAccess = await canAccessModule(
    session.user.id,
    'user_management',
    session.user.organizationId
  )
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

  const hasAccess = await canAccessModule(
    session.user.id,
    'user_management',
    session.user.organizationId
  )
  if (!hasAccess) return { error: 'Du har ikke adgang til at oprette brugere' }

  const normalizedEmail = parsed.data.email.trim().toLowerCase()

  // Fremadrettet håndhæver vi global email-entydighed i app-laget.
  // Schemaet er stadig unik pr. organisation, men nye tvetydige logins på tværs af
  // tenants må ikke kunne opstå igen.
  const existing = await prisma.user.findFirst({
    where: {
      email: { equals: normalizedEmail, mode: 'insensitive' },
      deleted_at: null,
    },
    select: {
      id: true,
      organization_id: true,
    },
  })

  if (existing) {
    if (existing.organization_id === session.user.organizationId) {
      return { error: `En bruger med email ${normalizedEmail} findes allerede` }
    }

    return {
      error:
        'Emailen bruges allerede i en anden organisation. Brug en unik email eller flyt brugeren i stedet.',
    }
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
          email: normalizedEmail,
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
      extra: { email: normalizedEmail, role: parsed.data.role },
    })
    return { error: 'Brugeren kunne ikke oprettes — prøv igen' }
  }
}

export async function updateUserRole(input: UpdateUserRoleInput): Promise<ActionResult<void>> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  const parsed = updateUserRoleSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'Ugyldigt input'
    return { error: firstError }
  }

  const hasAccess = await canAccessModule(
    session.user.id,
    'user_management',
    session.user.organizationId
  )
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

// ─────────────────────────────────────────────────────────────────────────────
// Page-data queries (flyt Prisma-kald ud af page.tsx)
// ─────────────────────────────────────────────────────────────────────────────

export interface SettingsPageRawData {
  users: (User & { roles: UserRoleAssignment[] })[]
  companies: Array<{ id: string; name: string }>
  organization: {
    id: string
    name: string
    cvr: string | null
    plan: string | null
    plan_expires_at: Date | null
    chain_structure: boolean
    created_at: Date
  } | null
}

export async function getSettingsPageData(): Promise<SettingsPageRawData | null> {
  const session = await auth()
  if (!session) return null

  const hasAccess = await canAccessModule(
    session.user.id,
    'user_management',
    session.user.organizationId
  )
  if (!hasAccess) return null

  const [users, companies, organization] = await Promise.all([
    prisma.user.findMany({
      where: {
        organization_id: session.user.organizationId,
        deleted_at: null,
      },
      include: { roles: true },
      orderBy: { created_at: 'desc' },
    }),
    prisma.company.findMany({
      where: {
        organization_id: session.user.organizationId,
        deleted_at: null,
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: {
        id: true,
        name: true,
        cvr: true,
        plan: true,
        plan_expires_at: true,
        chain_structure: true,
        created_at: true,
      },
    }),
  ])

  return { users, companies, organization }
}

export async function toggleUserActive(userId: string): Promise<ActionResult<void>> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  const hasAccess = await canAccessModule(
    session.user.id,
    'user_management',
    session.user.organizationId
  )
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

export async function inviteUser(input: InviteUserInput): Promise<ActionResult<{ success: true }>> {
  const session = await auth()
  if (!session) return { error: 'Ikke autoriseret' }

  const parsed = inviteUserSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'Ugyldigt input'
    return { error: firstError }
  }

  const hasAccess = await canAccessModule(
    session.user.id,
    'user_management',
    session.user.organizationId
  )
  if (!hasAccess) return { error: 'Du har ikke adgang til at invitere brugere' }

  const normalizedEmail = parsed.data.email.trim().toLowerCase()

  // Tjek om brugeren allerede eksisterer i organisationen
  const existing = await prisma.user.findFirst({
    where: {
      email: { equals: normalizedEmail, mode: 'insensitive' },
      organization_id: session.user.organizationId,
      deleted_at: null,
    },
  })
  if (existing) {
    return { error: `En bruger med email ${normalizedEmail} er allerede medlem af organisationen` }
  }

  // Hent organisation og inviter-navn til email
  const [organization, inviter] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { name: true },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true },
    }),
  ])

  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 dage

  try {
    await prisma.inviteToken.create({
      data: {
        token,
        email: normalizedEmail,
        role: parsed.data.role,
        organization_id: session.user.organizationId,
        expires_at: expiresAt,
        created_by: session.user.id,
      },
    })

    const baseUrl = env.NEXTAUTH_URL ?? 'http://localhost:3000'
    const inviteUrl = `${baseUrl}/invite?token=${token}`
    const orgName = organization?.name ?? 'ChainHub'
    const inviterName = inviter?.name ?? session.user.name ?? 'En kollega'

    await sendInviteEmail(normalizedEmail, inviteUrl, orgName, inviterName)

    return { data: { success: true } }
  } catch (err) {
    captureError(err, {
      namespace: 'action:inviteUser',
      extra: { email: normalizedEmail, role: parsed.data.role },
    })
    return { error: 'Invitationen kunne ikke sendes — prøv igen' }
  }
}

// Gyldige roller — afspejler UserRole enum fra Prisma-schemaet
const userRoleValues = [
  'GROUP_OWNER',
  'GROUP_ADMIN',
  'GROUP_LEGAL',
  'GROUP_FINANCE',
  'GROUP_READONLY',
  'COMPANY_MANAGER',
  'COMPANY_LEGAL',
  'COMPANY_READONLY',
] as const

const userRoleSchema = z.enum(userRoleValues)

export async function acceptInvite(
  input: AcceptInviteInput
): Promise<ActionResult<{ email: string }>> {
  const parsed = acceptInviteSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'Ugyldigt input'
    return { error: firstError }
  }

  // Hurtig pre-check: eksisterer og er ikke udløbet (token-id hentes til brug i transaktionen)
  const preCheck = await prisma.inviteToken.findUnique({
    where: { token: parsed.data.token },
    select: {
      id: true,
      used_at: true,
      expires_at: true,
      email: true,
      role: true,
      organization_id: true,
      created_by: true,
    },
  })

  if (!preCheck) return { error: 'Invite-linket er ugyldigt' }
  if (preCheck.used_at) return { error: 'Invite-linket er allerede brugt' }
  if (preCheck.expires_at < new Date()) return { error: 'Invite-linket er udløbet' }

  // Bug 3: Validér role-værdien fra databasen (InviteToken.role er String, ikke enum)
  const parsedRole = userRoleSchema.safeParse(preCheck.role)
  if (!parsedRole.success) {
    return { error: 'Invitationen indeholder en ugyldig rolle — kontakt din administrator' }
  }
  const role: UserRole = parsedRole.data

  // Tjek om email allerede er i brug
  const existingUser = await prisma.user.findFirst({
    where: {
      email: { equals: preCheck.email, mode: 'insensitive' },
      deleted_at: null,
    },
  })
  if (existingUser) {
    return {
      error: 'Emailen er allerede registreret — log ind eller kontakt din administrator',
    }
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12)
  const isGroupRole = role.startsWith('GROUP_')
  const scope = isGroupRole ? 'ALL' : 'ASSIGNED'

  try {
    // Bug 2 (TOCTOU): Brug atomic updateMany med WHERE used_at IS NULL.
    // Hvis tokenet allerede er brugt parallel, returnerer count=0 og vi afbryder.
    const result = await prisma.$transaction(async (tx) => {
      // Atomisk markering — fejler stille hvis already used
      const claimed = await tx.inviteToken.updateMany({
        where: { id: preCheck.id, used_at: null },
        data: { used_at: new Date() },
      })

      if (claimed.count === 0) {
        // Tokenet blev brugt i en parallel request — afvis
        return null
      }

      const newUser = await tx.user.create({
        data: {
          organization_id: preCheck.organization_id,
          email: preCheck.email,
          name: parsed.data.name,
          password_hash: passwordHash,
        },
      })

      await tx.userRoleAssignment.create({
        data: {
          organization_id: preCheck.organization_id,
          user_id: newUser.id,
          role,
          scope,
          company_ids: [],
          created_by: preCheck.created_by,
        },
      })

      return preCheck.email
    })

    if (result === null) {
      return { error: 'Invite-linket er allerede brugt' }
    }

    return { data: { email: result } }
  } catch (err) {
    captureError(err, {
      namespace: 'action:acceptInvite',
      extra: { token: parsed.data.token },
    })
    return { error: 'Kontoen kunne ikke oprettes — prøv igen' }
  }
}
