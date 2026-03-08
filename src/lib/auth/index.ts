import { getServerSession } from 'next-auth'
import { authOptions } from './config'

export { authOptions } from './config'

export async function auth() {
  return getServerSession(authOptions)
}

export async function requireAuth() {
  const session = await auth()
  
  if (!session?.user) {
    throw new Error('Ikke autoriseret')
  }
  
  return session
}

export async function getCurrentUser() {
  const session = await auth()
  return session?.user ?? null
}

export async function getCurrentUserId(): Promise<string | null> {
  const session = await auth()
  return session?.user?.id ?? null
}

export async function getCurrentOrganizationId(): Promise<string | null> {
  const session = await auth()
  return session?.user?.organizationId ?? null
}