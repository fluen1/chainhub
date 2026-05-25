import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { canAccessModule } from '@/lib/permissions'
import { getUserRoleLabel, formatDate } from '@/lib/labels'
// formatDate bruges til organization.plan_expires_at + created_at nedenfor.
import { SettingsPageB, type SettingsUser } from './settings-b'
import { getSettingsAIUsage } from '@/actions/ai-usage'

export const metadata: Metadata = { title: 'Indstillinger' }

interface SettingsPageProps {
  searchParams: Promise<{ section?: string }>
}

const VALID_SECTIONS = ['org', 'brugere', 'ai', 'notif', 'integr', 'sikkerhed', 'faktura'] as const
type SectionKey = (typeof VALID_SECTIONS)[number]

function parseSection(s: string | undefined): SectionKey {
  if (s && (VALID_SECTIONS as readonly string[]).includes(s)) return s as SectionKey
  return 'org'
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const sp = await searchParams
  const session = await auth()
  if (!session) redirect('/login')

  const section = parseSection(sp.section)

  const hasAccess = await canAccessModule(
    session.user.id,
    'user_management',
    session.user.organizationId
  )

  if (!hasAccess) {
    return (
      <SettingsPageB
        section={section}
        canManage={false}
        organization={null}
        companies={[]}
        users={[]}
        currentUserId={session.user.id}
        aiUsage={{ used: 0, max: 1000, percent: 0 }}
      />
    )
  }

  const [users, companies, organization, aiUsage] = await Promise.all([
    prisma.user.findMany({
      where: {
        organization_id: session.user.organizationId,
        deleted_at: null,
      },
      include: { roles: true },
      orderBy: { created_at: 'desc' },
      // last_login_at hentes til "sidst aktiv"-kolonnen i BrugereSection
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
    getSettingsAIUsage(session.user.organizationId),
  ])

  // Mappede brugere — initialer + primær rolle-label
  const mappedUsers: SettingsUser[] = users.map((u) => {
    const primary = u.roles[0]
    const ini = (u.name ?? u.email ?? '?')
      .split(' ')
      .map((p) => p[0] ?? '')
      .join('')
      .slice(0, 2)
      .toUpperCase()

    const lastLogin = u.last_login_at
    const sidstAktiv = lastLogin ? formatDate(lastLogin) : 'Aldrig'

    return {
      id: u.id,
      navn: u.name ?? u.email,
      email: u.email,
      initials: ini || '?',
      rolle: primary?.role ?? 'GROUP_READONLY',
      rolleLabel: primary ? getUserRoleLabel(primary.role) : 'Ukendt',
      sidstAktiv,
      isSelf: u.id === session.user.id,
      active: u.active,
      companyIds: primary?.company_ids ?? [],
    }
  })

  return (
    <SettingsPageB
      section={section}
      canManage={true}
      organization={
        organization
          ? {
              id: organization.id,
              name: organization.name,
              cvr: organization.cvr,
              plan: organization.plan ?? 'Free',
              planExpiresAt: organization.plan_expires_at
                ? formatDate(organization.plan_expires_at)
                : null,
              chainStructure: organization.chain_structure,
              createdAt: formatDate(organization.created_at),
            }
          : null
      }
      companies={companies}
      users={mappedUsers}
      currentUserId={session.user.id}
      aiUsage={aiUsage}
    />
  )
}
