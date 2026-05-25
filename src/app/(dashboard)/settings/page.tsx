import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { canAccessModule } from '@/lib/permissions'
import { getUserRoleLabel, formatDate } from '@/lib/labels'
// formatDate bruges til organization.plan_expires_at + created_at nedenfor.
import { SettingsPageB, type SettingsUser } from './settings-b'
import { getSettingsAIUsage } from '@/actions/ai-usage'
import { getSettingsPageData } from '@/actions/users'

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

  const [rawData, aiUsage] = await Promise.all([
    getSettingsPageData(),
    getSettingsAIUsage(session.user.organizationId),
  ])

  const users = rawData?.users ?? []
  const companies = rawData?.companies ?? []
  const organization = rawData?.organization ?? null

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
