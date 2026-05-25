import NextAuth, { type NextAuthOptions, type DefaultSession, getServerSession } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { checkLoginRateLimit } from '@/lib/auth/login-rate-limit'

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

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    organizationId: string
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const rateCheck = checkLoginRateLimit(credentials.email as string)
        if (!rateCheck.allowed) {
          const minutter = Math.ceil((rateCheck.retryAfterMs ?? 0) / 60000)
          throw new Error(
            `For mange loginforsøg — prøv igen om ${minutter} minut${minutter === 1 ? '' : 'ter'}`
          )
        }

        const normalizedEmail = credentials.email.trim().toLowerCase()

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
        if (!user.password_hash) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, user.password_hash)

        if (!isPasswordValid) {
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
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.organizationId = user.organizationId
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
}

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

export async function auth() {
  return getServerSession(authOptions)
}

export default NextAuth(authOptions)
