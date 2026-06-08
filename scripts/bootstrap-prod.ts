import { PrismaClient } from '@prisma/client'
import { bootstrapProd, type BootstrapInput, type BootstrapPrisma } from '../src/lib/bootstrap'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Mangler env-var ${name}`)
  return value
}

async function main() {
  const input: BootstrapInput = {
    orgName: requireEnv('BOOTSTRAP_ORG_NAME'),
    orgCvr: process.env.BOOTSTRAP_ORG_CVR,
    plan: process.env.BOOTSTRAP_PLAN,
    adminEmail: requireEnv('BOOTSTRAP_ADMIN_EMAIL'),
    adminName: requireEnv('BOOTSTRAP_ADMIN_NAME'),
    adminPassword: requireEnv('BOOTSTRAP_ADMIN_PASSWORD'),
  }

  const prisma = new PrismaClient()
  try {
    // PrismaClient er strukturelt kompatibel med BootstrapPrisma; cast ved seam'en.
    const result = await bootstrapProd(prisma as unknown as BootstrapPrisma, input)
    if (result.created) {
      console.log(
        `✓ Bootstrap fuldført — organisation ${result.organizationId}, admin ${input.adminEmail} (GROUP_OWNER).`
      )
    } else {
      console.log(`⊘ ${result.reason}`)
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error('Bootstrap fejlede:', error)
  process.exit(1)
})
