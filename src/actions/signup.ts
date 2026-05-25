'use server'

import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { captureError } from '@/lib/logger'
import type { ActionResult } from '@/types/actions'

// ────────────────────────────────────────────────────────────────────────────
// Zod schemas
// ────────────────────────────────────────────────────────────────────────────

const createAccountSchema = z.object({
  name: z.string().min(2, 'Navn skal være mindst 2 tegn'),
  email: z.string().email('Ugyldig e-mailadresse'),
  password: z.string().min(8, 'Adgangskoden skal være mindst 8 tegn'),
})

const updateOrganizationOnboardingSchema = z.object({
  organizationId: z.string().uuid('Ugyldigt organisations-ID'),
  name: z.string().min(1, 'Organisationsnavn er påkrævet'),
  industry: z.string().optional(),
  estimatedLocations: z.string().optional(),
})

export type CreateAccountInput = z.infer<typeof createAccountSchema>
export type UpdateOrganizationOnboardingInput = z.infer<typeof updateOrganizationOnboardingSchema>

// ────────────────────────────────────────────────────────────────────────────
// createAccount — opretter org + user + rolle i én transaktion
// ────────────────────────────────────────────────────────────────────────────

export async function createAccount(
  input: CreateAccountInput
): Promise<ActionResult<{ userId: string; organizationId: string }>> {
  const parsed = createAccountSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]
    return { error: firstError?.message ?? 'Ugyldig input' }
  }

  const { name, email, password } = parsed.data

  try {
    // Tjek om e-mail allerede er i brug
    const existing = await prisma.user.findFirst({
      where: { email, deleted_at: null },
    })
    if (existing) {
      return { error: 'En konto med denne e-mail findes allerede' }
    }

    const passwordHash = await bcrypt.hash(password, 12)

    // Udled organisationsnavn fra efternavn
    const nameParts = name.trim().split(/\s+/)
    const lastName = nameParts[nameParts.length - 1] ?? nameParts[0] ?? name
    const orgName = `${lastName} Holding`

    const planExpiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

    const result = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: orgName,
          plan: 'trial',
          plan_expires_at: planExpiresAt,
        },
      })

      const user = await tx.user.create({
        data: {
          organization_id: org.id,
          name,
          email,
          password_hash: passwordHash,
          active: true,
        },
      })

      await tx.userRoleAssignment.create({
        data: {
          organization_id: org.id,
          user_id: user.id,
          role: 'GROUP_OWNER',
          scope: 'ALL',
          company_ids: [],
          created_by: user.id,
        },
      })

      return { userId: user.id, organizationId: org.id }
    })

    return { data: result }
  } catch (err) {
    captureError(err, { namespace: 'actions:signup', extra: { email } })
    return { error: 'Der opstod en fejl. Prøv igen eller kontakt support.' }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// updateOrganizationOnboarding — opdaterer org med onboarding-info
// ────────────────────────────────────────────────────────────────────────────

export async function updateOrganizationOnboarding(
  input: UpdateOrganizationOnboardingInput
): Promise<ActionResult<{ success: true }>> {
  const parsed = updateOrganizationOnboardingSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]
    return { error: firstError?.message ?? 'Ugyldig input' }
  }

  const { organizationId, name, industry, estimatedLocations } = parsed.data

  try {
    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        name,
        ...(industry !== undefined ? { industry } : {}),
        ...(estimatedLocations !== undefined ? { estimated_locations: estimatedLocations } : {}),
      },
    })

    return { data: { success: true } }
  } catch (err) {
    captureError(err, { namespace: 'actions:signup', extra: { organizationId } })
    return { error: 'Kunne ikke gemme organisationsoplysninger. Prøv igen.' }
  }
}
