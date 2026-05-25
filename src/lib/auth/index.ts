import NextAuth, { type DefaultSession } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { isLoginRateLimited, recordFailedLoginAttempt } from '@/lib/auth/login-rate-limit'

declare module 'next-auth' {
  interface Session extends DefaultSession {
    user: {
      id: string
      organizationId: string
      email: string
      name: string
    } & DefaultSession['user']
  }
  interface User {
    organizationId: string
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    id: string
    organizationId: string
  }
}

const {
  handlers,
  auth: _auth,
  signIn,
  signOut,
} = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const email = credentials.email as string
        const password = credentials.password as string
        const normalizedEmail = email.trim().toLowerCase()

        const rateCheck = await isLoginRateLimited(normalizedEmail)
        if (rateCheck.limited) {
          const minutter = Math.ceil((rateCheck.retryAfterMs ?? 0) / 60000)
          throw new Error(
            `For mange loginforsøg — prøv igen om ${minutter} minut${minutter === 1 ? '' : 'ter'}`
          )
        }

        // Defensive auth-guard:
        // Email er kun unik pr. organisation i schemaet, så vi må ikke logge ind på
        // "første match" hvis samme email findes i flere tenants. I så fald afvises
        // login deterministisk indtil email er gjort entydig i data.
        const matchingUsers = await prisma.user.findMany({
          where: {
            email: { equals: normalizedEmail, mode: 'insensitive' },
            deleted_at: null,
            active: true,
          },
          select: {
            id: true,
            email: true,
            name: true,
            password_hash: true,
            organization_id: true,
          },
          take: 2,
        })

        if (matchingUsers.length !== 1) {
          return null
        }

        const user = matchingUsers[0]
        if (!user || !user.password_hash) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(password, user.password_hash)

        if (!isPasswordValid) {
          await recordFailedLoginAttempt(normalizedEmail)
          return null
        }

        // Opdater last_login_at — fail-silent, må ikke blokere login
        try {
          await prisma.user.update({
            where: { id: user.id },
            data: { last_login_at: new Date() },
          })
        } catch {
          // Non-fatal: logtabellen er ikke kritisk for autentifikationsflowet
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          organizationId: user.organization_id,
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'credentials') return true
      if (!user.email) return false

      const normalizedEmail = user.email.trim().toLowerCase()

      const matchingUsers = await prisma.user.findMany({
        where: {
          email: { equals: normalizedEmail, mode: 'insensitive' },
          deleted_at: null,
          active: true,
        },
        take: 2,
      })

      if (matchingUsers.length > 1) return false

      if (matchingUsers.length === 1) {
        const existingUser = matchingUsers[0]!
        try {
          await prisma.user.update({
            where: { id: existingUser.id },
            data: { last_login_at: new Date() },
          })
        } catch {
          // Non-fatal
        }
        return true
      }

      const nameParts = (user.name ?? normalizedEmail.split('@')[0] ?? 'Bruger').trim().split(/\s+/)
      const lastName = nameParts[nameParts.length - 1] ?? nameParts[0]
      const orgName = `${lastName} Holding`
      const planExpiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

      await prisma.$transaction(async (tx) => {
        const org = await tx.organization.create({
          data: { name: orgName, plan: 'trial', plan_expires_at: planExpiresAt },
        })

        const newUser = await tx.user.create({
          data: {
            organization_id: org.id,
            name: user.name ?? normalizedEmail.split('@')[0] ?? 'Bruger',
            email: normalizedEmail,
            avatar_url: (user as { image?: string | null }).image ?? null,
            active: true,
            last_login_at: new Date(),
          },
        })

        await tx.userRoleAssignment.create({
          data: {
            organization_id: org.id,
            user_id: newUser.id,
            role: 'GROUP_OWNER',
            scope: 'ALL',
            company_ids: [],
            created_by: newUser.id,
          },
        })

        user.id = newUser.id
      })

      return '/signup/organization'
    },
    async jwt({ token, user, account }) {
      if (user) {
        if (account?.provider === 'credentials') {
          token.id = user.id!
          token.organizationId = user.organizationId
        } else {
          const dbUser = await prisma.user.findFirst({
            where: {
              email: { equals: token.email ?? '', mode: 'insensitive' },
              deleted_at: null,
              active: true,
            },
            select: { id: true, organization_id: true },
          })
          if (dbUser) {
            token.id = dbUser.id
            token.organizationId = dbUser.organization_id
          }
        }
      }
      return token
    },
    async session({ session, token }) {
      session.user.id = token.id
      session.user.organizationId = token.organizationId
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 hours
  },
})

// Eksportér handlers og signIn/signOut til brug i route-handler og klient-komponenter
export { handlers, signIn, signOut }

import type { Session } from 'next-auth'

// auth() — server-side session getter med simpel type.
// Typed kun som () => Promise<Session | null> (ikke middleware-overloaden)
// så test-mocks kan bruge vi.mocked(auth).mockResolvedValue(null) uden type-fejl.
export const auth: () => Promise<Session | null> = _auth as () => Promise<Session | null>

// authMiddleware — den fuldt-typede NextAuth auth-funktion til brug i proxy.ts.
// Har middleware-overloaden og må IKKE bruges i action-filer eller tests.
export const authMiddleware = _auth

// Development-mode NEXTAUTH_URL mismatch-detektion.
// Logges som warning (ikke fejl) så dev-serveren stadig starter uden forhindringer.
// Prodution: `process.env.NODE_ENV !== 'development'` giver no-op.
export function warnNextauthUrlMismatch(requestOrigin: string): void {
  if (process.env.NODE_ENV !== 'development') return
  const configured = process.env.NEXTAUTH_URL
  if (!configured) return
  try {
    const configuredOrigin = new URL(configured).origin
    if (configuredOrigin !== requestOrigin) {
      console.warn(
        `[ChainHub auth] NEXTAUTH_URL mismatch: env=${configured}, request=${requestOrigin}\n` +
          `  → Opdater NEXTAUTH_URL i .env.local til den faktiske dev-port. Se docs/DEVELOPER.md#port-konflikter`
      )
    }
  } catch {
    // Ugyldig URL i NEXTAUTH_URL — lad NextAuth selv håndtere fejlen
  }
}
