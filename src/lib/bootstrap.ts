import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'

export type BootstrapInput = {
  orgName: string
  orgCvr?: string
  plan?: string
  adminEmail: string
  adminName: string
  adminPassword: string
}

export type BootstrapResult =
  | { created: true; organizationId: string; userId: string }
  | { created: false; reason: string }

// Minimal strukturel type for de Prisma-delegater vi bruger — gør logikken testbar
// uden en rigtig PrismaClient. CLI-runneren caster en ægte klient hertil.
export type BootstrapPrisma = {
  organization: {
    findFirst(args?: unknown): Promise<{ id: string } | null>
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>
  }
  user: {
    findFirst(args?: unknown): Promise<{ id: string } | null>
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>
  }
  userRoleAssignment: {
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>
  }
}

export async function bootstrapProd(
  prisma: BootstrapPrisma,
  input: BootstrapInput
): Promise<BootstrapResult> {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.adminEmail)) {
    throw new Error('Ugyldig admin-e-mail')
  }
  if (input.adminPassword.length < 8) {
    throw new Error('Admin-adgangskode skal være mindst 8 tegn')
  }

  // Sikkerhed: bootstrap kun en TOM database. Findes der allerede en organisation, afbryd
  // (nye kunder oprettes via self-service signup, ikke via dette script).
  const existing = await prisma.organization.findFirst()
  if (existing) {
    return {
      created: false,
      reason: 'Databasen indeholder allerede en organisation — bootstrap springes over',
    }
  }

  const organizationId = randomUUID()
  await prisma.organization.create({
    data: {
      id: organizationId,
      name: input.orgName,
      cvr: input.orgCvr,
      plan: input.plan ?? 'trial',
      chain_structure: true,
    },
  })

  const passwordHash = await bcrypt.hash(input.adminPassword, 10)
  const userId = randomUUID()
  await prisma.user.create({
    data: {
      id: userId,
      organization_id: organizationId,
      email: input.adminEmail,
      name: input.adminName,
      password_hash: passwordHash,
    },
  })

  await prisma.userRoleAssignment.create({
    data: {
      id: randomUUID(),
      organization_id: organizationId,
      user_id: userId,
      role: 'GROUP_OWNER',
      scope: 'ALL',
      company_ids: [],
      created_by: userId,
    },
  })

  return { created: true, organizationId, userId }
}
